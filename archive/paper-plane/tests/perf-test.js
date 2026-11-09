/**
 * Mobile Performance Testing Suite
 *
 * Measures frame timing under simulated mobile conditions (iPhone 14, 4x CPU throttle)
 * across four scenarios: baseline scroll, plane idle, plane firing, and post-scroll reform.
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   node tests/perf-test.js
 *
 * Output: JSON to stdout
 */

const { chromium } = require('playwright');

// --- Constants & Config ---

const BASE_URL = 'http://localhost:8080';
const VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE_FACTOR = 3;
const CPU_THROTTLE_RATE = 4;
const SCROLL_DURATION_MS = 5000;
const REFORM_IDLE_MS = 3000;
const FIRING_DURATION_MS = 5000;
const DROPPED_FRAME_THRESHOLD_MS = 20;

const CDP_METRICS_OF_INTEREST = [
  'LayoutCount',
  'RecalcStyleCount',
  'ScriptDuration',
  'LayoutDuration',
  'TaskDuration',
];

// --- Helpers: Frame Timing ---

async function injectFrameCollector(page) {
  await page.evaluate(() => {
    window.__perfFrames = [];
    window.__perfRunning = true;
    let lastTime = 0;
    function collect(timestamp) {
      if (!window.__perfRunning) return;
      if (lastTime > 0) {
        window.__perfFrames.push({
          timestamp: timestamp,
          delta: timestamp - lastTime,
        });
      }
      lastTime = timestamp;
      requestAnimationFrame(collect);
    }
    requestAnimationFrame(collect);
  });
}

async function collectFrames(page) {
  return await page.evaluate(() => {
    window.__perfRunning = false;
    return window.__perfFrames;
  });
}

function computeFrameStats(frames) {
  if (frames.length === 0) {
    return { totalFrames: 0, droppedFrames: 0, avgFrameMs: 0, p95FrameMs: 0, maxFrameMs: 0 };
  }

  const deltas = frames.map((f) => f.delta);
  const sorted = [...deltas].sort((a, b) => a - b);
  const totalFrames = deltas.length;
  const droppedFrames = deltas.filter((d) => d > DROPPED_FRAME_THRESHOLD_MS).length;
  const avgFrameMs = Math.round((deltas.reduce((s, d) => s + d, 0) / totalFrames) * 100) / 100;
  const p95Index = Math.floor(totalFrames * 0.95);
  const p95FrameMs = Math.round(sorted[p95Index] * 100) / 100;
  const maxFrameMs = Math.round(sorted[sorted.length - 1] * 100) / 100;

  return { totalFrames, droppedFrames, avgFrameMs, p95FrameMs, maxFrameMs };
}

// --- Helpers: CDP Metrics ---

async function getCdpMetrics(cdpSession) {
  await cdpSession.send('Performance.enable');
  const result = await cdpSession.send('Performance.getMetrics');
  const map = {};
  for (const m of result.metrics) {
    map[m.name] = m.value;
  }
  return map;
}

function diffMetrics(before, after) {
  const diff = {};
  for (const key of CDP_METRICS_OF_INTEREST) {
    let val = (after[key] || 0) - (before[key] || 0);
    // Convert durations from seconds to ms
    if (key.endsWith('Duration')) {
      val = Math.round(val * 1000 * 100) / 100;
      diff[key.replace('Duration', 'DurationMs')] = val;
    } else {
      diff[key] = Math.round(val);
    }
  }
  return diff;
}

// --- Helper: Programmatic Scroll ---

async function programmaticScroll(page, durationMs) {
  await page.evaluate((duration) => {
    return new Promise((resolve) => {
      const totalDistance = document.documentElement.scrollHeight - window.innerHeight;
      const startTime = performance.now();
      const startScroll = window.scrollY;

      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease in-out for smoother scroll
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        window.scrollTo(0, startScroll + totalDistance * eased);
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }, durationMs);
}

// --- Helper: Override Reveal Visibility ---

async function overrideRevealVisibility(page) {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'perf-test-reveal-override';
    style.textContent = '.reveal { opacity: 1 !important; transform: none !important; }';
    document.head.appendChild(style);
  });
}

// --- Helper: Wait for Page Ready ---

async function waitForPageReady(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Wait for GSAP
  await page.waitForFunction(() => typeof gsap !== 'undefined', { timeout: 15000 });

  // Wait for TextDestruction
  await page.waitForFunction(() => window.TextDestruction, { timeout: 15000 });

  // Wait for plane toggle button (created dynamically by plane.js)
  await page.waitForSelector('.plane-toggle', { timeout: 15000 });

  // Override reveal visibility so text is visible for destruction testing
  await overrideRevealVisibility(page);

  // Allow a brief settle
  await page.waitForTimeout(500);
}

// --- Helper: Activate Plane Mode ---

async function activatePlaneMode(page) {
  // Click the plane toggle button
  await page.click('.plane-toggle');

  // Wait for plane-active class
  await page.waitForFunction(
    () => document.documentElement.classList.contains('plane-active'),
    { timeout: 10000 }
  );

  // Wait for Three.js canvas to exist
  await page.waitForSelector('#plane-canvas canvas', { timeout: 15000 });

  // Buffer for GLB model load
  await page.waitForTimeout(2000);
}

// --- Helper: Run Scenario ---

async function runScenario(name, page, cdpSession, scenarioFn) {
  process.stderr.write(`  Running scenario: ${name}...\n`);

  const metricsBefore = await getCdpMetrics(cdpSession);
  await injectFrameCollector(page);

  await scenarioFn();

  const frames = await collectFrames(page);
  const metricsAfter = await getCdpMetrics(cdpSession);

  const frameStats = computeFrameStats(frames);
  const cdpDiff = diffMetrics(metricsBefore, metricsAfter);

  return { ...frameStats, ...cdpDiff };
}

// --- Scenario Functions ---

async function scenarioBaselineScroll(page) {
  // Scroll top to bottom with plane OFF
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await programmaticScroll(page, SCROLL_DURATION_MS);
}

async function scenarioPlaneIdleScroll(page) {
  // Plane is already active; scroll without firing
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await programmaticScroll(page, SCROLL_DURATION_MS);
}

async function scenarioPlaneFireScroll(page) {
  // Mouse down on plane's screen position to start firing
  const centerX = VIEWPORT.width / 2;
  const startY = Math.floor(VIEWPORT.height * 0.66);

  await page.mouse.move(centerX, startY);
  await page.mouse.down();
  await page.waitForTimeout(200);

  // Oscillate mouse x in a sine wave while gradually moving y down
  // This sweeps the plane across text and triggers auto-scroll
  const steps = 50;
  const stepDelay = FIRING_DURATION_MS / steps;
  const targetY = Math.floor(VIEWPORT.height * 0.75);

  for (let i = 0; i < steps; i++) {
    const progress = i / steps;
    const xOffset = Math.sin(progress * Math.PI * 4) * 80;
    const currentX = centerX + xOffset;
    const currentY = startY + (targetY - startY) * progress;
    await page.mouse.move(currentX, currentY);
    await page.waitForTimeout(stepDelay);
  }
}

async function scenarioPostScrollReform(page) {
  // Release mouse to stop firing
  await page.mouse.up();

  // Idle while reform animations play
  await page.waitForTimeout(REFORM_IDLE_MS);
}

// --- Analysis ---

function buildAnalysis(results) {
  const baseline = results.baseline_scroll;
  const planeIdle = results.plane_idle_scroll;
  const planeFiring = results.plane_firing_scroll;
  const postReform = results.post_scroll_reform;

  const baselineOk = baseline.avgFrameMs < 25;
  const planeOverheadMs =
    Math.round((planeIdle.avgFrameMs - baseline.avgFrameMs) * 100) / 100;
  const firingOverheadMs =
    Math.round((planeFiring.avgFrameMs - planeIdle.avgFrameMs) * 100) / 100;

  // Find worst offender by p95
  const scenarios = {
    baseline_scroll: baseline,
    plane_idle_scroll: planeIdle,
    plane_firing_scroll: planeFiring,
    post_scroll_reform: postReform,
  };
  let worstOffender = 'baseline_scroll';
  let worstP95 = 0;
  for (const [name, data] of Object.entries(scenarios)) {
    if (data.p95FrameMs > worstP95) {
      worstP95 = data.p95FrameMs;
      worstOffender = name;
    }
  }

  // Determine likely bottleneck
  let likelyBottleneck;
  const baselineLayout = baseline.LayoutCount || 0;
  const firingLayout = planeFiring.LayoutCount || 0;
  const baselineScript = baseline.ScriptDurationMs || 0;
  const firingScript = planeFiring.ScriptDurationMs || 0;

  if (baselineLayout > 0 && firingLayout / baselineLayout > 10) {
    likelyBottleneck =
      'layout thrashing in destruction.js hit detection (LayoutCount ' +
      firingLayout + ' vs ' + baselineLayout + ' baseline)';
  } else if (baselineScript > 0 && firingScript / baselineScript > 3) {
    likelyBottleneck = 'GSAP animation overhead (ScriptDuration ' +
      firingScript + 'ms vs ' + baselineScript + 'ms baseline)';
  } else {
    likelyBottleneck = 'GPU-bound (Three.js at ' + DEVICE_SCALE_FACTOR + 'x DPR)';
  }

  return {
    baselineOk,
    planeOverheadMs,
    firingOverheadMs,
    worstOffender,
    likelyBottleneck,
  };
}

// --- Main ---

async function main() {
  process.stderr.write('Mobile Performance Test Suite\n');
  process.stderr.write('=============================\n');
  process.stderr.write(`Target: ${BASE_URL}\n`);
  process.stderr.write(`Device: iPhone 14 (emulated, ${CPU_THROTTLE_RATE}x CPU throttle)\n\n`);

  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();
  const cdpSession = await context.newCDPSession(page);

  // Apply CPU throttling
  await cdpSession.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE_RATE });

  const results = {};

  // --- Scenario A: Baseline Scroll (plane OFF) ---
  process.stderr.write('Phase 1: Baseline (plane OFF)\n');
  await waitForPageReady(page);

  results.baseline_scroll = await runScenario(
    'baseline_scroll',
    page,
    cdpSession,
    () => scenarioBaselineScroll(page)
  );

  // --- Reload for plane scenarios ---
  process.stderr.write('\nPhase 2: Plane mode scenarios\n');
  await waitForPageReady(page);
  await activatePlaneMode(page);

  // --- Scenario B: Plane Idle Scroll ---
  results.plane_idle_scroll = await runScenario(
    'plane_idle_scroll',
    page,
    cdpSession,
    () => scenarioPlaneIdleScroll(page)
  );

  // Scroll back to top for firing scenario
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // --- Scenario C: Plane Firing Scroll ---
  results.plane_firing_scroll = await runScenario(
    'plane_firing_scroll',
    page,
    cdpSession,
    () => scenarioPlaneFireScroll(page)
  );

  // --- Scenario D: Post-Scroll Reform ---
  results.post_scroll_reform = await runScenario(
    'post_scroll_reform',
    page,
    cdpSession,
    () => scenarioPostScrollReform(page)
  );

  // --- Cleanup ---
  await browser.close();

  // --- Build output ---
  const output = {
    device: `iPhone 14 (emulated, ${CPU_THROTTLE_RATE}x CPU throttle)`,
    url: BASE_URL,
    timestamp: new Date().toISOString(),
    scenarios: results,
    analysis: buildAnalysis(results),
  };

  // JSON to stdout
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');

  process.stderr.write('\nDone. Results written to stdout.\n');
}

main().catch((err) => {
  process.stderr.write(`\nError: ${err.message}\n`);
  if (err.message.includes('net::ERR_CONNECTION_REFUSED')) {
    process.stderr.write(
      'Is the local server running? Start it with: npx http-server -p 8080 -c-1\n'
    );
  }
  process.exit(1);
});
