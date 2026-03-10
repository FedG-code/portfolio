# Text Destruction Effect — Technical Specification

## Overview

When the plane mode is active and the user clicks to fire projectiles, any text the projectiles pass through shatters into individual letter/word fragments that scatter with physics, then reassemble after a delay.

**Trigger:** Projectile collision with text elements  
**Effect:** Characters shatter outward from the impact point with physics (velocity, gravity, rotation)  
**Recovery:** Characters animate back into place after ~2.5 seconds  
**Scope:** All text across every page (headings, body, labels, etc.)

---

## Architecture

The system has four subsystems:

1. **TextSplitter** — Splits all text into animatable character spans on init
2. **CollisionDetector** — Maps projectile world positions to screen coordinates and finds which chars they hit
3. **ShatterAnimator** — Applies Physics2D scatter + timed reassembly via GSAP
4. **Lifecycle Manager** — Handles init/teardown, plane toggle, scroll/resize, and theme changes

All code lives in a new file: **`js/destruction.js`**  
It is loaded after `plane.js` and exposes a global `TextDestruction` object that `plane.js` calls into.

---

## New Dependencies (CDN)

Add these script tags in `index.html` (and all project pages) **after** the existing GSAP core script and **before** `plane.js`:

```html
<!-- Existing -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>

<!-- NEW: GSAP plugins (all free since May 2025) -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/SplitText.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/Physics2DPlugin.min.js"></script>

<!-- NEW: Destruction system -->
<script src="js/destruction.js"></script>

<!-- Existing -->
<script src="js/plane.js"></script>
```

Register plugins at the top of `destruction.js`:

```js
gsap.registerPlugin(SplitText, Physics2DPlugin);
```

---

## Subsystem 1: TextSplitter

### Purpose
Split all visible text elements into individual `<span>` elements (one per character), enabling per-character animation.

### Selector
Mark destructible text with a CSS class. Rather than hardcoding selectors per page, use a broad selector that covers common text elements, excluding UI controls:

```js
var DESTRUCTIBLE_SELECTOR = [
  'h1', 'h2', 'h3', 'h4',
  '.hero-desc', '.hero-badge',
  '.tidbit-value', '.tidbit-label',
  '.section-label', '.section-heading',
  '.work-card-info h3', '.work-card-info p',
  '.work-pill',
  '.about-prose p', '.about-box-title', '.about-box-text',
  '.chip',
  '.contact-heading', '.contact-sub',
  '.project-hero-title', '.project-hero-desc',
  '.project-text p', '.project-text h4',
  '.work-stat-num', '.work-stat-label',
  'footer span'
].join(', ');
```

**Exclusions:** Nav links, theme switcher button, plane toggle button, `<a>` tags used as buttons. These must remain interactive and unsplit.

### Implementation

```js
var splitInstances = [];   // Array of SplitText instances for cleanup
var allChars = [];         // Flat array of all character span elements

function splitAllText() {
  revertAllText(); // clean up any previous split

  var elements = document.querySelectorAll(DESTRUCTIBLE_SELECTOR);
  elements.forEach(function(el) {
    // Skip elements that are not visible or are inside nav/buttons
    if (el.closest('nav, .theme-switcher, .plane-toggle, .btn')) return;
    if (el.offsetParent === null) return; // hidden

    var instance = SplitText.create(el, {
      type: 'words, chars',
      tag: 'span',
      charsClass: 'destruct-char'
    });

    splitInstances.push(instance);
    allChars = allChars.concat(instance.chars);
  });
}

function revertAllText() {
  splitInstances.forEach(function(inst) {
    inst.revert();
  });
  splitInstances = [];
  allChars = [];
}
```

### CSS for split characters

Add to `shared.css`:

```css
/* Destruction system */
.destruct-char {
  display: inline-block; /* Required for transforms */
  will-change: transform, opacity; /* GPU layer hint for active animations */
}
```

`display: inline-block` is critical — GSAP transforms (translate, rotate, scale) do not work on inline elements. SplitText's default wrapping into `<div>` elements would break inline text flow, which is why we use `tag: 'span'` and add `display: inline-block` via CSS.

### Lifecycle

- **Split on:** `TextDestruction.init()` (called when plane mode turns on)
- **Revert on:** `TextDestruction.destroy()` (called when plane mode turns off)
- **Re-split on:** window resize (debounced 300ms), theme change — these can cause text reflow

---

## Subsystem 2: CollisionDetector

### Purpose
Each animation frame, convert projectile head positions from Three.js world space to screen coordinates, then determine which character `<span>` elements fall within a "blast radius" of that screen point.

### World-to-Screen Conversion

The plane uses an orthographic camera. Your existing `screenToWorld()` does:

```js
// screen → world (existing)
wx = (sx / window.innerWidth - 0.5) * FRUSTUM_SIZE * aspect;
wz = (sy / window.innerHeight - 0.5) * FRUSTUM_SIZE;
```

The inverse is:

```js
// world → screen (new)
function worldToScreen(wx, wz) {
  var sx = (wx / (FRUSTUM_SIZE * aspect) + 0.5) * window.innerWidth;
  var sy = (wz / FRUSTUM_SIZE + 0.5) * window.innerHeight;
  return { x: sx, y: sy };
}
```

This must be exposed from `plane.js` (or the relevant constants `FRUSTUM_SIZE` and `aspect` must be accessible to `destruction.js`).

### Blast Radius

A single point collision would rarely hit anything — characters are small. Use a **blast radius** in screen pixels around the projectile head:

```js
var BLAST_RADIUS = 60; // pixels — tune this for feel
```

### Collision Strategy: Cached Bounding Rects

**Why not `document.elementsFromPoint()`?**  
It only returns elements at a single point and requires the elements to be under the pointer — it won't catch characters *near* the projectile. Also, calling it every frame for every projectile is expensive because it triggers layout.

**Better approach: Spatial cache with bounding rects.**

On each frame (or every N frames), iterate only the character elements that are:
1. Currently in the viewport (use a pre-filtered list)
2. Not already in "shattered" state

For each, compare cached `getBoundingClientRect()` center against the projectile's screen position using distance check.

```js
var charRectCache = [];     // {el, cx, cy, active} — rebuilt on scroll/resize
var cacheStale = true;

function rebuildCharCache() {
  charRectCache = [];
  var viewH = window.innerHeight;
  var viewW = window.innerWidth;

  for (var i = 0; i < allChars.length; i++) {
    var el = allChars[i];
    if (el.dataset.shattered === '1') continue; // skip already shattered

    var rect = el.getBoundingClientRect();
    // Skip offscreen
    if (rect.bottom < 0 || rect.top > viewH) continue;
    if (rect.right < 0 || rect.left > viewW) continue;

    charRectCache.push({
      el: el,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2
    });
  }
  cacheStale = false;
}

// Mark cache stale on scroll/resize (throttled)
window.addEventListener('scroll', function() { cacheStale = true; }, { passive: true });
window.addEventListener('resize', function() { cacheStale = true; });
```

### Per-Frame Hit Detection

Called from the projectile update loop in `plane.js`:

```js
/**
 * @param {number} screenX - Projectile head X in screen/viewport pixels
 * @param {number} screenY - Projectile head Y in screen/viewport pixels
 * @returns {Array<Element>} - Character spans within blast radius
 */
function getCharsInBlastRadius(screenX, screenY) {
  if (cacheStale) rebuildCharCache();

  var hits = [];
  var rSq = BLAST_RADIUS * BLAST_RADIUS;

  for (var i = charRectCache.length - 1; i >= 0; i--) {
    var c = charRectCache[i];
    var dx = c.cx - screenX;
    var dy = c.cy - screenY;
    if (dx * dx + dy * dy <= rSq) {
      hits.push({
        el: c.el,
        dx: dx, // offset from impact (used for scatter direction)
        dy: dy,
        dist: Math.sqrt(dx * dx + dy * dy)
      });
      // Remove from cache so it won't be hit again until reformed
      charRectCache.splice(i, 1);
    }
  }
  return hits;
}
```

### Performance Budget

- Rebuilding the rect cache: only when `cacheStale` is true (scroll/resize). Not every frame.
- Hit detection loop: iterating a flat array with simple arithmetic. Even with 500+ chars visible, this is sub-millisecond.
- Max simultaneous shattered chars: cap at ~300. If exceeded, skip new shatters until some reform.

---

## Subsystem 3: ShatterAnimator

### Purpose
Animate hit characters outward with physics, fade them out, then bring them back after a delay.

### Shatter Animation (per character)

When a character is hit:

```js
var MAX_SHATTERED = 300;
var currentShattered = 0;

function shatterChars(hits, impactScreenX, impactScreenY) {
  hits.forEach(function(hit) {
    if (currentShattered >= MAX_SHATTERED) return;

    var el = hit.el;
    el.dataset.shattered = '1';
    currentShattered++;

    // Calculate scatter angle: away from impact point
    var angle = Math.atan2(hit.dy, hit.dx) * (180 / Math.PI);
    // Add randomness (±30°)
    angle += (Math.random() - 0.5) * 60;

    // Velocity inversely proportional to distance (closer = faster)
    var maxV = 500;
    var minV = 150;
    var velocityFactor = 1 - (hit.dist / BLAST_RADIUS);
    var velocity = minV + (maxV - minV) * velocityFactor;

    // Random rotation
    var rotationVelocity = (Math.random() - 0.5) * 720; // degrees

    // Phase 1: Scatter with physics
    gsap.to(el, {
      duration: 1.2,
      physics2D: {
        velocity: velocity,
        angle: angle,
        gravity: 600  // pulls chars downward as they scatter
      },
      rotation: rotationVelocity,
      opacity: 0,
      ease: 'none', // Physics2D ignores easing anyway
      onComplete: function() {
        // Phase 2: Wait, then reform
        gsap.delayedCall(1.5, function() {
          reformChar(el);
        });
      }
    });
  });
}
```

### Reform Animation (per character)

```js
function reformChar(el) {
  gsap.to(el, {
    duration: 0.6,
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    ease: 'back.out(1.4)',
    onComplete: function() {
      el.dataset.shattered = '0';
      currentShattered--;
      cacheStale = true; // re-enter the collision pool
    }
  });
}
```

### Visual Polish Ideas (optional, for later)

- **Scale:** Add a slight scale-down (0.8) during scatter, scale back to 1 on reform
- **Blur:** `filter: blur(1px)` during scatter for motion blur feel (GPU-composited, cheap)
- **Stagger reform:** When multiple chars from the same word reform, stagger by 30ms for a "typing back in" feel
- **Color flash:** Briefly tint chars to the accent color on impact before scattering

---

## Subsystem 4: Lifecycle Manager

### The Public API — `TextDestruction` global

```js
window.TextDestruction = {
  init: function() {
    splitAllText();
    // Set up scroll/resize listeners for cache invalidation
  },

  destroy: function() {
    // Kill all active GSAP tweens on shattered chars
    allChars.forEach(function(el) {
      gsap.killTweensOf(el);
    });
    revertAllText();
    currentShattered = 0;
  },

  /**
   * Called from plane.js projectile loop.
   * @param {number} screenX
   * @param {number} screenY
   */
  onProjectileAt: function(screenX, screenY) {
    var hits = getCharsInBlastRadius(screenX, screenY);
    if (hits.length > 0) {
      shatterChars(hits, screenX, screenY);
    }
  },

  /** Call when theme changes (text colors/fonts may change) */
  onThemeChange: function() {
    // Kill animations, revert, re-split
    this.destroy();
    this.init();
  }
};
```

---

## Integration Points in `plane.js`

### 1. Init/Destroy on Toggle

In the existing `toggle()` function:

```js
function toggle() {
  enabled = !enabled;
  sessionStorage.setItem(LS_KEY, enabled ? 'on' : 'off');
  updateButtonLabel();

  if (enabled) {
    if (!initialized) {
      init();
    } else {
      start();
    }
    // NEW
    if (window.TextDestruction) TextDestruction.init();
  } else {
    stop();
    // NEW
    if (window.TextDestruction) TextDestruction.destroy();
  }
}
```

Also call `TextDestruction.init()` at the end of the existing `init()` function (after the model loads and the first animation frame starts).

### 2. Expose worldToScreen

Either add `worldToScreen` as a function on `window`, or have `destruction.js` access the constants directly. Simplest approach — add to the IIFE's scope and expose:

```js
// Inside plane.js IIFE, near screenToWorld:
function worldToScreen(wx, wz) {
  var sx = (wx / (FRUSTUM_SIZE * aspect) + 0.5) * window.innerWidth;
  var sy = (wz / FRUSTUM_SIZE + 0.5) * window.innerHeight;
  return { x: sx, y: sy };
}

// Expose for destruction system
window._planeWorldToScreen = worldToScreen;
```

### 3. Fire Collision Check in Projectile Loop

In the existing `animate()` function, inside the projectile update loop, after updating positions but before disposal:

```js
// Update projectiles
for (var p = projectiles.length - 1; p >= 0; p--) {
  var proj = projectiles[p];
  proj.progress += PROJECTILE_SPEED * delta;
  var headT = Math.min(proj.progress, 1.0);
  var tailT = Math.min(proj.progress * TAIL_SPEED_RATIO, 1.0);

  // ... existing position update code ...

  // NEW: Check for text collision at projectile head position
  if (window.TextDestruction && headT < 1.0) {
    var headWorldX = proj.startX + (proj.endX - proj.startX) * headT;
    var headWorldZ = proj.startZ + (proj.endZ - proj.startZ) * headT;
    var screenPos = window._planeWorldToScreen(headWorldX, headWorldZ);
    TextDestruction.onProjectileAt(screenPos.x, screenPos.y);
  }

  // ... existing disposal code ...
}
```

**Important:** Only check while `headT < 1.0` (projectile still in flight). Once it reaches its endpoint, stop checking.

### 4. Theme Change Hook

In `shared.js`, the theme switcher click handler:

```js
themeSwitcher.addEventListener('click', () => {
  currentIndex = (currentIndex + 1) % themes.length;
  document.documentElement.setAttribute('data-theme', themes[currentIndex]);
  localStorage.setItem('portfolio-theme', themes[currentIndex]);
  updateLabel();

  // NEW
  if (window.TextDestruction) TextDestruction.onThemeChange();
});
```

---

## File Structure Summary

```
js/
  shared.js       — Add TextDestruction.onThemeChange() call to theme switcher
  plane.js        — Add worldToScreen, expose it, add collision check in animate loop,
                    add init/destroy calls in toggle
  destruction.js  — NEW FILE (all four subsystems above)

css/
  shared.css      — Add .destruct-char styles

*.html            — Add SplitText.min.js and Physics2DPlugin.min.js script tags
```

---

## Edge Cases & Considerations

### Text inside `<a>` tags (work cards, links)
Work card titles like `<h3>Casino Games</h3>` are inside `<a class="work-card">` elements. SplitText will split the text inside them fine — the `<a>` remains the outer wrapper. Click/hover behavior on the card is unaffected because the character spans are purely visual children.

### Expanded work cards
When a work card is expanded (`.expanded` class), new text becomes visible in `.work-expand`. This text was not visible during `splitAllText()`. Two options:
- **Option A (simpler):** Run `splitAllText()` on the expand event too. Costly but ensures all text is covered.
- **Option B (recommended):** Use a MutationObserver or hook into the expand logic to split newly-visible text incrementally.

For MVP, Option A is fine. The split is fast (<5ms for the page's amount of text).

### Scroll position and the rect cache
`getBoundingClientRect()` returns viewport-relative coordinates, which is exactly what we need since projectile screen positions are also viewport-relative. Scrolling invalidates the cache (characters move relative to viewport), which is why we mark `cacheStale = true` on scroll.

### Characters already mid-animation
A character that's currently scattering (shattered='1') is excluded from the collision cache. If the user fires at the same text twice quickly, already-flying characters won't be double-hit. They'll reform on their own timeline. This is the correct behavior.

### Multiple pages
Since `DESTRUCTIBLE_SELECTOR` uses generic element selectors (`h1`, `h2`, `.project-text p`, etc.), it works across all your project pages without per-page configuration. Just ensure each page loads the same script bundle.

### Performance on text-heavy pages
If a page has 1000+ characters visible simultaneously, the rect cache rebuild on scroll could take a few ms. Mitigations:
- Only rebuild when `cacheStale` is true (not every frame)
- Use `requestIdleCallback` for non-critical rebuilds
- The `MAX_SHATTERED` cap (300) prevents runaway GSAP tween creation

### Accessibility
SplitText automatically adds `aria-label` to split elements and `aria-hidden` to the generated character spans. Screen readers will read the original text, not individual characters. The shatter animation is purely visual and does not affect the accessible text.

---

## Tuneable Constants (all in destruction.js)

| Constant | Default | Description |
|----------|---------|-------------|
| `BLAST_RADIUS` | 60 | Pixels around projectile head that trigger shattering |
| `MAX_SHATTERED` | 300 | Max simultaneously shattered characters (performance cap) |
| `SCATTER_DURATION` | 1.2 | Seconds for the scatter physics animation |
| `REFORM_DELAY` | 1.5 | Seconds to wait (after scatter completes) before reforming |
| `REFORM_DURATION` | 0.6 | Seconds for the reform animation |
| `GRAVITY` | 600 | Downward acceleration during scatter (pixels/sec²) |
| `MIN_VELOCITY` | 150 | Minimum scatter velocity (pixels/sec) |
| `MAX_VELOCITY` | 500 | Maximum scatter velocity (at center of blast) |
| `ANGLE_SPREAD` | 60 | Random angle deviation (±degrees) from impact direction |
| `MAX_ROTATION` | 720 | Max rotation during scatter (degrees, randomized ±) |
| `CACHE_REBUILD_THROTTLE` | 0 | Min ms between rect cache rebuilds (0 = rebuild when stale) |

---

## Testing Checklist

- [ ] Plane on → text splits (verify with DOM inspector: chars wrapped in `.destruct-char` spans)
- [ ] Click to fire → projectiles shatter text they pass through
- [ ] Characters scatter outward from impact point with gravity
- [ ] Characters fade out during scatter
- [ ] After ~2.5s total (1.2 scatter + 1.5 wait), characters animate back
- [ ] Reformed characters can be shattered again
- [ ] Plane off → all text reverts to original HTML (no leftover spans)
- [ ] Theme switch while plane is on → text re-splits cleanly
- [ ] Scroll → shatter works on newly-visible text
- [ ] No shatter on nav links, buttons, or theme switcher
- [ ] Performance: no visible jank with 10+ rapid-fire clicks
- [ ] Works on all three themes (coral, slate, neon)
- [ ] Works on project sub-pages (logifuture.html, coffin-likker.html, etc.)
