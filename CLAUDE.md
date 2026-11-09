# Portfolio Site

## Structure
Static site, no build step. The homepage is the **Dolly Gallery** (3D greybox gallery wall, implemented 2026-11-09 from the approved round 4 prototype `design/blockout/dolly-r4.html`); the project pages are separate HTML pages, upgraded to the **On Set** stage (js/onset.js, 2026-11-09).

```
index.html              - Dolly Gallery homepage (name strip, About, 3D wall + guide, shot list)
casino_games.html       - Logifuture case study
eve_of_destruction.html - Lost Satellite Studios case study
my_games.html           - "Other Games" case study (file name kept; title renamed from My Games)
over_the_hill.html      - Over the Hill / Feedbot case study
university_projects.html - Climbing, Rally and Fishing Game (one page, one section each, in that order)
css/
  gallery.css           - Homepage only (self-contained, one identity)
  shared.css            - Project pages: base, tidbits, section headings, reveal (the plain case; tokens = gallery palette + green)
  project.css           - Project page layout, back link
  onset.css             - Project pages: the On Set stage (placard, bubble, beat strip, link tags, trailer, folded text)
js/
  greybox.js            - Shared 3D stage: renderer, Stage, capsule guide, stand, Clock, drag (window.Greybox)
  gallery.js            - The gallery: data, plain list, dolly, guide, open/return
  onset.js              - Project pages: On Set (the guide tells the case in bubbles, built from the page's HTML)
  shared.js             - Project pages: scroll reveal, lazy mp4 loops, title focus (plain page)
  analytics.js          - GA4 events
assets/                 - Captures. *.mp4 + *-poster.jpg are the loops (the GIF originals were deleted 2026-11-09; they are in git history)
tests/gallery-test.js   - Playwright checks for the gallery and the hand-over to/from project pages
tests/onset-test.js     - Playwright checks for the On Set project pages
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
- **Stands**: every gallery bay has a stand (the player-start pad, raised, thin green ring) to the left of its screen, the same spot as on the project page. The guide talks from its spot on the right; it steps onto the stand only when it walks in from off screen (coming back from a project page), pauses, then walks to its spot (user, 2026-11-09).
- **Project pages = On Set** (direction C, user 2026-11-09): low shot of the section's bay; the guide on its stand left of the screen tells the case in its bubble, one paragraph per beat (Back / Next, dots), the screen shows that part's capture; a beat strip under the stage jumps between parts (choosing a part never moves the camera: the bubble and capture change and the guide hops). University Projects = one set, strip = Overview + the three games; `#climbing/#rally/#fishing` land on that game. Media: clips play on the screen; a part with two clips gets a second, smaller screen; stats are chips in the bubble; links are small tags under the screen; Eve's trailer is a Play button over the poster that opens the embed over the screen. The plain HTML stays the source and the no-WebGL / `?flat` page; with the set it is folded into "The whole case as text". The copy is unchanged (a content pass, bullets, Over the Hill first, comes later).
- **HTML first**: `index.html` ships About + a plain list; Three.js r128 (cdnjs, async) upgrades it. Without WebGL, or with `?flat`, the list stays.
- **One WebGL context** on the page. The phone shot is a breakpoint (stage < 640px), not a second canvas.
- **Open / return**: Open pushes the camera into the screen and sets `sessionStorage['dolly-return'] = id`, then loads the project page, which consumes the key, starts inside its screen and pulls back out while the guide walks in onto the stand (a direct link skips the zoom; the guide still walks in). The back link (`← All projects`) pushes into the project's screen, sets the key, and loads `index.html#<section-id>`; the gallery pulls back out, the guide walks in, and focus goes to that section's button. Rejected, don't bring back: the title flight, and round 2's "lower dolly track" for project pages.
- **Media**: muted H.264 mp4 loops (ffmpeg recipe in `design/HANDOFF.md`), loaded only when needed: the gallery overlay loads the selected section's clip only; project pages play only the shown part's clip on the set (the folded text's clips load near the viewport, as before).
- **Content rules** (user): no availability line; gambling metrics only inside the Casino case study; don't apply `cv.md` content without asking; no major rewriting of page copy.
- **Pages**: `over_the_hill.html` (Feedbot, built from cv.md + the sentiment-tracker repo) and `university_projects.html` (order: Climbing Game = main item, Rally Game, Fishing Game last; anchors `#climbing`, `#rally`, `#fishing`). Each university item in the gallery bubble opens its own anchor. **No reference to AI use on the university page** (user rule).
- **Content still to come**:
  - **Showcase videos for all three university projects** (Climbing, Fishing, Rally): the user is making them. When each arrives, convert it to a muted mp4 loop + poster (ffmpeg recipe in `design/HANDOFF.md`) and swap it in on `university_projects.html` (`video[data-src]`, replacing the "Capture to come" box / island preview / court still; the On Set screen picks it up from the HTML. For Climbing also change `data-onset-img="ph:Climbing Game"` on `<body>` to the poster) and in the gallery's University bay (`items[k].img` = poster, plus a clip; today only `scr[0]` gets a motion overlay, so the small screens need the overlay extended or stay stills).
  - Real game titles (repos only have working names), and confirmation of module/year/solo for each university project.
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
node tests/onset-test.js
```

Headless Chromium needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL (the tests pass them). The plain case (folded text, `?flat`) still uses `.reveal` (opacity 0 until scrolled into view): override it before full-page screenshots. Delete screenshot files after verifying.

### Playwright Tips
- **Running JS on page**: `npx playwright-cli eval "() => { ... }"`.
- **Reload after CSS changes**: `npx playwright-cli reload` before screenshotting.
- **Gallery state**: select a section with `document.querySelector('.key[data-i="2"]').click()`; `?flat` forces the plain list.

## Conventions
- No build tools or bundler: static HTML/CSS/JS only
- Homepage styles in `css/gallery.css`; project page styles in `css/shared.css` + `css/project.css`
- Use CSS custom properties for colours; never hardcode colour values in element styles
- Project pages are fixed to `data-theme="bold"`; their back link must point to `index.html#<section-id>` and `<body data-section>` must be that id (ids in `P` in js/gallery.js). `data-onset-img` / `data-onset-clip` / `data-onset-px` on `<body>` = the gallery screen's capture for that section (the first frame of the hand-over); `ph:<label>` uses the gallery's placeholder.
- `@playwright/cli` for screenshots (`npm install -g @playwright/cli@latest` if not installed)

## Preferences
- **Use CLAUDE.md for persistent notes**, not the auto-memory directory. If something needs to be remembered across sessions, add it here.
- **Be surgical with file reads** — ALWAYS use `offset` and `limit` parameters. Never read more than 80 lines at once. Use Grep to find the right line numbers first, then read only that section. This applies to subagents too — when launching Explore/Plan agents, explicitly instruct them to use offset+limit and never read whole files. Whole-file reads of `js/gallery.js` (~520 lines) waste tokens and cause auto-compaction.
