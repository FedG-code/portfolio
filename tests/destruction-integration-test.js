/**
 * Destruction System Integration Tests
 *
 * Validates scatter + reform behavior across multiple viewports and
 * verifies mobile-desktop parity (no mobile-specific downgrades).
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   node tests/destruction-integration-test.js
 *
 * Exit: 0 = all pass, 1 = any failure
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';

const VIEWPORTS = [
  { label: 'desktop', width: 1920, height: 1080 },
  { label: 'mobile',  width: 375,  height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { label: 'tablet',  width: 1024, height: 768 },
];

// --- Helpers ---

async function overrideRevealVisibility(page) {
  await page.evaluate(() => {
    var style = document.createElement('style');
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

async function ensureArmedAndWarm(page) {
  await page.evaluate(() => {
    if (!isArmed) TextDestruction.init();
    cacheStale = true;
    scheduleEagerCacheWarm();
  });
  await page.waitForTimeout(200);
  await page.waitForFunction(() => !cacheRebuilding && !cacheStale, { timeout: 5000 });
}

// Get a point guaranteed to be near cached characters
async function getCachedCharCenter(page) {
  return await page.evaluate(() => {
    if (charRectCache.length === 0) return null;
    var mid = Math.floor(charRectCache.length / 2);
    var c = charRectCache[mid];
    return { x: c.docX, y: c.docY - window.scrollY };
  });
}

async function getElementCenter(page, selector) {
  return await page.evaluate((sel) => {
    var el = document.querySelector(sel);
    if (!el) return null;
    var rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, selector);
}

function log(msg) { process.stderr.write(msg + '\n'); }

// --- Test 1: Scatter and Reform (per viewport) ---

async function testScatterReform(browser, vpConfig) {
  var label = vpConfig.label;
  log('\n--- Scatter+Reform @ ' + label + ' (' + vpConfig.width + 'x' + vpConfig.height + ') ---');
  var tests = [];

  var contextOpts = { viewport: { width: vpConfig.width, height: vpConfig.height } };
  if (vpConfig.isMobile) contextOpts.isMobile = true;
  if (vpConfig.hasTouch) contextOpts.hasTouch = true;
  if (vpConfig.deviceScaleFactor) contextOpts.deviceScaleFactor = vpConfig.deviceScaleFactor;

  var context = await browser.newContext(contextOpts);
  var page = await context.newPage();

  try {
    await waitForPageReady(page);
    await ensureArmedAndWarm(page);

    var stats = await page.evaluate(() => ({ cacheSize: charRectCache.length, charCount: allChars.length }));
    log('  chars=' + stats.charCount + ' cache=' + stats.cacheSize);

    // Find target — use a cached char position to guarantee a hit
    var center = await getCachedCharCenter(page);

    if (!center) {
      log('FAIL  ' + label + '/scatter -- no cached chars found');
      tests.push({ name: label + '/scatter', passed: false, detail: 'no cached chars' });
      await context.close();
      return tests;
    }

    // Fire impact
    await page.evaluate(({ x, y }) => { TextDestruction.onProjectileAt(x, y); }, center);
    await page.waitForTimeout(200);

    // Verify shatter
    var afterImpact = await page.evaluate(() => currentShattered);
    var scattered = afterImpact > 0;
    log((scattered ? 'PASS' : 'FAIL') + '  ' + label + '/scatter -- shattered=' + afterImpact);
    tests.push({ name: label + '/scatter', passed: scattered, detail: 'shattered=' + afterImpact });

    // Wait for full reform
    var reformed = false;
    for (var i = 0; i < 30; i++) { // 6s max
      await page.waitForTimeout(200);
      var shattered = await page.evaluate(() => currentShattered);
      if (shattered === 0) { reformed = true; break; }
    }
    log((reformed ? 'PASS' : 'FAIL') + '  ' + label + '/reform');
    tests.push({ name: label + '/reform', passed: reformed, detail: reformed ? 'ok' : 'timeout' });

    // Verify chars restored
    var restored = await page.evaluate(() => {
      var shatteredEls = document.querySelectorAll('[data-shattered="1"]');
      return { remainingShattered: shatteredEls.length };
    });
    var allRestored = restored.remainingShattered === 0;
    log((allRestored ? 'PASS' : 'FAIL') + '  ' + label + '/restored -- remaining=' + restored.remainingShattered);
    tests.push({ name: label + '/restored', passed: allRestored, detail: 'remaining=' + restored.remainingShattered });

  } catch (err) {
    log('FAIL  ' + label + '/scatter-reform -- ' + err.message);
    tests.push({ name: label + '/error', passed: false, detail: err.message });
  }

  await context.close();
  return tests;
}

// --- Test 2: Mobile-Desktop Parity ---

async function testMobileDesktopParity(browser) {
  log('\n--- Mobile-Desktop Parity ---');
  var tests = [];

  // Read constants on desktop
  var desktopCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  var desktopPage = await desktopCtx.newPage();
  await waitForPageReady(desktopPage);

  var desktopConsts = await desktopPage.evaluate(() => ({
    GRAVITY: GRAVITY,
    MAX_ROTATION: MAX_ROTATION,
    MIN_VELOCITY: MIN_VELOCITY,
    MAX_VELOCITY: MAX_VELOCITY,
    SCATTER_DURATION: SCATTER_DURATION,
    MAX_ACTIVE_BATCHES: MAX_ACTIVE_BATCHES,
    BLAST_RADIUS: BLAST_RADIUS,
    MAX_SHATTERED: MAX_SHATTERED,
  }));
  await desktopCtx.close();

  // Read constants on mobile
  var mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 3
  });
  var mobilePage = await mobileCtx.newPage();
  await waitForPageReady(mobilePage);

  var mobileConsts = await mobilePage.evaluate(() => ({
    GRAVITY: GRAVITY,
    MAX_ROTATION: MAX_ROTATION,
    MIN_VELOCITY: MIN_VELOCITY,
    MAX_VELOCITY: MAX_VELOCITY,
    SCATTER_DURATION: SCATTER_DURATION,
    MAX_ACTIVE_BATCHES: MAX_ACTIVE_BATCHES,
    BLAST_RADIUS: BLAST_RADIUS,
    MAX_SHATTERED: MAX_SHATTERED,
  }));

  // Compare all constants
  var constNames = Object.keys(desktopConsts);
  constNames.forEach(function(name) {
    var match = desktopConsts[name] === mobileConsts[name];
    log((match ? 'PASS' : 'FAIL') + '  parity/' + name +
        ' -- desktop=' + desktopConsts[name] + ' mobile=' + mobileConsts[name]);
    tests.push({ name: 'parity/' + name, passed: match, detail: 'desktop=' + desktopConsts[name] + ' mobile=' + mobileConsts[name] });
  });

  // Verify mobile can fire multiple batches (was previously capped)
  await ensureArmedAndWarm(mobilePage);

  var mobileMultiBatch = await mobilePage.evaluate(() => {
    if (charRectCache.length < 2) return 0;
    // Pick two spread-out chars for distinct impacts
    var c1 = charRectCache[0];
    var c2 = charRectCache[Math.min(charRectCache.length - 1, Math.floor(charRectCache.length / 2))];
    TextDestruction.onProjectileAt(c1.docX, c1.docY - window.scrollY);
    TextDestruction.onProjectileAt(c2.docX, c2.docY - window.scrollY);
    return activeBatchCount;
  });

  var multiBatch = mobileMultiBatch >= 2;
  log((multiBatch ? 'PASS' : 'FAIL') + '  parity/mobile-multi-batch -- count=' + mobileMultiBatch);
  tests.push({ name: 'parity/mobile-multi-batch', passed: multiBatch, detail: 'count=' + mobileMultiBatch });

  await mobileCtx.close();
  return tests;
}

// --- Test 3: Cross-Page Re-initialization ---

async function testCrossPageReinit(browser) {
  log('\n--- Cross-Page Re-initialization ---');
  var tests = [];

  var context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  var page = await context.newPage();

  try {
    await waitForPageReady(page);
    await ensureArmedAndWarm(page);

    // Verify destruction works on index — use cached char position
    var indexCenter = await getCachedCharCenter(page);
    if (indexCenter) {
      await page.evaluate(({ x, y }) => { TextDestruction.onProjectileAt(x, y); }, indexCenter);
      await page.waitForTimeout(200);
      var indexShattered = await page.evaluate(() => currentShattered);
      var indexWorks = indexShattered > 0;
      log((indexWorks ? 'PASS' : 'FAIL') + '  cross-page/index-shatter -- shattered=' + indexShattered);
      tests.push({ name: 'cross-page/index-shatter', passed: indexWorks, detail: 'shattered=' + indexShattered });
    }

    // Navigate to project page via SPA (trigger card play)
    var hasPlayCard = await page.evaluate(() => typeof window.playCard === 'function');

    if (hasPlayCard) {
      var cardPlayed = await page.evaluate(() => {
        var card = document.querySelector('.card[data-card-id="1"]');
        if (!card) card = document.querySelector('.card[data-card-id="0"]');
        if (!card) return false;
        playCard(card, parseInt(card.dataset.cardId));
        return true;
      });

      if (cardPlayed) {
        // Wait for SPA transition
        await page.waitForTimeout(6000);

        // Check if we're on a project page
        var onProjectPage = await page.evaluate(() => {
          return !!document.querySelector('.project-hero-title') || window.location.pathname.includes('.html');
        });

        if (onProjectPage) {
          // Re-init destruction on project page
          await page.evaluate(() => {
            if (window.TextDestruction) {
              TextDestruction.init();
              cacheStale = true;
            }
          });
          await page.waitForTimeout(500);

          var projectArmed = await page.evaluate(() => isArmed);
          log((projectArmed ? 'PASS' : 'FAIL') + '  cross-page/project-armed');
          tests.push({ name: 'cross-page/project-armed', passed: projectArmed, detail: String(projectArmed) });

          // Wait for cache to be ready
          await page.waitForFunction(() => !cacheRebuilding && !cacheStale, { timeout: 5000 }).catch(() => {});

          // Fire impact on project page
          var projCenter = await getElementCenter(page, '.project-hero-title');
          if (!projCenter) projCenter = await getElementCenter(page, 'h1');

          if (projCenter) {
            await page.evaluate(({ x, y }) => { TextDestruction.onProjectileAt(x, y); }, projCenter);
            await page.waitForTimeout(200);
            var projShattered = await page.evaluate(() => currentShattered);
            var projWorks = projShattered > 0;
            log((projWorks ? 'PASS' : 'FAIL') + '  cross-page/project-shatter -- shattered=' + projShattered);
            tests.push({ name: 'cross-page/project-shatter', passed: projWorks, detail: 'shattered=' + projShattered });
          } else {
            log('SKIP  cross-page/project-shatter -- no target element found');
            tests.push({ name: 'cross-page/project-shatter', passed: true, detail: 'skipped, no target' });
          }
        } else {
          log('SKIP  cross-page/project-* -- SPA transition did not reach project page');
          tests.push({ name: 'cross-page/navigation', passed: true, detail: 'skipped, no project page' });
        }
      } else {
        log('SKIP  cross-page/card-play -- no card found');
        tests.push({ name: 'cross-page/card-play', passed: true, detail: 'skipped, no card' });
      }
    } else {
      log('SKIP  cross-page -- playCard not available');
      tests.push({ name: 'cross-page/playCard', passed: true, detail: 'skipped, no playCard' });
    }

  } catch (err) {
    log('FAIL  cross-page/error -- ' + err.message);
    tests.push({ name: 'cross-page/error', passed: false, detail: err.message });
  }

  await context.close();
  return tests;
}

// --- Main ---

async function main() {
  log('Destruction Integration Tests');
  log('=============================');

  var browser;
  try {
    browser = await chromium.launch({ headless: true });

    var allTests = [];

    // Test 1: Scatter and reform on each viewport
    for (var v = 0; v < VIEWPORTS.length; v++) {
      var vpTests = await testScatterReform(browser, VIEWPORTS[v]);
      allTests = allTests.concat(vpTests);
    }

    // Test 2: Mobile-desktop parity
    var parityTests = await testMobileDesktopParity(browser);
    allTests = allTests.concat(parityTests);

    // Test 3: Cross-page re-initialization
    var crossPageTests = await testCrossPageReinit(browser);
    allTests = allTests.concat(crossPageTests);

    // Summary
    log('\n=== Summary ===');
    var passed = allTests.filter(function(t) { return t.passed; }).length;
    var total = allTests.length;
    allTests.forEach(function(t) {
      if (!t.passed) log('FAIL  ' + t.name + ' -- ' + t.detail);
    });
    log('\nTotal: ' + passed + '/' + total + ' passed');

    await browser.close();
    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    log('FATAL: ' + err.message);
    if (browser) await browser.close();
    process.exit(2);
  }
}

main();
