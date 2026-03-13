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
js/
  shared.js             - Scroll reveal + theme switcher with localStorage persistence
  destruction.js        - Text destruction system (plane mode shatter + sequential reform)
```

## Key Details
- **Fonts**: Two Google Fonts `<link>` tags in every page's `<head>`:
  1. DM Sans, Instrument Serif, JetBrains Mono (used by coral & slate)
  2. Sora, Space Mono (used by neon)
  - Font CSS variables (`--font-serif`, `--font-body`, `--font-mono`) are redefined per theme in `shared.css`
- **Theme system**: Three themes cycle via button: `coral → slate → neon → coral`
  - `data-theme` attribute on `<html>` controls the active theme (`coral` default)
  - Each theme defines its own CSS variable block in `shared.css` (`:root` for coral, `[data-theme="slate"]`, `[data-theme="neon"]`)
  - Theme-specific overrides (hardcoded colours, border-radius, font weights, etc.) go in `[data-theme="<name>"]` selector blocks after the variable blocks
  - `js/shared.js` has `const themes = ['coral', 'slate', 'neon']` — the switcher button cycles through and persists to `localStorage`
  - **Persistence**: inline `<script>` in `<head>` of every page reads `localStorage.getItem('portfolio-theme')` and sets `data-theme` before CSS loads (prevents flash)
- **Theme design notes**:
  - **coral**: Warm light theme. Pill-shaped nav (centred, `border-radius: 100px`). Instrument Serif headings, DM Sans body, JetBrains Mono labels. Doodle decorations in hero. Rounded corners throughout.
  - **slate**: Cool light theme. Same layout as coral, different colour palette (teal accent). Same fonts and shapes.
  - **neon**: Dark techy theme. Full-width fixed nav bar (no pill, `border-radius: 0`). Sora headings/body, Space Mono labels. Lime-green accent (`#c9f059`). Sharp corners (6-12px radius). Grain overlay on `body::before`. Grid pattern in hero `::before`. Doodles hidden. Nav links have underline hover effect via `::after`.
- **Nav structure**: `<nav>` contains a `.container.nav-inner` wrapper around `.nav-logo` and `.nav-links`. The `.nav-inner` holds the flex layout. This lets neon's full-width nav align content with the page container while coral/slate's pill nav is unaffected.
- **Work cards**: `<a>` links in `index.html` that navigate to individual project pages; hover highlight effect (accent border + lift + shadow)
- **JS features**: Scroll reveal (IntersectionObserver), theme switcher with localStorage
- **Text Destruction** (`js/destruction.js`): "Plane mode" feature — a paper airplane projectile shatters text on collision, then characters reform.
  - **Dependencies**: GSAP core, SplitText plugin, Physics2DPlugin (all loaded externally, no npm)
  - **How it works**: `TextDestruction.init()` splits all destructible text elements (headings, paragraphs, labels, etc.) into word and char `<span>`s via `SplitText` (classes `destruct-word` and `destruct-char`). Word spans are `inline-block; white-space: nowrap` to prevent mid-word breaks. When plane mode is active, `onProjectileAt(x, y)` finds chars within `BLAST_RADIUS` and shatters them.
  - **Scatter phase**: Chars fly away from impact using `physics2D` (velocity, angle, gravity) with a brief accent-colour flash, fading to `opacity: 0` over `SCATTER_DURATION` (1.2s).
  - **Reform phase** (sequential typing drop-in): After a `REFORM_PAUSE` (1.0s), chars re-enter left-to-right in DOM reading order. Each char is pre-positioned 16px above its slot (`DROP_DISTANCE`), then drops into place with `power2.out` (no bounce) over `CHAR_LAND_DURATION` (0.12s). Consecutive chars are staggered by `CHAR_STAGGER` (0.055s) with an extra `WORD_EXTRA_STAGGER` (0.05s) pause at word boundaries (detected by `parentElement` change).
  - **Lifecycle**: `TextDestruction.onThemeChange()` destroys and re-inits on theme switch. Resize is debounced to re-split text. A `charRectCache` (invalidated on scroll/resize) accelerates hit detection.
  - **Selector list** (`DESTRUCTIBLE_SELECTOR`): targets headings, hero text, work cards, about section, chips, contact, project pages, footer — excludes nav, theme switcher, buttons.
  - **Mobile-gated constants**: `_isMob` (viewport ≤768 OR touch+coarse) gates performance-sensitive values. Desktop is completely unchanged. Mobile overrides: `MAX_SHATTERED` 150 (vs 300), `REFORM_PAUSE` 1.0s (vs 0.8s), `CHAR_STAGGER` 0.035s (vs 0.055s), `WORD_EXTRA_STAGGER` 0.03s (vs 0.05s), `MAX_VELOCITY` 350 (vs 500), `MAX_ROTATION` 360° (vs 720°). Color flash tween is skipped on mobile. Impact coalescing on mobile batches same-frame `onProjectileAt()` calls via RAF.
  - **Impact handling**: Every projectile impact calls `TextDestruction.onProjectileAt()` unconditionally (no throttle). The scroll speed gate (`SCROLL_SPEED_THRESHOLD`) was also removed earlier — it unnecessarily limited desktop destruction.
  - **Design fallback**: If optimisation doesn't resolve plane mode scroll+fire lag, the fallback is to **disable page scrolling while plane mode is active** (e.g. CSS `overflow: hidden` on `<html>` when `.plane-active`). This eliminates scroll-triggered cache invalidation and the compound scroll+destruction cost entirely.
- **Project pages**: Shared template - nav, theme switcher, back link, project hero, repeatable sub-project sections, footer

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
- **overlap_scatter_reform**: 3 staggered impacts on hero (h1 → hero-desc → tidbits) creating triple wave overlap (scatter + reform simultaneously). Thresholds: maxFrameMs > 50, p95 > 35.
- **high_count_reform**: 8-10 impacts to shatter near MAX_SHATTERED chars, then measures the reform animation window. Thresholds: maxFrameMs > 60, p95 > 30.
- **figure8_scroll_fire**: Simultaneous scrolling + destruction across the full page height (figure-8 Lissajous pattern). Tests scroll-triggered cache invalidation, overlapping scatter+reform across viewport changes, and compound scroll+destruction cost. Thresholds: maxFrameMs > 60, p95 > 35, avg > 25, droppedFrames > 40%.
- **sustained_annihilation**: Destroys all text in #about every 0.3s for 6 cycles using a 60px impact grid. Measures overlapping scatter+reform waves at extreme frequency. Thresholds: overlap maxFrameMs > 70, p95 > 40, avg > 25, droppedFrames > 40%.

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
