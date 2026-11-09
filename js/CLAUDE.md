# JS Reference Map

Overview: no build step, no modules, all IIFEs. Three.js r128 comes from cdnjs (async, in the `<head>` of `index.html` and of each project page).

| File | Loaded by | Purpose |
|------|-----------|---------|
| `greybox.js` (~175 lines) | `index.html`, project pages | Shared 3D stage (`window.Greybox`): `renderer()`, `Stage`, `capsule`, `stand`, `Clock`, `phURL`, `dragX`, easing helpers |
| `gallery.js` (~400 lines) | `index.html` | The Dolly Gallery homepage |
| `onset.js` (~400 lines) | project pages | On Set: the guide tells the case in bubbles, built from the page's own HTML |
| `shared.js` (~66 lines) | project pages | Scroll reveal, lazy mp4 loops, title focus (plain page) |
| `analytics.js` (~57 lines) | all pages | GA4 events: case_open, email_click, social_click, scroll_depth |

Retired code (card hand, page transitions, title flight, theme toolbar, paper plane, text destruction) is in `archive/` (see archive/README.md); none of it is loaded.

---

## gallery.js

Ported from `design/blockout/dolly-r4.html` (round 4 prototype). Grep for the names below; line numbers drift.

### Data
- `H`: city, About lead line and body.
- `P`: the five project sections in track order (About is section 0 and is not in `P`). Fields: `id` (also the URL hash), `t`, `sub`/`subM` (desktop/phone placard line), `img` (still texture), `clip` (mp4 for the motion overlay), `px` (pixel art: nearest filtering), `ar`, `alt`, `marks` (gizmo chips/boxes in the plain list preview), `href` (project page, or `null` = no Open yet), `blurb`, `spec`, `logs` (bubble facts), `items` (University Projects: three entries, placeholder captures from `phURL()`).
- Section index (`G.sel`, key `data-i`) = About 0, then `P[i]` is section `i + 1`.

### Flow
1. `boot()`: tries `upgrade()`; if Three.js isn't there yet (or no WebGL / `?flat`) it renders `flatList()`.
2. `three-ready` event (dispatched by the `<script onload>` in `<head>`) -> `upgrade()` keeps the selected section and focus.
3. `buildDolly(start)`: builds stage + shot list (`.keys`) + live region; `start = {sel, focus, pull}`.
4. Window width change -> rebuild (same renderer) keeping `G.sel`. Height changes are ignored (phone URL bars).

### Key pieces
| Name | Notes |
|------|-------|
| `renderer()` (greybox.js) | The single `WebGLRenderer`, created once and reused across rebuilds. `GB.glOK()` false if WebGL is missing -> plain list for good. |
| `Stage(host, w, h, o)` (greybox.js) | Scene, lights, grid floor, `screen()` (selection = green line + dark line), `tex()`, `pin()` (HTML pinned to 3D points; `rect` pins place themselves), render on demand (`render`, `later`), `proj`, `dispose()`. `o.k` scales pinned HTML on narrower desktops. |
| `standAt(zone, l)` | Each bay's stand: desktop left of the screen (`l + .8`), phone near the guide's spot. |
| `shot(m, w)` | Camera per breakpoint. Base sizes from the prototype (desktop 1192x470, phone 358x500). Desktop height = clamp(w*0.394, 400, 470); camera pulls back only sqrt of the aspect change and pins scale by `k` (min 0.72) so sign and bubble don't collide at 812-1100px. |
| `PHONE` | 640: stage width below this uses the phone shot (sign = lead line only, About body as `.ab-m` under the stage, bubble beside the guide). |
| `bubHTML(i)` | Bubble content: logs + stack + "Learn more" link (only if `href`); University Projects lists its three items, each an Open link to its anchor (`open(s, k)` pushes into screen k). |
| `select(s, anim, announce)` | Moves camera (`put`), walks the guide round the bay dividers (`route` via z=2.45 on desktop), then `arrive` -> `say` (bubble + live region) + `showOv` (clip). |
| `act(s)` | Shot-list click/Enter: select, or Open if already there. |
| `open(s)` | Sets `sessionStorage['dolly-return'] = id`, pushes the camera into the screen (0.6s), then `location.href = href`. Reduced motion: navigates at once. |
| `pullBack(s)` | Starts inside the screen and pulls out to the section shot while the guide walks in from off screen (along z=2.45, in front of the dividers), steps onto the stand, pauses, and walks to its spot; then `select(s, false)`. Used on return (`#id` + matching `dolly-return`) and on bfcache `pageshow`. Reduced motion: cut, guide at its spot. |
| `dragX`, wheel handler, `snap()` | Scrub the dolly; a press becomes a drag only after 6px. Bubble + clip hide at once; guide walks after the snap. |
| `st.pick()` + tap/hover | A plain click on a capture (screen groups tagged `userData.hit = {s, k}`) calls `open(s, k)`, same as Learn more; hovering one with a page shows a pointer (`.st.over`). In the plain list, clicking the preview capture opens the selected page. |

### Accessibility
- The shot list is the keyboard route: roving tabindex, arrows/Home/End select, Enter on the selected section opens.
- `.live` (`aria-live=polite`, visually hidden) gets only the section name, and only on user-driven moves.
- The bubble (`#guide-bubble`) is the `aria-describedby` of the active key. Wall placards (`.tp`) are `aria-hidden` and not focusable.
- Return focus: the section's key. On the project page `onset.js` focuses the title (or, for `#item`, that game's strip button) when it consumed `dolly-return`.
- `prefers-reduced-motion`: `Clock.add` completes tweens instantly, no walk, no bubble pop, no motion overlay, no push/pull.

### Gotchas
- **No flash of the plain list**: an inline `<head>` script adds `html.g3d-wait` (unless `?flat` or no WebGL support), and gallery.css hides `#gallery`'s children behind a stage-shaped placeholder. It's removed when the gallery is built (before anything takes focus: hidden elements can't hold focus), on the `three-failed` event (script `onerror`), or after 4s, when the plain list shows. A `#section` return focus that couldn't land on the hidden list is carried by `G.wantFocus`.
- `[hidden]{display:none !important}` in gallery.css is required: `.bub{display:grid}` would otherwise beat the UA `[hidden]` rule and the bubble would never hide.
- If Three.js arrives after the plain list was shown, a pending pull-back (`G.pull`) is applied on upgrade unless the visitor already moved (`G.moved`).
- Don't give page elements ids equal to section ids (`over-the-hill`, ...): the back link's hash would scroll to them.

---

## onset.js (project pages)
Built from direction C of `design/work-pages/work-pages.html` (section C, `makeSet`). Grep for the names below.

### Page contract
- `<body data-section="<P id>" data-onset-img data-onset-clip data-onset-px>`: the section id (must match the back link hash) and the gallery screen's capture (first frame of the hand-over; `ph:<label>` = `GB.phURL`).
- `<head>`: inline script adds `html.os-wait` (unless `?flat` / no WebGL support); Three.js async with `three-ready` / `three-failed` events. Scripts at the end: `shared.js`, `greybox.js`, `onset.js` (shared.js must run first: it reads `dolly-return` before onset.js consumes it).

### Flow
1. Arrival: `fromGallery` = `sessionStorage['dolly-return'] === data-section` (the key is removed). `hashEl` = `#climbing` etc.
2. `upgrade()` (now, or on `three-ready`): checks `GB.renderer()` before touching the DOM, then `parse()` -> `buildDOM()` -> `build()` -> `api.arrive('gallery' | 'walk')`. Sets `html.os-on`; `data-os-arrive` records the mode (tests read it). If `build` throws after the DOM moved, it sets `sessionStorage['os-failed']` and reloads once as the plain page.
3. Fallback (`?flat`, no WebGL, `three-failed`, 4s): `unwait()` shows the plain page and calls `window.planFocus()` (shared.js).

### Key pieces
| Name | Notes |
|------|-------|
| `parse()` | Beats from the HTML: beat 0 = `.project-hero-desc` with the gallery capture; then one beat per `<p>` in each `.project-content div.project-text`. Groups (strip keys) = `h2` sections when the page has 2+, else the `h4`s (Over the Hill). Captures = the block's `video[data-src]` / `img.work-image` / `.work-capture-tbc` (max 2; carried forward). `.work-stats` -> chips on the block's last beat. `.project-link`s -> tags on the section's beats (a section with no text: every beat). `.video-embed iframe` -> trailer on the section's first beat (no text: the previous beat). |
| `buildDOM()` | Placard (badge, the real `h1` moved in, tidbit chips), link tags, Play trailer button, bubble (`#os-bubble`), phone bubble slot `.os-mb`, beat strip `.os-keys` (roving tabindex, arrows/Home/End), live region `.os-live`. Moves the page's content into `<details class="os-text">`. Back link click -> `api.leave(href)`. |
| `fill(i)` / `go(i, user)` | Bubble text, `k / n` and dots within the part, stats, tags, strip state; the live region says "Part i of N: heading" on user moves only. |
| `build()` | The set: `GB.Stage`, back wall + dividers, screens (`L1` one, `L2` main + smaller), stand + guide left of the screen, pins (placard, tags, play, trailer, clip overlays, desktop bubble above the guide with its text height capped to fit). Phone (< 640) = bubble under the stage. Rebuilt on width change (same renderer). |
| `arrive(mode)` | `gallery`: start inside the screen (`inside()`, framed like the gallery's `pushTarget`), pull out to the low shot while `walkIn()`; `walk`: low shot + `walkIn()`; reduced motion / `cut`: guide on the stand at once. `.os-busy` hides placard, tags and play during camera moves. |
| `leave(href)` | Sets `dolly-return`, pushes into the screen (0.6s), loads the gallery. Interrupts a walk-in. bfcache `pageshow` pulls back out. |

### Gotchas
- `html.os-wait` hides the plain page; remove it **before** `build()` measures the stage (hidden = width 0 = phone shot).
- The desktop bubble is a `.pin` inside the stage; on phone the same element moves to `.os-mb` and loses `.pin`.
- Don't give anything an id equal to a section id.

---

## shared.js (project pages)
- Scroll reveal (`.reveal` -> `.visible`), `window.revealObserver`.
- `window.planFocus()`: if `sessionStorage['dolly-return']` is set, focus `.project-hero-title` (tabindex=-1), or, when the URL has `#item`, that section's `.section-heading`. Runs at once unless `html.os-wait` (then onset.js calls it if the plain page stays). Focus runs after `load` because the browser's own fragment focus step would undo it.
- `video[data-src]`: src set when within 200px of the viewport, play while visible, pause when not. Reduced motion: `controls`, no loop, `preload=none`, no autoplay.

---
