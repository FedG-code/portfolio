/**
 * Toolbar shadow visual test
 *
 * Verifies the mobile toolbar shadow wraps the tab+panel L-shape,
 * not the .toolbar parent bounding box.
 *
 * The bug (brutalist/retro): box-shadow on .toolbar traces the full-height
 * flex container (~247px). The .toolbar has transparent background, so the
 * shadow and border show through in the zone LEFT of the panel, ABOVE and
 * BELOW the 44px tab — where no child element has a background to cover them.
 *
 * Detection: isolate toolbar on white bg, scan a vertical pixel column at
 * (panel.left - 10) — in the transparent toolbar zone. Darkness above/below
 * the tab at this X means the bounding-box shadow/border is leaking.
 *
 * Run: node tests/toolbar-shadow-test.js
 * Prerequisite: local server on port 8080
 */

const { chromium, devices } = require('playwright');
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const THEMES = ['bold', 'brutalist', 'retro', 'cinematic', 'neon'];
const iPhone = devices['iPhone 14'];

function darkness(r, g, b) {
  return 255 - Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

function getPixel(png, x, y) {
  const idx = (y * png.width + x) * 4;
  return { r: png.data[idx], g: png.data[idx + 1], b: png.data[idx + 2], a: png.data[idx + 3] };
}

(async () => {
  const browser = await chromium.launch();
  let allPass = true;
  const failures = [];

  for (const theme of THEMES) {
    const context = await browser.newContext({ ...iPhone });
    const page = await context.newPage();
    const dpr = await page.evaluate(() => window.devicePixelRatio);

    await page.goto('http://localhost:8080');
    await page.evaluate(t => {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('portfolio-theme', t);
    }, theme);
    await page.waitForTimeout(400);

    await page.click('.toolbar-tab');
    await page.waitForTimeout(500);

    // Isolate toolbar on white background
    await page.evaluate(() => {
      document.body.style.background = 'white';
      for (const child of document.body.children) {
        if (!child.classList.contains('toolbar'))
          child.style.visibility = 'hidden';
      }
      const canvas = document.getElementById('plane-canvas');
      if (canvas) canvas.style.display = 'none';
    });
    await page.waitForTimeout(200);

    const geo = await page.evaluate(() => {
      const toolbar = document.querySelector('.toolbar');
      const tab = document.querySelector('.toolbar-tab');
      const panel = document.querySelector('.toolbar-panel');
      const tR = toolbar.getBoundingClientRect();
      const tabR = tab.getBoundingClientRect();
      const panelR = panel.getBoundingClientRect();
      return {
        toolbarShadow: getComputedStyle(toolbar).boxShadow,
        toolbar: { top: tR.top, bottom: tR.bottom, left: tR.left, right: tR.right, height: tR.height },
        tab: { top: tabR.top, bottom: tabR.bottom, left: tabR.left, right: tabR.right, height: tabR.height },
        panel: { top: panelR.top, bottom: panelR.bottom, left: panelR.left, right: panelR.right, height: panelR.height }
      };
    });

    // Screenshot
    const pad = 50;
    const clipX = Math.max(0, geo.tab.left - pad);
    const clipY = Math.max(0, geo.toolbar.top - pad);
    const clipW = geo.panel.right - clipX + pad;
    const clipH = geo.toolbar.height + 2 * pad;

    const screenshotBuf = await page.screenshot({
      type: 'png',
      clip: { x: clipX, y: clipY, width: clipW, height: clipH }
    });
    const png = PNG.sync.read(screenshotBuf);

    function cssToPixel(cssX, cssY) {
      return {
        px: Math.round((cssX - clipX) * dpr),
        py: Math.round((cssY - clipY) * dpr)
      };
    }

    // ── Scan at panel.left - 10 ──
    // This X is:
    //   - Inside the .toolbar bounding box (toolbar.left=316 < 325 < panel.left=335)
    //   - Outside the panel (325 < panel.left=335)
    //   - Inside the tab only at tab's Y range (tab: 316-336 horizontally, 310-354 vertically)
    //   - OUTSIDE the tab above y=310 and below y=354
    //
    // At non-tab Y positions, this column passes through transparent toolbar bg.
    // On white isolated background, any darkness here = bounding-box leak.
    const scanX = geo.panel.left - 10;

    const scanStartY = geo.toolbar.top - 15;
    const scanEndY = geo.toolbar.bottom + 15;

    // Collect darkness at non-tab Y positions (above and below the tab)
    const aboveTabDark = [];
    const belowTabDark = [];

    // Scan above the tab: from toolbar.top area down to a few px above tab.top
    for (let cssY = scanStartY; cssY < geo.tab.top - 5; cssY += 0.5) {
      const { px, py } = cssToPixel(scanX, cssY);
      if (px >= 0 && px < png.width && py >= 0 && py < png.height) {
        const p = getPixel(png, px, py);
        aboveTabDark.push(darkness(p.r, p.g, p.b));
      }
    }

    // Scan below the tab: from a few px below tab.bottom to toolbar.bottom area
    for (let cssY = geo.tab.bottom + 5; cssY <= scanEndY; cssY += 0.5) {
      const { px, py } = cssToPixel(scanX, cssY);
      if (px >= 0 && px < png.width && py >= 0 && py < png.height) {
        const p = getPixel(png, px, py);
        belowTabDark.push(darkness(p.r, p.g, p.b));
      }
    }

    const maxAbove = aboveTabDark.length > 0 ? Math.max(...aboveTabDark) : 0;
    const maxBelow = belowTabDark.length > 0 ? Math.max(...belowTabDark) : 0;
    const avgAbove = aboveTabDark.length > 0 ? aboveTabDark.reduce((a, b) => a + b, 0) / aboveTabDark.length : 0;
    const avgBelow = belowTabDark.length > 0 ? belowTabDark.reduce((a, b) => a + b, 0) / belowTabDark.length : 0;

    // ── PASS/FAIL ──
    // In this transparent zone, darkness should be near 0 (pure white bg).
    // Any significant darkness means the .toolbar's bounding-box shadow/border
    // is leaking through where no element is visible.
    //
    // Threshold: 100 catches hard-edge shadows (brutalist 4px 4px 0 → ~244,
    // retro 3px 3px 0 → ~185) while allowing diffuse blurred shadows
    // (cinematic 0 8px 32px → ~68, neon 0 0 20px → ~66) which are not
    // visually noticeable.
    const maxDarkThreshold = 100;
    const themePass = maxAbove <= maxDarkThreshold && maxBelow <= maxDarkThreshold;

    if (!themePass) {
      allPass = false;
      failures.push(
        `[${theme}] FAIL: Bounding-box shadow leaks above/below tab at x=${scanX.toFixed(0)}. ` +
        `above: max=${maxAbove} avg=${avgAbove.toFixed(1)}, ` +
        `below: max=${maxBelow} avg=${avgBelow.toFixed(1)}. ` +
        `toolbarShadow="${geo.toolbarShadow}"`
      );
    }

    const ssPath = path.join(__dirname, `toolbar-shadow-${theme}.png`);
    if (!themePass) {
      fs.writeFileSync(ssPath, screenshotBuf);
      console.log(`  Screenshot saved: ${ssPath}`);
    }

    console.log(
      `${themePass ? 'PASS' : 'FAIL'} [${theme}]  ` +
      `scanX=${scanX.toFixed(0)}  ` +
      `above(max=${maxAbove}, avg=${avgAbove.toFixed(1)})  ` +
      `below(max=${maxBelow}, avg=${avgBelow.toFixed(1)})  ` +
      `toolbarShadow="${geo.toolbarShadow}"`
    );

    await context.close();
  }

  if (failures.length) {
    console.log('\n=== FAILURES ===');
    for (const f of failures) console.log(f);
  }

  console.log(`\nOverall: ${allPass ? 'ALL PASS' : 'SOME FAILED'}`);

  if (allPass) {
    for (const theme of THEMES) {
      const p = path.join(__dirname, `toolbar-shadow-${theme}.png`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }

  await browser.close();
  process.exit(allPass ? 0 : 1);
})();
