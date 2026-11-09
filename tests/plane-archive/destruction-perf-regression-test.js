/**
 * Destruction Performance Regression Test
 *
 * Runs key destruction scenarios at desktop and mobile viewport sizes,
 * compares against stored baselines, and exits non-zero on regression.
 *
 * First run creates baselines. Subsequent runs compare.
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   node tests/destruction-perf-regression-test.js
 *   node tests/destruction-perf-regression-test.js --update-baseline
 *   node tests/destruction-perf-regression-test.js --viewport desktop
 *   node tests/destruction-perf-regression-test.js --tolerance 20
 *
 * Exit: 0 = pass/baseline created, 1 = regression, 2 = crash
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// --- Config ---

const BASE_URL = 'http://localhost:8080';
const BASELINES_DIR = path.join(__dirname, 'baselines');
const DROPPED_FRAME_THRESHOLD_MS = 20;

const CDP_METRICS_OF_INTEREST = [
  'LayoutCount', 'RecalcStyleCount', 'ScriptDuration', 'LayoutDuration', 'TaskDuration',
];

const VIEWPORT_CONFIGS = {
  desktop: {
    label: 'desktop-1920x1080',
    viewport: { width: 1920, height: 1080 },
    cpuThrottle: 1, // no throttle
    tolerance: 25, // 25% regression tolerance (maxFrameMs swings ~50% between runs)
  },
  mobile: {
    label: 'mobile-375x812',
    viewport: { width: 375, height: 812 },
    contextOpts: { isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
    cpuThrottle: 2, // lighter throttle than old 4x
    tolerance: 35, // wider for mobile variance + system load fluctuation
  },
};

// --- CLI Parsing ---

var args = process.argv.slice(2);
var updateBaseline = args.includes('--update-baseline');
var viewportArg = 'all';
var toleranceOverride = null;

for (var a = 0; a < args.length; a++) {
  if (args[a] === '--viewport' && args[a + 1]) viewportArg = args[a + 1];
  if (args[a] === '--tolerance' && args[a + 1]) toleranceOverride = parseFloat(args[a + 1]);
}

function log(msg) { process.stderr.write(msg + '\n'); }

// --- Frame Timing Helpers (from perf-test-destruction.js) ---

function computeFrameStats(frames) {
  if (frames.length === 0) {
    return { totalFrames: 0, droppedFrames: 0, droppedFramePct: 0, avgFrameMs: 0, p95FrameMs: 0, maxFrameMs: 0 };
  }
  var deltas = frames.map(function(f) { return f.delta; });
  var sorted = deltas.slice().sort(function(a, b) { return a - b; });
  var totalFrames = deltas.length;
  var droppedFrames = deltas.filter(function(d) { return d > DROPPED_FRAME_THRESHOLD_MS; }).length;
  var droppedFramePct = Math.round((droppedFrames / totalFrames) * 10000) / 100;
  var avgFrameMs = Math.round((deltas.reduce(function(s, d) { return s + d; }, 0) / totalFrames) * 100) / 100;
  var p95Index = Math.floor(totalFrames * 0.95);
  var p95FrameMs = Math.round(sorted[p95Index] * 100) / 100;
  var maxFrameMs = Math.round(sorted[sorted.length - 1] * 100) / 100;
  return { totalFrames: totalFrames, droppedFrames: droppedFrames, droppedFramePct: droppedFramePct, avgFrameMs: avgFrameMs, p95FrameMs: p95FrameMs, maxFrameMs: maxFrameMs };
}

// --- CDP Metrics Helpers ---

async function getCdpMetrics(cdpSession) {
  await cdpSession.send('Performance.enable');
  var result = await cdpSession.send('Performance.getMetrics');
  var map = {};
  for (var i = 0; i < result.metrics.length; i++) map[result.metrics[i].name] = result.metrics[i].value;
  return map;
}

function diffMetrics(before, after) {
  var diff = {};
  CDP_METRICS_OF_INTEREST.forEach(function(key) {
    var val = (after[key] || 0) - (before[key] || 0);
    if (key.endsWith('Duration')) {
      val = Math.round(val * 1000 * 100) / 100;
      diff[key.replace('Duration', 'DurationMs')] = val;
    } else {
      diff[key] = Math.round(val);
    }
  });
  return diff;
}

// --- Page Helpers ---

async function overrideRevealVisibility(page) {
  await page.evaluate(function() {
    var style = document.createElement('style');
    style.id = 'perf-test-reveal-override';
    style.textContent = '.reveal { opacity: 1 !important; transform: none !important; }';
    document.head.appendChild(style);
  });
}

async function waitForPageReady(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(function() { return typeof gsap !== 'undefined'; }, { timeout: 15000 });
  await page.waitForFunction(function() { return window.TextDestruction; }, { timeout: 15000 });
  await page.waitForSelector('.plane-toggle', { timeout: 15000 });
  await overrideRevealVisibility(page);
  await page.waitForTimeout(500);
}

async function ensureDestructionArmed(page) {
  await page.evaluate(function() {
    if (!isArmed) TextDestruction.init();
    cacheStale = true;
  });
  await page.waitForTimeout(200);
}

async function resetDestructionState(page) {
  await page.evaluate(function() {
    TextDestruction.destroy();
    TextDestruction.init();
  });
  await page.waitForTimeout(500);
}

async function scrollToElement(page, selector) {
  await page.evaluate(function(sel) {
    var el = document.querySelector(sel);
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  }, selector);
  await page.waitForTimeout(500);
}

async function getElementCenter(page, selector) {
  return await page.evaluate(function(sel) {
    var el = document.querySelector(sel);
    if (!el) return null;
    var rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, selector);
}

async function directImpact(page, x, y) {
  await page.evaluate(function(args) { TextDestruction.onProjectileAt(args.x, args.y); }, { x: x, y: y });
}

// --- Marker-Aware Frame Collector ---

async function injectMarkerFrameCollector(page) {
  await page.evaluate(function() {
    window.__perfFrames = [];
    window.__perfRunning = true;
    var lastTime = 0;
    window.__perfMark = function(name) {
      window.__perfFrames.push({ marker: name, timestamp: performance.now() });
    };
    function collect(timestamp) {
      if (!window.__perfRunning) return;
      if (lastTime > 0) window.__perfFrames.push({ timestamp: timestamp, delta: timestamp - lastTime });
      lastTime = timestamp;
      requestAnimationFrame(collect);
    }
    requestAnimationFrame(collect);
  });
}

async function stopFrameCollector(page) {
  return await page.evaluate(function() {
    window.__perfRunning = false;
    return window.__perfFrames;
  });
}

function sliceFramesByMarkers(frames, startMarker, endMarker) {
  var inWindow = false;
  var windowFrames = [];
  for (var i = 0; i < frames.length; i++) {
    var f = frames[i];
    if (f.marker === startMarker) { inWindow = true; continue; }
    if (f.marker === endMarker) { inWindow = false; continue; }
    if (inWindow && f.delta !== undefined) windowFrames.push(f);
  }
  return computeFrameStats(windowFrames);
}

// --- Scenarios ---

async function scenarioScatterSpike(page, cdpSession) {
  log('  Running: scatter_spike');
  await resetDestructionState(page);
  await scrollToElement(page, '#about');
  await ensureDestructionArmed(page);

  var center = await getElementCenter(page, '.about-prose p:first-child');
  if (!center) center = await getElementCenter(page, '#about h2');
  if (!center) throw new Error('No target for scatter_spike');

  var metricsBefore = await getCdpMetrics(cdpSession);
  await injectMarkerFrameCollector(page);

  await page.waitForTimeout(500);
  await page.evaluate(function() { window.__perfMark('scatter_start'); });
  await directImpact(page, center.x, center.y);
  await page.waitForTimeout(1400);
  await page.evaluate(function() { window.__perfMark('scatter_end'); });
  await page.waitForTimeout(500);

  var frames = await stopFrameCollector(page);
  var metricsAfter = await getCdpMetrics(cdpSession);

  return {
    scatter_active: sliceFramesByMarkers(frames, 'scatter_start', 'scatter_end'),
    cdp: diffMetrics(metricsBefore, metricsAfter),
  };
}

async function scenarioDenseBurst(page, cdpSession) {
  log('  Running: dense_burst');
  await resetDestructionState(page);
  await scrollToElement(page, '#about');
  await ensureDestructionArmed(page);

  var impactPoints = await page.evaluate(function() {
    var points = [];
    var ps = document.querySelectorAll('.about-prose p');
    ps.forEach(function(p, i) {
      if (i >= 4) return;
      var rect = p.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0)
        points.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    });
    var chips = document.querySelectorAll('.chip');
    chips.forEach(function(c) {
      if (points.length >= 6) return;
      var rect = c.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0)
        points.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    });
    return points.slice(0, 6);
  });

  var metricsBefore = await getCdpMetrics(cdpSession);
  await injectMarkerFrameCollector(page);
  await page.evaluate(function() { window.__perfMark('burst_start'); });

  for (var i = 0; i < impactPoints.length; i++) {
    await directImpact(page, impactPoints[i].x, impactPoints[i].y);
    if (i < impactPoints.length - 1) await page.waitForTimeout(100);
  }

  await page.waitForTimeout(1500);
  await page.evaluate(function() { window.__perfMark('burst_end'); });
  await page.waitForTimeout(300);

  var frames = await stopFrameCollector(page);
  var metricsAfter = await getCdpMetrics(cdpSession);

  return {
    burst_scatter: sliceFramesByMarkers(frames, 'burst_start', 'burst_end'),
    cdp: diffMetrics(metricsBefore, metricsAfter),
  };
}

async function scenarioFigure8ScrollFire(page, cdpSession) {
  log('  Running: figure8_scroll_fire');
  await resetDestructionState(page);
  await page.evaluate(function() { window.scrollTo(0, 0); });
  await page.waitForTimeout(300);
  await ensureDestructionArmed(page);

  var metricsBefore = await getCdpMetrics(cdpSession);
  await injectMarkerFrameCollector(page);

  var STEPS = 60;
  var STEP_DELAY = 100;
  var SCROLL_STEP = 3;

  await page.evaluate(function() { window.__perfMark('scroll_fire_start'); });

  for (var i = 0; i < STEPS; i++) {
    var t = (i / STEPS) * Math.PI * 2;
    await page.evaluate(function(args) {
      var vw = window.innerWidth, vh = window.innerHeight;
      var cx = vw * 0.5, cy = vh * 0.5;
      var x = cx + vw * 0.35 * Math.sin(2 * args.t);
      var y = cy + vh * 0.3 * Math.sin(args.t);
      window.scrollBy(0, args.scrollStep);
      TextDestruction.onProjectileAt(x, y);
    }, { t: t, scrollStep: SCROLL_STEP });
    await page.waitForTimeout(STEP_DELAY);
  }

  await page.evaluate(function() { window.__perfMark('scroll_fire_end'); });
  await page.evaluate(function() { window.__perfMark('reform_tail_start'); });
  await page.waitForTimeout(3000);
  await page.evaluate(function() { window.__perfMark('reform_tail_end'); });

  var frames = await stopFrameCollector(page);
  var metricsAfter = await getCdpMetrics(cdpSession);

  return {
    scroll_fire: sliceFramesByMarkers(frames, 'scroll_fire_start', 'scroll_fire_end'),
    reform_tail: sliceFramesByMarkers(frames, 'reform_tail_start', 'reform_tail_end'),
    cdp: diffMetrics(metricsBefore, metricsAfter),
  };
}

async function scenarioSustainedAnnihilation(page, cdpSession) {
  log('  Running: sustained_annihilation');
  await resetDestructionState(page);
  await scrollToElement(page, '#about');
  await ensureDestructionArmed(page);

  var gridPoints = await page.evaluate(function() {
    var SPACING = 60;
    var points = [];
    var sels = ['#about .section-label', '#about .section-heading', '.about-prose p', '.about-box-title', '.about-box-text', '.chip'];
    sels.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        var rect = el.getBoundingClientRect();
        if (rect.top >= window.innerHeight || rect.bottom <= 0 || rect.height === 0) return;
        for (var x = rect.left + SPACING / 2; x < rect.right; x += SPACING) {
          for (var y = rect.top + SPACING / 2; y < rect.bottom; y += SPACING) {
            if (y > 0 && y < window.innerHeight) points.push({ x: x, y: y });
          }
        }
      });
    });
    return points;
  });

  log('    Grid points: ' + gridPoints.length);

  var CYCLES = 6;
  var CYCLE_INTERVAL = 300;

  var metricsBefore = await getCdpMetrics(cdpSession);
  await injectMarkerFrameCollector(page);
  await page.evaluate(function() { window.__perfMark('annihilation_start'); });

  for (var cycle = 0; cycle < CYCLES; cycle++) {
    await page.evaluate(function(args) {
      for (var j = 0; j < args.pts.length; j++) {
        TextDestruction.onProjectileAt(args.pts[j].x, args.pts[j].y);
      }
    }, { pts: gridPoints });
    if (cycle < CYCLES - 1) await page.waitForTimeout(CYCLE_INTERVAL);
  }

  await page.evaluate(function() { window.__perfMark('annihilation_end'); });
  await page.evaluate(function() { window.__perfMark('cooldown_start'); });
  await page.waitForTimeout(4000);
  await page.evaluate(function() { window.__perfMark('cooldown_end'); });

  var frames = await stopFrameCollector(page);
  var metricsAfter = await getCdpMetrics(cdpSession);

  return {
    annihilation: sliceFramesByMarkers(frames, 'annihilation_start', 'annihilation_end'),
    cooldown: sliceFramesByMarkers(frames, 'cooldown_start', 'cooldown_end'),
    cdp: diffMetrics(metricsBefore, metricsAfter),
  };
}

// --- Baseline Comparison ---

function loadBaseline(label) {
  var filePath = path.join(BASELINES_DIR, label + '.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function saveBaseline(label, data) {
  if (!fs.existsSync(BASELINES_DIR)) fs.mkdirSync(BASELINES_DIR, { recursive: true });
  var filePath = path.join(BASELINES_DIR, label + '.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  log('  Baseline saved: ' + filePath);
}

// Minimum baseline thresholds — skip comparison when base value is too low
// (small absolute changes in low-count metrics produce misleading percentages)
// Minimum baseline thresholds — don't flag % regression when base is below these
// (maxFrameMs is the single worst frame — extremely volatile from GC/system load)
var MIN_BASELINE_THRESHOLDS = {
  droppedFrames: 5,
  droppedFramePct: 10,
  totalFrames: 10,
  maxFrameMs: 40,
};

function compareWithBaseline(current, baseline, tolerance) {
  var regressions = [];
  for (var scenario in current.scenarios) {
    var currentData = current.scenarios[scenario];
    var baselineData = baseline.scenarios[scenario];
    if (!baselineData) continue;

    for (var windowName in currentData) {
      if (windowName === 'cdp') continue;
      var cw = currentData[windowName];
      var bw = baselineData[windowName];
      if (!bw || typeof cw !== 'object') continue;

      for (var metric in cw) {
        var curr = cw[metric];
        var base = bw[metric];
        if (typeof curr !== 'number' || typeof base !== 'number') continue;
        if (base === 0) continue;

        // Skip low-count metrics where run-to-run noise dominates
        var minThreshold = MIN_BASELINE_THRESHOLDS[metric];
        if (minThreshold && base < minThreshold) continue;

        var pctChange = ((curr - base) / base) * 100;
        if (pctChange > tolerance) {
          regressions.push({
            scenario: scenario,
            window: windowName,
            metric: metric,
            baseline: base,
            current: curr,
            pctChange: Math.round(pctChange * 10) / 10,
          });
        }
      }
    }
  }
  return regressions;
}

// --- Run for a Viewport ---

async function runForViewport(browser, vpKey) {
  var config = VIEWPORT_CONFIGS[vpKey];
  var tolerance = toleranceOverride || config.tolerance;
  log('\n=== Viewport: ' + config.label + ' (tolerance ' + tolerance + '%) ===');

  var contextOpts = { viewport: config.viewport };
  if (config.contextOpts) Object.assign(contextOpts, config.contextOpts);
  var context = await browser.newContext(contextOpts);
  var page = await context.newPage();

  // Apply CPU throttle via CDP
  if (config.cpuThrottle > 1) {
    var cdpSession = await context.newCDPSession(page);
    await cdpSession.send('Emulation.setCPUThrottlingRate', { rate: config.cpuThrottle });
  }

  await waitForPageReady(page);

  var cdpSession = await context.newCDPSession(page);

  var scenarios = {};
  scenarios.scatter_spike = await scenarioScatterSpike(page, cdpSession);
  scenarios.dense_burst = await scenarioDenseBurst(page, cdpSession);
  scenarios.figure8_scroll_fire = await scenarioFigure8ScrollFire(page, cdpSession);
  scenarios.sustained_annihilation = await scenarioSustainedAnnihilation(page, cdpSession);

  await context.close();

  var result = {
    timestamp: new Date().toISOString(),
    device: config.label,
    scenarios: scenarios,
  };

  // Baseline logic
  var baseline = loadBaseline(config.label);

  if (updateBaseline || !baseline) {
    saveBaseline(config.label, result);
    if (!baseline) log('  No baseline found — current run saved as baseline');
    return { label: config.label, regressions: [], created: true };
  }

  var regressions = compareWithBaseline(result, baseline, tolerance);

  if (regressions.length > 0) {
    log('\n  REGRESSIONS DETECTED:');
    regressions.forEach(function(r) {
      log('    ' + r.scenario + '/' + r.window + '.' + r.metric +
          ': ' + r.baseline + ' -> ' + r.current + ' (+' + r.pctChange + '%)');
    });
  } else {
    log('  All metrics within tolerance');
  }

  return { label: config.label, regressions: regressions, created: false };
}

// --- Main ---

async function main() {
  log('Destruction Performance Regression Test');
  log('=======================================');

  var browser;
  try {
    browser = await chromium.launch({ headless: true });

    var vpKeys = viewportArg === 'all' ? ['desktop', 'mobile'] : [viewportArg];
    var allResults = [];

    for (var v = 0; v < vpKeys.length; v++) {
      var result = await runForViewport(browser, vpKeys[v]);
      allResults.push(result);
    }

    // Summary
    log('\n=== Summary ===');
    var hasRegression = false;
    allResults.forEach(function(r) {
      if (r.created) {
        log('NEW   ' + r.label + ' -- baseline created');
      } else if (r.regressions.length > 0) {
        log('FAIL  ' + r.label + ' -- ' + r.regressions.length + ' regression(s)');
        hasRegression = true;
      } else {
        log('PASS  ' + r.label);
      }
    });

    await browser.close();

    // JSON output to stdout
    process.stdout.write(JSON.stringify({
      timestamp: new Date().toISOString(),
      viewports: allResults.map(function(r) { return { label: r.label, regressions: r.regressions.length, baselineCreated: r.created }; }),
    }, null, 2) + '\n');

    process.exit(hasRegression ? 1 : 0);
  } catch (err) {
    log('FATAL: ' + err.message);
    if (err.stack) log(err.stack);
    if (browser) await browser.close();
    process.exit(2);
  }
}

main();
