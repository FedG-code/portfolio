# Card-Hand Navigation — Implementation Plan for Claude Code

**Purpose:** Step-by-step implementation guide for integrating the card-hand navigation system into Federico's portfolio site. This replaces the existing multi-page navigation with a SPA-style card hand using dynamic fetch.

**Date:** March 2026

**Reference files to have open:**
- `page-transition-prototype.html` — working prototype with all animation code
- `card-navigation-handoff.md` — full design spec and constants
- All site files: `index.html`, `logifuture.html`, `coffin-likker.html`, `lost-satellite.html`, `css/shared.css`, `css/project.css`, `js/shared.js`, `js/destruction.js`, `js/plane.js`

---

## Overview

We are converting the portfolio from a traditional multi-page site into a single-page application driven by a card hand at the bottom of the viewport. The user drags cards from a fan-shaped hand into a play zone to navigate between pages. The card expands, decomposes, and flies its title/art to the target page position. Project page content is fetched dynamically and cached.

**What changes:**
- `index.html` becomes the SPA shell — all navigation happens here
- The work section (`.work-section`) is removed from the home page
- The `<nav>` bar is hidden entirely (display: none)
- Two new JS files are created: `js/card-hand.js` and `js/page-transition.js`
- New CSS is added (either in `shared.css` or a new `css/cards.css`)
- Project pages (`logifuture.html`, `coffin-likker.html`, `lost-satellite.html`) remain as standalone files (they are fetched dynamically)

**What does NOT change:**
- `destruction.js` — do not modify, do not re-initialize after page transitions
- `plane.js` — do not modify
- `css/project.css` — the fetched content uses these styles, they must be loaded in `index.html`
- Theme switcher — remains functional, cards adapt via CSS custom properties

---

## Step 1: Modify `index.html`

### 1a. Add `project.css` to the `<head>`

The fetched project pages use classes from `project.css`. Add it to `index.html`'s `<head>`:

```html
<link rel="stylesheet" href="css/project.css">
```

### 1b. Hide the nav bar

Add `display: none` to the `<nav>` element. Do not remove it from the DOM — it may be re-enabled later.

```html
<nav style="display: none;">
  <!-- existing nav content unchanged -->
</nav>
```

### 1c. Remove the work section

Delete the entire `<section id="work" class="work-section">...</section>` block. Keep:
- The hero section (with its existing animation classes)
- The `#about` section
- The `#contact` section
- The footer

### 1d. Add bottom padding for card hand clearance

Add `padding-bottom: 220px` to the home page content area. The simplest way: add it to the `#contact` section or create a spacer. The card hand sits at the bottom of the viewport and overlaps content without this clearance.

### 1e. Add SPA container elements

Add these elements just inside `<body>`, after `<div id="plane-canvas"></div>`:

```html
<!-- Card hand SPA containers -->
<div class="drag-blur-overlay" id="dragBlurOverlay"></div>
<div class="page-container" id="pageContainer"></div>
<div class="hand-container" id="handContainer"></div>
<div class="perspective-container" id="perspectiveContainer"></div>
<div class="fly-overlay" id="flyOverlay"></div>
```

The existing `<div class="blur-overlay" id="blurOverlay"></div>` from the old card expand system can be removed or left — it's no longer needed since the work cards are gone.

### 1f. Wrap home content in a page container div

The hero + about + contact sections need to be identifiable as the "home page" content. Wrap them:

```html
<div class="spa-page active" id="page-home">
  <!-- hero section -->
  <!-- about section -->
  <!-- contact section -->
  <!-- footer -->
</div>
```

### 1g. Add new script tags

Add these before `</body>`, after the existing scripts:

```html
<script src="js/card-hand.js"></script>
<script src="js/page-transition.js"></script>
```

Order matters: `card-hand.js` must load before `page-transition.js` (or combine them into one file).

---

## Step 2: Create the CSS (`css/cards.css` or append to `shared.css`)

All card styles are driven by CSS custom properties scoped to `[data-theme]`. The card HTML structure is identical across themes — only CSS changes.

### 2a. SPA page system

```css
.spa-page {
  display: none;
  opacity: 0;
}
.spa-page.active {
  display: block;
  opacity: 1;
}
.spa-page.measuring {
  display: block;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
.spa-page.transitioning {
  z-index: 200;
}
```

Note: the home page `.spa-page` should NOT be `position: absolute` — it flows normally. Only fetched project pages get injected into the `.page-container` which IS absolute.

### 2b. Page container (for fetched content)

```css
.page-container {
  position: absolute;
  inset: 0;
  z-index: 5;
  overflow-y: auto;
  padding-bottom: 220px;
}
```

### 2c. Drag blur overlay

```css
.drag-blur-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  backdrop-filter: blur(0px);
  -webkit-backdrop-filter: blur(0px);
  background: rgba(0,0,0,0);
  pointer-events: none;
  will-change: backdrop-filter, background;
}
```

### 2d. Hand container

```css
.hand-container {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  height: 400px;
  width: 100%;
  max-width: 700px;
  pointer-events: none;
}
```

### 2e. Perspective container + fly overlay

```css
.perspective-container {
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: none;
}

.fly-overlay {
  position: fixed;
  inset: 0;
  z-index: 500;
  pointer-events: none;
}
```

### 2f. Card base styles

```css
.card {
  position: absolute;
  width: 220px;
  height: 320px;
  left: 0;
  top: 0;
  cursor: grab;
  will-change: transform;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: auto;
}
.card.dragging {
  cursor: grabbing;
  z-index: 100 !important;
}
.card:not(.dragging):not(.playing) {
  transition: transform 0.55s cubic-bezier(0.25, 1, 0.5, 1);
}
.card.playing {
  cursor: default;
  will-change: transform;
}
```

### 2g. Card inner — theme-adaptive styles

The card HTML structure (identical across all themes):

```html
<div class="card" data-card-id="0" data-accent="red">
  <div class="card-inner">
    <div class="card-title"><h3>Logifuture</h3></div>
    <div class="card-art"><div class="card-art-inner"><span class="card-art-icon">♦</span></div></div>
    <div class="type-bar">Casino Games · Game Developer</div>
    <div class="card-textbox"><p>Developed casino game features across web and mobile platforms...</p></div>
    <div class="accent-strip"></div>
  </div>
</div>
```

#### CORAL theme (default, `:root` / `[data-theme="coral"]`)

```css
.card-inner {
  width: 100%;
  height: 100%;
  border-radius: 14px;
  position: relative;
  overflow: hidden;
  pointer-events: none;
  transition: box-shadow 0.3s, border-color 0.3s;
  background: #ffffff;
  border: 1.5px solid var(--border);
}

.card-title {
  padding: 8px 10px 5px;
  text-align: center;
  position: relative;
  z-index: 4;
}
.card-title h3 {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  font-size: 13.5px;
  color: var(--text-primary);
  line-height: 1.2;
}

.card-art {
  position: relative;
  z-index: 2;
  margin: 0 6px;
  height: 155px;
  overflow: hidden;
  border-radius: 6px;
}
.card-art-inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card[data-accent="red"]    .card-art-inner { background: linear-gradient(145deg, #f5d5c8, #ecc0ae 50%, #f5d5c8); }
.card[data-accent="purple"] .card-art-inner { background: linear-gradient(145deg, #e0d5f0, #d0c5e8 50%, #e0d5f0); }
.card[data-accent="green"]  .card-art-inner { background: linear-gradient(145deg, #c8e8d5, #b8dcc8 50%, #c8e8d5); }
.card[data-accent="gold"]   .card-art-inner { background: linear-gradient(145deg, #f0e4c8, #e8d8b8 50%, #f0e4c8); }
.card-art-icon {
  font-size: 44px;
  opacity: 0.12;
}

.type-bar {
  position: relative;
  z-index: 5;
  margin: -13px 8px 0;
  padding: 4px 8px;
  text-align: center;
  font-family: var(--font-body);
  font-size: 8.5px;
  font-weight: 500;
  letter-spacing: 0.3px;
  white-space: nowrap;
  background: var(--cream);
  border: 1px solid var(--border);
  border-radius: 100px;
  color: var(--text-secondary);
}

.card-textbox {
  position: relative;
  z-index: 3;
  margin: 5px 0 0;
  padding: 8px 10px;
  min-height: 80px;
}
.card-textbox p {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--text-secondary);
  line-height: 1.55;
}

.accent-strip {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 4;
  border-radius: 0 0 14px 14px;
}
.card[data-accent="red"]    .accent-strip { background: linear-gradient(90deg, transparent, #e85d26, transparent); opacity: 0.3; }
.card[data-accent="purple"] .accent-strip { background: linear-gradient(90deg, transparent, #6a4cba, transparent); opacity: 0.3; }
.card[data-accent="green"]  .accent-strip { background: linear-gradient(90deg, transparent, #28885a, transparent); opacity: 0.3; }
.card[data-accent="gold"]   .accent-strip { background: linear-gradient(90deg, transparent, #e8a44a, transparent); opacity: 0.3; }
```

#### SLATE theme overrides

```css
[data-theme="slate"] .card-inner {
  background: var(--bg-card);
  border: 2.5px solid var(--border);
  border-radius: 12px;
}

[data-theme="slate"] .card[data-accent="red"]    .card-art-inner { background: linear-gradient(145deg, #e0d0cc, #d4c4be 50%, #e0d0cc); }
[data-theme="slate"] .card[data-accent="purple"] .card-art-inner { background: linear-gradient(145deg, #d0cce0, #c4bed8 50%, #d0cce0); }
[data-theme="slate"] .card[data-accent="green"]  .card-art-inner { background: linear-gradient(145deg, #c4dcd4, #b8d0c8 50%, #c4dcd4); }
[data-theme="slate"] .card[data-accent="gold"]   .card-art-inner { background: linear-gradient(145deg, #dcd8c8, #d0ccbc 50%, #dcd8c8); }

[data-theme="slate"] .type-bar {
  border-radius: 4px;
}

[data-theme="slate"] .card[data-accent="red"]    .accent-strip { background: linear-gradient(90deg, transparent, #d4614e, transparent); }
[data-theme="slate"] .card[data-accent="purple"] .accent-strip { background: linear-gradient(90deg, transparent, #6a7cba, transparent); }
[data-theme="slate"] .card[data-accent="green"]  .accent-strip { background: linear-gradient(90deg, transparent, #1a8a7d, transparent); }
[data-theme="slate"] .card[data-accent="gold"]   .accent-strip { background: linear-gradient(90deg, transparent, #c4944a, transparent); }
```

#### NEON theme overrides

Neon cards have NO per-card color distinction. All accent elements use lime (#c9f059). The per-card accent colors only appear in the art gradient (subtle tinting in the dark background).

```css
[data-theme="neon"] .card-inner {
  background: #131318;
  border: 1.5px solid var(--border);
  border-radius: 8px;
}

[data-theme="neon"] .card-title h3 {
  font-family: var(--font-serif); /* Sora in neon */
  font-style: normal;
  font-weight: 600;
  font-size: 12.5px;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

[data-theme="neon"] .card-art {
  border-radius: 4px;
}
[data-theme="neon"] .card-art-inner {
  background: #0a0a0c;
  border: 1px solid #1e1e28;
}
[data-theme="neon"] .card-art-icon {
  color: var(--accent);
  opacity: 0.15;
}

[data-theme="neon"] .type-bar {
  font-family: var(--font-mono); /* Space Mono */
  border-radius: 3px;
  background: #131318;
  border: 1px solid #c9f05935;
  color: var(--accent);
}

[data-theme="neon"] .card-textbox p {
  font-family: var(--font-mono);
  color: var(--text-muted);
}

/* All neon accent strips use lime, not per-card colors */
[data-theme="neon"] .accent-strip {
  left: 15%;
  right: 15%;
  height: 1px;
  background: var(--accent);
  opacity: 0.4;
  border-radius: 0;
}

/* Neon cards get a lime glow line at the top */
[data-theme="neon"] .card-inner::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1.5px;
  z-index: 10;
  background: linear-gradient(90deg, transparent 5%, #c9f05960 30%, #c9f05980 50%, #c9f05960 70%, transparent 95%);
  border-radius: 8px 8px 0 0;
}
```

---

## Step 3: Create `js/card-hand.js`

This file handles the card hand: building cards, fan layout, drag interaction, hover, play zone detection, and triggering the play animation.

### 3a. Card data

```javascript
var CARDS = [
  {
    id: 0,
    accent: 'red',
    title: 'Logifuture',
    typeLeft: 'Casino Games',
    typeRight: 'Game Developer',
    icon: '♦',
    text: 'Developed casino game features across web and mobile platforms...',
    accentColor: '#c83830',
    accentMuted: '#8a5a5a',
    pageUrl: 'logifuture.html',
  },
  {
    id: 1,
    accent: 'purple',
    title: 'Coffin-Likker',
    typeLeft: 'Project',
    typeRight: 'Solo Developer',
    icon: '☠',
    text: 'Stealth-horror project focused on visibility, AI behavior...',
    accentColor: '#6a4cba',
    accentMuted: '#6a5a8a',
    pageUrl: 'coffin-likker.html',
  },
  {
    id: 2,
    accent: 'green',
    title: 'Lost Satellite',
    typeLeft: 'EoD',
    typeRight: 'Tech Designer',
    icon: '☾',
    text: 'Combat, enemies and movement for a narrative-driven metroidvania...',
    accentColor: '#28885a',
    accentMuted: '#5a8a6a',
    pageUrl: 'lost-satellite.html',
  },
  {
    id: 3,
    accent: 'gold',
    title: 'Home',
    typeLeft: 'Index',
    typeRight: 'Portfolio',
    icon: '⌂',
    text: 'Return to the main page. Overview and contact information.',
    accentColor: '#e8a44a',
    accentMuted: '#8a7a5a',
    pageUrl: null, // home content is always in the DOM
  },
];
```

### 3b. Fan geometry constants (proven, don't change)

```javascript
var HOLD_RADIUS     = 1400;
var FAN_SPREAD      = 20;
var OVERLAP_SPACING = 155;
var SINK_BELOW      = 190;
var HOVER_LIFT      = 50;
var CARD_W          = 220;
var CARD_H          = 320;
var HAND_W          = 700;
var HAND_H          = 400;
```

### 3c. Play zone constants

```javascript
var PLAY_ZONE_HALF_W    = 385;
var PLAY_ZONE_HALF_H    = 289;
var MAX_BLUR            = 8;
var MAX_OVERLAY_OPACITY = 0.3;
var MAX_GLOW_SIZE       = 30;
```

### 3d. Core logic

Port directly from the prototype's JS. The key functions to extract:

- `buildCards()` — creates card DOM elements from CARDS data, appends to hand container
- `getRestPosition(slot, total)` — computes x, y, rotation for a card in the fan
- `layoutCards()` — positions all cards using getRestPosition, accounts for hover
- `onPointerDown / onPointerMove / onPointerUp` — drag handling
- `isInPlayZone(screenX, screenY)` — checks if card center is in the play zone
- `getProximityFactor(screenX, screenY)` — returns 0-1 based on distance to play zone center
- Hover handlers (pointerover / pointerout on the scene)

**Initial state:** Home page visible, hand has 3 cards (Logifuture, Coffin-Likker, Lost Satellite). Home card is NOT in the hand because you're already on home.

**Important:** The hand container has `pointer-events: none` but each `.card` has `pointer-events: auto`. This lets clicks pass through the empty hand area to the page below.

### 3e. Card HTML generation

`buildCards()` should generate this structure for each card:

```html
<div class="card" data-card-id="0" data-accent="red" style="transform-origin: center bottom;">
  <div class="card-inner">
    <div class="card-title"><h3>Logifuture</h3></div>
    <div class="card-art">
      <div class="card-art-inner">
        <span class="card-art-icon">♦</span>
      </div>
    </div>
    <div class="type-bar">Casino Games · Game Developer</div>
    <div class="card-textbox"><p>Developed casino game features...</p></div>
    <div class="accent-strip"></div>
  </div>
</div>
```

---

## Step 4: Create `js/page-transition.js`

This handles everything after a card enters the play zone: the play animation, dynamic fetch, content injection, clone + fly, page fade-in, and hand rebuild.

### 4a. Play animation sequence

Port the `playCard()` function from the prototype. The sequence (timings are proven):

1. **Center (0→500ms):** Card animates from drag position to viewport center. Other hand cards slide down and fade out. Current page begins fading out.
2. **Wriggle (500→1500ms):** Card wriggles with escalating intensity (rotation 0→8°, frequency ramps). Background blur and overlay darken. Card border glows with accent color.
3. **Expand (1500→2000ms):** Card scales to fill viewport. Scale = `Math.max(window.innerWidth / CARD_W, window.innerHeight / CARD_H)`. Glow fades. Blur clears.
4. **Decompose (2000→2150ms):** Card stays full-screen. Type bar, textbox, accent strip → opacity 0. Border → transparent. Title + art remain visible.
5. **Hover pause (2150→2350ms):** 200ms beat.
6. **Clone + fly (2350→2850ms):** Clone title + art to fly overlay. Position at exact screen coords. Remove card. Animate clones to target page positions (500ms, power3.out).
7. **Page fade-in (overlapping, ~2500→2900ms):** Target page fades in underneath. Title and first image on page are hidden (opacity 0) since clones represent them.
8. **Swap + hand rebuild (2850ms+):** Show real page elements, remove clones, rebuild hand with new composition.

### 4b. Dynamic fetch + cache

```javascript
var pageCache = {};

function prefetchPage(url) {
  if (!url || pageCache[url]) return;
  pageCache[url] = fetch(url)
    .then(function(r) { return r.text(); })
    .then(function(html) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      return extractPageContent(doc);
    });
}

function extractPageContent(doc) {
  // Extract everything inside <body> except:
  // - <nav>
  // - .theme-switcher
  // - <footer>
  // - <script> tags
  // - #plane-canvas
  // - .blur-overlay
  // - .project-nav (the prev/next links at top of project pages)
  //
  // Return the innerHTML string of the remaining elements.
  // The fetched content keeps its classes (.project-hero, .project-hero-title,
  // .work-image, .reveal, etc.) since the transition needs to find them.

  var body = doc.body;
  var clone = body.cloneNode(true);

  var removeSelectors = [
    'nav', '.theme-switcher', 'footer', 'script',
    '#plane-canvas', '.blur-overlay', '.project-nav'
  ];
  removeSelectors.forEach(function(sel) {
    clone.querySelectorAll(sel).forEach(function(el) { el.remove(); });
  });

  return clone.innerHTML;
}
```

**Prefetch timing:** Call `prefetchPage()` on `pointerdown` (drag start) so the fetch runs during the drag. By the time the card is played and the expand animation finishes (~2s), the content should be cached.

### 4c. Content injection

After expand completes, before clone + fly:

```javascript
async function beginPageTransition(cardEl, cardId, cardData) {
  var isHome = cardData.pageUrl === null;

  if (isHome) {
    // Home content is already in the DOM — just show it
    var targetPage = document.getElementById('page-home');
    // ... measure, fly, fade in
  } else {
    var content = await pageCache[cardData.pageUrl];
    var pageContainer = document.getElementById('pageContainer');
    pageContainer.innerHTML = content;
    pageContainer.className = 'spa-page measuring';

    // Wait one frame for layout
    await new Promise(function(r) { requestAnimationFrame(r); });

    // Measure target positions
    var targetTitle = pageContainer.querySelector('.project-hero-title');
    var targetImage = pageContainer.querySelector('.work-image');
    // ... etc

    pageContainer.classList.remove('measuring');
    // Continue with fly animation
  }
}
```

### 4d. Handling transitions TO home vs TO project

- **To project page:** Content is fetched and injected into `#pageContainer`. The home page (`#page-home`) fades out and gets `display: none`.
- **To home page:** `#pageContainer` is cleared. `#page-home` fades in. The home page scrolls back to top.

### 4e. Scroll reveal re-observation

After injecting fetched content, the `.reveal` elements won't be observed yet. After injection, re-run the observer:

```javascript
var newReveals = pageContainer.querySelectorAll('.reveal');
newReveals.forEach(function(el) { observer.observe(el); });
```

The `observer` from `shared.js` needs to be accessible. Either expose it globally (e.g., `window.revealObserver = observer`) or re-create an observer in `page-transition.js`.

### 4f. Hand rebuild after transition

After the transition completes:
1. Build new card set: all 4 cards except the one representing the current page
2. Append to hand container
3. Animate in from below with staggered slide-up (120ms per card, 550ms duration, power2.out)

```javascript
function rebuildHand(activeCardId) {
  var hand = document.getElementById('handContainer');
  hand.innerHTML = '';
  cardOrder = CARDS.filter(function(c) { return c.id !== activeCardId; }).map(function(c) { return c.id; });
  buildCards(); // re-creates DOM in hand
  // Animate each card from y+300 to rest position
  // See prototype for exact animation code
}
```

---

## Step 5: Z-Index Stack

Ensure these z-index values are correct (proven in prototype):

```
z-index:   0  — page background
z-index:   5  — .page-container / .spa-page (page content, below hand)
z-index:  50  — .drag-blur-overlay (backdrop blur during drag)
z-index:  60  — .hand-container (card hand)
z-index:  60  — .perspective-container (playing card during animation)
z-index: 100  — nav (hidden but kept in DOM)
z-index: 103  — #plane-canvas (already set in shared.css)
z-index: 200  — .spa-page.transitioning (promoted during transition)
z-index: 500  — .fly-overlay (flying title/art clones)
```

The plane canvas at z-index 103 sits above the hand (60) and the blur overlay (50). This is correct — the plane should always be visible on top.

---

## Step 6: Theme Switcher Integration

The theme switcher in `shared.js` already calls `window._planeOnThemeChange()` and `TextDestruction.onThemeChange()`. No additional hooks are needed for the card hand — the cards use CSS custom properties that update automatically when `data-theme` changes.

However, if border colors or accent-related inline styles are set via JS during drag/glow animations, those need to be recalculated on theme change. Add a global callback:

```javascript
// In card-hand.js
window._cardHandOnThemeChange = function() {
  // Re-read accent colors if any are cached
  // Re-layout cards if needed
};
```

And in `shared.js`, inside the theme switcher click handler, add:
```javascript
if (window._cardHandOnThemeChange) window._cardHandOnThemeChange();
```

---

## Step 7: Cleanup `shared.js`

The expand card system (the `overlay`, `cards`, `activeCard` code block) in `shared.js` is no longer needed since the work section is removed. The `if (overlay) { ... }` block can be left as-is (it won't find the overlay element and will silently skip) or removed for cleanliness.

Do NOT remove:
- Scroll reveal observer — still needed for home + fetched content
- Theme switcher — still needed
- Mobile auto-hide nav — can be removed since nav is hidden, but harmless to leave

---

## Step 8: Edge Cases

### Fetch failure
If the fetch fails or takes >3s, show a simple fade to a loading state ("Loading..."), then retry once. On a static portfolio site this shouldn't happen, but handle it.

### Browser back/forward
Since this is now a SPA, the browser back button won't work by default. For v1, this is acceptable. Future enhancement: use `history.pushState()` and `popstate` to support browser navigation.

### Viewport resize during animation
If the window is resized during a transition, positions will be stale. For v1, ignore this — it's unlikely on a portfolio site. GSAP handles mid-animation property changes reasonably.

### Multiple rapid plays
The animation state machine (`animState = 'IDLE' | 'DRAGGING' | 'PLAYING' | 'TRANSITIONING'`) prevents multiple simultaneous transitions. Only allow drag when `animState === 'IDLE'`.

---

## Step 9: Testing Checklist

After implementation, verify:

- [ ] Home page loads with hero + about + contact visible, no work section, no nav
- [ ] Card hand appears at bottom with 3 cards (Logifuture, Coffin-Likker, Lost Satellite)
- [ ] Cards fan correctly, hover lifts work
- [ ] Dragging a card shows blur overlay with proximity feedback
- [ ] Playing a card triggers the full animation sequence (center → wriggle → expand → decompose → fly → page fade-in)
- [ ] Fetched project page content renders correctly with all styles
- [ ] `.reveal` elements on fetched pages animate in on scroll
- [ ] Hand rebuilds with correct 3-card composition after transition
- [ ] Playing the Home card returns to the home page
- [ ] Theme switching works during all states (idle, mid-drag, after transition)
- [ ] All three themes display cards correctly (coral thin borders, slate medium borders, neon lime-unified)
- [ ] Destruction/plane system continues to work on the home page without interference
- [ ] GIFs and images on project pages load correctly via relative `assets/` paths

---

## File Summary

### Modified files:
- `index.html` — add project.css, hide nav, remove work section, add SPA containers, wrap home content, add new script tags, add bottom padding
- `shared.js` — expose reveal observer globally, add `_cardHandOnThemeChange` call in theme switcher

### New files:
- `css/cards.css` (or additions to `shared.css`) — all card styles per theme, SPA page system, hand container, overlay, fly overlay
- `js/card-hand.js` — card data, fan geometry, drag interaction, hover, play zone detection, buildCards, layoutCards
- `js/page-transition.js` — play animation (GSAP timeline), dynamic fetch + cache, content extraction, clone + fly, page fade-in, hand rebuild

### Unchanged files:
- `logifuture.html`, `coffin-likker.html`, `lost-satellite.html` — remain as standalone files, fetched dynamically
- `css/project.css` — unchanged, now also loaded in index.html
- `js/destruction.js` — do not touch
- `js/plane.js` — do not touch
