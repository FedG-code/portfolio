# Text Destruction — Preload & Layout Stability Update

## Problem

When plane mode toggles on, SplitText runs and wraps every character in `<span style="display:inline-block">`. This causes:

1. **Visible text reflow** — `inline-block` elements participate differently in line-height and spacing calculations, causing paragraphs to shift
2. **Mid-word line breaks** — each `inline-block` char is an independent wrapping unit, so the browser can break lines between characters within a word
3. **Broken underlines** — `text-decoration: underline` on parent `<a>` tags fragments into per-span segments with gaps

All three stem from the same root cause: `display: inline-block` on character spans changes the layout model.

## Solution: Split Early, Promote Late

### Concept

- **Split on page load** (not on plane toggle) — so the DOM is already in its final structure before the user sees anything
- **Keep characters as `display: inline`** by default — this is layout-identical to unsplit text (no spacing change, no wrapping change, no underline breakage)
- **Promote to `inline-block` only on the individual characters being animated** — at the moment a projectile hits them
- **Demote back to `inline` after reform** — restoring perfect text flow

The user never sees a layout shift because:
- The split happens before first paint
- Resting characters are always `inline` (visually identical to unsplit text)
- `inline-block` only exists on characters that are actively mid-explosion

### Mobile Gate

The plane system is gated behind `MIN_VIEWPORT = 768`. The preload split must use the same gate. On mobile, the DOM stays completely clean — no spans, no overhead.

---

## Changes to `destruction.js`

### 1. New lifecycle: split on load, arm on toggle

Replace the current init/destroy pattern:

```js
// --- State ---
var isSplit = false;    // whether text has been split into spans
var isArmed = false;    // whether collision detection is active

// --- Called once on page load (not on plane toggle) ---
function preloadSplit() {
  if (window.innerWidth <= 768) return;  // same gate as plane.js MIN_VIEWPORT
  splitAllText();
  isSplit = true;
}

// --- Public API (updated) ---
window.TextDestruction = {
  /**
   * Called when plane mode toggles ON.
   * Does NOT split — text is already split from preload.
   * Just enables collision detection.
   */
  init: function() {
    readAccentColor();
    if (!isSplit) {
      // Fallback: if preload didn't run (e.g. resize from mobile to desktop)
      splitAllText();
      isSplit = true;
    }
    isArmed = true;
    cacheStale = true;
    if (!resizeListenerActive) {
      window.addEventListener('resize', onResizeDebounced);
      resizeListenerActive = true;
    }
  },

  /**
   * Called when plane mode toggles OFF.
   * Does NOT revert the split — chars stay as inline spans.
   * Just disables collision detection and kills active animations.
   */
  destroy: function() {
    isArmed = false;
    // Kill all active tweens and reset shattered chars
    allChars.forEach(function(el) {
      gsap.killTweensOf(el);
      if (el.dataset.shattered === '1') {
        gsap.set(el, { x: 0, y: 0, rotation: 0, opacity: 1 });
        el.style.display = '';  // back to inline (from CSS)
        el.dataset.shattered = '0';
      }
    });
    currentShattered = 0;
    charRectCache = [];
  },

  /**
   * Called from plane.js projectile loop.
   * Only processes hits if armed.
   */
  onProjectileAt: function(screenX, screenY) {
    if (!isArmed) return;
    var hits = getCharsInBlastRadius(screenX, screenY);
    if (hits.length > 0) {
      shatterChars(hits, screenX, screenY);
    }
  },

  /**
   * Called when theme changes.
   * Must fully revert and re-split because font/color changes can affect layout.
   */
  onThemeChange: function() {
    var wasArmed = isArmed;
    // Kill animations
    allChars.forEach(function(el) {
      gsap.killTweensOf(el);
    });
    currentShattered = 0;
    charRectCache = [];
    // Revert and re-split
    revertAllText();
    isSplit = false;
    splitAllText();
    isSplit = true;
    readAccentColor();
    isArmed = wasArmed;
    cacheStale = true;
  }
};

// --- Auto-run preload on script load ---
// Use a small delay to ensure fonts have loaded and layout is stable
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function() {
    preloadSplit();
  });
} else {
  // Fallback: split after a short delay
  setTimeout(preloadSplit, 100);
}
```

### 2. CSS class change

In `shared.css`, change the character class from `inline-block` to `inline`:

```css
/* Characters are inline by default — visually identical to unsplit text */
.destruct-char {
  display: inline;
}

/* Word wrappers prevent mid-word line breaks */
.destruct-word {
  white-space: nowrap;
  display: inline;  /* NOT inline-block — keeps text flow identical */
}
```

Note: both are `display: inline`. This is the key to zero layout shift. The spans exist in the DOM but are invisible to the layout engine.

### 3. Promote to inline-block on shatter

In the `shatterChars` function, add `display: inline-block` to each character before animating:

```js
// Inside shatterChars, for each hit character:
el.dataset.shattered = '1';
currentShattered++;
blastChars.push(el);

// PROMOTE: enable transforms by switching to inline-block
el.style.display = 'inline-block';
```

### 4. Demote back to inline on reform complete

In `scheduleTypingReform`, after each character's drop animation completes:

```js
// Inside the cleanup delayedCall, after the char has landed:
gsap.delayedCall(charDelay + CHAR_LAND_DURATION, function() {
  el.dataset.shattered = '0';
  el.style.color = el.dataset.originalColor || '';
  el.style.display = '';  // DEMOTE: revert to CSS default (inline)
  currentShattered--;
  cacheStale = true;
});
```

Setting `el.style.display = ''` removes the inline style, so the element falls back to the CSS rule `.destruct-char { display: inline }`.

### 5. Also promote in the pre-reform reset

In `scheduleTypingReform`, when we position chars at their pre-reform state (above final position, invisible), they need to be `inline-block` for the transform to work:

```js
// The pre-reform positioning (before the drop animation):
gsap.delayedCall(startDelay - 0.01, function() {
  gsap.killTweensOf(el);
  el.style.display = 'inline-block';  // ensure transforms work
  gsap.set(el, {
    x: 0,
    y: -DROP_DISTANCE,
    rotation: 0,
    opacity: 0
  });
});
```

---

## Changes to `plane.js`

### Remove TextDestruction.init() from toggle

Currently `toggle()` calls `TextDestruction.init()`. This stays, but init no longer splits — it just arms the system. No change needed to the call site, just be aware of the new behavior.

### Remove TextDestruction.destroy() revert behavior

Currently `destroy()` calls `revertAllText()`. The updated version above does NOT revert — it just disarms and resets animations. The spans persist in the DOM. No change needed to the call site.

---

## Changes to HTML pages

**No changes needed.** The `destruction.js` script auto-runs `preloadSplit()` on load. It's gated behind the same 768px viewport check as the plane, so mobile devices are unaffected.

---

## How This Solves Each Problem

| Problem | How it's solved |
|---------|----------------|
| **Text reflow on plane toggle** | Text is pre-split on page load (before first paint). Chars are `display: inline` — zero layout difference from unsplit text. No DOM change occurs when plane toggles on. |
| **Mid-word line breaks** | `.destruct-word { white-space: nowrap }` keeps characters within a word together. Line breaks only occur between words. |
| **Broken underlines on links** | `display: inline` spans don't fragment the parent's `text-decoration`. The underline draws continuously across all inline children, identical to unsplit text. Only fragments momentarily on chars that are actively mid-explosion (invisible to user). |
| **Mobile overhead** | `preloadSplit()` checks `window.innerWidth <= 768` and exits early. DOM stays completely clean on mobile. |

---

## Timing: Why `document.fonts.ready`

We wait for fonts to finish loading before splitting. If we split while web fonts are still loading, the fallback font metrics would be used for any line-based calculations. Once fonts load, text reflows, and the split might not match the final layout. `document.fonts.ready` resolves when all fonts in the document have loaded, ensuring the split happens against the final visual state.

The fallback (`setTimeout(100)`) handles older browsers that don't support the Font Loading API.

---

## Testing Checklist

- [ ] Page loads → text is pre-split (inspect DOM: chars wrapped in `.destruct-char` spans)
- [ ] Page loads → text looks identical to unsplit version (compare screenshots if needed)
- [ ] Page loads → underlined links have continuous underlines
- [ ] Page loads on mobile (< 768px) → DOM is NOT split, no extra spans
- [ ] Plane toggles on → zero visible text shift
- [ ] Projectile hits text → characters shatter normally
- [ ] During shatter → hit characters have `display: inline-block` (inspect DOM)
- [ ] After reform → characters are back to `display: inline` (inspect DOM)
- [ ] After reform → underlines on links are continuous again
- [ ] Plane toggles off → text returns to normal (no shift), spans remain in DOM
- [ ] Theme switch → text reverts, re-splits, no shift
- [ ] Resize from desktop to mobile → no errors (split stays, just unused)
- [ ] Resize from mobile to desktop, then toggle plane → split happens on init fallback
