# Portfolio Site

## Structure
Static site, no build step. The homepage is the **Dolly Gallery** (3D greybox gallery wall, implemented 2026-11-09 from the approved round 4 prototype `design/blockout/dolly-r4.html`); each project's case opens **in the same scene** (js/case.js, "On Set", 2026-11-09). The project HTML files are the source of each case's text and the plain fallback pages.

```
index.html              - Dolly Gallery homepage (name strip, About, 3D wall + guide, shot list)
casino_games.html       - Logifuture case study
eve_of_destruction.html - Lost Satellite Studios case study
my_games.html           - "Other Games" case study (file name kept; title renamed from My Games)
over_the_hill.html      - Over the Hill / Feedbot case study
university_projects.html - Climbing, Rally and Fishing Game (one page, one section each, in that order)
css/
  gallery.css           - Homepage only (self-contained, one identity)
  shared.css            - Plain project pages: base, tidbits, section headings, reveal (tokens = gallery palette + green)
  project.css           - Project page layout, back link
js/
  greybox.js            - Shared 3D stage: renderer, Stage, capsule guide, stand, Clock, drag (window.Greybox)
  gallery.js            - The gallery: data, plain list, dolly, guide, open/return
  case.js               - A case in the scene: fetches the project file, the guide tells it in bubbles, case bar, trailer, University frames
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
- **Opening a section**: the bubble's "Learn more" button, a click on the capture itself, or Enter on an already-selected section button. All push the camera into the screen first.
- **One identity**: no theme switcher. **Green is the one signal colour** (user, 2026-11-09; replaced orange): it marks what is selected, what you can act on, and the debug layer. Bright `#2BD957` only on ink or the dark chip; on paper `#0E7F31` for bars/outlines/underlines and `#0B7A2E` for text. Debug marks and selection differ by shape: a debug mark is a thin outline with a mono chip, a selection is a solid bar or a doubled outline (green line + dark line). Archivo (variable width) + IBM Plex Mono.
- **Stands**: every gallery bay has a stand (the player-start pad, raised, thin green ring) to the left of its screen (desktop bays are about 1m wider for it). In the gallery the guide talks from its spot on the right; in a case it stands on the stand. It steps onto the stand only when it walks in from off screen (opening a case); leaving a case it steps off and walks to its spot (user, 2026-11-09).
- **One page, one scene** (user 2026-11-09): no page load between the gallery and a case. A case = low shot of the section's bay; the guide on the stand tells the case in its bubble, one paragraph per part (Back / Next, dots), the screen shows that part's capture. The section bar becomes the case bar ("← All projects" + the parts); choosing a part never moves the camera (bubble and capture change, the guide hops). University Projects: bar = Overview + the three games; the current game's frame is big; clicking a small frame (in the case: rotate, no zoom; from the gallery: rotate first, then push in) swaps it with the big one; leaving keeps the last game big. Media: clips play on the screen; a part with two clips splits the one screen, side by side (user, 2026-11-09: Casino's Unity games and sportsbook minis sit on the same screen; no second screen); stats are chips in the bubble; links are small tags under the screen; Eve's trailer: Play zooms the camera into the frame and plays it there (Close / Esc zooms back out). University frames: the big frame plays its game's muted loop (gallery and case). Rally's clip has sound (user: it's a study in polishing one mechanic, the impact audio is a layer): it loops muted like the others, and "Play with sound" zooms in and plays it with sound, the same way as Eve's trailer. No "whole case as text" box (user: in the way). Desktop stage fills the window height. The copy is unchanged (a content pass, bullets, Over the Hill first, comes later).
- **Phone** (user, 2026-11-09): gallery stage 400 tall (was 500). A case is one screen: the page scrolls once so the stage is at the top, the stage shrinks to ~40% of the window (`phoneView()`, `st.resize`), the bubble fills the rest above the parts bar with its text scrolling inside and Back / Next always showing; swipe the bubble or stage sideways for Next / Back; link tags sit under the screen's right edge (the guide is at its left). All projects puts the gallery height back. The bubble shows together with the case bar (opening used to read as a reload).
- **HTML first**: `index.html` ships About + a plain list; Three.js r128 (cdnjs, async) upgrades it. Without WebGL, or with `?flat`, the list stays.
- **One WebGL context** on the page. The phone shot is a breakpoint (stage < 640px), not a second canvas.
- **Open / close**: Learn more (or a click on a capture, or Enter on a selected section) pushes the camera into the screen, the case opens there and the camera pulls back out to the low shot while the guide walks in from off screen onto the stand. URL `index.html#<id>/case` (`#university-projects/case/<game>`), pushed to history: browser Back closes the case. "← All projects" (and browser Back, and switching cases) pulls straight back to the gallery shot, no push into the screen first (user, 2026-11-09), the guide steps off the stand and walks to its spot, focus returns to the section's button. Opening `index.html#<id>/case` directly starts inside the screen. Rejected, don't bring back: the title flight, round 2's "lower dolly track", and separate project pages with a page load.
- **Media**: muted H.264 mp4 loops (ffmpeg recipe in `design/HANDOFF.md`), loaded only when needed: the gallery overlay loads the selected section's clip only; a case plays only the shown part's clips; plain project pages load clips near the viewport.
- **Content rules** (user): no availability line; gambling metrics only inside the Casino case study; don't apply `cv.md` content without asking; no major rewriting of page copy.
- **Pages**: `over_the_hill.html` (Feedbot, built from cv.md + the sentiment-tracker repo) and `university_projects.html` (order: Climbing Game = main item, Rally Game, Fishing Game last; anchors `#climbing`, `#rally`, `#fishing`). Each university item in the gallery bubble opens its own anchor. **No reference to AI use on the university page** (user rule).
- **Content still to come**:
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
- **Be surgical with file reads** — ALWAYS use `offset` and `limit` parameters. Never read more than 80 lines at once. Use Grep to find the right line numbers first, then read only that section. This applies to subagents too — when launching Explore/Plan agents, explicitly instruct them to use offset+limit and never read whole files. Whole-file reads of `js/gallery.js` (~520 lines) waste tokens and cause auto-compaction.
