/**
 * Destruction-Focused Performance Test Suite
 *
 * Measures frame timing during specific destruction.js operations using
 * windowed measurement to isolate scatter/reform spikes that get averaged
 * away in broad 5-second windows.
 *
 * Calls TextDestruction.onProjectileAt() directly — bypasses plane.js
 * throttle/scroll gate to test destruction cost deterministically.
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   node tests/perf-test-destruction.js
 *
 * Output: JSON to stdout
 */

const { chromium } = require('playwright');

// --- Constants & Config ---

const BASE_URL = 'http://localhost:8080';
const VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE_FACTOR = 3;
const CPU_THROTTLE_RATE = 4;
const DROPPED_FRAME_THRESHOLD_MS = 20;

const CDP_METRICS_OF_INTEREST = [
  'LayoutCount',
  'RecalcStyleCount',
  'ScriptDuration',
  'LayoutDuration',
  'TaskDuration',
];

// --- Thresholds ---

const THRESHOLDS = {
  scatter_spike: {
    'scatter_active.maxFrameMs': 40,
    'scatter_active.p95FrameMs': 30,
    'scatter_active.avgFrameMs': 22,
  },
  cache_rebuild: {
    'cache_rebuild.maxFrameMs': 50,
  },
  dense_burst: {
    'burst_scatter.p95FrameMs': 35,
    'burst_scatter.droppedFramePct': 30,
    'ScriptDurationMs': 800,
  },
  overlap_scatter_reform: {
    'overlap_peak.maxFrameMs': 50,
    'overlap_peak.p95FrameMs': 35,
  },
  high_count_reform: {
    'reform_active.maxFrameMs': 60,
    'reform_active.p95FrameMs': 30,
  },
};

// --- Helpers: Frame Timing (reused from perf-test.js) ---

function computeFrameStats(frames) {
  if (frames.length === 0) {
    return { totalFrames: 0, droppedFrames: 0, droppedFramePct: 0, avgFrameMs: 0, p95FrameMs: 0, maxFrameMs: 0 };
  }

  const deltas = frames.map((f) => f.delta);
  const sorted = [...deltas].sort((a, b) => a - b);
  const totalFrames = deltas.length;
  const droppedFrames = deltas.filter((d) => d > DROPPED_FRAME_THRESHOLD_MS).length;
  const droppedFramePct = Math.round((droppedFrames / totalFrames) * 10000) / 100;
  const avgFrameMs = Math.round((deltas.reduce((s, d) => s + d, 0) / totalFrames) * 100) / 100;
  const p95Index = Math.floor(totalFrames * 0.95);
  const p95FrameMs = Math.round(sorted[p95Index] * 100) / 100;
  const maxFrameMs = Math.round(sorted[sorted.length - 1] * 100) / 100;

  return { totalFrames, droppedFrames, droppedFramePct, avgFrameMs, p95FrameMs, maxFrameMs };
}

// --- Helpers: CDP Metrics (reused from perf-test.js) ---

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
    if (key.endsWith('Duration')) {
      val = Math.round(val * 1000 * 100) / 100;
      diff[key.replace('Duration', 'DurationMs')] = val;
    } else {
      diff[key] = Math.round(val);
    }
  }
  return diff;
}

// --- Helpers: Override Reveal Visibility (reused) ---

async function overrideRevealVisibility(page) {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'perf-test-reveal-override';
    style.textContent = '.reveal { opacity: 1 !important; transform: none !important; }';
    document.head.appendChild(style);
  });
}

// --- Helpers: Wait for Page Ready (reused) ---

async function waitForPageReady(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof gsap !== 'undefined', { timeout: 15000 });
  await page.waitForFunction(() => window.TextDestruction, { timeout: 15000 });
  await page.waitForSelector('.plane-toggle', { timeout: 15000 });
  await overrideRevealVisibility(page);
  await page.waitForTimeout(500);
}

// --- Helpers: Activate Plane Mode (reused) ---

async function activatePlaneMode(page) {
  await page.click('.plane-toggle');
  await page.waitForFunction(
    () => document.documentElement.classList.contains('plane-active'),
    { timeout: 10000 }
  );
  await page.waitForSelector('#plane-canvas canvas', { timeout: 15000 });
  await page.waitForTimeout(2000);
}

// --- New Infrastructure ---

/**
 * Marker-aware frame collector.
 * Injects RAF-based delta collection with named markers.
 */
async function injectMarkerFrameCollector(page) {
  await page.evaluate(() => {
    window.__perfFrames = [];
    window.__perfRunning = true;
    let lastTime = 0;

    window.__perfMark = function(name) {
      window.__perfFrames.push({ marker: name, timestamp: performance.now() });
    };

    function collect(timestamp) {
      if (!window.__perfRunning) return;
      if (lastTime > 0) {
        window.__perfFrames.push({ timestamp, delta: timestamp - lastTime });
      }
      lastTime = timestamp;
      requestAnimationFrame(collect);
    }
    requestAnimationFrame(collect);
  });
}

async function stopFrameCollector(page) {
  return await page.evaluate(() => {
    window.__perfRunning = false;
    return window.__perfFrames;
  });
}

/**
 * Slice frames between two named markers and compute stats.
 */
function sliceFramesByMarkers(frames, startMarker, endMarker) {
  let startIdx = -1;
  let endIdx = frames.length;

  for (let i = 0; i < frames.length; i++) {
    if (frames[i].marker === startMarker) startIdx = i;
    if (frames[i].marker === endMarker) { endIdx = i; break; }
  }

  if (startIdx === -1) return computeFrameStats([]);

  const sliced = frames.slice(startIdx + 1, endIdx).filter(f => f.delta !== undefined);
  return computeFrameStats(sliced);
}

/**
 * Direct impact — calls TextDestruction.onProjectileAt() via page.evaluate.
 */
async function directImpact(page, x, y) {
  await page.evaluate(({ x, y }) => {
    TextDestruction.onProjectileAt(x, y);
  }, { x, y });
}

/**
 * Get center coordinates of an element.
 */
async function getElementCenter(page, selector) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, selector);
}

/**
 * Get destruction system stats.
 */
async function getDestructionStats(page) {
  return await page.evaluate(() => ({
    charCount: allChars.length,
    shattered: currentShattered,
    cacheSize: charRectCache.length,
    cacheStale: cacheStale,
    isArmed: isArmed,
  }));
}

/**
 * Scroll to an element and wait for settle.
 */
async function scrollToElement(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  }, selector);
  await page.waitForTimeout(500);
}

/**
 * Ensure destruction system is armed and ready.
 */
async function ensureDestructionArmed(page) {
  await page.evaluate(() => {
    if (!isArmed) TextDestruction.init();
    cacheStale = true;
  });
  await page.waitForTimeout(200);
}

/**
 * Reset destruction state without reloading the page.
 * Kills all active tweens, resets shattered chars, and re-arms.
 */
async function resetDestructionState(page) {
  await page.evaluate(() => {
    // Kill all tweens and reset shattered chars
    TextDestruction.destroy();
    // Re-arm
    TextDestruction.init();
  });
  await page.waitForTimeout(500);
}

// --- Scenario 1: Scatter Spike Isolation ---

async function scenarioScatterSpike(page, cdpSession) {
  process.stderr.write('  Running scenario: scatter_spike...\n');

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  // Scroll to #about (dense text)
  await scrollToElement(page, '#about');
  await ensureDestructionArmed(page);

  const center = await getElementCenter(page, '.about-prose p:first-child');
  if (!center) throw new Error('Could not find .about-prose p:first-child');

  const metricsBefore = await getCdpMetrics(cdpSession);
  await injectMarkerFrameCollector(page);

  // 500ms idle
  await page.waitForTimeout(500);

  // Mark + impact + wait for scatter + mark
  await page.evaluate(() => window.__perfMark('scatter_start'));
  await directImpact(page, center.x, center.y);
  await page.waitForTimeout(1400);
  await page.evaluate(() => window.__perfMark('scatter_end'));

  // 500ms idle
  await page.waitForTimeout(500);

  const frames = await stopFrameCollector(page);
  const metricsAfter = await getCdpMetrics(cdpSession);

  const shatteredDelta = await page.evaluate(() => currentShattered);

  const preScatter = sliceFramesByMarkers(frames, '__start__', 'scatter_start');
  // Use first frame as implicit start for pre_scatter
  const preScatterFrames = [];
  const scatterStartIdx = frames.findIndex(f => f.marker === 'scatter_start');
  if (scatterStartIdx > 0) {
    for (let i = 0; i < scatterStartIdx; i++) {
      if (frames[i].delta !== undefined) preScatterFrames.push(frames[i]);
    }
  }

  return {
    pre_scatter: computeFrameStats(preScatterFrames),
    scatter_active: sliceFramesByMarkers(frames, 'scatter_start', 'scatter_end'),
    charsHit: shatteredDelta,
    cdp: diffMetrics(metricsBefore, metricsAfter),
  };
}

// --- Scenario 2: Cache Rebuild Cost ---

async function scenarioCacheRebuild(page, cdpSession) {
  process.stderr.write('  Running scenario: cache_rebuild...\n');

  // Reset destruction state (no reload needed)
  await resetDestructionState(page);

  await scrollToElement(page, '#about');
  await ensureDestructionArmed(page);

  // Force cache stale via resize event
  await page.evaluate(() => {
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(500);

  // Verify cache is stale
  const statsBefore = await getDestructionStats(page);
  if (!statsBefore.cacheStale) {
    process.stderr.write('    Warning: cache not stale after resize\n');
  }

  const center = await getElementCenter(page, '.about-prose p:first-child');
  if (!center) throw new Error('Could not find .about-prose p:first-child');

  const metricsBefore = await getCdpMetrics(cdpSession);
  await injectMarkerFrameCollector(page);

  // Brief idle
  await page.waitForTimeout(200);

  // Mark + impact (triggers rebuildCharCache synchronously) + mark on next RAF
  await page.evaluate(() => window.__perfMark('cache_start'));
  await directImpact(page, center.x, center.y);
  await page.evaluate(() => {
    requestAnimationFrame(() => window.__perfMark('cache_end'));
  });
  await page.waitForTimeout(200);

  const frames = await stopFrameCollector(page);
  const metricsAfter = await getCdpMetrics(cdpSession);

  return {
    cache_rebuild: sliceFramesByMarkers(frames, 'cache_start', 'cache_end'),
    cdp: diffMetrics(metricsBefore, metricsAfter),
  };
}

// --- Scenario 3: Dense Sustained Burst ---

async function scenarioDenseBurst(page, cdpSession) {
  process.stderr.write('  Running scenario: dense_burst...\n');

  // Reset destruction state (no reload needed)
  await resetDestructionState(page);

  await scrollToElement(page, '#about');
  await ensureDestructionArmed(page);

  // Compute 6 impact points across .about-prose and .about-sidebar
  const impactPoints = await page.evaluate(() => {
    const points = [];
    const prosePs = document.querySelectorAll('.about-prose p');
    const sidebar = document.querySelector('.about-sidebar');

    // Get up to 4 points from prose paragraphs
    prosePs.forEach((p, i) => {
      if (i >= 4) return;
      const rect = p.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        points.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }
    });

    // Get up to 2 points from sidebar elements
    if (sidebar) {
      const chips = sidebar.querySelectorAll('.chip');
      chips.forEach((c, i) => {
        if (points.length >= 6) return;
        const rect = c.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          points.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
      });
    }

    return points.slice(0, 6);
  });

  if (impactPoints.length < 3) {
    process.stderr.write(`    Warning: only found ${impactPoints.length} impact points\n`);
  }

  const metricsBefore = await getCdpMetrics(cdpSession);
  await injectMarkerFrameCollector(page);

  await page.evaluate(() => window.__perfMark('burst_start'));

  // Fire 6 impacts at 100ms intervals
  for (let i = 0; i < impactPoints.length; i++) {
    await directImpact(page, impactPoints[i].x, impactPoints[i].y);
    if (i < impactPoints.length - 1) {
      await page.waitForTimeout(100);
    }
  }

  // Wait for scatter to complete
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__perfMark('burst_end'));

  // Brief idle
  await page.waitForTimeout(300);

  const frames = await stopFrameCollector(page);
  const metricsAfter = await getCdpMetrics(cdpSession);

  const peakShattered = await page.evaluate(() => currentShattered);

  // Split burst into impact phase (first 600ms) and scatter phase (600ms–end)
  // We'll use timestamp-based slicing within the burst window
  const burstFrames = [];
  let burstStartTime = null;
  let inBurst = false;

  for (const f of frames) {
    if (f.marker === 'burst_start') { inBurst = true; continue; }
    if (f.marker === 'burst_end') { inBurst = false; continue; }
    if (inBurst && f.delta !== undefined) {
      if (burstStartTime === null) burstStartTime = f.timestamp;
      burstFrames.push({ ...f, relativeMs: f.timestamp - burstStartTime });
    }
  }

  const burstImpacts = burstFrames.filter(f => f.relativeMs <= 600);
  const burstScatter = burstFrames.filter(f => f.relativeMs > 600);

  return {
    burst_impacts: computeFrameStats(burstImpacts),
    burst_scatter: computeFrameStats(burstScatter),
    peakShattered,
    impactPointCount: impactPoints.length,
    cdp: diffMetrics(metricsBefore, metricsAfter),
  };
}

// --- Scenario 4: Overlapping Scatter + Reform ---

async function scenarioOverlapScatterReform(page, cdpSession) {
  process.stderr.write('  Running scenario: overlap_scatter_reform...\n');

  // Reset destruction state (no reload needed)
  await resetDestructionState(page);

  // Scroll to hero section
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await ensureDestructionArmed(page);

  const h1Center = await getElementCenter(page, 'h1');
  const heroDescCenter = await getElementCenter(page, '.hero-desc');
  // Try .hero-tidbits first, fall back to .hero-badge
  let wave3Center = await getElementCenter(page, '.hero-tidbits');
  if (!wave3Center) wave3Center = await getElementCenter(page, '.hero-badge');

  if (!h1Center) throw new Error('Could not find h1');
  if (!heroDescCenter) throw new Error('Could not find .hero-desc');

  const metricsBefore = await getCdpMetrics(cdpSession);
  await injectMarkerFrameCollector(page);

  await page.evaluate(() => window.__perfMark('overlap_start'));

  // Wave 1: Impact h1
  await directImpact(page, h1Center.x, h1Center.y);
  await page.waitForTimeout(800);

  // Wave 2: Impact .hero-desc (Wave 1 scatter still running)
  await directImpact(page, heroDescCenter.x, heroDescCenter.y);
  await page.waitForTimeout(1400);

  // Wave 3: Impact hero-tidbits/badge (Wave 1 reform starting, Wave 2 scatter ending)
  if (wave3Center) {
    await directImpact(page, wave3Center.x, wave3Center.y);
  }
  await page.waitForTimeout(3000);

  await page.evaluate(() => window.__perfMark('overlap_end'));

  const frames = await stopFrameCollector(page);
  const metricsAfter = await getCdpMetrics(cdpSession);

  // Extract overlap_peak window (t=2000ms to t=3500ms from start)
  const overlapFrames = [];
  let overlapStartTime = null;
  let inOverlap = false;

  for (const f of frames) {
    if (f.marker === 'overlap_start') { inOverlap = true; continue; }
    if (f.marker === 'overlap_end') { inOverlap = false; continue; }
    if (inOverlap && f.delta !== undefined) {
      if (overlapStartTime === null) overlapStartTime = f.timestamp;
      overlapFrames.push({ ...f, relativeMs: f.timestamp - overlapStartTime });
    }
  }

  const overlapFull = computeFrameStats(overlapFrames);
  const overlapPeakFrames = overlapFrames.filter(f => f.relativeMs >= 2000 && f.relativeMs <= 3500);
  const overlapPeak = computeFrameStats(overlapPeakFrames);

  return {
    overlap_full: overlapFull,
    overlap_peak: overlapPeak,
    cdp: diffMetrics(metricsBefore, metricsAfter),
  };
}

// --- Scenario 5: High Char Count Reform ---

async function scenarioHighCountReform(page, cdpSession) {
  process.stderr.write('  Running scenario: high_count_reform...\n');

  // Reset destruction state (no reload needed)
  await resetDestructionState(page);

  await scrollToElement(page, '#about');
  await ensureDestructionArmed(page);

  // Compute 8-10 impact points spread across the about section
  const impactPoints = await page.evaluate(() => {
    const points = [];
    const selectors = [
      '.about-prose p',
      '.about-box-title',
      '.about-box-text',
      '.chip',
      '.section-heading',
    ];

    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        if (points.length >= 10) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0 && rect.height > 0) {
          points.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
      });
    }

    return points.slice(0, 10);
  });

  process.stderr.write(`    Found ${impactPoints.length} impact points\n`);

  const metricsBefore = await getCdpMetrics(cdpSession);
  await injectMarkerFrameCollector(page);

  // Fire all impacts at 100ms intervals to shatter as many chars as possible
  for (let i = 0; i < impactPoints.length; i++) {
    await directImpact(page, impactPoints[i].x, impactPoints[i].y);
    if (i < impactPoints.length - 1) {
      await page.waitForTimeout(100);
    }
  }

  const shatteredCount = await page.evaluate(() => currentShattered);
  process.stderr.write(`    Shattered ${shatteredCount} chars\n`);

  // Wait for reform to start (SCATTER_DURATION + REFORM_PAUSE = 2.0s after first impact)
  await page.waitForTimeout(2000);

  await page.evaluate(() => window.__perfMark('reform_start'));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__perfMark('reform_end'));

  const frames = await stopFrameCollector(page);
  const metricsAfter = await getCdpMetrics(cdpSession);

  return {
    reform_active: sliceFramesByMarkers(frames, 'reform_start', 'reform_end'),
    shatteredCount,
    impactPointCount: impactPoints.length,
    cdp: diffMetrics(metricsBefore, metricsAfter),
  };
}

// --- Analysis ---

function buildAnalysis(results) {
  const flags = [];

  // Check scatter_spike thresholds
  if (results.scatter_spike) {
    const sa = results.scatter_spike.scatter_active;
    if (sa.maxFrameMs > THRESHOLDS.scatter_spike['scatter_active.maxFrameMs']) {
      flags.push(`scatter_spike: maxFrameMs ${sa.maxFrameMs}ms > ${THRESHOLDS.scatter_spike['scatter_active.maxFrameMs']}ms (single-frame stutter)`);
    }
    if (sa.p95FrameMs > THRESHOLDS.scatter_spike['scatter_active.p95FrameMs']) {
      flags.push(`scatter_spike: p95FrameMs ${sa.p95FrameMs}ms > ${THRESHOLDS.scatter_spike['scatter_active.p95FrameMs']}ms (sustained jank)`);
    }
    if (sa.avgFrameMs > THRESHOLDS.scatter_spike['scatter_active.avgFrameMs']) {
      flags.push(`scatter_spike: avgFrameMs ${sa.avgFrameMs}ms > ${THRESHOLDS.scatter_spike['scatter_active.avgFrameMs']}ms (consistently slow)`);
    }
  }

  // Check cache_rebuild thresholds
  if (results.cache_rebuild) {
    const cr = results.cache_rebuild.cache_rebuild;
    if (cr.maxFrameMs > THRESHOLDS.cache_rebuild['cache_rebuild.maxFrameMs']) {
      flags.push(`cache_rebuild: maxFrameMs ${cr.maxFrameMs}ms > ${THRESHOLDS.cache_rebuild['cache_rebuild.maxFrameMs']}ms (cache rebuild hitch)`);
    }
  }

  // Check dense_burst thresholds
  if (results.dense_burst) {
    const bs = results.dense_burst.burst_scatter;
    if (bs.p95FrameMs > THRESHOLDS.dense_burst['burst_scatter.p95FrameMs']) {
      flags.push(`dense_burst: p95FrameMs ${bs.p95FrameMs}ms > ${THRESHOLDS.dense_burst['burst_scatter.p95FrameMs']}ms (overlapping scatters jank)`);
    }
    if (bs.droppedFramePct > THRESHOLDS.dense_burst['burst_scatter.droppedFramePct']) {
      flags.push(`dense_burst: droppedFramePct ${bs.droppedFramePct}% > ${THRESHOLDS.dense_burst['burst_scatter.droppedFramePct']}% (sustained poor perf)`);
    }
    const scriptMs = results.dense_burst.cdp.ScriptDurationMs || 0;
    if (scriptMs > THRESHOLDS.dense_burst['ScriptDurationMs']) {
      flags.push(`dense_burst: ScriptDurationMs ${scriptMs}ms > ${THRESHOLDS.dense_burst['ScriptDurationMs']}ms (GSAP dominating main thread)`);
    }
  }

  // Check overlap_scatter_reform thresholds
  if (results.overlap_scatter_reform) {
    const op = results.overlap_scatter_reform.overlap_peak;
    if (op.maxFrameMs > THRESHOLDS.overlap_scatter_reform['overlap_peak.maxFrameMs']) {
      flags.push(`overlap_scatter_reform: maxFrameMs ${op.maxFrameMs}ms > ${THRESHOLDS.overlap_scatter_reform['overlap_peak.maxFrameMs']}ms (triple-overlap stutter)`);
    }
    if (op.p95FrameMs > THRESHOLDS.overlap_scatter_reform['overlap_peak.p95FrameMs']) {
      flags.push(`overlap_scatter_reform: p95FrameMs ${op.p95FrameMs}ms > ${THRESHOLDS.overlap_scatter_reform['overlap_peak.p95FrameMs']}ms (sustained jank)`);
    }
  }

  // Check high_count_reform thresholds
  if (results.high_count_reform) {
    const ra = results.high_count_reform.reform_active;
    if (ra.maxFrameMs > THRESHOLDS.high_count_reform['reform_active.maxFrameMs']) {
      flags.push(`high_count_reform: maxFrameMs ${ra.maxFrameMs}ms > ${THRESHOLDS.high_count_reform['reform_active.maxFrameMs']}ms (reform callback spike)`);
    }
    if (ra.p95FrameMs > THRESHOLDS.high_count_reform['reform_active.p95FrameMs']) {
      flags.push(`high_count_reform: p95FrameMs ${ra.p95FrameMs}ms > ${THRESHOLDS.high_count_reform['reform_active.p95FrameMs']}ms (staggered animation too expensive)`);
    }
  }

  // Find worst scenario by maxFrameMs across all sub-windows
  const subWindows = {
    'scatter_spike.scatter_active': results.scatter_spike?.scatter_active,
    'cache_rebuild.cache_rebuild': results.cache_rebuild?.cache_rebuild,
    'dense_burst.burst_scatter': results.dense_burst?.burst_scatter,
    'overlap_scatter_reform.overlap_peak': results.overlap_scatter_reform?.overlap_peak,
    'high_count_reform.reform_active': results.high_count_reform?.reform_active,
  };

  let worstScenario = '';
  let worstMax = 0;
  for (const [name, stats] of Object.entries(subWindows)) {
    if (stats && stats.maxFrameMs > worstMax) {
      worstMax = stats.maxFrameMs;
      worstScenario = name;
    }
  }

  return {
    flags,
    flagCount: flags.length,
    worstScenario,
    worstMaxFrameMs: worstMax,
  };
}

// --- Main ---

async function main() {
  process.stderr.write('Destruction-Focused Performance Test Suite\n');
  process.stderr.write('==========================================\n');
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

  try {
    // --- Scenario 1: Scatter Spike Isolation ---
    process.stderr.write('Phase 1: Scatter Spike Isolation\n');
    await waitForPageReady(page);
    await activatePlaneMode(page);
    results.scatter_spike = await scenarioScatterSpike(page, cdpSession);

    // --- Scenario 2: Cache Rebuild Cost ---
    process.stderr.write('\nPhase 2: Cache Rebuild Cost\n');
    results.cache_rebuild = await scenarioCacheRebuild(page, cdpSession);

    // --- Scenario 3: Dense Sustained Burst ---
    process.stderr.write('\nPhase 3: Dense Sustained Burst\n');
    results.dense_burst = await scenarioDenseBurst(page, cdpSession);

    // --- Scenario 4: Overlapping Scatter + Reform ---
    process.stderr.write('\nPhase 4: Overlapping Scatter + Reform\n');
    results.overlap_scatter_reform = await scenarioOverlapScatterReform(page, cdpSession);

    // --- Scenario 5: High Char Count Reform ---
    process.stderr.write('\nPhase 5: High Char Count Reform\n');
    results.high_count_reform = await scenarioHighCountReform(page, cdpSession);

  } finally {
    await browser.close();
  }

  // --- Build output ---
  const output = {
    device: `iPhone 14 (emulated, ${CPU_THROTTLE_RATE}x CPU throttle)`,
    url: BASE_URL,
    timestamp: new Date().toISOString(),
    scenarios: results,
    analysis: buildAnalysis(results),
  };

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
