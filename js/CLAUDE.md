# JS Reference Map

Overview: no build step, no modules, all IIFEs. Three.js r128 comes from cdnjs (async, in `index.html`'s `<head>`).

| File | Loaded by | Purpose |
|------|-----------|---------|
| `gallery.js` (~514 lines) | `index.html` | The Dolly Gallery homepage |
| `shared.js` (~63 lines) | project pages | Scroll reveal, lazy mp4 loops, title focus on arrival from the gallery |
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
| `renderer()` | The single `WebGLRenderer`, created once and reused across rebuilds. `glOK=false` if WebGL is missing -> plain list for good. |
| `Stage(host, w, h, o)` | Scene, lights, grid floor, `screen()`, `pin()` (HTML pinned to 3D points), render on demand (`render`, `later`), `dispose()`. `o.k` scales pinned HTML on narrower desktops. |
| `shot(m, w)` | Camera per breakpoint. Base sizes from the prototype (desktop 1192x470, phone 358x500). Desktop height = clamp(w*0.394, 400, 470); camera pulls back only sqrt of the aspect change and pins scale by `k` (min 0.72) so sign and bubble don't collide at 812-1100px. |
| `PHONE` | 640: stage width below this uses the phone shot (sign = lead line only, About body as `.ab-m` under the stage, bubble beside the guide). |
| `bubHTML(i)` | Bubble content: logs + stack + "Learn more" link (only if `href`); University Projects lists its three items, each an Open link to its anchor (`open(s, k)` pushes into screen k). |
| `select(s, anim, announce)` | Moves camera (`put`), walks the guide round the bay dividers (`route` via z=2.45 on desktop), then `arrive` -> `say` (bubble + live region) + `showOv` (clip). |
| `act(s)` | Shot-list click/Enter: select, or Open if already there. |
| `open(s)` | Sets `sessionStorage['dolly-return'] = id`, pushes the camera into the screen (0.6s), then `location.href = href`. Reduced motion: navigates at once. |
| `pullBack(s)` | Starts inside the screen and pulls out to the section shot. Used on return (`#id` + matching `dolly-return`) and on bfcache `pageshow`. |
| `dragX`, wheel handler, `snap()` | Scrub the dolly; a press becomes a drag only after 6px. Bubble + clip hide at once; guide walks after the snap. |
| `st.pick()` + tap/hover | A plain click on a capture (screen groups tagged `userData.hit = {s, k}`) calls `open(s, k)`, same as Learn more; hovering one with a page shows a pointer (`.st.over`). In the plain list, clicking the preview capture opens the selected page. |

### Accessibility
- The shot list is the keyboard route: roving tabindex, arrows/Home/End select, Enter on the selected section opens.
- `.live` (`aria-live=polite`, visually hidden) gets only the section name, and only on user-driven moves.
- The bubble (`#guide-bubble`) is the `aria-describedby` of the active key. Wall placards (`.tp`) are `aria-hidden` and not focusable.
- Return focus: the section's key. On the project page `shared.js` focuses `.project-hero-title` when `dolly-return` is set.
- `prefers-reduced-motion`: `Clock.add` completes tweens instantly, no walk, no bubble pop, no motion overlay, no push/pull.

### Gotchas
- `[hidden]{display:none !important}` in gallery.css is required: `.bub{display:grid}` would otherwise beat the UA `[hidden]` rule and the bubble would never hide.
- If Three.js arrives after the plain list was shown, a pending pull-back (`G.pull`) is applied on upgrade unless the visitor already moved (`G.moved`).
- Don't give page elements ids equal to section ids (`over-the-hill`, ...): the back link's hash would scroll to them.

---

## shared.js (project pages)
- Scroll reveal (`.reveal` -> `.visible`), `window.revealObserver`.
- If `sessionStorage['dolly-return']` is set: focus `.project-hero-title` (tabindex=-1), or, when the URL has `#item`, that section's `.section-heading`. Focus runs after `load` because the browser's own fragment focus step would undo it.
- `video[data-src]`: src set when within 200px of the viewport, play while visible, pause when not. Reduced motion: `controls`, no loop, `preload=none`, no autoplay.

---
