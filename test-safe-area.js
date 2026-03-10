/**
 * test-safe-area.js
 *
 * Screenshots the site with simulated iPhone safe area insets
 * using Chrome DevTools Protocol (Emulation.setSafeAreaInsetsOverride).
 *
 * Usage:  node test-safe-area.js [url] [theme]
 *   url   — defaults to http://localhost:8080/index.html
 *   theme — "coral", "slate", or "neon" (defaults to "neon")
 *
 * Outputs: safe-area-{theme}.png
 */

const { chromium } = require('playwright-core');

const DEVICES = {
  'iPhone 15 Pro': {
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    insets: { top: 59, bottom: 34, left: 0, right: 0 },
  },
  'iPhone 14': {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    insets: { top: 47, bottom: 34, left: 0, right: 0 },
  },
  'iPhone SE': {
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    insets: { top: 20, bottom: 0, left: 0, right: 0 },
  },
};

(async () => {
  const url = process.argv[2] || 'http://localhost:8080/index.html';
  const theme = process.argv[3] || 'neon';
  const deviceName = process.argv[4] || 'iPhone 15 Pro';
  const device = DEVICES[deviceName];

  if (!device) {
    console.error(`Unknown device "${deviceName}". Available: ${Object.keys(DEVICES).join(', ')}`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();

  // Set safe area insets via CDP
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setSafeAreaInsetsOverride', {
    insets: device.insets,
  });

  await page.goto(url, { waitUntil: 'networkidle' });

  // Set theme
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
  }, theme);

  // Make .reveal elements visible (they need scroll to appear)
  await page.addStyleTag({
    content: '.reveal { opacity: 1 !important; transform: none !important; }',
  });

  await page.waitForTimeout(500);

  const filename = `safe-area-${theme}.png`;
  await page.screenshot({ path: filename });
  console.log(`Saved ${filename} (${deviceName}, ${device.viewport.width}x${device.viewport.height}, insets: top=${device.insets.top} bottom=${device.insets.bottom})`);

  await browser.close();
})();
