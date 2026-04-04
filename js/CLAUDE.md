# JS Reference Map

Overview: 6 JS files (~3,100 lines). No build step, no modules — all globals. GSAP + Three.js loaded from CDN. Files communicate via `window.*` hooks.

## Dependency Graph

```
shared.js (theme switcher)
  ├─ fires → TextDestruction.onThemeChange()
  ├─ fires → window._planeOnThemeChange()
  └─ fires → window._cardHandOnThemeChange()

plane.js (3D canvas + projectiles)
  └─ calls → TextDestruction.onProjectileAt()

card-hand.js ←→ page-transition.js (shared state: CARDS, cardOrder, activePageCardId, dragState, animState)
  └─ page-transition.js uses → TextRearrange.fly()

External: GSAP core, SplitText, Physics2DPlugin, Three.js r128, GLTFLoader
```

---

## shared.js (37 lines)

### Complete Reference
| Section | Lines | Notes |
|---------|-------|-------|
| Scroll reveal (IntersectionObserver) | 1-11 | threshold 0.1, rootMargin '0px 0px -40px 0px', staggered 60ms delay, unobserves after visible |
| Theme switcher setup | 14-17 | themes = ['bold','cinematic','brutalist','retro','neon'], reads data-theme attr |
| updateLabel() | 21-25 | Shows NEXT theme name on button |
| Click handler | 27-35 | Cycles index, sets data-theme, persists to localStorage('portfolio-theme'), fires 3 callbacks |

### Global Exports
- `window.revealObserver` (line 10) — IntersectionObserver instance

### Theme Change Hooks Fired (in order)
1. `window.TextDestruction.onThemeChange()` (line 32)
2. `window._planeOnThemeChange()` (line 33)
3. `window._cardHandOnThemeChange()` (line 34)

These are called without null checks — would throw if undefined and script loads before the others.

---

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
| Toggle button UI | 127-214 | createToggleButton(), updateButtonLabel(), attractor bounce |
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

## text-rearrange.js (268 lines)

### Section Map
| Section | Lines | Notes |
|---------|-------|-------|
| IIFE wrapper | 14, 266-268 | `var TextRearrange = (function() { ... })()` |
| quadBezier() | 23-29 | Quadratic bezier interpolation -> {x, y} |
| measureDirect() | 37-80 | SplitText on element, extracts char rects + computed styles |
| fly() | 94-263 | Main entry: measures source/target, builds bezier arc timeline |

### Constants
| Name | Value | Description |
|------|-------|-------------|
| CHAR_STAGGER | 0.05s | Delay between char launches |
| CHAR_DURATION | 0.20s | Per-char fly time |
| ARC_HEIGHT | 150px | Bezier arc offset |
| DISCRETE_SWAP | 0.30 | Progress point for font-family/style/transform swap |

### Functions
| Function | Lines | Params | Returns | Description |
|----------|-------|--------|---------|-------------|
| quadBezier | 23-29 | t, p0x/y, p1x/y, p2x/y | {x,y} | Bezier point interpolation |
| measureDirect | 37-80 | el, keepSplit | {positions[], sourceChars[], split, elRect, lineHeight} | Measures char positions + computed styles via SplitText |
| fly | 94-263 | {sourceEl, targetEl, overlay, onStart?} | {timeline, lastLaunchTime, destroy(), charEls[]} or null | Builds GSAP timeline: chars fly along bezier arcs from source to target |

### Measurement Invariant: destruct-char Consistency
`measureDirect()` uses `charsClass: 'destruct-char'` so that SplitText creates inline-block spans matching the final state after `TextDestruction.onThemeChange()` re-splits. This is critical — without it, positions measured as inline text differ from positions rendered as inline-block spans, causing visible character shifts (especially on punctuation like "." which shifts ~15px).

The old Y-correction block (previously L121-138) was removed because it compensated for inline-vs-inline-block glyph offset, which no longer exists when both source and target are measured as inline-block.

**If you touch measureDirect or splitAllText**: both MUST use `charsClass: 'destruct-char'` with matching SplitText options, or fly-swap positions will diverge.

### Line-Height Interpolation (L204-205, L230)
Source and target line-heights extracted per-char, linearly interpolated during animation. Prevents vertical spacing jumps between card and page typography.

### fly() Animation Flow
1. **Validate** (L94-119): Check fonts loaded, measure source (keepSplit), measure target, validate char count (+/-2 tolerance)
2. **Prepare chars** (L126-150): Reparent source chars to overlay as fixed-position elements, copy 9 computed style properties
3. **Build timeline** (L152-236): Per-char bezier arc (alternating perpendicular offset), interpolate font-size/weight/letter-spacing/line-height linearly, swap font-family/style/text-transform at DISCRETE_SWAP, GSAP native color interpolation
4. **Return** (L238-248): timeline, lastLaunchTime, destroy(), charEls[]

### Dependencies
GSAP core (timeline, to, set), SplitText (measureDirect)

---

## card-hand.js (546 lines)

### Section Map
| Section | Lines | Notes |
|---------|-------|-------|
| CARDS array | 0-40 | 4 card objects with id, accent, title, pageUrl, artImage, etc. |
| Constants | 42-61 | Responsive dimensions (mobile vs desktop) |
| State variables | 63-84 | dragState, animState, cardOrder, activePageCardId, etc. |
| createCardHTML() + freezeGif() + buildCards() | 86-150 | DOM construction, GIF->PNG freeze |
| Fan geometry | 152-175 | fanX(), fanAngle(), fanArcY(), getRestPosition() |
| layoutCards() | 177-197 | Applies transforms to card elements |
| Slot detection + proximity | 199-239 | getSlotForX(), getCardCenter(), calcProximity(), isInPlayZone() |
| Proximity feedback | 242-280 | applyProximityFeedback(), resetProximityFeedback(), hexToRGB() |
| Touch helpers | 282-319 | isPlaneActive(), findNearestCardInRange(), liftCard(), dismissLift() |
| Drag handlers | 321-467 | onPointerDown(), onPointerMove(), onPointerUp() |
| Hover handlers | 469-494 | pointerover/pointerout |
| Event listeners | 496-528 | Pointer events, dragstart, scroll, theme callback |
| Theme change callback | 530-540 | window._cardHandOnThemeChange |
| Init | 542-546 | buildCards() + layoutCards() |

### CARDS Array Structure (each object)
```
{ id, accent, title, typeLeft, typeRight, icon, text, pageUrl, artImage }
```
- id 0-2: project cards (have pageUrl + artImage)
- id 3: Home card (pageUrl: null, artImage: null)

### Key Constants
| Name | Desktop | Mobile (<=768) | Description |
|------|---------|----------------|-------------|
| CARD_W | 220 | 132 | Card width (px) |
| CARD_H | 320 | 192 | Card height (px) |
| HAND_W | 700 | min(innerWidth, 400) | Hand container width |
| HAND_H | 400 | 260 | Hand container height |
| HOLD_RADIUS | 1400 | 900 | Fan arc radius |
| FAN_SPREAD | 20 deg | 14 deg | Angular spread |
| OVERLAP_SPACING | 155 | 90 | Horizontal card spacing |
| SINK_BELOW | 190 | 130 | Vertical offset down |
| HOVER_LIFT | 50 | 35 | Hover lift (px) |
| PLAY_ZONE_HALF_W | ~385 | — | Play zone half-width |
| PLAY_ZONE_HALF_H | ~289 | — | Play zone half-height |
| MAX_BLUR | 8 | — | Max proximity blur (px) |
| MAX_OVERLAY_OPACITY | 0.3 | — | Max overlay darkness |
| MAX_GLOW_SIZE | 30 | — | Max card glow (px) |
| PROXIMITY_DEAD_ZONE | 0.35 | — | Dead zone (35% distance) |

### Fan Geometry
- X: `(slot - (total-1)/2) * OVERLAP_SPACING`
- Angle: `-FAN_SPREAD/2 + (FAN_SPREAD/(total-1)) * slot`
- Y: `HOLD_RADIUS - HOLD_RADIUS * cos(angle_radians)`

### DOM Structure Created
```
#handContainer (preserve-3d)
  .card[data-card-id]
    .card-inner[data-accent]
      .card-title > h3
      .card-art > .card-art-inner > (img.card-art-img OR .card-art-icon)
      .type-bar
      .card-textbox
      .accent-strip
```

### Global Exports
- `window._cardHandOnThemeChange` (L533-540): Clears inline proximity feedback styles
- Shared variables (used by page-transition.js): CARDS, cardOrder, activePageCardId, dragState, animState, buildCards, getRestPosition, calcProximity, MAX_BLUR, MAX_OVERLAY_OPACITY, MAX_GLOW_SIZE, handContainer, dragBlurOverlay, perspectiveContainer, flyOverlay

### Cross-File Dependencies
- Calls `window.prefetchPage()` (from page-transition.js) on pointer down
- Checks `isPlaneActive()` — reads `plane-active` CSS class (set by plane.js)

---

## page-transition.js (890 lines)

### Section Map
| Section | Lines | Notes |
|---------|-------|-------|
| Timing constants | 0-6 | DECOMPOSE_DURATION=0.1s, FLY_DURATION=0.5s |
| Fetch + cache | 8-31 | pageCache = {url: Promise<html>}, prefetchPage(), extractPageContent() |
| SPA bootstrap | 50-136 | bootstrapFromProjectPage(): handles direct project page loads |
| playCard() | 138-258 | 6-phase animation: center -> wriggle -> expand -> decompose -> pause -> transition |
| beginPageTransition() | 260-356 | Measures title/art, reparents to flyOverlay, routes to home/project |
| transitionToHome() | 358-501 | Flies elements to home hero, fades in home page |
| transitionToProject() | 503-694 | Flies elements to project page, fades in wrapper |
| Helpers | 696-722 | getTargetTypography(), applyArtCloneStyles() |
| rebuildHand() | 725-765 | Rebuilds card hand after transition |
| History + navigation | 767-889 | navigateToPage(), popstate handler, back/forward |

### Timing Constants
| Name | Value | Lines | Description |
|------|-------|-------|-------------|
| DECOMPOSE_DURATION | 0.1s | 5 | Decorative element fade-out |
| FLY_DURATION | 0.5s | 6 | Title/art fly animation |
| WRIGGLE_DURATION | 1.0s | 202 | Wriggle phase |
| Page fade | 0.3-0.4s | various | Opacity transitions |

### playCard() Animation Phases
1. **Center** (0-500ms, L195-199): Card slides to viewport center, power3.out
2. **Wriggle** (500-1500ms, L201-225): +/-8 deg rotation, +/-2.5px jitter, blur->16px, overlay->0.55, glow->70px
3. **Expand** (1500-2000ms, L227-235): Scale to fill viewport `min(vw/CARD_W, vh/CARD_H)`, glow+blur->0
4. **Decompose** (2000-2150ms, L237-249): Fade .type-bar, .card-textbox, .accent-strip, border
5. **Pause** (2150-2350ms, L252): Empty delay
6. **Transition** (2350ms+, L255-257): Calls beginPageTransition()

### transitionToHome vs transitionToProject
| Aspect | toHome (L358-501) | toProject (L503-694) |
|--------|-------------------|----------------------|
| Target | `#page-home` (hidden) | New `<div class="spa-page measuring">` |
| Title target | `.hero h1` (theme-aware) | `.project-hero-title` |
| Image target | None (art fades out) | First `.work-image` |
| .reveal handling | Strips from title | Strips from title + image ancestor |
| History | pushState -> index.html | pushState -> cardData.pageUrl |

### Fly Clone System
1. Measures card title/art at current scale (beginPageTransition L285-296)
2. Reparents real elements to #flyOverlay with fixed positioning (L298-342)
3. Uses TextRearrange.fly() for char-by-char animation (or fallback tween)
4. After animation: destroy() clears overlay

### transitionToHome Cleanup Ordering
In the cleanup callback (~L477), `TextDestruction.onThemeChange()` MUST run BEFORE `targetTitle.style.opacity = '1'` and `rearrangeResult.destroy()`. This ensures the h1 is already split into `destruct-char` spans (inline-block) when it becomes visible. If onThemeChange runs after the title is revealed, the h1 briefly appears in its unsplit (inline) state, then jumps when re-split — punctuation like "." shifts ~15px.

### .reveal Class Handling
Elements with `.reveal` start at opacity:0 + translateY(24px). Must be stripped from fly targets before measuring, otherwise getBoundingClientRect returns wrong values. Re-observed after transition for elements without `.visible`.

### pageCache Structure
```
{ [url: string]: Promise<string> }
```
Promises resolve to extracted HTML (nav/footer/canvas stripped by extractPageContent).

### Global Exports
- `window.prefetchPage(url)` (L31): Starts async fetch+cache

### Cross-File Dependencies
- Imports from card-hand.js: CARDS, calcProximity, MAX_BLUR, MAX_OVERLAY_OPACITY, MAX_GLOW_SIZE, cardOrder, activePageCardId, buildCards, getRestPosition, handContainer, dragBlurOverlay, perspectiveContainer, flyOverlay
- Uses optional: window.TextDestruction, window.TextRearrange, window.revealObserver
- Modifies: activePageCardId, cardOrder, dragState, animState

### Uncertainties
- extractPageContent() (L33-48) uses hardcoded selector list for removal — if page structure changes, content may be incorrectly stripped
- TextRearrange.fly() failure is silently caught (L416-420)
- popstate handler (L877-889) clears GSAP timeline on every navigation — may interrupt unrelated animations
