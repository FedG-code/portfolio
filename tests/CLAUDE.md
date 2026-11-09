# Tests Reference Map

Playwright (Chromium). The `playwright` package is in the repo's `package.json`; run `npm install` first if `node_modules` is missing (worktrees don't have their own: set `NODE_PATH` to the main checkout's `node_modules`).

## gallery-test.js (live site)

`node tests/gallery-test.js`. Server on `BASE` (default `http://localhost:8080`; e.g. `BASE=http://localhost:8091` when 8080 serves another checkout). Uses SwiftShader flags so headless Chromium has WebGL. Exits 1 on any failed check.

| Check | What |
|-------|------|
| Viewports | 1920x1080, 1024x768, 390x844, 812x375: gallery built, exactly one canvas, About selected, bubble shown, no horizontal overflow, no page errors |
| Keyboard | focus About key, ArrowRight x2 -> Eve; live region = "Eve of Destruction" only; `aria-describedby="guide-bubble"` on the active key; knightboss.mp4 overlay |
| Open | Enter on the selected key: bubble hides during the push, eve_of_destruction.html loads, focus on the H1 |
| Project clips | none loaded at first; first one gets `src` once scrolled near |
| Return | back link -> `#eve-of-destruction`, bubble hidden during the pull-out then shown, focus on the Eve key |
| University | bubble lists 3 items, no Open |
| Fallbacks | `?flat` and `--disable-webgl`: plain list, no canvas, 5 rows |
| Reduced motion | instant cut, no clip; project clips have controls and stay paused |

## plane-archive/ (dormant)

The destruction/plane suites (`run-destruction-suite.js`, `destruction-*-test.js`, `perf-test*.js`, `gsap-diagnostic-test.js`, `baselines/`). They drive `TextDestruction` and the plane on the old homepage, which no longer loads `destruction.js`/`plane.js`, so they **won't run against the current pages**. Kept for when the paper plane is switched back on (how is still undecided); they'll need a page that loads those scripts and new destructible targets.

## Removed (2026-11-09)

Card hand / title flight / theme tests whose systems are gone: blur-overlay-cleanup, fly-clone-alignment, fly-swap-diagnostic, fullstop-shift, home-title-jump-diagnostic, title-jump-diagnostic, hero-layout, mobile-hand, mobile-touch, toolbar-shadow, transition-refresh. See git history (commit 2ad4150) if needed.
