# Portfolio Site

## Structure
Static site, no build step. The homepage is the **Dolly Gallery** (3D greybox gallery wall, implemented 2026-11-09 from the approved round 4 prototype `design/blockout/dolly-r4.html`); the project pages are separate HTML pages.

```
index.html              - Dolly Gallery homepage (name strip, About, 3D wall + guide, shot list)
casino_games.html       - Logifuture case study
eve_of_destruction.html - Lost Satellite Studios case study
my_games.html           - "Other Games" case study (file name kept; title renamed from My Games)
over_the_hill.html      - Over the Hill / Feedbot case study
university_projects.html - Climbing, Fishing and Rally Game (one page, one section each)
css/
  gallery.css           - Homepage only (self-contained, one identity)
  shared.css            - Project pages (bold theme; other theme blocks are dead CSS)
  project.css           - Project page layout, back link
js/
  gallery.js            - The gallery: data, plain list, Three.js stage, guide, open/return
  shared.js             - Project pages: scroll reveal, lazy mp4 loops, title focus
  analytics.js          - GA4 events
  plane-key.js          - P key: loads GSAP + destruction.js + plane.js on demand and toggles the paper plane
assets/                 - Captures. *.mp4 + *-poster.jpg are the loops (the GIF originals were deleted 2026-11-09; they are in git history)
```

## Detailed Documentation
- **CSS**: [css/CLAUDE.md](css/CLAUDE.md)
- **JS** (gallery flow, accessibility, gotchas): [js/CLAUDE.md](js/CLAUDE.md)
- **Tests**: [tests/CLAUDE.md](tests/CLAUDE.md)
- **Design history / decisions**: `design/HANDOFF.md` (in the main checkout, untracked)

## Key Details
- **Section order** (user): About, Over the Hill, Eve of Destruction, Casino Games, University Projects, Other Games. Over the Hill leads.
- **One identity**: no theme switcher. Green only for colliders/triggers, orange only for selection. Archivo (variable width) + IBM Plex Mono.
- **HTML first**: `index.html` ships About + a plain list; Three.js r128 (cdnjs, async) upgrades it. Without WebGL, or with `?flat`, the list stays.
- **One WebGL context** on the page. The phone shot is a breakpoint (stage < 640px), not a second canvas.
- **Open / return**: Open pushes the camera into the screen, then loads the project page. The back link (`← All projects`) goes to `index.html#<section-id>`; with `sessionStorage['dolly-return']` the gallery pulls back out and focuses that section's button. No title flight (user removed it).
- **Media**: muted H.264 mp4 loops (ffmpeg recipe in `design/HANDOFF.md`), loaded only when needed: the gallery overlay loads the selected section's clip only; project pages load clips near the viewport.
- **Content rules** (user): no availability line; gambling metrics only inside the Casino case study; don't apply `cv.md` content without asking; no major rewriting of page copy.
- **Pages**: `over_the_hill.html` (Feedbot, built from cv.md + the sentiment-tracker repo) and `university_projects.html` (Climbing Game = main item, Fishing Game, Rally Game; anchors `#climbing`, `#fishing`, `#rally`). Each university item in the gallery bubble opens its own anchor. **No reference to AI use on the university page** (user rule).
- **Content still to come**:
  - **Showcase videos for all three university projects** (Climbing, Fishing, Rally): the user is making them. When each arrives, convert it to a muted mp4 loop + poster (ffmpeg recipe in `design/HANDOFF.md`) and swap it in on `university_projects.html` (`video[data-src]`, replacing the "Capture to come" box / island preview / court still) and in the gallery's University bay (`items[k].img` = poster, plus a clip; today only `scr[0]` gets a motion overlay, so the small screens need the overlay extended or stay stills).
  - Real game titles (repos only have working names), and confirmation of module/year/solo for each university project.
  - A real Feedbot dashboard capture (needs player data blurred); the page uses the public site's illustrative example.

## Serving Locally
```
npx http-server -p 8080 -c-1
```

## Paper plane + destruction (P key)
Off by default; pressing **P** on any page (`js/plane-key.js`) loads GSAP, `js/destruction.js` and `js/plane.js`, then calls `PaperPlane.toggle()` (user: "pressing p for now", untested by them). It stays on across pages until a reload. plane.js creates its own renderer, so with the plane on the homepage runs two WebGL contexts. The 2026-04-04 mobile performance notes and the destruction test descriptions below apply when it comes back; the suites live in `tests/plane-archive/`.

### Mobile Destruction Performance — Investigation Notes (2026-04-04)

**Status**: Optimizations removed, diagnostic tests written. GSAP tween count is NOT the problem.

#### What the diagnostic proved
- **6 GSAP calls per impact** (3 immediate + 3 deferred) — very modest
- **Peak 6 concurrent tweens** even with 10 overlapping impacts — no explosion
- **Tweens clean up properly** — globalTimeline returns to 0, no leaks, no orphans
- **Duplicate tweens exist** but are by-design (color flash + physics scatter on same chars) — not stacking
- The removed optimizations (MAX_ACTIVE_BATCHES=6, MAX_SHATTERED=300, cache deferral, cleanup chunking) were solving a nonexistent problem and bottlenecking the effect

#### Directions to investigate next
1. **Physics2DPlugin per-frame cost** — Each `physics2D` tween runs a gravity simulation every RAF tick. With overlapping batches, the plugin iterates all active physics particles every frame. Profile the GSAP tick itself (not tween count) to see if physics2D's per-frame loop is the real cost.
2. **`getBoundingClientRect` during cache rebuilds** — Now that cache rebuild deferral is removed, `rebuildCharCache()` can fire while animations are running. Each rebuild calls `getBoundingClientRect()` on every visible char's parent. On mobile this forces layout recalc. Measure how often rebuilds trigger during rapid fire.
3. **SplitText DOM overhead** — `splitAllText()` wraps every destructible char in a `<span>`. With 1228 chars, that's 1228 extra DOM nodes. Mobile browsers are slow at style recalc on deep/wide DOM trees. The initial split cost + any re-split on theme change may cause jank spikes.
4. **Plane.js render loop** — The Three.js `animate()` runs every frame regardless of destruction. On low-end mobile, the combined cost of WebGL render + GSAP tick + destruction physics may exceed the 16ms frame budget even though each system alone is fine.
5. **Scroll-triggered cache invalidation** — `plane.js` scroll-on-drag (now disabled) was calling `window.scrollBy()` every frame, which sets `cacheStale=true` via the resize/scroll listener, potentially triggering `rebuildCharCache()` every frame during drag.

#### Temporary changes in place
- Scroll-on-drag disabled in `plane.js` (search for "Scroll-on-drag disabled")
- All destruction optimizations removed from `destruction.js`
- Run `node tests/plane-archive/gsap-diagnostic-test.js` to see current GSAP behavior

## Verification
After visual changes, check whether port 8080 is already serving (`curl -s -o /dev/null -w "%{http_code}" http://localhost:8080`). Make sure it is serving **this** checkout (worktrees: use another port, e.g. `npx http-server -p 8091 -c-1`). Screenshot at 1920x1080, 1024x768, 390x844 and 812x375, and run:

```bash
node tests/gallery-test.js
```

Headless Chromium needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL (gallery-test.js passes them). The project pages still use `.reveal` (opacity 0 until scrolled into view): override it before full-page screenshots. Delete screenshot files after verifying.

### Plane/destruction performance tests (dormant, `tests/plane-archive/`)

Run the mobile performance test suite:
```bash
node tests/plane-archive/perf-test.js
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
node tests/plane-archive/perf-test-destruction.js
```

Prerequisite: local server on port 8080 (`npx http-server -p 8080 -c-1`).

Uses windowed measurement to isolate destruction.js frame spikes that get averaged away in broad 5-second windows. Calls `TextDestruction.onProjectileAt()` directly — bypasses plane.js for deterministic testing.

Seven scenarios:
- **scatter_spike**: Single impact on dense text (#about). Isolates the 1.2s physics2D scatter window. Thresholds: maxFrameMs > 40, p95 > 30, avg > 22.
- **cache_rebuild**: Forces `cacheStale = true` then impacts to trigger `rebuildCharCache()`. Measures the `getBoundingClientRect()` loop cost. Threshold: maxFrameMs > 50.
- **dense_burst**: 6 rapid-fire impacts at 100ms intervals across #about. Measures overlapping physics2D tweens. Thresholds: p95 > 35, droppedFrames > 30%, ScriptDurationMs > 800.
- **overlap_scatter_reform**: 3 staggered impacts on hero (h1 -> hero-desc -> tidbits) creating triple wave overlap (scatter + reform simultaneously). Thresholds: maxFrameMs > 50, p95 > 35.
- **high_count_reform**: 8-10 impacts to shatter a large number of chars, then measures the reform animation window. Thresholds: maxFrameMs > 60, p95 > 30.
- **figure8_scroll_fire**: Simultaneous scrolling + destruction across the full page height (figure-8 Lissajous pattern). Tests scroll-triggered cache invalidation, overlapping scatter+reform across viewport changes, and compound scroll+destruction cost. Thresholds: maxFrameMs > 60, p95 > 35, avg > 25, droppedFrames > 40%.
- **sustained_annihilation**: Destroys all text in #about every 0.3s for 6 cycles using a 60px impact grid. Measures overlapping scatter+reform waves at extreme frequency. Thresholds: overlap maxFrameMs > 70, p95 > 40, avg > 25, droppedFrames > 40%.

### Playwright Tips
- **Running JS on page**: `npx playwright-cli eval "() => { ... }"`.
- **Reload after CSS changes**: `npx playwright-cli reload` before screenshotting.
- **Gallery state**: select a section with `document.querySelector('.key[data-i="2"]').click()`; `?flat` forces the plain list.

## Conventions
- No build tools or bundler: static HTML/CSS/JS only
- Homepage styles in `css/gallery.css`; project page styles in `css/shared.css` + `css/project.css`
- Use CSS custom properties for colours; never hardcode colour values in element styles
- Project pages are fixed to `data-theme="bold"`; their back link must point to `index.html#<section-id>` (ids in `P` in js/gallery.js)
- `@playwright/cli` for screenshots (`npm install -g @playwright/cli@latest` if not installed)

## Preferences
- **Use CLAUDE.md for persistent notes**, not the auto-memory directory. If something needs to be remembered across sessions, add it here.
- **Be surgical with file reads** — ALWAYS use `offset` and `limit` parameters. Never read more than 80 lines at once. Use Grep to find the right line numbers first, then read only that section. This applies to subagents too — when launching Explore/Plan agents, explicitly instruct them to use offset+limit and never read whole files. Whole-file reads of `shared.css` or `index.html` waste 2-4k tokens each and cause auto-compaction.
