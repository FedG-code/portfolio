# Text Destruction — Reform Animation Update

## Summary

Replace the current `reformChar()` function and its invocation with a new **sequential drop-in typing** animation. Characters drop from above with a hard stop, left-to-right, with words staggering.

This replaces the old `back.out(1.4)` simultaneous reform.

---

## New Constants (replace old reform constants in destruction.js)

```js
// --- Reform: sequential drop-in ---
var CHAR_LAND_DURATION = 0.12;   // seconds — how fast each letter drops into place
var CHAR_STAGGER      = 0.055;   // seconds — delay between consecutive chars starting their drop
var WORD_EXTRA_STAGGER = 0.05;   // seconds — extra pause added at word boundaries
var DROP_DISTANCE      = 16;     // pixels — how far above the final position the char starts
```

Remove these old constants:
```js
// DELETE these
var REFORM_DELAY = 1.5;      // replaced by computed sequential timing
var REFORM_DURATION = 0.6;   // replaced by CHAR_LAND_DURATION
var REFORM_STAGGER = 0.03;   // replaced by CHAR_STAGGER
```

Keep `REFORM_DELAY` but rename for clarity:
```js
var REFORM_PAUSE = 1.2;  // seconds to wait after scatter completes before typing begins
```

---

## New Reform Logic

### Core concept

Instead of animating all shattered chars simultaneously with `back.out`, we:

1. Collect all shattered chars from a single blast
2. Sort them by their DOM order (left-to-right reading order)
3. Compute a sequential delay for each: chars get `CHAR_STAGGER` apart, with `WORD_EXTRA_STAGGER` added at word boundaries
4. Each char animates: `opacity 0→1` and `y: -DROP_DISTANCE → 0` with a hard-stop easing
5. No bounce, no overshoot

### Easing

```
Hard stop (decelerate only): cubic-bezier(0.0, 0.0, 0.2, 1)
```

This is equivalent to a steep ease-out with zero overshoot. The letter decelerates as it approaches its final position and stops dead.

### Replace `shatterChars` reform scheduling

Delete the old word-group reform scheduling at the bottom of `shatterChars()`. Replace with:

```js
function shatterChars(hits, impactScreenX, impactScreenY) {
  if (!accentColor) readAccentColor();

  // Collect elements that will be shattered in this blast
  var blastChars = [];

  hits.forEach(function(hit) {
    if (currentShattered >= MAX_SHATTERED) return;

    var el = hit.el;
    el.dataset.shattered = '1';
    currentShattered++;
    blastChars.push(el);

    // Scatter angle: away from impact point
    var angle = Math.atan2(hit.dy, hit.dx) * (180 / Math.PI);
    angle += (Math.random() - 0.5) * ANGLE_SPREAD;

    // Velocity inversely proportional to distance
    var velocityFactor = 1 - (hit.dist / BLAST_RADIUS);
    var velocity = MIN_VELOCITY + (MAX_VELOCITY - MIN_VELOCITY) * velocityFactor;

    var rotationVelocity = (Math.random() - 0.5) * MAX_ROTATION;

    // Store original color for reform
    var originalColor = el.style.color || '';
    el.dataset.originalColor = originalColor;

    // Color flash
    gsap.fromTo(el, { color: accentColor }, {
      duration: 0.15,
      color: originalColor || getComputedStyle(el).color,
      ease: 'power1.out'
    });

    // Scatter with physics
    gsap.to(el, {
      duration: SCATTER_DURATION,
      physics2D: {
        velocity: velocity,
        angle: angle,
        gravity: GRAVITY
      },
      rotation: rotationVelocity,
      opacity: 0,
      ease: 'none'
    });
  });

  // Schedule the sequential drop-in reform for this blast
  if (blastChars.length > 0) {
    scheduleTypingReform(blastChars);
  }
}
```

### New function: `scheduleTypingReform`

```js
/**
 * Sorts shattered chars into DOM/reading order, then reforms them
 * sequentially with a typing drop-in animation.
 */
function scheduleTypingReform(chars) {
  // Sort by DOM order (reading order: top-to-bottom, left-to-right)
  chars.sort(function(a, b) {
    var rectA = a.getBoundingClientRect();
    var rectB = b.getBoundingClientRect();
    // Primary sort: vertical position (top of line)
    var lineDiff = rectA.top - rectB.top;
    // If on the same line (within 5px tolerance), sort by horizontal position
    if (Math.abs(lineDiff) < 5) {
      return rectA.left - rectB.left;
    }
    return lineDiff;
  });

  // Compute sequential delays with word boundary detection
  var delays = [];
  var cursor = 0;

  chars.forEach(function(el, i) {
    if (i === 0) {
      delays.push(0);
      return;
    }

    // Detect word boundary: if this char's parent word span differs from previous
    var prevWord = chars[i - 1].parentElement;
    var thisWord = el.parentElement;
    if (prevWord !== thisWord) {
      cursor += WORD_EXTRA_STAGGER;
    }

    cursor += CHAR_STAGGER;
    delays.push(cursor);
  });

  var totalTypingTime = cursor + CHAR_LAND_DURATION;

  // Wait for scatter to complete + pause, then start typing
  var startDelay = SCATTER_DURATION + REFORM_PAUSE;

  chars.forEach(function(el, i) {
    var charDelay = startDelay + delays[i];

    // First: set the pre-reform position (invisible, above final position)
    gsap.delayedCall(startDelay - 0.01, function() {
      // Kill the scatter tween so we can control position
      gsap.killTweensOf(el);
      gsap.set(el, {
        x: 0,
        y: -DROP_DISTANCE,
        rotation: 0,
        opacity: 0
      });
    });

    // Then: animate the drop-in
    gsap.delayedCall(charDelay, function() {
      gsap.to(el, {
        duration: CHAR_LAND_DURATION,
        y: 0,
        ease: 'power2.out',  // hard stop — cubic-bezier(0.0, 0.0, 0.2, 1) equivalent
        overwrite: 'auto'
      });
      gsap.to(el, {
        duration: CHAR_LAND_DURATION * 0.4,
        opacity: 1,
        ease: 'none',
        overwrite: 'auto'
      });
    });

    // Finally: clean up after this char has landed
    gsap.delayedCall(charDelay + CHAR_LAND_DURATION, function() {
      el.dataset.shattered = '0';
      el.style.color = el.dataset.originalColor || '';
      currentShattered--;
      cacheStale = true;
    });
  });
}
```

### Delete old `reformChar` function

The old `reformChar(el)` function is no longer used. Remove it entirely.

---

## GSAP Easing Note

`power2.out` in GSAP is equivalent to `cubic-bezier(0.0, 0.0, 0.2, 1)` — a deceleration curve with no overshoot. This gives the hard stop feel. Do NOT use `back.out`, `elastic.out`, or `bounce.out` — those all overshoot.

---

## Timing Breakdown

For "Never shipped a boring product." (26 non-space chars, 5 words):

| Phase | Duration |
|-------|----------|
| Scatter (physics) | 1.2s |
| Pause | 1.2s |
| Type-in (26 chars × 55ms + 4 word gaps × 50ms) | ~1.6s |
| **Total cycle** | **~4.0s** |

For shorter text like "Casino Games" (11 chars, 2 words):

| Phase | Duration |
|-------|----------|
| Scatter | 1.2s |
| Pause | 1.2s |
| Type-in (11 × 55ms + 1 × 50ms) | ~0.7s |
| **Total cycle** | **~3.1s** |

---

## Edge Case: Multiple Blasts

If the user fires at different text elements in quick succession, each blast schedules its own independent `scheduleTypingReform`. They run on separate timelines. This is correct — you might see the hero heading typing back in while a section label is still scattered. Each text block has its own lifecycle.

---

## Constants Summary (final)

```js
// Scatter (unchanged)
var SCATTER_DURATION = 1.2;
var GRAVITY = 600;
var MIN_VELOCITY = 150;
var MAX_VELOCITY = 500;
var ANGLE_SPREAD = 60;
var MAX_ROTATION = 720;
var BLAST_RADIUS = 40;
var MAX_SHATTERED = 300;

// Reform: sequential drop-in typing (NEW)
var REFORM_PAUSE         = 1.2;    // seconds after scatter before typing starts
var CHAR_LAND_DURATION   = 0.12;   // seconds per character drop
var CHAR_STAGGER         = 0.055;  // seconds between consecutive char starts
var WORD_EXTRA_STAGGER   = 0.05;   // seconds extra pause at word boundaries
var DROP_DISTANCE        = 16;     // pixels above final position
```
