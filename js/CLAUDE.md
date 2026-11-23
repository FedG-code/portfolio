# JS Reference Map

Overview: no build step, no modules, all IIFEs. Three.js r128 comes from cdnjs (async, in the `<head>` of `index.html` and of each project page).

| File | Loaded by | Purpose |
|------|-----------|---------|
| `greybox.js` (~175 lines) | `index.html`, project pages | Shared 3D stage (`window.Greybox`): `renderer()`, `Stage`, `capsule`, `stand`, `Clock`, `phURL`, `dragX`, easing helpers |
| `gallery.js` (~540 lines) | `index.html` | The Dolly Gallery homepage |
| `case.js` (~475 lines) | `index.html` | A case in the scene (`window.CaseMode`): parses the project file, bubble, case bar, trailer, University frames, URL |
| `shared.js` (~63 lines) | project files (plain pages) | Scroll reveal, lazy mp4 loops, title focus |
| `analytics.js` (~57 lines) | all pages | GA4 events: case_open, email_click, social_click, scroll_depth |

Retired code (card hand, page transitions, title flight, theme toolbar, paper plane, text destruction) is in `archive/` (see archive/README.md); none of it is loaded.

---

## gallery.js

Ported from `design/blockout/dolly-r4.html` (round 4 prototype). Grep for the names below; line numbers drift.

### Data
- `H`: city, About lead line and body.
- `P`: the five project sections in track order (About is section 0 and is not in `P`). Fields: `id` (also the URL hash), `t`, `sub`/`subM` (desktop/phone placard line), `img` (still texture), `clip` (mp4 for the motion overlay), `px` (pixel art: nearest filtering), `ar`, `alt`, `marks` (gizmo chips/boxes in the plain list preview), `href` (project page, or `null` = no Open yet), `blurb` (the gallery bubble's summary: Over the Hill / Eve / Casino = their page's `.project-hero-desc` verbatim, checked by gallery-test), `cap` (the plain list's preview caption), `spec`, `logs` (wall label facts; `spec[2]` = its Stack line), `items` (University Projects and Other Games: three entries, each `t`, `href` (page + anchor), `img` poster + `clip` loop + `ar`; item 0 is the main, big frame; `phURL()` stands in for a missing `img`). An items bay's overlay plays the clip of the item that is big (`secs[s].order`). Each frame entry in `secs[s].scr` carries its name label (`lab`).
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
| `Stage(host, w, h, o)` (greybox.js) | Scene, lights, grid floor, `screen()` (selection = green line + dark line), `tex()`, `pin()` (HTML pinned to 3D points; `rect` pins place themselves), render on demand (`render`, `later`), `proj`, `dispose()`. `o.k` scales pinned HTML on narrower desktops. `o.sm` = shadow map size (gallery: 2048 desktop, 1024 phone). `sunSpan(a, b)` fits the sun's shadow box to the wall from x=a to b (+3) and moves the sun with it, so the far bays get shadows (it used to be ±24 round x=0); `buildDolly` calls it once the wall's extent is known. The shadow map is redrawn only when a caster has moved (`R.shadowMap.autoUpdate = false`; `draw()` keys the casters' world matrices), not for camera moves or clips. `render()` during a `Clock` tick places the pins at once and leaves the WebGL draw to the end of the tick (one draw per frame however many tweens run). |
| `Clock` (greybox.js) | On-demand tweens, dt capped at .05 s (slow frames slow the motion down). One rAF chain: a tween added inside a tick (a `done()` starting the next move) used to start a second loop, and each extra loop drew the scene again; in SwiftShader that stacked up to ~5 draws a frame and made the case open take 8-10 s (the flaky "Learn more did nothing" / timeouts in the tests). |
| `divider(x)` (gallery.js) | A bay divider = a visible box that only receives shadows + an invisible caster (`SHM`: no colour, no depth, `shadowSide = FrontSide`) inset .1 on the lit sides (the sun is at -x, +y, +z) and running .3 into the wall and floor. r128 draws back faces into the shadow map, so the visible box's own shadow-side face sat within a texel of the wall and floor and a lit band leaked along every join; overlap and bias didn't fix it. The caster isn't in `hits`, so `st.pick` never sees it. |
| `GB.clip(src, poster, rm)` / `clipPut(o, v)` / `clipGate(o, v)` (greybox.js) | The clip cache, shared by the gallery overlay and the case's overlays: `<video>`s kept by src (up to 5; least recently used, never one showing, is evicted with `removeAttribute('src'); load()`), moved between overlays instead of rebuilt; spare ones wait paused in a 1px `.vhold` holder. `clipGate` adds `.wait` (opacity 0) until the video has a frame (readyState >= 2, not seeking; checked on `loadeddata` / `seeked` / `playing` / `timeupdate` and `requestVideoFrameCallback`, whichever comes first), and only if it is still that overlay's video; a video that already has a frame shows at once; with a `GB.START[src]` it also waits for that time on the first play. A clip that fails stays invisible and the still shows. |
| `standAt(zone, l, s)` | Each bay's stand: desktop 1.0 left of the screen (`l + SL - 1`; About `l + .8`), phone near the guide's spot. `SL` (screen's left edge from the divider) and `BW` carry `WX` = 1.15 for the wall label on desktop. |
| `shot(m, w)` | Camera per breakpoint. Base sizes from the prototype (desktop 1192x470, phone 358x500). Phone height 400 (case view: `setStageH`, see case.js `phoneView`). Desktop height = clamp(w*0.394, 400, 470); camera pulls back only sqrt of the aspect change and pins scale by `k` (min 0.72) so sign and bubble don't collide at 812-1100px. |
| `PHONE` | 640: stage width below this uses the phone shot (sign = lead line only; the guide's About bubble says the About body, `bubHTML(i, m)`; bubble beside the guide). Nothing sits between the stage and the bar (the old `.ab-m` box was removed, user 2026-11-09). |
| `bubHTML(i)` | Bubble content: the summary (`.sum`, `blurb`) + "Learn more" (only if `href`). `say()` points Learn more (and `act()`'s Enter) at `bigK(s)`, the game in an items bay's big frame. `fitSum()` caps the summary's height so the bubble fits above the guide (desktop) or in the stage (phone); it scrolls inside. Desktop About: `.abr`, the bubble opens to the right (`bubPin.ax`). |
| `wl` / `W` (wall label) | Desktop only (`#wall-label`, `.wl`, `aria-describedby` of the active key with the bubble). `wlHTML(i)`: logs + Stack. A `rect` pin places it by `W.t`: 0 = left of the screen (right edge .4 from the big frame, top level with its top), 1 = right of the rightmost frame, in projected screen px so it follows a moving camera (no slide between the two: tried and removed, user 2026-11-23). `wlSet(html)` cross-fades (`.fade`, '' hides), `wlShow(s)` (in `arrive`), `wlHide()` (dolly, drag, pull-back; not `open`). Handed to case.js as `X.wl`. `WLW` 190px (160 under 820px stages). |
| `select(s, anim, announce)` | Moves camera (`put`), walks the guide round the bay dividers (`route` via z=2.45 on desktop), then `arrive` -> `say` (bubble + live region) + `showOv` (clip). |
| `showOv(s)` / `clipOf(s)` | The selected section's clip (an items bay: the big frame's) from `GB.clip`, gated (`clipGate`) when it is new or the overlay was hidden; once it plays, the clips of s-1 and s+1 are pre-warmed (paused `preload=auto` cache entries). `start` on a University item (`GB.START`) makes its clip start at the poster's moment. |
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
| `load(p)` / `parse(doc, p)` | Fetches the project file (cached; scripts don't run) and reads it: no Overview part (2026-11-23: the hero is the gallery summary); one part per `<p>` in `.project-content div.project-text`; a `<ul>` joins the `<p>` before it (lead line + bullets) or, straight after an `h4`, is a part of its own (`b.html` holds the wrapped elements; `fill()` sets it as is). A `div.part` is one part with all its paragraphs (Fishing). The first part with no capture of its own falls back to the gallery capture; a text-less section's trailer (Eve) goes to the part before it, or the first part. Bar groups = `h2` sections when there are 2+, else the `h4`s (Over the Hill). Captures = the block's `video[data-src]` / `img.work-image` (max 2, carried forward). `.work-stats` -> stat chips (desktop: `chipsHTML(b)` on the wall label via `X.wl`, set in `show()` once it has landed (`wlR`); phone: `.cstats` at the end of the bubble); `.project-link` -> tags; `.video-embed iframe` -> trailer; a `video[data-sound]` capture (Rally) -> "Play with sound" (`snd(b)`). Sections of an items bay map to `items` by id (`item`); `own` marks a part whose capture comes from its own section (not carried over). |
| `enter(s, k, o)` | `o.inside`: start inside the screen; `o.push`: push in first (Forward); `o.cut`: no motion (reduced motion, rebuild); `o.user`: pushes `#<id>/case` to history; `o.part`: start part. Hides the section bar, builds the case bar, low shot (`lowShot()`: desktop from 3.0 left of the stand to the bay's right end, widened if the wall label (`X.wl.w` px) wouldn't fit right of the frames; phone adds the guide's depth), wall label: hidden, placed right of the frames; it shows the part's chips when the guide talks, `walkIn()` onto the stand, then `talk()`. If the file fails to load: the plain page (`?flat`). |
| `show(i, talk)` / `go(i, user)` | Part i: an items bay rotates its game big (`rotateTo`) and the big frame shows the part's own capture (`partCap(b)`: Stealth Game's three parts each have a clip), else its game's; the small frames and leaving restore each frame's own still; otherwise `setImg` on the main screen; two captures split it (`setSplit`: the still is hidden, the two overlays fill the screen's halves, `.vov.half` = contain; the bubble and tags measure the full screen then), clip overlays (`clips(b)`: videos from `GB.clip`, gated with `clipGate` when new; reduced motion: paused with controls, no gate), tags (items bay: beside the big frame's name label, or a row under it when they don't fit), Play button. Live region "Part i of N: heading" on user moves only. |
| `leave()` / `exit(done)` | All projects: `history.back()` if we pushed the state (popstate closes), else replace the hash and close. Kills a walk-in still running (`inT`: browser Back during the walk-in used to leave the case bubble showing over the gallery). The wall label hides, and comes back left with the facts once the camera is at the gallery shot. Restore the screen's own capture, swap bars (scroll kept), pull straight back to the gallery shot (no push in), `standToSpot`. Phone `enter` shows the bubble with the case bar and keeps the scroll. |
| `trailer()` / `closeTrailer()` | Zoom into the frame (`inside()`), YouTube embed (or, for a `data-sound` clip, a `<video controls>` played with sound from its `GB.START` time, like the loop; muted if the browser refuses) over the screen, Close button + Esc (focus stays on Close: the player frame would keep Esc). |
| `setupSlots()` / `rotateTo(k, dur)` / `rotateBay(s, k, dur)` | Frames (University, Other Games): `sec.order[k]` = slot of item k (slot 0 = big). Rotation tweens position + scale, updates `sec.scr[k].scx/sy/sw` (so `pushTarget` follows) and the selection outline's margin. `rotateBay` is the gallery's rotate-first before the push. |
| popstate | `#<id>/case`: open (or switch from another case); anything else: close. |

Gotchas: `st.pick` (greybox.js) only counts visible meshes: r128 raycasts hidden objects too, and line outlines are hit up to a unit away, so a hidden selection outline used to steal clicks meant for the next frame. While a case is open the stage doesn't scrub but clicks still reach `tap()` (gallery's drag `start` checks `inCase()`); the case bubble is `#case-bubble` (`.bub.cbub`), the gallery's is `#guide-bubble`; phone puts the case bubble in `.cmb` under the stage.

---

## shared.js (plain project pages)
- Scroll reveal (`.reveal` -> `.visible`), `window.revealObserver`.
- If `sessionStorage['dolly-return']` is set (the plain list's links set it): focus `.project-hero-title` (tabindex=-1), or, when the URL has `#item`, that section's `.section-heading`. Focus runs after `load` because the browser's own fragment focus step would undo it.
- `video[data-src]`: src set when within 200px of the viewport, play while visible, pause when not. Reduced motion: `controls`, no loop, `preload=none`, no autoplay.

---
