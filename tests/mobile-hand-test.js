/**
 * Mobile Hand-Card Layout Test
 *
 * Verifies that all cards in the hand fan are visible and fit within
 * the viewport on iPhone-sized screens (375x812).
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   node tests/mobile-hand-test.js
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';

const VIEWPORTS = [
  { name: 'iPhone SE',     width: 375, height: 667 },
  { name: 'iPhone 14',     width: 390, height: 844 },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932 },
];

async function runTest() {
  const browser = await chromium.launch();
  const results = [];
  let allPassed = true;

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    // Wait for cards to render
    await page.waitForSelector('.card', { timeout: 5000 });
    await page.waitForTimeout(500);

    const data = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cards = document.querySelectorAll('.hand-container .card');
      const cardResults = [];
      let allVisible = true;

      cards.forEach((card, i) => {
        const rect = card.getBoundingClientRect();
        // Cards are intentionally sunk below viewport (hand effect).
        // Check: horizontal fit and that at least 30px is visible above viewport bottom.
        const hFits = rect.left >= -5 && rect.right <= vw + 5;
        const visibleAboveFold = vh - rect.top >= 30;
        const ok = hFits && visibleAboveFold;
        if (!ok) allVisible = false;
        cardResults.push({
          index: i,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          hFits,
          visibleAboveFold,
          ok,
        });
      });

      return {
        viewportWidth: vw,
        viewportHeight: vh,
        cardCount: cards.length,
        allVisible,
        cards: cardResults,
      };
    });

    const passed = data.cardCount >= 3 && data.allVisible;
    if (!passed) allPassed = false;

    results.push({
      viewport: vp.name + ' (' + vp.width + 'x' + vp.height + ')',
      passed,
      cardCount: data.cardCount,
      allVisible: data.allVisible,
      cards: data.cards,
    });

    await context.close();
  }

  await browser.close();

  console.log(JSON.stringify(results, null, 2));

  if (!allPassed) {
    console.error('\nFAILED: Some cards overflow the viewport on mobile.');
    process.exit(1);
  } else {
    console.log('\nPASSED: All cards fit within viewport on all tested mobile sizes.');
    process.exit(0);
  }
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
