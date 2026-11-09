# JS Reference Map

Overview: no build step, no modules, all IIFEs. Three.js r128 comes from cdnjs (async, in `index.html`'s `<head>`).

| File | Loaded by | Purpose |
|------|-----------|---------|
| `gallery.js` (~490 lines) | `index.html` | The Dolly Gallery homepage |
| `shared.js` (~60 lines) | project pages | Scroll reveal, lazy mp4 loops, title focus on arrival from the gallery |
| `analytics.js` (~57 lines) | all pages | GA4 events: case_open, email_click, social_click, scroll_depth |
| `plane-key.js` (~50 lines) | all pages | P key (no modifiers, not in a field) loads GSAP + SplitText + Physics2DPlugin, `destruction.js`, `plane.js` in order (creating `#plane-canvas`), then `PaperPlane.toggle()`. Reloads the stack on the next page if sessionStorage `portfolio-plane` is 'on'. |
| `plane.js`, `destruction.js` | `plane-key.js`, on demand | Paper plane + text destruction, off by default. plane.js exposes `window.PaperPlane = {toggle, isOn}` and no longer builds a toggle button. It creates its own WebGLRenderer (a second context on the homepage while on). `DESTRUCTIBLE_SELECTOR` targets the gallery's HTML text and project page text. |

Retired on 2026-11-09 with the Dolly Gallery: `card-hand.js`, `page-transition.js`, `text-rearrange.js` (title flight), `toolbar.js` (theme switcher). They are in git history (last at commit 2ad4150).

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
| `bubHTML(i)` | Bubble content: logs + stack + Open link (only if `href`); University Projects lists its three items, each an Open link to its anchor (`open(s, k)` pushes into screen k). |
| `select(s, anim, announce)` | Moves camera (`put`), walks the guide round the bay dividers (`route` via z=2.45 on desktop), then `arrive` -> `say` (bubble + live region) + `showOv` (clip). |
| `act(s)` | Shot-list click/Enter: select, or Open if already there. |
| `open(s)` | Sets `sessionStorage['dolly-return'] = id`, pushes the camera into the screen (0.6s), then `location.href = href`. Reduced motion: navigates at once. |
| `pullBack(s)` | Starts inside the screen and pulls out to the section shot. Used on return (`#id` + matching `dolly-return`) and on bfcache `pageshow`. |
| `dragX`, wheel handler, `snap()` | Scrub the dolly; bubble + clip hide at once; guide walks after the snap. |

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

## destruction.js and plane.js (loaded on the P key)

The reference below predates the Dolly Gallery; line numbers and the selector list have drifted (the selectors now target the gallery and project pages, and the toggle button/toolbar slot is gone).

## destruction.js (~447 lines)

### Section Map
| Section | Lines | Notes |
|---------|-------|-------|
| GSAP registration | 1-7 | Registers SplitText + Physics2DPlugin |
| Constants | 8-17 | Unified (no mobile overrides) |
| Batch tracking | 19 | activeBatchCount (diagnostic only, no gating) |
| DESTRUCTIBLE_SELECTOR | 22-42 | 28 CSS selectors targeting destructible text |
| splitAllText() | 50-75 | SplitText.create() per element, caches parent color |
| revertAllText() | 77-83 | Clears splits/char arrays |
| revertElement() | 85-98 | Single element revert |
| preloadSplit() | 100-103 | Pre-split on fonts ready (all viewports) |
| CollisionDetector + spatial grid | 105-212 | Document-relative cache, spatial grid (80px cells), eager warm-up |
| getCharsInBlastRadius() | ~170-212 | O(1) spatial grid lookup (3x3 cell neighborhood) |
| shatterChars() | ~228-304 | Physics2D scatter + color flash + batch tracking |
| scheduleTypingReform() | ~306-390 | Staggered reform, chunked cleanup (40 chars/RAF) |
| Resize debounce | ~392-403 | 300ms debounce, re-splits + stale cache |
| Public API (window.TextDestruction) | ~405-447 | init(), destroy(), onProjectileAt(), onThemeChange(), revertElement() |

### Constants Table
| Name | Value | Description |
|------|-------|-------------|
| BLAST_RADIUS | 40 | Impact radius (px) |
| SCATTER_DURATION | 1.2 | Scatter time (s) |
| REFORM_PAUSE | 0.8 | Pause before reform (s) |
| CHAR_LAND_DURATION | 0.12 | Drop-in time per char (s) |
| CHAR_STAGGER | 0.055 | Delay between char reforms (s) |
| WORD_EXTRA_STAGGER | 0.05 | Extra pause at word boundary (s) |
| DROP_DISTANCE | 16 | Pre-position offset above slot (px) |
| GRAVITY | 600 | Physics gravity |
| MIN_VELOCITY | 150 | Scatter velocity floor (px/s) |
| MAX_VELOCITY | 500 | Scatter velocity ceiling (px/s) |
| ANGLE_SPREAD | 60 | Scatter angle variance (deg) |
| MAX_ROTATION | 720 | Max rotation scatter (deg) |
| GRID_CELL_SIZE | 80 | Spatial grid cell size (2x BLAST_RADIUS) |

### Global API
```
window.TextDestruction = {
  init()                    // Arm + split all text
  destroy()                 // Disarm + kill tweens (does NOT revert split)
  onProjectileAt(sx, sy)    // Hit detection entry (pressure-gated)
  onThemeChange()           // Kill tweens, revert/re-split, re-read accent
  revertElement(el)         // Revert single element split
}
```

### Key Mechanisms
- **Document-relative cache**: Stores {el, docX, docY} per visible char. Positions are document-relative (docY = screenY + scrollY), so the cache never needs rebuilding on scroll — only on init, resize, and theme change.
- **Spatial grid**: Cache entries are indexed into 80px grid cells (key: "col,row"). `getCharsInBlastRadius()` checks only 9 cells (3x3 neighborhood) for O(1) average-case hit detection instead of O(n) linear scan.
- **Batch tracking**: `activeBatchCount` tracks in-flight scatter batches for diagnostic purposes. No gating — all impacts proceed regardless of active batch count.
- **Shatter**: Physics2D scatter with gravity + rotation + color flash on all platforms.
- **Reform**: Left-to-right DOM order, staggered CHAR_STAGGER with WORD_EXTRA_STAGGER at word boundaries. Cleanup chunked (40 chars/RAF) on all platforms.

### Dependencies
GSAP core, SplitText plugin, Physics2DPlugin (all CDN, no npm)

---

## plane.js (812 lines)

### Section Map
| Section | Lines | Notes |
|---------|-------|-------|
| IIFE & constants | 1-68 | 28 tuneables, mobile gating (MIN_VIEWPORT 768px) |
| Mobile detection | 29-35 | isMobile() with _isMobileCached |
| State variables | 37-80 | enabled, scene/camera/renderer, plane model, mouse/touch, projectiles[], fire interval |
| Iframe avoidance | 82-125 | getAvoidanceTarget() keeps plane outside iframe buffered regions |
| Toggle button UI | ~125-161 | `planeIcon` SVG (paper plane), `createToggleButton()` builds `.plane-btn` with aria-label + aria-pressed, adopts into `#toolbar-plane-slot` (body fallback). `updateButtonLabel()` toggles `.active` + aria-pressed on state change. No icon swap — active state is pure CSS recolor via `.plane-btn.active { color: var(--accent); background: var(--accent-soft); }` |
| Toggle handler | 216-247 | SessionStorage persist, syncs TextDestruction.init/destroy, plane-active class |
| start() / stop() | 249-271 | Control animation loop + canvas visibility |
| Dynamic script loading | 273-298 | CDN Three.js r128 + GLTFLoader |
| Coordinate conversion | 300-312 | screenToWorld(), worldToScreen() |
| Mouse events (desktop) | 314-388 | onMouseMove/Leave/Enter, snapMouseIfTrappedInIframe() |
| Touch events (mobile) | 390-437 | onTouchStart/Move/End with touch hit radius |
| Mobile mouse fallback | 439-471 | DevTools emulation support |
| Projectile system | 473-532 | Pool of 20 THREE.Line objects, fire from wing tips |
| Animation loop | 534-669 | animate(): propeller spin, position lerp, scroll-on-drag, roll, projectile update, destruction trigger |
| Resize handler | 671-682 | Camera frustum + renderer size update |
| init() (Three.js) | 684-799 | Scene/camera/renderer, lighting, GLB load, event listeners |
| Bootstrap | 801-812 | Disables on page reload, creates button, inits if enabled |

### Key Constants
| Name | Value | Mobile? | Description |
|------|-------|---------|-------------|
| MODEL_SCALE | 0.1 | x1.3 mobile | Plane GLB scale |
| FRUSTUM_SIZE | 10 | no | Orthographic camera height |
| PROJECTILE_SPEED | 8.0 | no | World units/s |
| FIRE_INTERVAL | 0.12 | no | Rapid-fire delay (s) |
| POOL_SIZE | 20 | no | Projectile pool |
| IMPACT_THROTTLE | removed | — | Was 120ms mobile; now handled by destruction.js tween pressure monitor |
| TOUCH_HIT_RADIUS | 60 | no | Mobile touch target (px) |
| LS_KEY | 'portfolio-plane' | — | SessionStorage key |
| IFRAME_BUFFER | 50 | no | Avoidance margin (px) |

### Global Exports
- `window._planeOnThemeChange` (L723): Updates cachedAccentColor
- `window._planeWorldToScreen` (L656): worldToScreen() alias

### Three.js Setup
- Orthographic camera, frustum height 10, looking down Y axis
- WebGL renderer, antialias always-on, pixel ratio capped at 2.0
- GLB from `assets/plane.glb`, finds FrontPropeller/TopPropeller children
- Ambient light 0.8 + directional light 0.6

### Projectile System
- Pool of 20 pre-allocated THREE.Line objects (BufferGeometry, 6 floats each)
- Fires 2 per trigger (left + right wing)
- Progress 0-1, head travels at PROJECTILE_SPEED, tail at 70% (TAIL_SPEED_RATIO)
- At head=1.0: triggers TextDestruction.onProjectileAt() (unthrottled; destruction.js handles pressure)

### Toggle Persistence
- SessionStorage key 'portfolio-plane', cleared on page reload (L804-808)
- Adds/removes `plane-active` class on documentElement

---

