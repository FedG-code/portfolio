/**
 * Blur Overlay Cleanup Test
 *
 * Verifies that #dragBlurOverlay is fully cleared after a card play animation.
 * Catches a mobile-specific bug where webkitBackdropFilter is set during the
 * wriggle phase but never animated back to zero in the expand phase cleanup,
 * leaving the screen permanently blurred on WebKit browsers.
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   node tests/blur-overlay-cleanup-test.js
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const TRANSITION_SETTLE_MS = 6000;

var allPassed = true;
var results = [];

function report(name, passed, detail) {
  results.push({ name: name, passed: passed, detail: detail });
  if (!passed) allPassed = false;
}

/**
 * Trigger a card play animation and wait for it to fully settle.
 */
async function triggerCardPlayAndWait(page) {
  await page.evaluate(function() {
    var cards = document.querySelectorAll('.card');
    var targetCard = null;
    cards.forEach(function(c) {
      if (c.dataset.cardId === '1') targetCard = c;
    });
    if (!targetCard) targetCard = cards[1];
    if (targetCard && window.playCard) {
      window.playCard(targetCard, 1);
    } else {
      throw new Error('Could not find card or playCard function');
    }
  });
  await page.waitForTimeout(TRANSITION_SETTLE_MS);
}

/**
 * Read all blur-related styles from the overlay element.
 */
async function getOverlayState(page) {
  return page.evaluate(function() {
    var overlay = document.getElementById('dragBlurOverlay');
    if (!overlay) return null;
    var cs = getComputedStyle(overlay);
    return {
      inlineBackdropFilter: overlay.style.backdropFilter,
      inlineWebkitBackdropFilter: overlay.style.webkitBackdropFilter,
      inlineBackground: overlay.style.background,
      computedBackdropFilter: cs.backdropFilter,
      computedWebkitBackdropFilter: cs.webkitBackdropFilter,
      computedBackground: cs.background,
    };
  });
}

function isBlurCleared(val) {
  return !val || val === '' || val === 'blur(0px)' || val === 'none';
}

function isBgCleared(val) {
  return !val || val === '' || val === 'rgba(0,0,0,0)' || val === 'rgba(0, 0, 0, 0)' || val === 'transparent';
}

/* ───────────────────────────────────────────
   Test 1: Mobile — webkitBackdropFilter cleared
   ─────────────────────────────────────────── */
async function testMobileBlurCleared(browser) {
  var context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  var page = await context.newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('.card', { timeout: 5000 });
    await page.waitForTimeout(400);

    await triggerCardPlayAndWait(page);

    var state = await getOverlayState(page);
    if (!state) {
      report('mobile-webkit-backdrop-cleared', false, 'Overlay element not found');
      return;
    }

    var webkit = state.inlineWebkitBackdropFilter;
    report('mobile-webkit-backdrop-cleared', isBlurCleared(webkit),
      'webkitBackdropFilter=' + JSON.stringify(webkit) +
      ' backdropFilter=' + JSON.stringify(state.inlineBackdropFilter));

    var standard = state.inlineBackdropFilter;
    report('mobile-backdrop-cleared', isBlurCleared(standard),
      'backdropFilter=' + JSON.stringify(standard));

    var bg = state.inlineBackground;
    report('mobile-background-cleared', isBgCleared(bg),
      'background=' + JSON.stringify(bg));
  } finally {
    await context.close();
  }
}

/* ───────────────────────────────────────────
   Test 2: Desktop — both filters cleared
   ─────────────────────────────────────────── */
async function testDesktopBlurCleared(browser) {
  var context = await browser.newContext({
    viewport: DESKTOP_VIEWPORT,
  });
  var page = await context.newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('.card', { timeout: 5000 });
    await page.waitForTimeout(400);

    await triggerCardPlayAndWait(page);

    var state = await getOverlayState(page);
    if (!state) {
      report('desktop-webkit-backdrop-cleared', false, 'Overlay element not found');
      return;
    }

    var webkit = state.inlineWebkitBackdropFilter;
    report('desktop-webkit-backdrop-cleared', isBlurCleared(webkit),
      'webkitBackdropFilter=' + JSON.stringify(webkit) +
      ' backdropFilter=' + JSON.stringify(state.inlineBackdropFilter));

    var standard = state.inlineBackdropFilter;
    report('desktop-backdrop-cleared', isBlurCleared(standard),
      'backdropFilter=' + JSON.stringify(standard));
  } finally {
    await context.close();
  }
}

/* ───────────────────────────────────────────
   Test 3: Mobile — computed style shows no blur
   ─────────────────────────────────────────── */
async function testMobileComputedBlur(browser) {
  var context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  var page = await context.newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('.card', { timeout: 5000 });
    await page.waitForTimeout(400);

    await triggerCardPlayAndWait(page);

    var state = await getOverlayState(page);
    if (!state) {
      report('mobile-computed-no-blur', false, 'Overlay element not found');
      return;
    }

    var computed = state.computedBackdropFilter || '';
    var blurMatch = computed.match(/blur\((\d+\.?\d*)px\)/);
    var blurValue = blurMatch ? parseFloat(blurMatch[1]) : 0;
    report('mobile-computed-no-blur', blurValue < 0.5,
      'computedBackdropFilter=' + JSON.stringify(computed) + ' blurValue=' + blurValue);
  } finally {
    await context.close();
  }
}

/* ───────────────────────────────────────────
   Test 4: Mobile — overlay is visually non-blocking
   ─────────────────────────────────────────── */
async function testOverlayNonBlocking(browser) {
  var context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  var page = await context.newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('.card', { timeout: 5000 });
    await page.waitForTimeout(400);

    await triggerCardPlayAndWait(page);

    var blocking = await page.evaluate(function() {
      var overlay = document.getElementById('dragBlurOverlay');
      if (!overlay) return { exists: false };
      var cs = getComputedStyle(overlay);
      var hasBlur = cs.backdropFilter && cs.backdropFilter !== 'none' && cs.backdropFilter !== 'blur(0px)';
      var hasWebkitBlur = cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none' && cs.webkitBackdropFilter !== 'blur(0px)';
      var hasBg = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
      return {
        exists: true,
        hasBlur: !!hasBlur,
        hasWebkitBlur: !!hasWebkitBlur,
        hasBg: !!hasBg,
        opacity: cs.opacity,
      };
    });

    if (!blocking.exists) {
      report('overlay-non-blocking', true, 'Overlay element removed');
      return;
    }

    var passed = !blocking.hasBlur && !blocking.hasWebkitBlur && !blocking.hasBg;
    report('overlay-non-blocking', passed,
      'blur=' + blocking.hasBlur + ' webkitBlur=' + blocking.hasWebkitBlur +
      ' bg=' + blocking.hasBg + ' opacity=' + blocking.opacity);
  } finally {
    await context.close();
  }
}

/* ───────────────────────────────────────────
   Runner
   ─────────────────────────────────────────── */
async function run() {
  var browser = await chromium.launch({ headless: true });

  await testMobileBlurCleared(browser);
  await testDesktopBlurCleared(browser);
  await testMobileComputedBlur(browser);
  await testOverlayNonBlocking(browser);

  await browser.close();

  console.log('\n=== Blur Overlay Cleanup Test Results ===\n');
  results.forEach(function(r) {
    console.log((r.passed ? 'PASS' : 'FAIL') + '  ' + r.name + '  --  ' + r.detail);
  });

  if (allPassed) {
    console.log('\nAll tests PASSED.');
    process.exit(0);
  } else {
    console.error('\nSome tests FAILED.');
    process.exit(1);
  }
}

run().catch(function(err) {
  console.error(err);
  process.exit(1);
});
