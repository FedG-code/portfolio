# Portfolio Site

## Structure
Multi-page portfolio site with shared CSS/JS (no build step).

```
index.html              — Main landing page (hero, work cards, about, approach, contact)
logifuture.html         — Logifuture project breakdown (~3 sub-projects)
coffin-likker.html      — Coffin-Likker project breakdown (3 sub-projects)
lost-satellite.html     — Lost Satellite Studios breakdown (1 project + screenshot gallery)
css/
  shared.css            — All shared styles (variables, nav, layout, components)
  project.css           — Project page-specific styles (hero, sections, gallery)
js/
  shared.js             — Scroll reveal + theme switcher with localStorage persistence
```

## Key Details
- **Fonts**: Instrument Serif, DM Sans, JetBrains Mono (loaded from Google Fonts)
- **CSS variables**: Defined in `:root`, swapped via `data-theme` attribute on `<html>` (`coral` default, `slate` alternate)
- **Theme persistence**: `localStorage.getItem('portfolio-theme')` — set inline in `<head>` of every page to prevent flash
- **Work cards**: `<a>` links in `index.html` that navigate to individual project pages; hover highlight effect (accent border + lift + shadow)
- **JS features**: Scroll reveal (IntersectionObserver), theme switcher with localStorage
- **Project pages**: Shared template — nav, theme switcher, back link, project hero, repeatable sub-project sections, footer

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
- No build tools or bundler — static HTML/CSS/JS only
- Shared styles in `css/shared.css`, project-specific styles in `css/project.css`
- Use CSS custom properties (`var(--...)`) for all colours; never hardcode colour values in element styles
- Theme-specific overrides go in `[data-theme="<name>"]` selector blocks
- Every page must include the inline `<script>` in `<head>` for theme persistence (before CSS loads)
- Nav links on project pages must be prefixed with `index.html#` (e.g., `index.html#work`)
- Playwright is installed for screenshots/testing (`npx playwright install chromium` if browsers missing)
