# Portfolio Site

## Structure
Single-page portfolio site — everything lives in `index.html` (inline CSS + JS, no build step).

## Key Details
- **Fonts**: Instrument Serif, DM Sans, JetBrains Mono (loaded from Google Fonts)
- **CSS variables**: Defined in `:root`, swapped via `data-theme` attribute on `<html>` (`coral` default, `slate` alternate)
- **Sections**: Hero, Work (expanding cards), About, Approach, Contact, Footer
- **JS features**: Scroll reveal (IntersectionObserver), expanding work cards with blur overlay, theme switcher

## Serving Locally
```
npx http-server -p 8080 -c-1
```

## Verification
After making visual changes, always screenshot the page with Playwright to verify the result:
```js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('file:///' + path.resolve('.', 'index.html').replace(/\\/g, '/'));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshot.png', fullPage: false });
  await browser.close();
})();
```
If browsers aren't installed: `npx playwright install chromium`

## Conventions
- No build tools or bundler — edit `index.html` directly
- Use CSS custom properties (`var(--...)`) for all colours; never hardcode colour values in element styles
- Theme-specific overrides go in `[data-theme="<name>"]` selector blocks
- Playwright is installed for screenshots/testing (`npx playwright install chromium` if browsers missing)
