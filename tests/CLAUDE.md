# Tests Reference Map

Playwright (Chromium). `playwright` is the only dependency in `package.json`; run `npm install` first if `node_modules` is missing (worktrees don't have their own: set `NODE_PATH` to the main checkout's `node_modules`).

## gallery-test.js (live site)

`node tests/gallery-test.js`. Server on `BASE` (default `http://localhost:8080`; e.g. `BASE=http://localhost:8091` when 8080 serves another checkout). Uses SwiftShader flags so headless Chromium has WebGL. Exits 1 on any failed check.

| Check | What |
|-------|------|
| Viewports | 1920x1080, 1024x768, 390x844, 812x375: gallery built, exactly one canvas, About selected, bubble shown, no horizontal overflow, no page errors |
| Keyboard | focus About key, ArrowRight x2 -> Eve; live region = "Eve of Destruction" only; `aria-describedby="guide-bubble"` on the active key; knightboss.mp4 overlay |
| Open | Enter on the selected key: bubble hides during the push, eve_of_destruction.html loads, focus on the H1 |
| Project clips | the folded text's clips aren't loaded; once opened and scrolled near, the first gets `src` |
| Return | back link pushes in, then `#eve-of-destruction`; bubble hidden during the pull-out + walk-in, then shown; focus on the Eve key |
| University | bubble lists 3 Open links (#climbing, #rally, #fishing); Rally opens on its part of the set with focus on its strip button; back focuses the University button |
| Over the Hill | Learn more loads over_the_hill.html |
| Stage input | button reads "Learn more"; no dolly-track label; a drag scrubs and snaps; a click on a capture opens its page |
| No flash | with Three.js slowed to 1.5s, the plain list is never visible before the gallery appears |
| Fallbacks | `?flat` and `--disable-webgl`: plain list, no canvas, 5 rows |
| Reduced motion | instant cut, no clip; project clips have controls and stay paused |

## onset-test.js (project pages)

`node tests/onset-test.js`, same `BASE` / `NODE_PATH` as above.

| Check | What |
|-------|------|
| Viewports | 4 viewports x 5 pages: `html.os-on`, one canvas, h1 in the placard, bubble shown, strip = one key per part, no overflow, no errors |
| Arrival | `dolly-return` = section: `data-os-arrive="gallery"`, key consumed, bubble waits, then Overview with focus on the title; direct link = `walk`, no focus move; a key for another section is ignored |
| Navigation | Next / Back, strip click, ArrowRight on the strip (focus follows), live region "Part 2 of N: The brief", link tag, still one canvas |
| Anchors | `#rally`, `#fishing` from the gallery: that game's part, focus on its strip button |
| Media | Casino two-clip part plays hitfor6 + hopit; stat chips 300k / #1; Eve overview plays knightboss.mp4, Play trailer opens the embed, Next closes it; Tetrarcana link tags |
| Back link | bubble hides and the page stays during the push, then `index.html#eve-of-destruction` |
| Fallbacks | `?flat` and `--disable-webgl`: plain page, no canvas; with Three.js slowed 1.5s the plain page never shows |
| Reduced motion | `cut`, bubble at once, clip paused with controls |

## Archived
The card-hand / title-flight / theme tests and the paper-plane / destruction suites are in `archive/card-hand/tests/` and `archive/paper-plane/tests/`. They target code that is no longer loaded, so they don't run against the current site.
