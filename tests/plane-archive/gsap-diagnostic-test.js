/**
 * GSAP Diagnostic Test — Tween Count & Lifecycle Analysis
 *
 * Instruments GSAP to count tween creation, accumulation, duplicates,
 * and cleanup during text destruction. Purely diagnostic — always exits 0,
 * outputs informative JSON to stdout.
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   node tests/gsap-diagnostic-test.js
 *
 * Output: JSON to stdout
 */

const { chromium } = require('playwright');

// --- Constants ---

const BASE_URL = 'http://localhost:8080';
const VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE_FACTOR = 3;
const CPU_THROTTLE_RATE = 4;

function log(msg) {
  process.stderr.write('[gsap-diag] ' + msg + '\n');
}

// --- Reused Helpers (from perf-test-destruction.js) ---

async function overrideRevealVisibility(page) {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'diag-reveal-override';
    style.textContent = '.reveal { opacity: 1 !important; transform: none !important; }';
    document.head.appendChild(style);
  });
}

async function waitForPageReady(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof gsap !== 'undefined', { timeout: 15000 });
  await page.waitForFunction(() => window.TextDestruction, { timeout: 15000 });
  await page.waitForSelector('.plane-toggle', { timeout: 15000 });
  await overrideRevealVisibility(page);
  await page.waitForTimeout(500);
}

async function activatePlaneMode(page) {
  await page.click('.plane-toggle');
  await page.waitForFunction(
    () => document.documentElement.classList.contains('plane-active'),
    { timeout: 10000 }
  );
  await page.waitForSelector('#plane-canvas canvas', { timeout: 15000 });
  await page.waitForTimeout(2000);
}

async function directImpact(page, x, y) {
  await page.evaluate(({ x, y }) => {
    TextDestruction.onProjectileAt(x, y);
  }, { x, y });
}

async function getElementCenter(page, selector) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, selector);
}

async function scrollToElement(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  }, selector);
  await page.waitForTimeout(500);
}

async function ensureDestructionArmed(page) {
  await page.evaluate(() => {
    if (!isArmed) TextDestruction.init();
    cacheStale = true;
  });
  await page.waitForTimeout(200);
}

async function resetDestructionState(page) {
  await page.evaluate(() => {
    TextDestruction.destroy();
    TextDestruction.init();
  });
  await page.waitForTimeout(500);
}

// --- GSAP Instrumentation ---

/**
 * Injects wrappers around gsap.to, gsap.fromTo, gsap.set, gsap.delayedCall,
 * gsap.killTweensOf to count every call. Stores data on window.__gsapDiag.
 */
async function injectGsapInstrumentation(page) {
  await page.evaluate(() => {
    if (window.__gsapDiag) return; // already injected

    window.__gsapDiag = {
      calls: [],
      callCounts: { to: 0, fromTo: 0, set: 0, delayedCall: 0 },
      killCounts: 0,
      nextId: 0,
    };

    const diag = window.__gsapDiag;

    function targetCount(targets) {
      if (!targets) return 0;
      if (Array.isArray(targets)) return targets.length;
      if (targets.length !== undefined) return targets.length; // NodeList
      return 1;
    }

    // Wrap gsap.to
    const _to = gsap.to.bind(gsap);
    gsap.to = function(targets, vars) {
      const count = targetCount(targets);
      diag.calls.push({ method: 'to', targetCount: count, timestamp: performance.now(), id: diag.nextId++ });
      diag.callCounts.to++;
      return _to(targets, vars);
    };

    // Wrap gsap.fromTo
    const _fromTo = gsap.fromTo.bind(gsap);
    gsap.fromTo = function(targets, fromVars, toVars) {
      const count = targetCount(targets);
      diag.calls.push({ method: 'fromTo', targetCount: count, timestamp: performance.now(), id: diag.nextId++ });
      diag.callCounts.fromTo++;
      return _fromTo(targets, fromVars, toVars);
    };

    // Wrap gsap.set
    const _set = gsap.set.bind(gsap);
    gsap.set = function(targets, vars) {
      const count = targetCount(targets);
      diag.calls.push({ method: 'set', targetCount: count, timestamp: performance.now(), id: diag.nextId++ });
      diag.callCounts.set++;
      return _set(targets, vars);
    };

    // Wrap gsap.delayedCall
    const _delayedCall = gsap.delayedCall.bind(gsap);
    gsap.delayedCall = function(delay, callback, params) {
      diag.calls.push({ method: 'delayedCall', targetCount: 0, timestamp: performance.now(), id: diag.nextId++ });
      diag.callCounts.delayedCall++;
      return _delayedCall(delay, callback, params);
    };

    // Wrap gsap.killTweensOf
    const _killTweensOf = gsap.killTweensOf.bind(gsap);
    gsap.killTweensOf = function(targets, props) {
      diag.killCounts++;
      return _killTweensOf(targets, props);
    };
  });
}

/**
 * Take a snapshot of GSAP state: global timeline children, active tweens,
 * call counts, destruction state.
 */
async function getGsapSnapshot(page) {
  return await page.evaluate(() => {
    const children = gsap.globalTimeline.getChildren(true, true, true);
    const active = children.filter(t => typeof t.isActive === 'function' && t.isActive());
    return {
      globalTimelineChildren: children.length,
      activeTweens: active.length,
      callCounts: { ...window.__gsapDiag.callCounts },
      killCounts: window.__gsapDiag.killCounts,
      totalCalls: window.__gsapDiag.calls.length,
      destructionState: {
        shattered: currentShattered,
        activeBatchCount: activeBatchCount,
        charCount: allChars.length,
      },
      timestamp: performance.now(),
    };
  });
}

/**
 * Detect duplicate tweens — multiple active tweens targeting the same element.
 */
async function getDuplicateTweenTargets(page) {
  return await page.evaluate(() => {
    const children = gsap.globalTimeline.getChildren(true, true, false);
    const active = children.filter(t => typeof t.isActive === 'function' && t.isActive());
    const targetMap = new Map();

    for (const tween of active) {
      if (typeof tween.targets !== 'function') continue;
      const targets = tween.targets();
      for (const el of targets) {
        targetMap.set(el, (targetMap.get(el) || 0) + 1);
      }
    }

    let duplicateCount = 0;
    let maxTweensOnSingleElement = 0;
    for (const [, count] of targetMap) {
      if (count > 1) duplicateCount++;
      if (count > maxTweensOnSingleElement) maxTweensOnSingleElement = count;
    }

    return {
      duplicateCount,
      maxTweensOnSingleElement,
      totalTargetedElements: targetMap.size,
      totalActiveTweens: active.length,
    };
  });
}

/**
 * Reset diagnostic counters without re-wrapping.
 */
async function resetGsapDiagCounters(page) {
  await page.evaluate(() => {
    const diag = window.__gsapDiag;
    diag.calls = [];
    diag.callCounts = { to: 0, fromTo: 0, set: 0, delayedCall: 0 };
    diag.killCounts = 0;
    diag.nextId = 0;
  });
}

/**
 * Get the raw call log from instrumentation.
 */
async function getGsapCallLog(page) {
  return await page.evaluate(() => window.__gsapDiag.calls.slice());
}

// --- Scenario 1: Single Impact Tween Audit ---

async function scenarioSingleImpact(page) {
  log('Scenario 1: Single Impact Tween Audit');
  await resetDestructionState(page);
  await resetGsapDiagCounters(page);
  await scrollToElement(page, '#about');
  await ensureDestructionArmed(page);

  const baseline = await getGsapSnapshot(page);

  // Find a text element to hit
  const center = await getElementCenter(page, '.about-prose p');
  if (!center) {
    log('  WARNING: Could not find .about-prose p');
    return { error: 'no target element' };
  }

  // Fire single impact
  await directImpact(page, center.x, center.y);

  // Snapshot during scatter (100ms after impact)
  await page.waitForTimeout(100);
  const scatterActive = await getGsapSnapshot(page);
  const scatterDuplicates = await getDuplicateTweenTargets(page);

  // Snapshot after reform should be complete (~2.2s: 1.2s scatter + 0.8s pause + 0.2s reform)
  await page.waitForTimeout(2100);
  const reformComplete = await getGsapSnapshot(page);

  // Snapshot after full settle (4s total)
  await page.waitForTimeout(1800);
  const settled = await getGsapSnapshot(page);

  const callLog = await getGsapCallLog(page);

  return {
    baseline,
    scatterActive,
    scatterDuplicates,
    reformComplete,
    settled,
    callLog,
    computed: {
      gsapCallsForOneImpact: scatterActive.totalCalls - baseline.totalCalls,
      peakActiveTweens: scatterActive.activeTweens,
      tweensAfterReform: reformComplete.activeTweens,
      tweensAfterSettle: settled.activeTweens,
      tweensReturnedToBaseline: settled.globalTimelineChildren <= baseline.globalTimelineChildren + 2,
    },
  };
}

// --- Scenario 2: Tween Accumulation (10 impacts) ---

async function scenarioAccumulation(page) {
  log('Scenario 2: Tween Accumulation (10 impacts at 300ms intervals)');
  await resetDestructionState(page);
  await resetGsapDiagCounters(page);
  await scrollToElement(page, '#about');
  await ensureDestructionArmed(page);

  const baseline = await getGsapSnapshot(page);

  // Compute 10 impact points spread across visible text
  const points = await page.evaluate(() => {
    const paragraphs = document.querySelectorAll('.about-prose p, .about-prose .chip, #about h2');
    const pts = [];
    for (const el of paragraphs) {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        pts.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }
      if (pts.length >= 10) break;
    }
    // Pad with offset copies if we don't have 10
    while (pts.length < 10 && pts.length > 0) {
      const base = pts[pts.length % pts.length];
      pts.push({ x: base.x + 20, y: base.y + 10 });
    }
    return pts;
  });

  const snapshots = [];
  for (let i = 0; i < Math.min(10, points.length); i++) {
    await directImpact(page, points[i].x, points[i].y);
    await page.waitForTimeout(300);
    const snap = await getGsapSnapshot(page);
    snap.impactIndex = i;
    snapshots.push(snap);
  }

  // Wait for everything to settle
  await page.waitForTimeout(5000);
  const settled = await getGsapSnapshot(page);

  const peakActive = Math.max(...snapshots.map(s => s.activeTweens));
  const peakGlobal = Math.max(...snapshots.map(s => s.globalTimelineChildren));

  return {
    baseline,
    snapshots,
    settled,
    computed: {
      peakActiveTweens: peakActive,
      peakGlobalChildren: peakGlobal,
      tweenGrowthPerImpact: snapshots.length > 1
        ? (snapshots[snapshots.length - 1].globalTimelineChildren - snapshots[0].globalTimelineChildren) / (snapshots.length - 1)
        : 0,
      settledActiveTweens: settled.activeTweens,
      settledGlobalChildren: settled.globalTimelineChildren,
    },
  };
}

// --- Scenario 3: Full Lifecycle Cleanup ---

async function scenarioLifecycle(page) {
  log('Scenario 3: Full Lifecycle Cleanup (time-series)');
  await resetDestructionState(page);
  await resetGsapDiagCounters(page);
  await scrollToElement(page, '#about');
  await ensureDestructionArmed(page);

  const baseline = await getGsapSnapshot(page);

  // Fire 3 impacts at 200ms intervals
  const center = await getElementCenter(page, '.about-prose p');
  if (!center) return { error: 'no target element' };

  for (let i = 0; i < 3; i++) {
    await directImpact(page, center.x + i * 30, center.y);
    await page.waitForTimeout(200);
  }

  // Poll tween count every 500ms for 6 seconds
  const timeSeries = [];
  for (let t = 0; t < 12; t++) {
    await page.waitForTimeout(500);
    const snap = await getGsapSnapshot(page);
    snap.timeOffsetMs = (t + 1) * 500;
    timeSeries.push(snap);
  }

  const peakActive = Math.max(...timeSeries.map(s => s.activeTweens));
  const finalActive = timeSeries[timeSeries.length - 1].activeTweens;
  const finalGlobal = timeSeries[timeSeries.length - 1].globalTimelineChildren;

  return {
    baseline,
    timeSeries,
    computed: {
      peakActiveTweens: peakActive,
      finalActiveTweens: finalActive,
      finalGlobalChildren: finalGlobal,
      baselineGlobalChildren: baseline.globalTimelineChildren,
      tweensReturnedToZero: finalActive === 0,
      orphanedTweens: finalGlobal - baseline.globalTimelineChildren,
    },
  };
}

// --- Scenario 4: Rapid Fire Explosion (20 impacts in 2s) ---

async function scenarioRapidFire(page) {
  log('Scenario 4: Rapid Fire Explosion (20 impacts in 2s)');
  await resetDestructionState(page);
  await resetGsapDiagCounters(page);
  await scrollToElement(page, '#about');
  await ensureDestructionArmed(page);

  const baseline = await getGsapSnapshot(page);

  // Compute 20 impact points in a grid across visible text
  const points = await page.evaluate(() => {
    const about = document.querySelector('#about');
    if (!about) return [];
    const rect = about.getBoundingClientRect();
    const pts = [];
    const cols = 5, rows = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        pts.push({
          x: rect.left + (rect.width / (cols + 1)) * (c + 1),
          y: rect.top + (rect.height / (rows + 1)) * (r + 1),
        });
      }
    }
    return pts.slice(0, 20);
  });

  // Fire all 20 at 100ms intervals
  for (let i = 0; i < points.length; i++) {
    await directImpact(page, points[i].x, points[i].y);
    await page.waitForTimeout(100);
  }

  // Peak snapshot immediately after last impact
  const peak = await getGsapSnapshot(page);
  const peakDuplicates = await getDuplicateTweenTargets(page);
  const peakCallLog = await getGsapCallLog(page);

  // Wait for settle
  await page.waitForTimeout(6000);
  const settled = await getGsapSnapshot(page);
  const settledDuplicates = await getDuplicateTweenTargets(page);

  // Compute tween creation rate
  const firstCall = peakCallLog.length > 0 ? peakCallLog[0].timestamp : 0;
  const lastCall = peakCallLog.length > 0 ? peakCallLog[peakCallLog.length - 1].timestamp : 0;
  const durationSec = (lastCall - firstCall) / 1000;

  return {
    baseline,
    peak,
    peakDuplicates,
    settled,
    settledDuplicates,
    computed: {
      totalGsapCalls: peak.totalCalls,
      peakActiveTweens: peak.activeTweens,
      peakGlobalChildren: peak.globalTimelineChildren,
      settledActiveTweens: settled.activeTweens,
      settledGlobalChildren: settled.globalTimelineChildren,
      duplicateElementsAtPeak: peakDuplicates.duplicateCount,
      maxTweensOnOneElement: peakDuplicates.maxTweensOnSingleElement,
      tweenCreationRate: durationSec > 0 ? Math.round(peak.totalCalls / durationSec) : 0,
      estimatedTweenMemoryKB: Math.round(peak.globalTimelineChildren * 2),
      callBreakdown: peak.callCounts,
      killCount: peak.killCounts,
    },
  };
}

// --- Scenario 5: Same-Location Re-shatter ---

async function scenarioDuplicates(page) {
  log('Scenario 5: Same-Location Re-shatter (duplicate detection)');
  await resetDestructionState(page);
  await resetGsapDiagCounters(page);
  await scrollToElement(page, '#about');
  await ensureDestructionArmed(page);

  const center = await getElementCenter(page, '.about-prose p');
  if (!center) return { error: 'no target element' };

  const impacts = [];

  // Impact #1
  await directImpact(page, center.x, center.y);
  await page.waitForTimeout(50);
  impacts.push({
    label: 'after_impact_1',
    snapshot: await getGsapSnapshot(page),
    duplicates: await getDuplicateTweenTargets(page),
  });

  // Impact #2 at same location (50ms later — chars still scattering)
  await directImpact(page, center.x, center.y);
  await page.waitForTimeout(50);
  impacts.push({
    label: 'after_impact_2_same_location',
    snapshot: await getGsapSnapshot(page),
    duplicates: await getDuplicateTweenTargets(page),
  });

  // Impact #3 at same location
  await directImpact(page, center.x, center.y);
  await page.waitForTimeout(50);
  impacts.push({
    label: 'after_impact_3_same_location',
    snapshot: await getGsapSnapshot(page),
    duplicates: await getDuplicateTweenTargets(page),
  });

  // Wait for first batch to reform (~2.5s from first impact)
  await page.waitForTimeout(2500);
  impacts.push({
    label: 'after_first_reform',
    snapshot: await getGsapSnapshot(page),
    duplicates: await getDuplicateTweenTargets(page),
  });

  // Re-shatter reformed chars
  // Force cache rebuild so reformed chars are findable again
  await page.evaluate(() => {
    cacheStale = true;
  });
  await page.waitForTimeout(100);
  await directImpact(page, center.x, center.y);
  await page.waitForTimeout(50);
  impacts.push({
    label: 'after_reshatter_reformed',
    snapshot: await getGsapSnapshot(page),
    duplicates: await getDuplicateTweenTargets(page),
  });

  // Full settle
  await page.waitForTimeout(4000);
  impacts.push({
    label: 'settled',
    snapshot: await getGsapSnapshot(page),
    duplicates: await getDuplicateTweenTargets(page),
  });

  return {
    impacts,
    computed: {
      duplicatesAtImpact2: impacts[1].duplicates.duplicateCount,
      duplicatesAtImpact3: impacts[2].duplicates.duplicateCount,
      maxDuplicatesAnyPoint: Math.max(...impacts.map(i => i.duplicates.duplicateCount)),
      maxTweensOnOneElement: Math.max(...impacts.map(i => i.duplicates.maxTweensOnSingleElement)),
      orphansAfterSettle: impacts[impacts.length - 1].snapshot.activeTweens,
    },
  };
}

// --- Summary ---

function buildDiagnosticSummary(results) {
  const summary = {
    gsapCallsPerImpact: results.single_impact.computed
      ? results.single_impact.computed.gsapCallsForOneImpact
      : 'N/A',
    peakConcurrentTweens: Math.max(
      results.single_impact.computed ? results.single_impact.computed.peakActiveTweens : 0,
      results.accumulation.computed ? results.accumulation.computed.peakActiveTweens : 0,
      results.rapid_fire.computed ? results.rapid_fire.computed.peakActiveTweens : 0,
    ),
    tweensCleanUpProperly:
      (results.lifecycle.computed ? results.lifecycle.computed.tweensReturnedToZero : false) &&
      (results.single_impact.computed ? results.single_impact.computed.tweensReturnedToBaseline : false),
    duplicateTweensDetected:
      (results.duplicates.computed ? results.duplicates.computed.maxDuplicatesAnyPoint > 0 : false),
    orphanedTweensDetected:
      (results.lifecycle.computed ? results.lifecycle.computed.orphanedTweens > 5 : false),
  };

  // Estimated mobile cost
  if (summary.peakConcurrentTweens > 100) {
    summary.estimatedMobileCost = 'High';
  } else if (summary.peakConcurrentTweens > 50) {
    summary.estimatedMobileCost = 'Medium';
  } else {
    summary.estimatedMobileCost = 'Low';
  }

  // Build recommendations
  summary.recommendations = [];
  if (!summary.tweensCleanUpProperly) {
    summary.recommendations.push('Tween leak detected — tweens do not return to zero after full cycle');
  }
  if (summary.duplicateTweensDetected) {
    summary.recommendations.push('Multiple active tweens targeting the same element — missing killTweensOf before re-scatter');
  }
  if (summary.peakConcurrentTweens > 100) {
    summary.recommendations.push('Tween explosion under load — ' + summary.peakConcurrentTweens + ' concurrent tweens at peak');
  }
  if (results.rapid_fire.computed && results.rapid_fire.computed.killCount === 0) {
    summary.recommendations.push('No killTweensOf calls during rapid fire — tweens may be stacking without cleanup');
  }
  if (results.rapid_fire.computed && results.rapid_fire.computed.callBreakdown) {
    const dc = results.rapid_fire.computed.callBreakdown.delayedCall;
    if (dc > 15) {
      summary.recommendations.push(dc + ' pending delayedCalls from rapid fire — these will create ' + (dc * 3) + ' additional tweens when they fire');
    }
  }

  return summary;
}

// --- Main ---

async function main() {
  log('Starting GSAP Diagnostic Test');
  log('Ensure local server is running: npx http-server -p 8080 -c-1');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  // CDP for CPU throttling
  const cdpSession = await context.newCDPSession(page);
  await cdpSession.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE_RATE });

  // Load page and set up
  await waitForPageReady(page);
  await activatePlaneMode(page);
  await injectGsapInstrumentation(page);

  const results = {};

  // Run scenarios sequentially
  try {
    results.single_impact = await scenarioSingleImpact(page);
    log('  Single impact done');
  } catch (e) {
    log('  Single impact FAILED: ' + e.message);
    results.single_impact = { error: e.message, computed: {} };
  }

  try {
    results.accumulation = await scenarioAccumulation(page);
    log('  Accumulation done');
  } catch (e) {
    log('  Accumulation FAILED: ' + e.message);
    results.accumulation = { error: e.message, computed: {} };
  }

  try {
    results.lifecycle = await scenarioLifecycle(page);
    log('  Lifecycle done');
  } catch (e) {
    log('  Lifecycle FAILED: ' + e.message);
    results.lifecycle = { error: e.message, computed: {} };
  }

  try {
    results.rapid_fire = await scenarioRapidFire(page);
    log('  Rapid fire done');
  } catch (e) {
    log('  Rapid fire FAILED: ' + e.message);
    results.rapid_fire = { error: e.message, computed: {} };
  }

  try {
    results.duplicates = await scenarioDuplicates(page);
    log('  Duplicates done');
  } catch (e) {
    log('  Duplicates FAILED: ' + e.message);
    results.duplicates = { error: e.message, computed: {} };
  }

  const summary = buildDiagnosticSummary(results);

  const output = {
    device: 'iPhone 14 (emulated, ' + CPU_THROTTLE_RATE + 'x CPU throttle)',
    url: BASE_URL,
    timestamp: new Date().toISOString(),
    scenarios: results,
    summary,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');

  log('Done. Summary:');
  log('  GSAP calls per impact: ' + summary.gsapCallsPerImpact);
  log('  Peak concurrent tweens: ' + summary.peakConcurrentTweens);
  log('  Tweens clean up: ' + summary.tweensCleanUpProperly);
  log('  Duplicates detected: ' + summary.duplicateTweensDetected);
  log('  Estimated mobile cost: ' + summary.estimatedMobileCost);
  if (summary.recommendations.length > 0) {
    log('  Recommendations:');
    summary.recommendations.forEach(r => log('    - ' + r));
  }

  await browser.close();
  process.exit(0);
}

main().catch(err => {
  log('FATAL: ' + err.message);
  console.error(err);
  process.exit(0); // Always exit 0 — diagnostic only
});
