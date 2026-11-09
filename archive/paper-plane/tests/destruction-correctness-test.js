/**
 * Destruction System Correctness Tests
 *
 * Validates the three bottleneck fixes from remove-mobile-downgrades:
 *   1. Spatial grid accuracy (vs brute-force linear scan)
 *   2. Document-relative cache coords (stable after scroll)
 *   3. Tween pressure monitor (activeBatchCount bounded, returns to 0)
 *   4. Cache lifecycle (shatter -> reform -> stale -> rebuild -> re-entry)
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   node tests/destruction-correctness-test.js
 *
 * Exit: 0 = all pass, 1 = any failure
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';
const VIEWPORT = { width: 1920, height: 1080 };

// --- Helpers ---

async function overrideRevealVisibility(page) {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'test-reveal-override';
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

async function ensureArmedAndCacheWarm(page) {
  await page.evaluate(() => {
    if (!isArmed) TextDestruction.init();
    cacheStale = true;
    scheduleEagerCacheWarm();
  });
  // Wait for RAF-scheduled cache rebuild
  await page.waitForTimeout(200);
  await page.waitForFunction(() => !cacheRebuilding && !cacheStale, { timeout: 5000 });
}

async function resetDestructionState(page) {
  await page.evaluate(() => {
    TextDestruction.destroy();
    TextDestruction.init();
  });
  await page.waitForTimeout(500);
  await page.waitForFunction(() => !cacheRebuilding && !cacheStale, { timeout: 5000 });
}

async function getDestructionStats(page) {
  return await page.evaluate(() => ({
    charCount: allChars.length,
    shattered: currentShattered,
    cacheSize: charRectCache.length,
    cacheStale: cacheStale,
    cacheRebuilding: cacheRebuilding,
    isArmed: isArmed,
    activeBatchCount: activeBatchCount,
    gridCellCount: Object.keys(spatialGrid).length,
  }));
}

function log(msg) { process.stderr.write(msg + '\n'); }

// --- Suite 1: Spatial Grid Accuracy ---

async function testSpatialGridAccuracy(page) {
  log('\n=== Suite 1: Spatial Grid Accuracy ===');
  var tests = [];

  await resetDestructionState(page);

  // Inject brute-force reference and comparison function
  var results = await page.evaluate(() => {
    var RADIUS = BLAST_RADIUS;
    var rSq = RADIUS * RADIUS;
    var CELL = GRID_CELL_SIZE;
    var testResults = [];

    // Collect test impact points from known char positions
    var sampleChars = charRectCache.slice(0, Math.min(charRectCache.length, 50));
    if (sampleChars.length === 0) return [{ name: 'sanity', passed: false, detail: 'charRectCache is empty' }];

    // Generate diverse test points
    var testPoints = [];

    // 1. Center of a known char (should get hits)
    var midChar = sampleChars[Math.floor(sampleChars.length / 2)];
    testPoints.push({ name: 'char-center', x: midChar.docX, y: midChar.docY - window.scrollY });

    // 2. Near a char but offset (partial hits)
    testPoints.push({ name: 'offset-from-char', x: midChar.docX + 25, y: midChar.docY - window.scrollY + 25 });

    // 3. Grid cell boundary (docX exactly on 80px boundary)
    var boundaryX = Math.ceil(midChar.docX / CELL) * CELL;
    testPoints.push({ name: 'x-boundary', x: boundaryX, y: midChar.docY - window.scrollY });

    // 4. Grid cell boundary (docY exactly on 80px boundary)
    var boundaryDocY = Math.ceil(midChar.docY / CELL) * CELL;
    testPoints.push({ name: 'y-boundary', x: midChar.docX, y: boundaryDocY - window.scrollY });

    // 5. Grid cell corner (both on 80px boundary)
    testPoints.push({ name: 'cell-corner', x: boundaryX, y: boundaryDocY - window.scrollY });

    // 6. Exactly at BLAST_RADIUS distance from a char
    testPoints.push({ name: 'at-blast-radius', x: midChar.docX + RADIUS, y: midChar.docY - window.scrollY });

    // 7. Just inside BLAST_RADIUS
    testPoints.push({ name: 'inside-blast-radius', x: midChar.docX + RADIUS - 1, y: midChar.docY - window.scrollY });

    // 8. Just outside BLAST_RADIUS
    testPoints.push({ name: 'outside-blast-radius', x: midChar.docX + RADIUS + 1, y: midChar.docY - window.scrollY });

    // 9. Empty space (far from any char)
    testPoints.push({ name: 'empty-space', x: -500, y: -500 });

    // 10. First char
    testPoints.push({ name: 'first-char', x: sampleChars[0].docX, y: sampleChars[0].docY - window.scrollY });

    // 11-20. Spread across cache using various chars
    for (var s = 0; s < 10; s++) {
      var idx = Math.floor(s * charRectCache.length / 10);
      var c = charRectCache[idx];
      if (c) {
        testPoints.push({
          name: 'spread-' + s,
          x: c.docX + (Math.random() - 0.5) * 30,
          y: (c.docY - window.scrollY) + (Math.random() - 0.5) * 30
        });
      }
    }

    // Run comparison for each test point
    for (var t = 0; t < testPoints.length; t++) {
      var pt = testPoints[t];
      var screenX = pt.x;
      var screenY = pt.y;
      var docX = screenX;
      var docY = screenY + window.scrollY;

      // Brute-force scan (non-destructive read of charRectCache)
      var bruteHitEls = [];
      for (var i = 0; i < charRectCache.length; i++) {
        var entry = charRectCache[i];
        var dx = entry.docX - docX;
        var dy = entry.docY - docY;
        if (dx * dx + dy * dy <= rSq) {
          bruteHitEls.push(entry.el);
        }
      }

      // Grid lookup (destructive — splices from grid)
      var gridHits = getCharsInBlastRadius(screenX, screenY);
      var gridHitEls = gridHits.map(function(h) { return h.el; });

      // Compare sets (order-independent)
      var bruteSet = new Set(bruteHitEls);
      var gridSet = new Set(gridHitEls);

      var missingFromGrid = bruteHitEls.filter(function(el) { return !gridSet.has(el); });
      var extraInGrid = gridHitEls.filter(function(el) { return !bruteSet.has(el); });

      var passed = missingFromGrid.length === 0 && extraInGrid.length === 0;
      testResults.push({
        name: pt.name,
        passed: passed,
        detail: passed
          ? 'hits=' + bruteHitEls.length
          : 'brute=' + bruteHitEls.length + ' grid=' + gridHitEls.length +
            ' missing=' + missingFromGrid.length + ' extra=' + extraInGrid.length
      });

      // Rebuild cache for next test point (grid was modified by splice)
      cacheStale = true;
      rebuildCharCache();
    }

    return testResults;
  });

  results.forEach(function(r) {
    log((r.passed ? 'PASS' : 'FAIL') + '  spatial-grid/' + r.name + ' -- ' + r.detail);
    tests.push(r);
  });

  return { name: 'spatial-grid-accuracy', passed: tests.every(function(t) { return t.passed; }), tests: tests };
}

// --- Suite 2: Document-Relative Cache Coords ---

async function testDocRelativeCoords(page) {
  log('\n=== Suite 2: Document-Relative Cache Coords ===');
  var tests = [];

  await resetDestructionState(page);

  // Run entire scroll test in a single evaluate to track specific elements
  // across scroll positions (cache may be rebuilt between evaluate calls)
  var results = await page.evaluate(() => {
    var testResults = [];
    var count = Math.min(charRectCache.length, 10);
    if (count === 0) return [{ name: 'sanity', passed: false, detail: 'empty cache' }];

    // Capture specific elements and their cached docY at scroll=0
    var tracked = [];
    for (var i = 0; i < count; i++) {
      var entry = charRectCache[i];
      tracked.push({ el: entry.el, docX: entry.docX, docY: entry.docY });
    }

    // Test 1: Verify cache coords match getBoundingClientRect at scroll=0
    var scrollY0 = window.scrollY;
    for (var i = 0; i < tracked.length; i++) {
      var t = tracked[i];
      var rect = t.el.getBoundingClientRect();
      var expectedDocX = rect.left + rect.width / 2;
      var expectedDocY = rect.top + rect.height / 2 + scrollY0;
      var dxErr = Math.abs(t.docX - expectedDocX);
      var dyErr = Math.abs(t.docY - expectedDocY);
      testResults.push({
        name: 'scroll0-entry' + i,
        passed: dxErr <= 1 && dyErr <= 1,
        detail: 'dxErr=' + dxErr.toFixed(2) + ' dyErr=' + dyErr.toFixed(2)
      });
    }

    // Test 2: Scroll 500px, verify docY - scrollY maps to screen position
    window.scrollTo(0, 500);
    // Force layout so getBoundingClientRect reflects new scroll
    var scrollY500 = window.scrollY;

    for (var i = 0; i < tracked.length; i++) {
      var t = tracked[i];
      var rect = t.el.getBoundingClientRect();
      var screenYFromCache = t.docY - scrollY500;
      var actualScreenY = rect.top + rect.height / 2;
      var yErr = Math.abs(screenYFromCache - actualScreenY);
      var actualScreenX = rect.left + rect.width / 2;
      var xErr = Math.abs(t.docX - actualScreenX);
      testResults.push({
        name: 'scroll500-entry' + i,
        passed: xErr <= 1 && yErr <= 1,
        detail: 'xErr=' + xErr.toFixed(2) + ' yErr=' + yErr.toFixed(2)
      });
    }

    // Test 3: Scroll back to 0, verify again
    window.scrollTo(0, 0);
    var scrollYBack = window.scrollY;

    for (var i = 0; i < tracked.length; i++) {
      var t = tracked[i];
      var rect = t.el.getBoundingClientRect();
      var screenYFromCache = t.docY - scrollYBack;
      var actualScreenY = rect.top + rect.height / 2;
      var yErr = Math.abs(screenYFromCache - actualScreenY);
      var actualScreenX = rect.left + rect.width / 2;
      var xErr = Math.abs(t.docX - actualScreenX);
      testResults.push({
        name: 'scrollBack0-entry' + i,
        passed: xErr <= 1 && yErr <= 1,
        detail: 'xErr=' + xErr.toFixed(2) + ' yErr=' + yErr.toFixed(2)
      });
    }

    return testResults;
  });

  results.forEach(function(r) {
    log((r.passed ? 'PASS' : 'FAIL') + '  doc-coords/' + r.name + ' -- ' + r.detail);
    tests.push(r);
  });

  return { name: 'doc-relative-coords', passed: tests.every(function(t) { return t.passed; }), tests: tests };
}

// --- Suite 3: Tween Pressure Monitor ---

async function testPressureMonitor(page) {
  log('\n=== Suite 3: Tween Pressure Monitor ===');
  var tests = [];

  await resetDestructionState(page);

  // Scroll to #about so text is in viewport and cache
  await page.evaluate(() => {
    var el = document.querySelector('#about');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(300);
  // Rebuild cache with #about in viewport
  await page.evaluate(() => { cacheStale = true; scheduleEagerCacheWarm(); });
  await page.waitForTimeout(200);
  await page.waitForFunction(() => !cacheRebuilding && !cacheStale, { timeout: 5000 });

  // Find dense text area for impacts
  var aboutCenter = await page.evaluate(() => {
    var el = document.querySelector('.about-prose p');
    if (!el) el = document.querySelector('#about h2');
    if (!el) el = document.querySelector('h1');
    var rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });

  if (!aboutCenter) {
    log('FAIL  pressure/setup -- could not find text target');
    return { name: 'pressure-monitor', passed: false, tests: [{ name: 'setup', passed: false, detail: 'no target' }] };
  }

  // Fire 12 rapid impacts and verify they all proceed (no pressure gating)
  var afterRapidFire = await page.evaluate(({ cx, cy }) => {
    var points = [];
    for (var i = 0; i < 12; i++) {
      points.push({ x: cx + (i % 4) * 15 - 22, y: cy + Math.floor(i / 4) * 15 - 15 });
    }
    points.forEach(function(p) { TextDestruction.onProjectileAt(p.x, p.y); });
    return {
      activeBatchCount: activeBatchCount,
      shattered: currentShattered
    };
  }, { cx: aboutCenter.x, cy: aboutCenter.y });

  // Test: batches are being tracked
  var tracked = afterRapidFire.activeBatchCount > 0;
  log((tracked ? 'PASS' : 'FAIL') + '  pressure/batches-tracked -- activeBatchCount=' +
      afterRapidFire.activeBatchCount);
  tests.push({ name: 'batches-tracked', passed: tracked, detail: 'count=' + afterRapidFire.activeBatchCount });

  // Test: some impacts were actually processed
  var hadImpact = afterRapidFire.shattered > 0;
  log((hadImpact ? 'PASS' : 'FAIL') + '  pressure/impacts-processed -- shattered=' + afterRapidFire.shattered);
  tests.push({ name: 'impacts-processed', passed: hadImpact, detail: 'shattered=' + afterRapidFire.shattered });

  // Poll until activeBatchCount returns to 0
  var batchRecovered = false;
  for (var poll = 0; poll < 50; poll++) { // 50 * 200ms = 10s max
    await page.waitForTimeout(200);
    var count = await page.evaluate(() => activeBatchCount);
    if (count === 0) {
      batchRecovered = true;
      break;
    }
  }
  log((batchRecovered ? 'PASS' : 'FAIL') + '  pressure/batch-recovery -- returned to 0');
  tests.push({ name: 'batch-recovery', passed: batchRecovered, detail: batchRecovered ? 'ok' : 'timeout' });

  // Wait for reform completion (shattered should return to 0)
  var reformRecovered = false;
  for (var poll2 = 0; poll2 < 40; poll2++) { // 40 * 200ms = 8s max
    await page.waitForTimeout(200);
    var shattered = await page.evaluate(() => currentShattered);
    if (shattered === 0) {
      reformRecovered = true;
      break;
    }
  }
  log((reformRecovered ? 'PASS' : 'FAIL') + '  pressure/reform-recovery -- currentShattered=0');
  tests.push({ name: 'reform-recovery', passed: reformRecovered, detail: reformRecovered ? 'ok' : 'timeout' });

  return { name: 'pressure-monitor', passed: tests.every(function(t) { return t.passed; }), tests: tests };
}

// --- Suite 4: Cache Lifecycle ---

async function testCacheLifecycle(page) {
  log('\n=== Suite 4: Cache Lifecycle ===');
  var tests = [];

  await resetDestructionState(page);

  // Record initial state
  var initial = await getDestructionStats(page);
  var hasCache = initial.cacheSize > 0;
  log((hasCache ? 'PASS' : 'FAIL') + '  lifecycle/initial-cache -- size=' + initial.cacheSize);
  tests.push({ name: 'initial-cache', passed: hasCache, detail: 'size=' + initial.cacheSize });

  // Find a target and fire one impact
  var target = await page.evaluate(() => {
    if (charRectCache.length === 0) return null;
    // Pick a char near the middle of the cache
    var mid = Math.floor(charRectCache.length / 2);
    var c = charRectCache[mid];
    return { x: c.docX, y: c.docY - window.scrollY };
  });

  if (!target) {
    log('FAIL  lifecycle/setup -- no cache entries');
    return { name: 'cache-lifecycle', passed: false, tests: [{ name: 'setup', passed: false, detail: 'empty cache' }] };
  }

  await page.evaluate(({ x, y }) => { TextDestruction.onProjectileAt(x, y); }, target);
  await page.waitForTimeout(200);

  // Verify chars are shattered
  var afterImpact = await page.evaluate(() => ({
    shattered: currentShattered,
    activeBatchCount: activeBatchCount,
    hasShatteredChars: !!document.querySelector('[data-shattered="1"]')
  }));

  var gotShattered = afterImpact.shattered > 0 && afterImpact.hasShatteredChars;
  log((gotShattered ? 'PASS' : 'FAIL') + '  lifecycle/shatter -- shattered=' + afterImpact.shattered);
  tests.push({ name: 'shatter', passed: gotShattered, detail: 'shattered=' + afterImpact.shattered });

  // Wait for scatter + reform (SCATTER_DURATION=1.2 + REFORM_PAUSE=0.8 + stagger ~1s + cleanup)
  // Poll for cacheStale to become true (set by reformComplete)
  var reformTriggeredStale = false;
  for (var i = 0; i < 40; i++) { // 40 * 200ms = 8s
    await page.waitForTimeout(200);
    var state = await page.evaluate(() => ({
      cacheStale: cacheStale,
      shattered: currentShattered,
      activeBatchCount: activeBatchCount
    }));
    // Reform is complete when shattered returns to 0 — cache should be stale or already rebuilt
    if (state.shattered === 0 && state.activeBatchCount === 0) {
      reformTriggeredStale = true;
      break;
    }
  }
  log((reformTriggeredStale ? 'PASS' : 'FAIL') + '  lifecycle/reform-complete');
  tests.push({ name: 'reform-complete', passed: reformTriggeredStale, detail: reformTriggeredStale ? 'ok' : 'timeout' });

  // Wait for cache rebuild (scheduleEagerCacheWarm fires when activeBatchCount===0 && cacheStale)
  var cacheRebuilt = false;
  for (var j = 0; j < 20; j++) { // 20 * 200ms = 4s
    await page.waitForTimeout(200);
    var rebuildState = await page.evaluate(() => ({
      cacheStale: cacheStale,
      cacheRebuilding: cacheRebuilding,
      cacheSize: charRectCache.length
    }));
    if (!rebuildState.cacheStale && !rebuildState.cacheRebuilding) {
      cacheRebuilt = true;
      break;
    }
  }
  log((cacheRebuilt ? 'PASS' : 'FAIL') + '  lifecycle/cache-rebuilt');
  tests.push({ name: 'cache-rebuilt', passed: cacheRebuilt, detail: cacheRebuilt ? 'ok' : 'stale=' + !cacheRebuilt });

  // Verify cache size recovered (reformed chars re-entered)
  var finalStats = await getDestructionStats(page);
  // Allow 10% tolerance — some chars may have scrolled off viewport
  var tolerance = Math.floor(initial.cacheSize * 0.1);
  var sizeRecovered = finalStats.cacheSize >= initial.cacheSize - tolerance;
  log((sizeRecovered ? 'PASS' : 'FAIL') + '  lifecycle/cache-size-recovered -- initial=' +
      initial.cacheSize + ' final=' + finalStats.cacheSize + ' tolerance=' + tolerance);
  tests.push({ name: 'cache-size-recovered', passed: sizeRecovered, detail: 'initial=' + initial.cacheSize + ' final=' + finalStats.cacheSize });

  // Verify reformed chars exist in spatial grid
  var inGrid = await page.evaluate(() => {
    // Find a char that was shattered and is now reformed
    var reformed = document.querySelectorAll('[data-shattered="0"]');
    if (reformed.length === 0) return { checked: false, reason: 'no reformed chars found' };

    var el = reformed[0];
    var rect = el.getBoundingClientRect();
    var docX = rect.left + rect.width / 2;
    var docY = rect.top + rect.height / 2 + window.scrollY;
    var col = Math.floor(docX / GRID_CELL_SIZE);
    var row = Math.floor(docY / GRID_CELL_SIZE);
    var key = col + ',' + row;
    var cell = spatialGrid[key];
    if (!cell) return { checked: true, found: false, key: key };

    var found = cell.some(function(entry) { return entry.el === el; });
    return { checked: true, found: found, key: key, cellSize: cell.length };
  });

  var gridOk = inGrid.checked && inGrid.found;
  log((gridOk ? 'PASS' : 'FAIL') + '  lifecycle/reformed-in-grid -- ' + JSON.stringify(inGrid));
  tests.push({ name: 'reformed-in-grid', passed: gridOk, detail: JSON.stringify(inGrid) });

  return { name: 'cache-lifecycle', passed: tests.every(function(t) { return t.passed; }), tests: tests };
}

// --- Main ---

async function main() {
  log('Destruction Correctness Tests');
  log('============================');

  var browser;
  try {
    browser = await chromium.launch({ headless: true });
    var context = await browser.newContext({ viewport: VIEWPORT });
    var page = await context.newPage();

    await waitForPageReady(page);

    var stats = await getDestructionStats(page);
    log('Initial stats: chars=' + stats.charCount + ' cache=' + stats.cacheSize + ' armed=' + stats.isArmed);

    if (stats.charCount === 0) {
      log('FATAL: No chars found — destruction system did not initialize');
      process.exit(2);
    }

    var results = [];
    results.push(await testSpatialGridAccuracy(page));
    results.push(await testDocRelativeCoords(page));
    results.push(await testPressureMonitor(page));
    results.push(await testCacheLifecycle(page));

    // Summary
    log('\n=== Summary ===');
    var totalTests = 0;
    var totalPassed = 0;
    results.forEach(function(suite) {
      var suitePassed = suite.tests.filter(function(t) { return t.passed; }).length;
      var suiteTotal = suite.tests.length;
      totalTests += suiteTotal;
      totalPassed += suitePassed;
      log((suite.passed ? 'PASS' : 'FAIL') + '  ' + suite.name + ' (' + suitePassed + '/' + suiteTotal + ')');
    });
    log('\nTotal: ' + totalPassed + '/' + totalTests + ' passed');

    await browser.close();
    process.exit(totalPassed === totalTests ? 0 : 1);
  } catch (err) {
    log('FATAL: ' + err.message);
    if (browser) await browser.close();
    process.exit(2);
  }
}

main();
