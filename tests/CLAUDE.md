# Tests Reference Map

Playwright (Chromium). `playwright` is the only dependency in `package.json`; run `npm install` first if `node_modules` is missing (worktrees don't have their own: set `NODE_PATH` to the main checkout's `node_modules`).

## gallery-test.js (live site)

`node tests/gallery-test.js`. Server on `BASE` (default `http://localhost:8080`; e.g. `BASE=http://localhost:8091` when 8080 serves another checkout). Uses SwiftShader flags so headless Chromium has WebGL. Exits 1 on any failed check.

| Check | What |
|-------|------|
| Viewports | 1920x1080, 1024x768, 390x844, 812x375: gallery built, exactly one canvas, About selected, bubble shown, no horizontal overflow, no page errors |
| Keyboard | focus About key, ArrowRight x2 -> Eve; live region = "Eve of Destruction" only; `aria-describedby="guide-bubble"` on the active key; knightboss.mp4 overlay |
| Open | Enter on the selected key: bubble hides during the push; `#eve-of-destruction/case` in the same page, one canvas, case bar shown, focus on Overview |
| All projects | bubble hidden during the push / pull-out / walk, then shown; section bar back, focus on the Eve key, no `/case` in the URL |
| University | bubble lists 3 Open links (#climbing, #rally, #fishing); Rally opens its game in the scene with focus on its part; browser Back closes the case and focuses the University button |
| Over the Hill | Learn more opens `#over-the-hill/case` |
| Stage input | button reads "Learn more"; no dolly-track label; a drag scrubs and snaps; a click on a capture opens its case |
| No flash | with Three.js slowed to 1.5s, the plain list is never visible before the gallery appears |
| Fallbacks | `?flat` and `--disable-webgl`: plain list, no canvas, 5 rows |
| Reduced motion | instant cut, no clip; the case cuts in with its clip paused + controls; plain project page clips have controls and stay paused |

## case-test.js (cases in the scene)

`node tests/case-test.js`, same `BASE` / `NODE_PATH` as above.

| Check | What |
|-------|------|
| Viewports | 4 viewports x 5 cases (`index.html#<id>/case`): case bar shown, section bar hidden, one canvas, one key per part, bubble, no overflow, no errors |
| Parts | Next / Back, bar click, ArrowRight (focus follows), live region "Part 2 of N: Launch week", feedbot.co.uk tag |
| Switch | another case's hash while one is open switches cases |
| Media | Casino two-clip part plays hitfor6 + hopit, split side by side on the one screen, clear of the bubble; stat chips 300k / #1; Eve overview plays knightboss.mp4; Play trailer zooms in (embed > 75% of the stage width), Esc zooms back out; Rally: big frame loops rally.mp4, "Play with sound" zooms in with an unmuted `<video>`, Esc closes; gallery University bay plays the big frame's clip (Climbing, then Rally after leaving its case) |
| University | `#university-projects/case/rally` opens Rally; a small frame (tap, and real clicks above the labels, in any order) rotates to big and the URL names the game; from the homepage a small frame rotates first, then the case opens on it |
| Phone | 390x664 touch: Learn more opens Casino as one screen (stage at the top, Back / Next and the parts bar in view); a left swipe on the bubble goes to the next part; All projects restores the 400px gallery stage |
| Project files | redirect into the scene (also `#fishing` -> `/case/fishing`); `?flat` stays plain; `index.html?flat#<id>/case` goes to the plain page; no WebGL ends on the plain page |
| Reduced motion | the case cuts in, clip paused with controls |

## Archived
The card-hand / title-flight / theme tests and the paper-plane / destruction suites are in `archive/card-hand/tests/` and `archive/paper-plane/tests/`. They target code that is no longer loaded, so they don't run against the current site.
