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

## Paper plane (removed)
The paper plane and text destruction (`js/plane.js`, `js/destruction.js`, the P-key loader, `assets/plane.glb` and their test suites) were removed on 2026-11-09 at the user's request. They are in git history (last in commit 7471f29).

## Verification
After visual changes, check whether port 8080 is already serving (`curl -s -o /dev/null -w "%{http_code}" http://localhost:8080`). Make sure it is serving **this** checkout (worktrees: use another port, e.g. `npx http-server -p 8091 -c-1`). Screenshot at 1920x1080, 1024x768, 390x844 and 812x375, and run:

```bash
node tests/gallery-test.js
```

Headless Chromium needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL (gallery-test.js passes them). The project pages still use `.reveal` (opacity 0 until scrolled into view): override it before full-page screenshots. Delete screenshot files after verifying.

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
