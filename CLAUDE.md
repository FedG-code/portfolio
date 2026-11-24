# Portfolio Site

## Structure
Static site, no build step. The homepage is the **Dolly Gallery** (3D greybox gallery wall, implemented 2026-11-09 from the approved round 4 prototype `design/blockout/dolly-r4.html`); each project's case opens **in the same scene** (js/case.js, "On Set", 2026-11-09). The project HTML files are the source of each case's text and the plain fallback pages.

```
index.html              - Dolly Gallery homepage (name strip, About, 3D wall + guide, shot list)
casino_games.html       - Logifuture case study
eve_of_destruction.html - Lost Satellite Studios case study
my_games.html           - "Other Games" case study (file name kept; title renamed from My Games): Stealth Game, Tetrarcana, Calm Before the Storm
over_the_hill.html      - Over the Hill / Feedbot case study
university_projects.html - Climbing, Rally and Fishing Game (one page, one section each, in that order)
css/
  gallery.css           - Homepage only (self-contained, one identity)
  shared.css            - Plain project pages: base, tidbits, section headings, reveal (tokens = gallery palette + green)
  project.css           - Project page layout, back link
js/
  greybox.js            - Shared 3D stage: renderer, Stage, capsule guide, stand, Clock, drag (window.Greybox)
  gallery.js            - The gallery: data, plain list, dolly, guide, open/return
  case.js               - A case in the scene: fetches the project file, the guide tells it in bubbles, case bar, trailer, the three frames (University, Other Games)
  shared.js             - Plain project pages: scroll reveal, lazy mp4 loops, title focus
  analytics.js          - GA4 events
assets/                 - Captures. *.mp4 + *-poster.jpg are the loops (the GIF originals were deleted 2026-11-09; they are in git history)
tests/gallery-test.js   - Playwright checks for the gallery and the hand-over to/from project pages
tests/case-test.js      - Playwright checks for the cases in the scene and the project files
archive/                - Retired code, not loaded anywhere: card hand + theme switcher, paper plane, legacy backups (see archive/README.md)
```

## Detailed Documentation
- **CSS**: [css/CLAUDE.md](css/CLAUDE.md)
- **JS** (gallery flow, accessibility, gotchas): [js/CLAUDE.md](js/CLAUDE.md)
- **Tests**: [tests/CLAUDE.md](tests/CLAUDE.md)
- **Design history / decisions**: `design/HANDOFF.md` (in the main checkout, untracked)

## Key Details
- **Section order** (user): About, Over the Hill, Eve of Destruction, Casino Games, University Projects, Other Games. Over the Hill leads.
- **Opening a section**: the bubble's "Learn more" button, a click on the capture itself, or Enter on an already-selected section button. All push the camera into the screen first. In University / Other Games, Learn more and Enter open the game in the big frame (`sec.order` slot 0), the same as clicking the big frame.
- **Gallery bubble = summary, wall monitor = facts** (user, 2026-11-23): the guide's gallery bubble is the section's summary (`P[].blurb`) + one Learn more; no bullets, no game list. Over the Hill, Eve and Casino's summaries are their page's `.project-hero-desc`, verbatim (gallery-test fails if they drift: edit the page, then P). University and Other Games have their own lines (the user's words). The summary scrolls inside the bubble when it doesn't fit; Learn more always shows. The facts (`logs`) and the Stack line are on the **wall monitor** (was a paper wall label; visual pass 2026-11-23, `design/review/BRIEF.md`): a small monitor (3D bezel, chin + green LED) hung on two thin lines that run up out of shot, its HTML face (`#wall-label`) fitted to the projected face; desktop only, one monitor, left of the selected screen (right edge .4 from the picture, top level with it), above the stand; University: just the stack. Phone: no monitor.
- **Bay layout (visual pass, 2026-11-23)**: desktop single bays share one picture height (2.55 m; bezels take the clip's shape, no letterbox); frame bays a 2.2 m tall big frame (width from its clip, cap 4.5) + two 1.0 m small ones stacked right of it. A desktop bay = 2.75 (`SL`, the monitor's gap) + the picture(s) + a fixed 2.9 m zone (`ZONE`): the guide and its bubble in the gallery, the monitor in a case. The About bay is 5.25, so the first shot still frames the About sign and the whole lead screen (the About bubble opens to the right). Phone keeps its sizes. Titles are **lit 3D signs** (a thin card centred above the main screen / big frame, two bolts, Archivo 800 + the sub line in Plex Mono caps + a green rule; a click selects / opens like the old HTML plates). The **About card is a 3D sign too** (2026-11-24): ABOUT label, the lead line, a short green rule, the body (desktop; phone: lead only, the body is in the bubble); its text stays in the page as `.sr` for screen readers. **HTML on a screen follows its perspective** (2026-11-24): the clip overlays, the trailer embed and the monitor's face are warped onto the four projected corners (`GB.quad`, a matrix3d), not stretched to their bounding box (they spilled past the bezel off-centre). **Wall shadows**: screens, signs and the monitor don't cast into the shadow map (their thin shadow strip drew as dashed lines); each has a soft blurred shadow plane on the wall, offset along the sun (`soft()` in greybox.js). The sun also has a `normalBias`. The **bubble**: rounded (12 px), curved tail in the bar's dark colour, soft shadow, fades up 6 px on entry; in the gallery it sits in the zone (left edge .35 right of the bezel, up to 280 px wide, top capped at the sign); in a case it stays left of the screen and the sign; on phone it stays below the picture.
- **Wall monitor motion** (option A, "fly in"): every change of place flies it up out of shot, it travels unseen, swaps its content and drops in at the new place, then switches on (a CRT line). Gallery section to section (out as the dolly starts, in on arrival; a drag flies it out, it drops in where the dolly stops; About: out only), opening a case (into the case side), leaving (in on the gallery side once the camera is back), switching cases. Reduced motion, rebuilds and direct `#<id>/case` links place it at once.
- **One identity**: no theme switcher. **Green is the one signal colour** (user, 2026-11-09; replaced orange): it marks what is selected, what you can act on, and the debug layer. Bright `#2BD957` for every mark, on ink and on paper alike (bars, markers, playhead, outlines: user, 2026-11-23, it matches the debug green; paper marks used to be `#0E7F31`); green text on paper stays `#0B7A2E` for contrast. Debug marks and selection differ by shape: a debug mark is a thin outline with a mono chip, a selection is a solid bar or a doubled outline (green line + dark line). Archivo (variable width) + IBM Plex Mono.
- **Stands**: every gallery bay has a stand (the player-start pad, raised, thin green ring) to the left of its screen (desktop bays are about 1m wider for it). In the gallery the guide talks from its spot on the right; in a case it stands on the stand. It steps onto the stand only when it walks in from off screen (opening a case); leaving a case it steps off and walks to its spot (user, 2026-11-09).
- **One page, one scene** (user 2026-11-09): no page load between the gallery and a case. A case = low shot of the section's bay; the guide on the stand tells the case in its bubble, one paragraph per part (Back / Next, dots), the screen shows that part's capture. The section bar becomes the case bar ("← All projects" + the parts); choosing a part never moves the camera (bubble and capture change, the guide hops). University Projects and Other Games (2026-11-23, same treatment): bar = the three games (no Overview: University's page has no intro; Other Games' intro stays on the plain page only); the current game's frame is big; clicking a small frame (in the case: rotate, no zoom; from the gallery: rotate first, then push in) swaps it with the big one; leaving keeps the last game big. Media: clips play on the screen; a part with two clips splits the one screen, side by side (user, 2026-11-09: Casino's Unity games and sportsbook minis sit on the same screen; no second screen); stats are on the wall monitor (below); links are small tags under the screen; Eve's trailer: Play zooms the camera into the frame and plays it there (Close / Esc zooms back out). Frames: the big frame plays its game's muted loop (gallery and case); in a case, a part with its own capture plays that in the big frame instead (Stealth Game: Vision & Visibility, Readable Danger, Enemy and Shadows each have their clip; user 2026-11-23). In frame bays the link tags sit beside the big frame's name label, or a row under it when they don't fit. Rally's clip has sound (user: it's a study in polishing one mechanic, the impact audio is a layer): it loops muted like the others, and "Play with sound" zooms in and plays it with sound, the same way as Eve's trailer. No "whole case as text" box (user: in the way). **No Overview part in any case** (user, 2026-11-23): the page intro is the gallery summary; the case bar starts at the first real section (Eve's trailer goes with Combat). **Wall monitor in a case** (desktop): .3 right of the rightmost frame (the frame bays' widest extent, so it doesn't move when frames swap), never hidden in a case: a section sheet for the whole case (Studio, Role, Year(s), Stack from `spec`, + two headline figures `P[].head`; University: stack only until its facts are confirmed) + a "Now" row (`NOW 2/5 · Unity Games`: the bar group) with the part's stat chips (`.work-stats`), cross-fading between parts. No "case" wording on it. Its face hides while the camera is zoomed into a trailer. The low shot takes in its right edge. Desktop stage fills the window height. The copy is unchanged (a content pass, bullets, Over the Hill first, comes later).
- **Phone** (user, 2026-11-09): gallery stage 400 tall (was 500). A case is one screen: the page scrolls once so the stage is at the top, the stage shrinks to ~40% of the window (`phoneView()`, `st.resize`), the bubble fills the rest above the parts bar with its text scrolling inside and Back / Next always showing; swipe the bubble or stage sideways for Next / Back; link tags sit under the screen's right edge (the guide is at its left); stat chips end the bubble (no wall monitor on phone). The gallery bubble's summary scrolls inside it (stage 400 tall), Learn more always showing. All projects puts the gallery height back. The bubble shows together with the case bar (opening used to read as a reload).
- **HTML first**: `index.html` ships About + a plain list; Three.js r128 (cdnjs, async) upgrades it. Without WebGL, or with `?flat`, the list stays.
- **One WebGL context** on the page. The phone shot is a breakpoint (stage < 640px), not a second canvas.
- **Open / close**: Learn more (or a click on a capture, or Enter on a selected section) pushes the camera into the screen, the case opens there and the camera pulls back out to the low shot while the guide walks in from off screen onto the stand. URL `index.html#<id>/case` (`#university-projects/case/<game>`), pushed to history: browser Back closes the case. "← All projects" (and browser Back, and switching cases) pulls straight back to the gallery shot, no push into the screen first (user, 2026-11-09), the guide steps off the stand and walks to its spot, focus returns to the section's button. Opening `index.html#<id>/case` directly starts inside the screen. Rejected, don't bring back: the title flight, round 2's "lower dolly track", and separate project pages with a page load.
- **Media**: muted H.264 mp4 loops (ffmpeg recipe in `design/HANDOFF.md`), loaded only when needed: the gallery overlay loads the selected section's clip and pre-warms one neighbour each side; a case plays only the shown part's clips; plain project pages load clips near the viewport. The `<video>`s are cached by src (`GB.clip`, up to 5, shared by the gallery and the case), and an overlay shows only once its video has a frame (no black box). The University clips start at their poster's moment (`start` on the item: Climbing 15 s, Rally 18 s, Fishing 1 s; Rally's "Play with sound" too).
- **Content rules** (user): no availability line; gambling metrics (bets, stakes) only inside the Casino case study, but player/user counts (e.g. "700k+ users") may show in the gallery (user, 2026-11-23); don't apply `cv.md` content without asking; no major rewriting of page copy.
- **Pages**: `over_the_hill.html` (Feedbot, built from cv.md + the sentiment-tracker repo) and `university_projects.html` (order: Climbing Game = main item, Rally Game, Fishing Game last; anchors `#climbing`, `#rally`, `#fishing`). Each university item in the gallery bubble opens its own anchor. `my_games.html` works the same way: Stealth Game (the first section, h2 renamed from "My Games" by the user, 2026-11-23) = main item, Tetrarcana, Calm Before the Storm; anchors `#stealth`, `#tetrarcana`, `#calm` (ids on the `.project-section`s). **No reference to AI use on the university page** (user rule), except the Climbing Game line "without using any AI to write code": the user wrote it, it is a limitation the project set itself (2026-11-10). University copy is the user's own text, verbatim: don't reword it.
- **Visual pass (2026-11-23): done**, P0-P5 of `design/review/BRIEF.md` (picture sizes + zone, wall monitor + its flight, 3D signs, bubble). Still open from that review: P6 content (Casino's hero ~70 words scrolls in the zone; Eve team size / outcome, University module / year / solo, Other Games stack per game for the monitor sheet; Other Games' sub line / button / badge), the "Calm Before the Storm" frame label wider than its small frame, and the monitor text is small on 1024-wide and smaller desktops (its face is 2.0 x 1.6 m). Also: the plain `university_projects.html` page still plays the clips from frame 0 under a mid-clip poster (the gallery/case start them at the poster's moment, `GB.START`).
- **Content pass notes (2026-11-23)**: (Casino's repeated "PixiJS and Unity WebGL" bullet was dropped in the visual pass.) Other Games' monitor facts (guard vision cone, Unity 6) cover only the Stealth Game; Other Games' sign ("A stealth game in Unity, plus jam games, since 2025"), its section button ("Solo developer · 2025 onwards") and the page's "Solo Dev" badge predate the new summary; Over the Hill's section button still says "Tool Designer". Gallery summaries: Over the Hill / Eve / Casino = their page hero (test-enforced); University and Other Games = the user's lines in `P` (`blurb`).
- **Content still to come**:
  - **The content pass (in progress, 2026-11-09)**, with the user: one bubble per part, bullets. `parse()` reads a `<ul>` (it joins the `<p>` just before it as one part, or is its own part straight after an `h4`). University is drafted from the user's own text (old technical copy cut). **Over the Hill is prose, no bullets** (user, 2026-11-24: the bubbles read as the guide talking, and a one-item list per part meant nothing): one `<p>` per part. Full brief in `design/HANDOFF.md` (top).
  - **University videos: done 2026-11-09.** `assets/climbing.mp4` (muted), `assets/rally.mp4` (from 0:07, **with audio**, `data-sound` on its `<video>`), `assets/fishing.mp4` (from 0:13, muted); 960 wide, posters `*-poster.jpg`. Recipe: the HANDOFF one with `-vf scale=960:-2 -r 30` (crf 30; Rally crf 28 + `-c:a aac -b:a 96k`). The Fishing island preview moved under the island paragraph. University content (bullets, module/year/solo) is still to do.
  - Game titles: **Climbing Game, Rally Game, Fishing Game are the names for now** (user, 2026-11-09). Still to confirm: module/year/solo for each university project.
  - A real Feedbot dashboard capture (needs player data blurred); the page uses the public site's illustrative example.

## Redesign history
The design work behind the gallery (v2-v9, the animated and blockout explorations, Dolly Gallery rounds 2-4, the polish list and the decisions already made) is in `design/` in the main checkout, untracked. Start at `design/HANDOFF.md`; versions and artifact links are in `design/CHANGELOG.md`.

## CV Reference
`cv.md` (repo root, gitignored) is a text copy of `Federico Giovannini CV.pdf` (also gitignored). Use it as the source of truth for roles, dates and metrics. Ask before changing site content based on it (the Over the Hill page was written from it with the user's go-ahead).

## Serving Locally
```
npx http-server -p 8080 -c-1
```

## Archive
The card hand, title flight and theme switcher (retired with the Dolly Gallery) and the paper plane + text destruction (removed at the user's request) live in `archive/` with their tests. Nothing there is loaded by a page. The plane's model (`assets/plane.glb`) was deleted; it's in git history (commit 7471f29). See [archive/README.md](archive/README.md).

## Verification
After visual changes, check whether port 8080 is already serving (`curl -s -o /dev/null -w "%{http_code}" http://localhost:8080`). Make sure it is serving **this** checkout (worktrees: use another port, e.g. `npx http-server -p 8091 -c-1`). Screenshot at 1920x1080, 1024x768, 390x844 and 812x375, and run:

```bash
node tests/gallery-test.js
node tests/case-test.js
```

Headless Chromium needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL (the tests pass them). The plain project pages (`?flat`) still use `.reveal` (opacity 0 until scrolled into view): override it before full-page screenshots. Delete screenshot files after verifying.

### Playwright Tips
- **Running JS on page**: `npx playwright-cli eval "() => { ... }"`.
- **Reload after CSS changes**: `npx playwright-cli reload` before screenshotting.
- **Gallery state**: select a section with `document.querySelector('.key[data-i="2"]').click()`; `?flat` forces the plain list.

## Conventions
- No build tools or bundler: static HTML/CSS/JS only
- Homepage styles in `css/gallery.css`; project page styles in `css/shared.css` + `css/project.css`
- Use CSS custom properties for colours; never hardcode colour values in element styles
- Project files are fixed to `data-theme="bold"`. Each has an inline `<head>` script that, with WebGL and without `?flat`, redirects to `index.html#<section-id>/case` (plus `/<item>` for a `#item` anchor); keep its id in step with `P` in js/gallery.js. Their back link points to `index.html#<section-id>`. js/case.js parses their markup (`.project-hero-desc`, `.project-section`, `.project-content div.project-text` p/h4, `.work-stats`, `.project-link`, `.video-embed iframe`): keep that structure when editing copy.
- `@playwright/cli` for screenshots (`npm install -g @playwright/cli@latest` if not installed)

## Preferences
- **Work directly on `master`** (user, 2026-11-09): no `claude/` branches or worktrees. Commit on `master`; ask before pushing (GitHub Pages serves `master`).
- **Use CLAUDE.md for persistent notes**, not the auto-memory directory. If something needs to be remembered across sessions, add it here.
- **Be surgical with file reads** — ALWAYS use `offset` and `limit` parameters. Never read more than 80 lines at once. Use Grep to find the right line numbers first, then read only that section. This applies to subagents too — when launching Explore/Plan agents, explicitly instruct them to use offset+limit and never read whole files. Whole-file reads of `js/gallery.js` (~715 lines) waste tokens and cause auto-compaction.
