/**
 * Mobile Touch Interaction Test
 *
 * Verifies mobile touch support for the card hand system:
 *   - Tap-to-lift (toggle hover-active)
 *   - Drag without lift prerequisite
 *   - Scroll lock during drag
 *   - Second touch ignored
 *   - Plane mode disables interaction
 *   - Outside touch dismisses lift
 *   - Play zone scales with viewport
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   node tests/mobile-touch-test.js
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';

const VIEWPORT = { width: 390, height: 844 }; // iPhone 14

let allPassed = true;
const results = [];

function report(name, passed, detail) {
  results.push({ name, passed, detail });
  if (!passed) allPassed = false;
}

async function createMobilePage(browser) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.card', { timeout: 5000 });
  await page.waitForTimeout(400);
  return { context, page };
}

// Helper: get the center of the first card's visible area
async function getFirstCardCenter(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.hand-container .card');
    if (!card) return null;
    const rect = card.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + 30 }; // top 30px visible
  });
}

// Helper: simulate a touch tap via CDP
async function touchTap(page, x, y) {
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  await page.waitForTimeout(50);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await page.waitForTimeout(100);
}

// Helper: simulate a touch drag via CDP
async function touchDrag(page, startX, startY, endX, endY, steps) {
  steps = steps || 10;
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }],
  });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cx = startX + (endX - startX) * t;
    const cy = startY + (endY - startY) * t;
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: cx, y: cy }],
    });
    await page.waitForTimeout(16);
  }
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await page.waitForTimeout(100);
}

/* ========== TESTS ========== */

async function testTapToLift(browser) {
  const { context, page } = await createMobilePage(browser);
  try {
    const center = await getFirstCardCenter(page);
    if (!center) { report('tap-to-lift', false, 'No card found'); return; }

    // Tap the first card
    await touchTap(page, center.x, center.y);

    const lifted = await page.evaluate(() => {
      const card = document.querySelector('.hand-container .card');
      return card ? card.classList.contains('hover-active') : false;
    });
    report('tap-to-lift', lifted, lifted ? 'Card lifted on tap' : 'Card NOT lifted on tap');
  } finally {
    await context.close();
  }
}

async function testTapToUnlift(browser) {
  const { context, page } = await createMobilePage(browser);
  try {
    const center = await getFirstCardCenter(page);
    if (!center) { report('tap-to-unlift', false, 'No card found'); return; }

    // Tap to lift
    await touchTap(page, center.x, center.y);
    await page.waitForTimeout(100);

    // Tap again to unlift
    await touchTap(page, center.x, center.y);

    const lifted = await page.evaluate(() => {
      const card = document.querySelector('.hand-container .card');
      return card ? card.classList.contains('hover-active') : false;
    });
    report('tap-to-unlift', !lifted, !lifted ? 'Card unlifted on second tap' : 'Card still lifted after second tap');
  } finally {
    await context.close();
  }
}

async function testDragWithoutLift(browser) {
  const { context, page } = await createMobilePage(browser);
  try {
    const center = await getFirstCardCenter(page);
    if (!center) { report('drag-without-lift', false, 'No card found'); return; }

    // Drag the card upward (toward viewport center) without tapping first
    const endY = center.y - 200;
    await touchDrag(page, center.x, center.y, center.x, endY, 15);

    // After drag ends, card should have returned to hand (not still dragging)
    const state = await page.evaluate(() => {
      return {
        animState: window.animState,
        hasDragging: !!document.querySelector('.card.dragging'),
      };
    });
    // animState should be IDLE or RETURNING (not stuck in DRAGGING)
    const passed = state.animState !== 'DRAGGING' && !state.hasDragging;
    report('drag-without-lift', passed, 'animState=' + state.animState + ', dragging=' + state.hasDragging);
  } finally {
    await context.close();
  }
}

async function testScrollLockDuringDrag(browser) {
  const { context, page } = await createMobilePage(browser);
  try {
    const center = await getFirstCardCenter(page);
    if (!center) { report('scroll-lock', false, 'No card found'); return; }

    // Start a drag (use CDP for fine control)
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: center.x, y: center.y }],
    });
    // Move enough to trigger drag
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: center.x, y: center.y - 20 }],
    });
    await page.waitForTimeout(50);

    // Check that card-dragging class is on html
    const hasClass = await page.evaluate(() => {
      return document.documentElement.classList.contains('card-dragging');
    });

    // End drag
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.waitForTimeout(200);

    // Class should be removed after drag ends
    const hasClassAfter = await page.evaluate(() => {
      return document.documentElement.classList.contains('card-dragging');
    });

    const passed = hasClass && !hasClassAfter;
    report('scroll-lock', passed,
      'During drag: card-dragging=' + hasClass + ', after drag: card-dragging=' + hasClassAfter);
  } finally {
    await context.close();
  }
}

async function testPlaneModePreventsInteraction(browser) {
  const { context, page } = await createMobilePage(browser);
  try {
    // Simulate plane mode by adding the class directly
    await page.evaluate(() => {
      document.documentElement.classList.add('plane-active');
    });

    const center = await getFirstCardCenter(page);
    if (!center) { report('plane-mode-block', false, 'No card found'); return; }

    await touchTap(page, center.x, center.y);

    const lifted = await page.evaluate(() => {
      const card = document.querySelector('.hand-container .card');
      return card ? card.classList.contains('hover-active') : false;
    });

    report('plane-mode-block', !lifted,
      !lifted ? 'Card NOT lifted (plane mode blocks)' : 'Card lifted despite plane mode');
  } finally {
    await context.close();
  }
}

async function testOutsideTouchDismissesLift(browser) {
  const { context, page } = await createMobilePage(browser);
  try {
    const center = await getFirstCardCenter(page);
    if (!center) { report('outside-dismiss', false, 'No card found'); return; }

    // Tap to lift
    await touchTap(page, center.x, center.y);

    // Verify lifted
    const liftedBefore = await page.evaluate(() => {
      const card = document.querySelector('.hand-container .card');
      return card ? card.classList.contains('hover-active') : false;
    });
    if (!liftedBefore) {
      report('outside-dismiss', false, 'Card not lifted before outside tap');
      return;
    }

    // Tap outside the hand area (top of page)
    await touchTap(page, VIEWPORT.width / 2, 100);

    const liftedAfter = await page.evaluate(() => {
      return window._liftedCardId;
    });

    const passed = liftedAfter === -1;
    report('outside-dismiss', passed,
      passed ? 'Lift dismissed on outside tap' : '_liftedCardId=' + liftedAfter);
  } finally {
    await context.close();
  }
}

async function testPlayZoneScaling(browser) {
  const { context, page } = await createMobilePage(browser);
  try {
    const data = await page.evaluate(() => {
      return {
        playZoneHalfW: window.PLAY_ZONE_HALF_W,
        playZoneHalfH: window.PLAY_ZONE_HALF_H,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        isMob: window._isMobHand,
      };
    });

    // On mobile, play zone should scale with viewport (capped at desktop max)
    const wScaled = data.isMob && data.playZoneHalfW <= 385 && data.playZoneHalfW === Math.min(Math.round(data.viewportW * 0.45), 385);
    const hScaled = data.isMob && data.playZoneHalfH <= 289 && data.playZoneHalfH === Math.min(Math.round(data.viewportH * 0.35), 289);
    const passed = wScaled && hScaled;
    report('play-zone-scaling', passed,
      'isMob=' + data.isMob + ' halfW=' + data.playZoneHalfW + ' halfH=' + data.playZoneHalfH);
  } finally {
    await context.close();
  }
}

async function testHoverSuppressedOnTouch(browser) {
  const { context, page } = await createMobilePage(browser);
  try {
    const center = await getFirstCardCenter(page);
    if (!center) { report('hover-suppressed', false, 'No card found'); return; }

    // Dispatch a touch pointerover — hover should not activate
    await page.evaluate(({ cx, cy }) => {
      var card = document.querySelector('.hand-container .card');
      var evt = new PointerEvent('pointerover', {
        bubbles: true, clientX: cx, clientY: cy, pointerType: 'touch',
      });
      card.dispatchEvent(evt);
    }, { cx: center.x, cy: center.y });

    await page.waitForTimeout(50);

    const lifted = await page.evaluate(() => {
      var cards = document.querySelectorAll('.hand-container .card');
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].classList.contains('hover-active')) return true;
      }
      return false;
    });

    report('hover-suppressed', !lifted,
      !lifted ? 'No hover-active on touch pointerover' : 'hover-active set despite touch');
  } finally {
    await context.close();
  }
}

/* ========== RUNNER ========== */

async function run() {
  const browser = await chromium.launch();

  await testTapToLift(browser);
  await testTapToUnlift(browser);
  await testDragWithoutLift(browser);
  await testScrollLockDuringDrag(browser);
  await testPlaneModePreventsInteraction(browser);
  await testOutsideTouchDismissesLift(browser);
  await testPlayZoneScaling(browser);
  await testHoverSuppressedOnTouch(browser);

  await browser.close();

  console.log('\n=== Mobile Touch Test Results ===\n');
  results.forEach(function(r) {
    console.log((r.passed ? 'PASS' : 'FAIL') + '  ' + r.name + '  —  ' + r.detail);
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
