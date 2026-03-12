# Plane Button Redesign — Implementation Spec

## Context

The portfolio site has a fixed-position toggle button (`.plane-toggle`) that activates a 3D plane Easter egg. Currently the button uses a filled accent background in its "attractor" state and a paper-plane SVG icon. We're replacing this with an unfilled bounce-nudge button, a crosshair icon, and a contextual label swap.

**Files to modify:**
- `css/shared.css` — button styles and keyframes
- `js/shared.js` (or `js/plane.js`, wherever the plane toggle logic lives) — bounce interval, label/icon swap

---

## 1. Crosshair SVG

Use this exact SVG inline in the button. It replaces whatever icon is currently there (likely a paper-plane SVG). Render size 12×12, viewBox 16×16:

```html
<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
  <circle cx="8" cy="8" r="3.5"/>
  <line x1="8" y1="0.5" x2="8" y2="3.5"/>
  <line x1="8" y1="12.5" x2="8" y2="15.5"/>
  <line x1="0.5" y1="8" x2="3.5" y2="8"/>
  <line x1="12.5" y1="8" x2="15.5" y2="8"/>
</svg>
```

Give it a class or ID (e.g. `.plane-toggle-icon`) so JS can show/hide it.

---

## 2. CSS changes in `css/shared.css`

### 2a. Replace `.plane-toggle.attractor` block

Remove the existing `.plane-toggle.attractor` and `.plane-toggle.attractor:hover` rules entirely. Replace with:

```css
.plane-toggle.attractor {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--cream);
  will-change: transform;
}

.plane-toggle.attractor.bouncing {
  animation: nudgeBounce 1.2s ease;
}

.plane-toggle.attractor:hover {
  animation: none;
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}
```

### 2b. Add `@keyframes nudgeBounce`

Place this near the other keyframes (after `@keyframes fadeUp` is fine):

```css
@keyframes nudgeBounce {
  0%, 100% { transform: translateY(0); }
  20% { transform: translateY(-5px); }
  40% { transform: translateY(0); }
  55% { transform: translateY(-3px); }
  70% { transform: translateY(0); }
}
```

### 2c. Update neon theme overrides

Find the two neon `.plane-toggle.attractor` lines and replace them with:

```css
[data-theme="neon"] .plane-toggle.attractor {
  border-radius: 4px;
  background: var(--bg-card);
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: none;
}
[data-theme="neon"] .plane-toggle.attractor:hover {
  background: var(--bg-card);
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 12px #c9f05940;
}
```

Do NOT change the base `.plane-toggle` styles, the `.plane-toggle:hover` rule, or any other neon `.plane-toggle` rules. Only the `.attractor` variants change.

---

## 3. JS changes

These changes go wherever the plane toggle button is wired up. The button element has the class `.plane-toggle`. It currently gets `.attractor` added when the plane feature is off (to draw attention).

### 3a. Bounce interval

Create a repeating bounce system. The animation is CSS-driven but the repeat is JS-driven so we can start/stop it cleanly:

```js
let bounceInterval = null;
let bounceTimeout = null;
const planeToggle = document.querySelector('.plane-toggle');

function startBounce() {
  stopBounce();
  // Fire immediately on start
  triggerBounce();
  bounceInterval = setInterval(triggerBounce, 6000);
}

function triggerBounce() {
  planeToggle.classList.add('bouncing');
  bounceTimeout = setTimeout(() => {
    planeToggle.classList.remove('bouncing');
  }, 1200);
}

function stopBounce() {
  if (bounceInterval) clearInterval(bounceInterval);
  if (bounceTimeout) clearTimeout(bounceTimeout);
  bounceInterval = null;
  bounceTimeout = null;
  planeToggle.classList.remove('bouncing');
}
```

### 3b. Hover pause

Pause the bounce on hover so the button feels responsive, not robotic:

```js
planeToggle.addEventListener('pointerenter', () => {
  if (planeToggle.classList.contains('attractor')) {
    stopBounce();
  }
});

planeToggle.addEventListener('pointerleave', () => {
  if (planeToggle.classList.contains('attractor')) {
    startBounce();
  }
});
```

### 3c. Toggle behaviour

When the plane **activates** (user clicks, plane spawns):

```js
// 1. Remove attractor state
planeToggle.classList.remove('attractor');
stopBounce();

// 2. Hide crosshair icon, change label
// (however the icon/label elements are referenced)
crosshairIcon.style.display = 'none';  // or remove from DOM
labelElement.textContent = 'Stop';
```

When the plane **deactivates** (user clicks Stop, plane despawns):

```js
// 1. Restore attractor state
planeToggle.classList.add('attractor');
startBounce();

// 2. Show crosshair icon, restore label
crosshairIcon.style.display = '';
labelElement.textContent = 'Fly';
```

Adapt the selectors (`crosshairIcon`, `labelElement`) to however the button's inner HTML is structured. If the button currently just has `textContent` set directly, you'll need to restructure it to have a span for the icon and a span for the label so they can be toggled independently.

---

## 4. Button HTML structure

The button needs to support showing/hiding the icon independently from the label. Suggested structure:

```html
<button class="plane-toggle attractor">
  <svg class="plane-toggle-icon" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
    <circle cx="8" cy="8" r="3.5"/>
    <line x1="8" y1="0.5" x2="8" y2="3.5"/>
    <line x1="8" y1="12.5" x2="8" y2="15.5"/>
    <line x1="0.5" y1="8" x2="3.5" y2="8"/>
    <line x1="12.5" y1="8" x2="15.5" y2="8"/>
  </svg>
  <span class="plane-toggle-label">Fly</span>
</button>
```

Add a small gap between icon and text in the base `.plane-toggle` styles:

```css
.plane-toggle {
  /* ...existing styles... */
  display: flex;
  align-items: center;
  gap: 5px;
}
```

---

## 5. What NOT to change

- The base `.plane-toggle` styles (position, font, padding, border-radius, background, colour) — these are correct and shared between idle/active states.
- The `.plane-toggle:hover` rule — this is for the non-attractor state and stays as-is.
- The neon base `.plane-toggle` override — only the `.attractor` variants change.
- The slate theme — it doesn't have plane-toggle-specific overrides, so the base CSS variable cascade handles it automatically.
- Any plane spawning/despawning/shooting logic — this spec only covers the button's visual behaviour.

---

## Design rationale (for context, not implementation)

- **Unfilled instead of filled:** the filled accent button competed visually with the nav and primary CTAs. Unfilled matches the theme switcher above it.
- **Bounce:** most physically intuitive affordance for a small peripheral button. Double-bounce (big then small) gives it a spring-like personality.
- **Crosshair icon:** replaces paper-plane SVG that misrepresented the actual prop-plane model. Subtly hints at the shooting mechanic.
- **Crosshair disappears in active state:** creates a "wait, something changed" moment that primes users to think about targeting/clicking, nudging them toward discovering the shooting mechanic without being explicit.
- **"Fly" / "Stop" labels:** "Fly" is playful and aviation-appropriate. "Stop" is neutral — we avoid "Land" because the plane has no landing animation and the disconnect would feel unfinished.
