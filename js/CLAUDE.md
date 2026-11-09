# JS Reference Map

Overview: no build step, no modules, all IIFEs. Three.js r128 comes from cdnjs (async, in the `<head>` of `index.html` and of each project page).

| File | Loaded by | Purpose |
|------|-----------|---------|
| `greybox.js` (~175 lines) | `index.html`, project pages | Shared 3D stage (`window.Greybox`): `renderer()`, `Stage`, `capsule`, `stand`, `Clock`, `phURL`, `dragX`, easing helpers |
| `gallery.js` (~450 lines) | `index.html` | The Dolly Gallery homepage |
| `case.js` (~390 lines) | `index.html` | A case in the scene (`window.CaseMode`): parses the project file, bubble, case bar, trailer, University frames, URL |
| `shared.js` (~63 lines) | project files (plain pages) | Scroll reveal, lazy mp4 loops, title focus |
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
- Return focus: the section's key. Opening a case moves focus to its current part on the case bar; closing returns it to the section's key.
- `prefers-reduced-motion`: `Clock.add` completes tweens instantly, no walk, no bubble pop, no motion overlay, no push/pull.

### Gotchas
- **No flash of the plain list**: an inline `<head>` script adds `html.g3d-wait` (unless `?flat` or no WebGL support), and gallery.css hides `#gallery`'s children behind a stage-shaped placeholder. It's removed when the gallery is built (before anything takes focus: hidden elements can't hold focus), on the `three-failed` event (script `onerror`), or after 4s, when the plain list shows. A `#section` return focus that couldn't land on the hidden list is carried by `G.wantFocus`.
- `[hidden]{display:none !important}` in gallery.css is required: `.bub{display:grid}` would otherwise beat the UA `[hidden]` rule and the bubble would never hide.
- If Three.js arrives after the plain list was shown, a pending pull-back (`G.pull`) is applied on upgrade unless the visitor already moved (`G.moved`).
- Don't give page elements ids equal to section ids (`over-the-hill`, ...): the back link's hash would scroll to them.

---

## case.js (a case in the scene)
"On Set" (direction C) in the gallery's own scene. `gallery.js` hands it the scene as `X` (`G.cs = CaseMode({...})`: stage, clock, guide, `secs`, `sx`, bars, `pushTarget`, `standToSpot`, `galleryShot`, `atGallery`, `setBusy`). Grep for the names below.

| Name | Notes |
|------|-------|
| `load(p)` / `parse(doc, p)` | Fetches the project file (cached; scripts don't run) and reads it: part 0 = `.project-hero-desc` with the gallery capture (`p.img/clip/px`, so the push in and out is one shot); then one part per `<p>` in `.project-content div.project-text`. Bar groups = `h2` sections when there are 2+, else the `h4`s (Over the Hill). Captures = the block's `video[data-src]` / `img.work-image` (max 2, carried forward). `.work-stats` -> chips; `.project-link` -> tags; `.video-embed iframe` -> trailer. University sections map to `items` by id (`item`). |
| `enter(s, k, o)` | `o.inside`: start inside the screen; `o.push`: push in first (Forward); `o.cut`: no motion (reduced motion, rebuild); `o.user`: pushes `#<id>/case` to history; `o.part`: start part. Hides the section bar, builds the case bar, low shot (`lowShot()`: from left of the bay's divider to its right end; phone adds the guide's depth), `walkIn()` onto the stand, then `talk()`. If the file fails to load: the plain page (`?flat`). |
| `show(i, talk)` / `go(i, user)` | Part i: University rotates its game big (`rotateTo`); otherwise `setImg` on the main screen, a second small screen (`extra`) for two captures, clip overlays, tags, Play button. Live region "Part i of N: heading" on user moves only. |
| `leave()` / `exit(done)` | All projects: `history.back()` if we pushed the state (popstate closes), else replace the hash and close. Push in, restore the screen's own capture, swap bars, pull out to the gallery shot, `standToSpot`. |
| `trailer()` / `closeTrailer()` | Zoom into the frame (`inside()`), YouTube embed over the screen, Close button + Esc (focus stays on Close: the player frame would keep Esc). |
| `setupSlots()` / `rotateTo(k, dur)` / `rotateBay(s, k, dur)` | University frames: `sec.order[k]` = slot of item k (slot 0 = big). Rotation tweens position + scale, updates `sec.scr[k].scx/sy/sw` (so `pushTarget` follows) and the selection outline's margin. `rotateBay` is the gallery's rotate-first before the push. |
| popstate | `#<id>/case`: open (or switch from another case); anything else: close. |

Gotchas: while a case is open the stage doesn't scrub but clicks still reach `tap()` (gallery's drag `start` checks `inCase()`); the case bubble is `#case-bubble` (`.bub.cbub`), the gallery's is `#guide-bubble`; phone puts the case bubble in `.cmb` under the stage.

---

## shared.js (plain project pages)
- Scroll reveal (`.reveal` -> `.visible`), `window.revealObserver`.
- If `sessionStorage['dolly-return']` is set (the plain list's links set it): focus `.project-hero-title` (tabindex=-1), or, when the URL has `#item`, that section's `.section-heading`. Focus runs after `load` because the browser's own fragment focus step would undo it.
- `video[data-src]`: src set when within 200px of the viewport, play while visible, pause when not. Reduced motion: `controls`, no loop, `preload=none`, no autoplay.

---
