# Tests Reference Map

Playwright (Chromium). `playwright` is the only dependency in `package.json`; run `npm install` first if `node_modules` is missing (worktrees don't have their own: set `NODE_PATH` to the main checkout's `node_modules`).

## gallery-test.js (live site)

`node tests/gallery-test.js`. Server on `BASE` (default `http://localhost:8080`; e.g. `BASE=http://localhost:8091` when 8080 serves another checkout). Uses SwiftShader flags so headless Chromium has WebGL. Exits 1 on any failed check.

| Check | What |
|-------|------|
| Viewports | 1920x1080, 1024x768, 390x844, 812x375: gallery built, exactly one canvas, About selected, bubble shown, no horizontal overflow, no page errors; Casino: the bubble is the summary + one Learn more, inside the stage; the bubble clear of the screen and the 3D sign (phone: of the picture; rects from `window.__dolly.rects()`); desktop: the wall monitor landed (`data-at` `3:gallery`) left of the screen with the two facts (incl. 700k+) and Stack; phone: no monitor; 1920: the three single-screen bays' picture heights within 2% of each other, each frame bay's big frame 2.2/2.55 of that ±2% |
| Keyboard | focus About key, ArrowRight x2 -> Eve; live region = "Eve of Destruction" only; `aria-describedby="guide-bubble wall-label"` on the active key; ult+bossfightgif.mp4 overlay (the Combat clip) |
| Open | Enter on the selected key: bubble hides during the push; `#eve-of-destruction/case` in the same page, one canvas, case bar shown, focus on its first part (Combat: no Overview) |
| All projects | bubble hidden during the push / pull-out / walk, then shown; section bar back, focus on the Eve key, no `/case` in the URL |
| University | bubble = the user's summary + one Learn more (#climbing, the big frame); wall label = just the stack; Learn more opens Climbing; with Rally made big in the case, browser Back closes it (focus on the University button) and Learn more then opens Rally |
| Summaries | Over the Hill, Eve, Casino: the bubble's `.sum` text equals the page's `.project-hero-desc` (whitespace-normalised; fails when they drift); Eve's Steam link: new tab, noopener, no inline style, `--link` colour |
| Over the Hill | Learn more opens `#over-the-hill/case` |
| Other Games | bubble = the summary + one Learn more (#stealth) |
| Stage input | Over the Hill's button reads "Learn more"; no dolly-track label; a drag scrubs and snaps; a click on Other Games' big frame opens `#other-games/case/stealth` |
| Signs | no `.tp` on the stage; a click on Over the Hill's 3D sign selects it (the outline shows on its screen only, `rects().bays[].sel`), a second click opens its case |
| No flash | with Three.js slowed to 1.5s, the plain list is never visible before the gallery appears |
| Clip overlays | on a throttled network (150 ms, 6 Mbit/s), selecting Eve, Casino, University, Other Games, ...: a `.vov` is never visible (not hidden, opacity > 0) while its video has readyState < 2; Eve pre-warms Casino's clip and University pre-warms Casino's and Other Games' (paused, `preload=auto`, in `.vhold`); Climbing's first shown frame is at 15 s (its poster's moment) |
| Fallbacks | `?flat` and `--disable-webgl`: plain list, no canvas, 5 rows |
| Reduced motion | instant cut, no clip; the wall monitor is placed at once (no flight); the case cuts in with its clip paused + controls; plain project page clips have controls and stay paused |

## case-test.js (cases in the scene)

`node tests/case-test.js`, same `BASE` / `NODE_PATH` as above.

| Check | What |
|-------|------|
| Viewports | 4 viewports x 5 cases (`index.html#<id>/case`): case bar shown, section bar hidden, one canvas, one key per part (no Overview), bubble, no overflow, no errors; desktop: the case bubble clear of the screen and the 3D sign; Casino part 2 and Tetrarcana: desktop, the chips on the wall monitor's Now row right of the picture, inside the stage, clear of bubble / tags / Play / frame labels / screens, none in the bubble; phone: no monitor, chips at the end of the bubble |
| Monitor | 1440x900: every part of every case shows the monitor (landed, face inside its projected bezel ±2 px, a `Now n/N` row, no "case" wording). The `label()` helper waits for `#wall-label[data-at]` (set once the monitor has landed and switched on; a flight takes ~2 s) |
| Parts | Next / Back, bar click, ArrowRight (focus follows), live region "Part 2 of N: Launch week", feedbot.co.uk tag |
| Switch | another case's hash while one is open switches cases; the monitor lands on the new case side (`3:case`) with its sheet |
| Clip start | `#university-projects/case/climbing`, then Rally and Fishing: each clip's first shown frame is at its poster's moment (15 s, 18 s, 1 s), and no `.vov` is visible before its video has a frame; Rally's Play with sound starts at 18 s |
| Media | Casino two-clip part plays hitfor6 + hopit, split side by side on the one screen, clear of the bubble; Casino's first part (no chips) keeps the monitor (sheet + `Now 1/5`, no chips), the next shows 300k / #1 on it; Eve opens on Combat (its own clip, trailer button); Play trailer zooms in (embed > 75% of the stage width), Esc zooms back out; Rally: big frame loops rally.mp4, "Play with sound" zooms in with an unmuted `<video>`, Esc closes; gallery University bay plays the big frame's clip (Climbing, then Rally after leaving its case) |
| University | `#university-projects/case/rally` opens Rally; a small frame (tap, and real clicks above the labels, in any order) rotates to big and the URL names the game; from the homepage a small frame rotates first, then the case opens on it |
| Other Games | bar = Stealth Game, Tetrarcana, Calm Before the Storm (no Overview), three frames; Next through the Stealth Game parts plays visionsystem / soundring / enemy-ai in the big frame, then Tetrarcana (big, its clip, `#other-games/case/tetrarcana`); clicking the small Calm / Stealth frames rotates them big; `#other-games/case/tetrarcana` opens on it; from the homepage the bay plays visionsystem.mp4, the wall monitor lands left of the big frame (`5:gallery`, facts + Stack), a small Tetrarcana frame rotates first, then opens, and the monitor flies to the right of them (`5:case`) with 2 Week / 1v1; All projects flies it back left with the facts (`5:gallery`); leaving on Readable Danger the gallery plays visionsystem.mp4 again |
| Phone | 390x664 touch: Learn more opens Casino as one screen (stage at the top, Back / Next and the parts bar in view); a left swipe on the bubble goes to the next part (1 / 2 -> 2 / 2), whose chips end the bubble (no monitor); All projects restores the 400px gallery stage |
| Project files | redirect into the scene (also `#fishing` -> `/case/fishing`, `my_games.html#calm` -> `#other-games/case/calm`); `?flat` stays plain; `index.html?flat#<id>/case` goes to the plain page; no WebGL ends on the plain page |
| Reduced motion | the case cuts in, clip paused with controls |

## Archived
The card-hand / title-flight / theme tests and the paper-plane / destruction suites are in `archive/card-hand/tests/` and `archive/paper-plane/tests/`. They target code that is no longer loaded, so they don't run against the current site.
