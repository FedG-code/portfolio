# Portfolio Site

## Structure
Multi-page portfolio site with shared CSS/JS (no build step).

```
index.html              - Main landing page (hero, work cards, about, contact)
logifuture.html         - Logifuture project breakdown (~3 sub-projects)
coffin-likker.html      - Coffin-Likker project breakdown (3 sub-projects)
lost-satellite.html     - Lost Satellite Studios breakdown (1 project + screenshot gallery)
css/
  shared.css            - All shared styles (variables, nav, layout, components)
  project.css           - Project page-specific styles (hero, sections, gallery)
  cards.css             - Card and hand container styles (base card 220x320, theme overrides)
js/
  shared.js             - Scroll reveal + theme switcher with localStorage persistence
  destruction.js        - Text destruction system (plane mode shatter + sequential reform)
  card-hand.js          - Card hand system (fan layout, drag, proximity detection, play zone)
  page-transition.js    - Card play animation + SPA page transitions (fly clones, page fade-in)
```

## Detailed Documentation
- **CSS** (themes, line ranges, selectors): See [css/CLAUDE.md](css/CLAUDE.md)
- **JS** (functions, constants, APIs): See [js/CLAUDE.md](js/CLAUDE.md)
- **Tests** (scenarios, thresholds, setup): See [tests/CLAUDE.md](tests/CLAUDE.md)

## Key Details
- **Fonts**: Google Fonts `<link>` tags in every page's `<head>` load all theme fonts:
  - Bold: Archivo Black, Archivo, IBM Plex Mono
  - Cinematic: Syne, Commit Mono
  - Brutalist: Space Mono, Literata
  - Retro: Shrikhand, Bitter, IBM Plex Mono
  - Neon: Sora, Space Mono
  - Font CSS variables (`--font-serif`, `--font-body`, `--font-mono`) are redefined per theme in `shared.css`
- **Theme system**: Five themes cycle via button: `bold -> cinematic -> brutalist -> retro -> neon -> bold`
  - `data-theme` attribute on `<html>` controls the active theme (`bold` default)
  - Each theme defines its own CSS variable block in `shared.css` (`:root` for bold, `[data-theme="cinematic"]`, etc.)
  - Theme-specific overrides (hardcoded colours, border-radius, font weights, etc.) go in `[data-theme="<name>"]` selector blocks after the variable blocks
  - `js/shared.js` has `const themes = ['bold', 'cinematic', 'brutalist', 'retro', 'neon']` — the switcher button cycles through and persists to `localStorage`
  - **Persistence**: inline `<script>` in `<head>` of every page reads `localStorage.getItem('portfolio-theme')` and sets `data-theme` before CSS loads (prevents flash). Also migrates stored `coral`/`slate` values to `bold`.
  - See [css/CLAUDE.md](css/CLAUDE.md) for per-theme design notes and line ranges.
- **Nav**: Removed from all pages. Navigation is handled by the card-hand system only. Nav CSS is archived in `backup/nav-styles.css`.
- **Alternate HTML layouts**:
  - `.hero-default` / `.hero-brutalist` — dual-layout hero
  - `.about-default` / `.about-brutalist` — dual-layout about
  - `.hero-panel` — retro teal panel
  - `.status-bar` — brutalist status bar (hidden by default)
- **Work cards**: `<a>` links in `index.html` that navigate to individual project pages; hover highlight effect (accent border + lift + shadow)
- **JS features**: Scroll reveal (IntersectionObserver), theme switcher with localStorage
- **Text Destruction**: See [js/CLAUDE.md](js/CLAUDE.md) for detailed destruction.js documentation (mechanics, constants, mobile-gated values, impact throttle, design fallback).
- **Card-hand system**: See [js/CLAUDE.md](js/CLAUDE.md) for card-hand.js and page-transition.js documentation (play animation phases, SPA navigation, title matching, .reveal vs card handoff, known issues).
- **Project pages**: Shared template - theme switcher, back link, project hero, repeatable sub-project sections, footer

## Serving Locally
```
npx http-server -p 8080 -c-1
```

## Verification
After making visual changes, start the local server yourself (`npx http-server -p 8080 -c-1 -o` in background) and use `playwright-cli` to screenshot the page and verify the result. Do not prompt the user to start the server.

Before starting the server, check if port 8080 is already in use (e.g. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080`). Skip starting if it's already running.

The local server must be running before taking screenshots.

The `.reveal` class sets `opacity: 0` and `translateY(24px)` - elements only become visible when the IntersectionObserver adds `.visible` on scroll. Playwright screenshots don't trigger scroll events, so `.reveal` elements below the fold appear invisible. **Fix**: temporarily override `.reveal` to `opacity: 1; transform: translateY(0)` in `shared.css` before screenshots, then revert after. Delete any screenshot files (e.g., `screenshot.png`) after verification is complete.

```bash
playwright-cli open http://localhost:8080/index.html
playwright-cli screenshot --filename=screenshot.png
```

For project pages:
```bash
playwright-cli open http://localhost:8080/logifuture.html
playwright-cli screenshot --filename=screenshot.png
```

If not installed: `npm install -g @playwright/cli@latest`

### Performance Testing

Run the mobile performance test suite:
```bash
node tests/perf-test.js
```

Prerequisite: local server on port 8080 (`npx http-server -p 8080 -c-1`).

This emulates an iPhone 14 with 4x CPU throttle and measures frame timing across four scenarios (baseline scroll, plane idle, plane firing, post-scroll reform). Results are JSON to stdout — check `droppedFrames` percentage and `layoutCount` to detect regressions.

Key thresholds:
- avgFrameMs > 25 = bad (visible jank)
- droppedFrames > 15% of total = bad
- layoutCount > 200 per scenario = likely layout thrashing in destruction.js

If performance degrades after a change, compare the scenario-level metrics against the baseline to isolate whether the regression is in the render loop, hit detection, or animation system.

### Destruction-Specific Tests
```bash
node tests/perf-test-destruction.js
```

Prerequisite: local server on port 8080 (`npx http-server -p 8080 -c-1`).

Uses windowed measurement to isolate destruction.js frame spikes that get averaged away in broad 5-second windows. Calls `TextDestruction.onProjectileAt()` directly — bypasses plane.js for deterministic testing.

Seven scenarios:
- **scatter_spike**: Single impact on dense text (#about). Isolates the 1.2s physics2D scatter window. Thresholds: maxFrameMs > 40, p95 > 30, avg > 22.
- **cache_rebuild**: Forces `cacheStale = true` then impacts to trigger `rebuildCharCache()`. Measures the `getBoundingClientRect()` loop cost. Threshold: maxFrameMs > 50.
- **dense_burst**: 6 rapid-fire impacts at 100ms intervals across #about. Measures overlapping physics2D tweens. Thresholds: p95 > 35, droppedFrames > 30%, ScriptDurationMs > 800.
- **overlap_scatter_reform**: 3 staggered impacts on hero (h1 -> hero-desc -> tidbits) creating triple wave overlap (scatter + reform simultaneously). Thresholds: maxFrameMs > 50, p95 > 35.
- **high_count_reform**: 8-10 impacts to shatter near MAX_SHATTERED chars, then measures the reform animation window. Thresholds: maxFrameMs > 60, p95 > 30.
- **figure8_scroll_fire**: Simultaneous scrolling + destruction across the full page height (figure-8 Lissajous pattern). Tests scroll-triggered cache invalidation, overlapping scatter+reform across viewport changes, and compound scroll+destruction cost. Thresholds: maxFrameMs > 60, p95 > 35, avg > 25, droppedFrames > 40%.
- **sustained_annihilation**: Destroys all text in #about every 0.3s for 6 cycles using a 60px impact grid. Measures overlapping scatter+reform waves at extreme frequency. Thresholds: overlap maxFrameMs > 70, p95 > 40, avg > 25, droppedFrames > 40%.

### Card Expansion Bounds Tests

Verify that the expanded card stays within the viewport at multiple sizes. These tests use Playwright to trigger the card play animation and check for overflow.

**Approach:**
1. Open the page in Playwright at a specific viewport size
2. Trigger card expansion via JS: call `playCard()` on a card element, or simulate dragging a card into the play zone
3. Wait for the expand phase (~2s into the animation timeline)
4. Check `document.documentElement.scrollWidth <= window.innerWidth` and `document.documentElement.scrollHeight <= window.innerHeight` — if either is false, the card overflows
5. Take a screenshot at the expanded state for visual verification
6. Repeat at different viewport sizes: 1920x1080 (desktop), 1024x768 (tablet), 375x812 (mobile portrait), 812x375 (mobile landscape)

**Test script pattern** (to be implemented in `tests/card-bounds-test.js`):
```js
// For each viewport size:
// 1. page.setViewportSize({ width, height })
// 2. page.goto('http://localhost:8080')
// 3. page.evaluate(() => { /* trigger playCard on first card */ })
// 4. page.waitForTimeout(2000) // wait for expand phase
// 5. const overflow = await page.evaluate(() => ({
//      hOverflow: document.documentElement.scrollWidth > window.innerWidth,
//      vOverflow: document.documentElement.scrollHeight > window.innerHeight
//    }))
// 6. assert no overflow
// 7. page.screenshot({ path: `card-expand-${width}x${height}.png` })
```

### Playwright Tips
- **Scrolling to sections**: Use `npx playwright-cli eval "() => document.querySelector('#work').scrollIntoView()"` to scroll to a specific element before taking a screenshot.
- **Expanding work cards**: Work cards use `.expanded` class toggled by JS. To expand a card for screenshots, use `npx playwright-cli eval "() => document.querySelector('.work-card').classList.add('expanded')"` then wait ~2s for the `max-height` transition before screenshotting. Use `.querySelectorAll('.work-card')[N]` to target a specific card by index.
- **Running JS on page**: Use `npx playwright-cli eval "() => { ... }"` (arrow function string) for page-level JavaScript execution.
- **Reload after CSS changes**: After editing CSS files, run `npx playwright-cli reload` before screenshotting, as the browser may cache old styles.

## Conventions
- No build tools or bundler - static HTML/CSS/JS only
- Shared styles in `css/shared.css`, project-specific styles in `css/project.css`
- Use CSS custom properties (`var(--...)`) for all colours; never hardcode colour values in element styles
- Theme-specific overrides go in `[data-theme="<name>"]` selector blocks
- Every page must include the inline `<script>` in `<head>` for theme persistence (before CSS loads)
- Nav links on project pages must be prefixed with `index.html#` (e.g., `index.html#work`)
- `@playwright/cli` is used for screenshots/testing (`npm install -g @playwright/cli@latest` if not installed)

## Preferences
- **Use CLAUDE.md for persistent notes**, not the auto-memory directory. If something needs to be remembered across sessions, add it here.
- **Be surgical with file reads** — ALWAYS use `offset` and `limit` parameters. Never read more than 80 lines at once. Use Grep to find the right line numbers first, then read only that section. This applies to subagents too — when launching Explore/Plan agents, explicitly instruct them to use offset+limit and never read whole files. Whole-file reads of `shared.css` or `index.html` waste 2-4k tokens each and cause auto-compaction.
