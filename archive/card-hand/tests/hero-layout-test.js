/**
 * Hero Layout Test
 *
 * Checks that the bold theme hero section is properly laid out across
 * multiple resolutions. Verifies tidbits sit below the description
 * (not overlapping the accent circle) and content stays left-aligned.
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   node tests/hero-layout-test.js
 *
 * Output: JSON results to stdout, screenshots in tests/screenshots/
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';

const RESOLUTIONS = [
  { width: 2560, height: 1440, label: 'qhd' },
  { width: 1920, height: 1080, label: 'desktop' },
  { width: 1440, height: 900,  label: 'laptop' },
  { width: 1024, height: 768,  label: 'tablet' },
  { width: 375,  height: 812,  label: 'mobile' },
];

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

async function runTest() {
  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  const results = [];

  for (const res of RESOLUTIONS) {
    const context = await browser.newContext({
      viewport: { width: res.width, height: res.height },
    });
    const page = await context.newPage();

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Make .reveal elements visible for screenshots
    await page.addStyleTag({
      content: '.reveal { opacity: 1 !important; transform: none !important; }'
    });

    // Set bold theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'bold');
    });

    // Wait for fonts and reflow
    await page.waitForTimeout(500);

    // Measure layout positions
    const metrics = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const desc = document.querySelector('.hero-desc');
      const tidbits = document.querySelector('.hero-tidbits');
      const heroBody = document.querySelector('.hero-body');
      const hero = document.querySelector('.hero');

      if (!desc || !tidbits || !heroBody || !hero) {
        return { error: 'Missing hero elements' };
      }

      const descRect = desc.getBoundingClientRect();
      const tidbitsRect = tidbits.getBoundingClientRect();
      const bodyRect = heroBody.getBoundingClientRect();
      const heroRect = hero.getBoundingClientRect();

      // Check if tidbits are below description
      const tidbitsBelow = tidbitsRect.top >= descRect.bottom - 2; // 2px tolerance

      // Check content is flush-left (left edge near viewport edge, within padding)
      const contentLeft = bodyRect.left;
      const contentLeftAligned = contentLeft <= 80; // ~3rem padding + tolerance

      // Check content stays in left portion of viewport
      // On smaller screens (<= 1024), content naturally fills more width
      const contentRight = bodyRect.right;
      const maxContentRatio = vw <= 768 ? 1.0 : vw <= 1024 ? 0.75 : 0.6;
      const contentInLeftHalf = contentRight <= vw * maxContentRatio;

      // Check if tidbits overlap with the accent circle area
      // The circle is positioned at right: -8vw, width: 52vw
      // So its left edge is approximately at: vw - 52vw + 8vw = vw * 0.56
      // Only check overlap on viewports > 1200px where the circle is distinct from content
      const circleLeftEdge = vw * 0.56;
      const tidbitsOverlapCircle = vw > 1200 && tidbitsRect.right > circleLeftEdge;

      return {
        viewport: { width: vw, height: vh },
        descBottom: Math.round(descRect.bottom),
        tidbitsTop: Math.round(tidbitsRect.top),
        tidbitsRight: Math.round(tidbitsRect.right),
        bodyLeft: Math.round(bodyRect.left),
        bodyRight: Math.round(bodyRect.right),
        circleLeftEdge: Math.round(circleLeftEdge),
        tidbitsBelow,
        contentLeftAligned,
        contentInLeftHalf,
        tidbitsOverlapCircle,
      };
    });

    // Take screenshot of hero section
    const screenshotPath = path.join(
      SCREENSHOT_DIR,
      `hero-bold-${res.width}x${res.height}.png`
    );
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Determine pass/fail
    const checks = [];

    if (metrics.error) {
      checks.push({ name: 'elements_found', pass: false, detail: metrics.error });
    } else {
      checks.push({
        name: 'tidbits_below_desc',
        pass: metrics.tidbitsBelow,
        detail: `desc bottom: ${metrics.descBottom}px, tidbits top: ${metrics.tidbitsTop}px`,
      });
      checks.push({
        name: 'content_flush_left',
        pass: metrics.contentLeftAligned,
        detail: `body left: ${metrics.bodyLeft}px (should be <= 80px)`,
      });
      checks.push({
        name: 'content_left_aligned',
        pass: metrics.contentInLeftHalf,
        detail: `body right: ${metrics.bodyRight}px, viewport: ${metrics.viewport.width}px`,
      });
      checks.push({
        name: 'tidbits_no_circle_overlap',
        pass: !metrics.tidbitsOverlapCircle,
        detail: `tidbits right: ${metrics.tidbitsRight}px, circle left: ${metrics.circleLeftEdge}px`,
      });
    }

    const allPassed = checks.every(c => c.pass);

    results.push({
      resolution: `${res.width}x${res.height}`,
      label: res.label,
      screenshot: screenshotPath,
      pass: allPassed,
      checks,
    });

    await context.close();
  }

  await browser.close();

  // Print results
  const allPassed = results.every(r => r.pass);
  const output = { passed: allPassed, results };
  console.log(JSON.stringify(output, null, 2));

  process.exit(allPassed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
