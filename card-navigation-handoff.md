# Card-Hand Navigation — Implementation Handoff

**Purpose:** This document hands off everything needed to implement the card-hand navigation system across the portfolio site. It supersedes the original `spire-implementation-roadmap.md` in scope — the card hand is no longer a Spire-only feature, it's the site-wide navigation system across all themes.

**Date:** March 2026

---

## Architectural Shift

The original plan was to build the card hand as part of a "Spire" theme — one of four theme options. That has changed:

- **The card hand is now the primary navigation for all themes** (coral, slate, neon, and any future themes).
- **Cards adapt their visual style per theme.** The parchment/Cinzel/Fira Code aesthetic is specific to the Spire look. Coral, slate, and neon themes need their own card styles — fonts, colors, surfaces, borders — that feel native to each theme.
- **The existing multi-page nav links are replaced** by the card hand. The nav bar may remain for anchor links within a page (e.g., #about, #contact on the home page) but cross-page navigation is handled exclusively by cards.

---

## What Exists (From This Session)

### Prototype File
- **`page-transition-prototype.html`** — Standalone prototype containing:
  - Card visuals (Cinzel/Fira Code, 7px borders, parchment surface, MTG type bar) — these are the Spire-style cards; other themes need their own styles
  - Fan geometry, drag-to-rearrange, hover lift
  - Drag-to-play zone with proximity blur/glow feedback
  - Center → wriggle → expand → decompose → fly → page fade-in → hand rebuild
  - 4 pages embedded: home (hero + tidbits), coffin-likker (full 3-section content), logifuture (stub), lost-satellite (stub)
  - Dynamic hand composition: 3 cards in hand, played card removed, previous page's card added back
  - Weathered Bone palette (#d8cfc0 background)

### Existing Prototype Files (From Prior Sessions)
- **`card-played.html`** — The canonical card interaction prototype. Has the complete card visuals, fan geometry, drag, play zone, wriggle, expand. **The page-transition-prototype extends this.** Do not reference `card-hand.html` — it is fully superseded.
- **`card-played-handoff.md`** — Design spec for play zone and card animation. Superseded by `card-played.html` itself.

### Key Design Decisions Made
1. **Initial state:** Home page visible + hero content showing. Hand at bottom with 3 project cards (logifuture, coffin-likker, lost-satellite). No home card in hand because you're already on home.
2. **Card composition:** Always exactly 3 cards in hand. The card representing the current page is absent. When you play a card, the previous page's card enters the hand.
3. **No "back" button.** The gold Home card serves this purpose. Playing it transitions back to home.
4. **Reverse transition (page → card):** Simple fade for v1. Full reverse animation (text scatter → elements fly back → card reforms) is a future enhancement.
5. **Text reform effect:** Scrapped for now. Page content fades in as a whole. The destruction.js reform effect was too slow and didn't match the original destruction feel. Can be revisited — the `destruction.js` file has the constants and `scheduleTypingReform()` function that could be extracted into a standalone reform function.

---

## SPA Approach: Dynamic Fetch (Primary) with Embedded Fallback

### Dynamic Fetch (Recommended)

Instead of embedding all page content in `index.html`, fetch page HTML on demand:

```
User drags card → drag starts → prefetch target page HTML
Card enters play zone → center → wriggle → expand (fetch resolves during this ~2s window)
Expand completes → inject fetched content into .page-container → add .measuring class
Wait one frame for layout → measure target element positions
Decompose → fly → page fade-in → cleanup
```

#### How It Works

1. **Prefetch on drag start.** When `onPointerDown` fires on a card, immediately `fetch()` the target page URL. Store the promise.

```javascript
// In onPointerDown or when drag begins
const cardData = CARDS[cardId];
if (!pageCache[cardData.pageUrl]) {
  pageCache[cardData.pageUrl] = fetch(cardData.pageUrl)
    .then(r => r.text())
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      // Extract content between nav and footer (skip scripts, nav, theme switcher)
      const content = doc.querySelector('.project-hero, .hero')?.closest('body');
      // Store parsed content sections
      return extractPageContent(doc);
    });
}
```

2. **Cache in memory.** Once fetched, the parsed content stays in a `pageCache` object for the rest of the session. Second visit to the same page is instant.

3. **Inject before measuring.** After expand completes, await the cached promise, inject into a `.page-container` div, add `.measuring`, wait a frame, measure, then proceed with the fly.

```javascript
async function beginPageTransition(cardEl, cardId, cardData) {
  const content = await pageCache[cardData.pageUrl];
  pageContainer.innerHTML = content;
  pageContainer.classList.add('measuring');
  
  // Wait one frame for layout
  await new Promise(r => requestAnimationFrame(r));
  
  // Now measure target positions
  const targetTitle = pageContainer.querySelector('.project-hero-title');
  const targetTitleRect = targetTitle.getBoundingClientRect();
  // ... etc
  
  pageContainer.classList.remove('measuring');
  // Continue with fly animation
}
```

4. **Content extraction.** The `extractPageContent()` function should pull:
   - Everything inside `<body>` except: `<nav>`, `.theme-switcher`, `<footer>`, `<script>` tags, `#plane-canvas`, `.blur-overlay`
   - Preserve the HTML structure (sections, classes, etc.) since the transition needs to find `.project-hero-title`, `.work-image`, etc.

#### What This Means for Existing Files
- `index.html` stays as-is (home page content)
- `logifuture.html`, `coffin-likker.html`, `lost-satellite.html` stay as standalone pages
- A new `js/card-hand.js` handles card system + fetch + transition
- A new `js/page-transition.js` (or combined into card-hand.js) handles the decompose → fly → fade sequence
- The home page content is already in the DOM (no fetch needed for home)

#### Edge Cases
- **Fetch failure:** If the fetch fails or takes too long (>3s), fall back to a simple fade to a "loading" state, then retry. This shouldn't happen on a static portfolio site but handle it gracefully.
- **Measuring timing:** The injected content needs one animation frame for the browser to compute layout. Use `requestAnimationFrame` before measuring.
- **Styles:** The fetched content relies on `shared.css` and `project.css` which are already loaded on `index.html`. No additional style loading needed.
- **Images/GIFs:** The fetched pages reference `assets/` paths. These load asynchronously. The transition doesn't need to wait for images — they'll pop in after the page fades in, which is fine.

### Embedded Fallback

If the dynamic approach proves too complex or has timing issues, the embedded approach is proven to work — the prototype already demonstrates it. To switch:

1. Copy the content from each project page into `index.html` wrapped in `.spire-page` divs (as done in the prototype)
2. Give each a unique ID: `#page-home`, `#page-logifuture`, `#page-coffin-likker`, `#page-lost-satellite`
3. Use `.measuring` class for hidden-but-measurable state
4. No fetch logic needed — everything is in the DOM from page load

The tradeoff: larger initial page weight (all 4 pages loaded upfront) but zero async complexity. For a 4-page portfolio this is ~20KB of extra HTML, which is negligible.

---

## Card-to-Page Transition Sequence

This is the corrected sequence from the prototype session. Each phase is listed with its timing relative to the card entering the play zone.

### Phase 1: Center (0→500ms)
Card animates from drag position to viewport center. Other hand cards slide down and fade out. Current page begins fading out.

### Phase 2: Wriggle (500→1500ms)
Card wriggles with escalating intensity (rotation amplitude 0→8°, frequency ramps). Background blur and overlay darken. Card border glows with accent color. Border transitions from muted to vivid.

### Phase 3: Expand (1500→2000ms)
Card scales to fill viewport. Scale calculation: `Math.max(window.innerWidth / CARD_W, window.innerHeight / CARD_H)`. No overshoot multiplier — card should exactly cover the screen. Glow fades. Blur overlay clears.

### Phase 4: Decompose (2000→2150ms)
**Card stays at full-screen size.** Decorative elements fade out in place (150ms):
- Type bar → opacity 0
- Textbox → opacity 0
- Accent strip → opacity 0
- Border → transparent

What remains visible: title text and art/image area, floating on the parchment background (which matches the scene background, so it's visually seamless).

### Phase 5: Hover Pause (2150→2350ms)
Title and art sit in place for ~200ms. This gives the user a beat to register what's about to happen.

### Phase 6: Clone + Fly (2350→2850ms)
1. Clone title and art to a fixed-position overlay (z-index 501)
2. Position clones at exact screen coordinates of the scaled originals
3. Quietly remove the card element (background matches scene — invisible swap)
4. Animate clones to their target page positions (500ms, power3.out ease)
   - Title → `.project-hero-title` position (or `.hero h1` for home)
   - Art → first `.work-image` position (or fade out for home, which has no hero image)

### Phase 7: Page Fade-In (overlapping with fly, ~2500→2900ms)
Target page fades in (400ms) while clones are still flying. The page appears underneath the flying elements. Title and first image on the page are hidden (opacity 0) since the clones are still representing them.

### Phase 8: Swap + Hand Rebuild (2850ms+)
1. Show real page title and image elements
2. Remove flying clones
3. Rebuild hand with new card composition (3 cards, excluding the now-active page's card)
4. Cards animate up from below with staggered slide-up (120ms per card, 550ms duration)

### Total time: ~3.5 seconds from card release to fully interactive page

---

## Card Data Structure

```javascript
const CARDS = [
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
    pageId: 'page-logifuture',     // for embedded approach
    pageUrl: 'logifuture.html',    // for dynamic fetch approach
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
    pageId: 'page-coffin-likker',
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
    pageId: 'page-lost-satellite',
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
    pageId: 'page-home',
    pageUrl: null, // home content is always in the DOM
  },
];
```

---

## Fan Geometry Constants

These are proven values from the prototype — don't change without testing:

```javascript
const HOLD_RADIUS = 1400;      // arc radius for fan curvature
const FAN_SPREAD = 20;         // total degrees of fan spread
const OVERLAP_SPACING = 155;   // px between card centers horizontally
const SINK_BELOW = 190;        // how far cards sink below the hand container bottom
const HOVER_LIFT = 50;         // px a hovered card lifts
const CARD_W = 220;            // card width
const CARD_H = 320;            // card height
const HAND_W = 700;            // hand container width
const HAND_H = 400;            // hand container height
```

### Play Zone
```javascript
const PLAY_ZONE_HALF_W = 385;  // 770px total width
const PLAY_ZONE_HALF_H = 289;  // 578px total height
const MAX_BLUR = 8;            // max background blur during drag
const MAX_OVERLAY_OPACITY = 0.3;
const MAX_GLOW_SIZE = 30;      // max card border glow during drag
```

---

## Theme-Adaptive Cards

Cards must adapt their visual style per theme. The prototype only implements the Spire/parchment style. Each theme needs:

| Property | Spire (reference) | Coral | Slate | Neon |
|----------|------------------|-------|-------|------|
| Card background | #d8cfc0 (parchment) | TBD | TBD | TBD |
| Border style | 7px solid, muted accent | TBD | TBD | TBD |
| Title font | Cinzel, 13.5px, 700 | TBD (Instrument Serif?) | TBD | TBD (Sora?) |
| Body font | Fira Code, 9px | TBD (DM Sans?) | TBD | TBD (Space Mono?) |
| Type bar | Cinzel, 8.5px, centered | TBD | TBD | TBD |
| Art area | Gradient placeholder | TBD | TBD | TBD |
| Surface texture | Paper grain | TBD | TBD | TBD |

**Implementation approach:** Use CSS custom properties scoped to `[data-theme]`. The card HTML structure stays the same across themes — only the CSS changes. The JS doesn't need to know which theme is active.

```css
[data-theme="coral"] .card-inner {
  background: var(--card-bg);
  border: var(--card-border-width) solid var(--card-border-color);
  font-family: var(--card-title-font);
}
```

### Open Question
The accent colors (red, purple, green, gold) work well on the warm parchment surface. They may need adjustment per theme to maintain contrast and feel native. Consider defining accent colors per-theme in the card data or via CSS variables.

---

## Z-Index Stack

Correct layering (proven in prototype):

```
z-index:   0  — scene background, map lines, grain, vignette
z-index:   5  — .spire-page (page content, below hand)
z-index:  50  — .drag-blur-overlay (backdrop blur during drag)
z-index:  60  — .hand-container (card hand)
z-index:  60  — .perspective-container (playing card during animation)
z-index: 200  — .spire-page.transitioning (promoted during transition)
z-index: 500  — .fly-overlay (flying title/art clones)
```

Key insight: pages sit at z-index 5 so the hand is always visible on top. During transitions, the target page gets `.transitioning` which promotes it to z-index 200 (above the blur overlay). Once the transition completes, `.transitioning` is removed and the page drops back to z-index 5.

---

## Files Reference

### Existing Site Files
- `index.html` — main landing page (home content)
- `logifuture.html` — project page (fetched dynamically)
- `coffin-likker.html` — project page (fetched dynamically)
- `lost-satellite.html` — project page (fetched dynamically)
- `css/shared.css` — shared styles + theme variable blocks
- `css/project.css` — project page-specific styles
- `js/shared.js` — scroll reveal, theme switcher, card expand/blur
- `js/destruction.js` — text destruction system (SplitText, scatter, reform)
- `js/plane.js` — paper airplane projectile system

### New Files to Create
- `js/card-hand.js` — Card hand system: fan geometry, drag, hover, play zone detection, proximity feedback, play animation (center → wriggle → expand), hand rebuild
- `js/page-transition.js` — Page transition: dynamic fetch + cache, content extraction/injection, decompose, clone + fly, page fade-in, cleanup. Could be merged into card-hand.js if preferred.
- CSS additions to `shared.css` or a new `css/cards.css` — card styles per theme, hand container, play zone, fly overlay, page container

### Prototype Files (Reference Only)
- `page-transition-prototype.html` — **The latest prototype.** Contains the full transition sequence, embedded page content, Weathered Bone palette. Use as reference for all animation code.
- `card-played.html` — Earlier prototype. Card visuals and interaction are canonical here but the page transition code is outdated. The page-transition-prototype supersedes this for transition logic.

---

## Integration Concerns

### destruction.js Conflict
`destruction.js` auto-runs `preloadSplit()` on page load, which calls `splitAllText()` on all visible text matching `DESTRUCTIBLE_SELECTOR`. If dynamically fetched page content is injected into the DOM, destruction.js will not have split it (it only splits on load and resize). This is actually fine for the dynamic approach — the fetched content won't be split, so the plane/destruction feature won't affect it unless you explicitly re-run `TextDestruction.onThemeChange()` or similar.

**Decision needed:** Should the destruction/plane feature work on project pages in the card-hand navigation model? If not, no action needed. If yes, call `TextDestruction.init()` after injecting fetched content.

### Scroll Reveal Conflict
`shared.js` has `.reveal` + IntersectionObserver for scroll-triggered animations. Dynamically injected content won't have `.reveal` classes unless the fetched HTML includes them (which it does — the existing project pages use `.reveal`). The observer should pick them up automatically since it observes all `.reveal` elements. Test to confirm.

### Existing Work Card Expand
The current `index.html` has `.work-card` elements with hover-to-expand behavior in `shared.js`. In the card-hand model, these are replaced by the card hand entirely. The work section on the home page may need to be redesigned or removed — the cards ARE the work section now. Consider what the home page shows: currently it's hero + work + about + contact. With card-hand navigation, the work section is redundant since the cards represent the projects.

**Decided:** Home card shows hero + contact (not the work section). The about section's placement is an open question — it could be a card, part of the home page, or accessible another way.

### Contact Section
The contact CTA, email/GitHub/LinkedIn buttons need to be accessible. Currently on the home page. In the card-hand model, they remain on the home page content — no change needed.

---

## Remaining Phases (Updated from Original Roadmap)

### Phase 1: Dynamic Fetch + Transition Integration ⬜
Wire the prototype's transition logic into the real site. Implement fetch + cache. Test with all 4 pages.

### Phase 2: Theme-Adaptive Card Styles ⬜
Design and implement card visuals for coral, slate, and neon themes. The Spire/parchment style exists in the prototype.

### Phase 3: Card Art / Portrait Imagery ⬜
Replace gradient placeholders with actual project images/GIFs in card art areas. Images should match what appears on the project pages (the art area becomes the page's hero image during transition).

### Phase 4: Home Page Redesign ⬜
Rethink the home page for card-hand navigation. The work section is now the card hand itself. Hero + about + contact need to work with the hand always present at the bottom.

### Phase 5: Custom Hover Effect ⬜
Design the card hover treatment (user has a different idea, not yet specified).

### Phase 6: Responsive / Mobile ⬜
Touch adaptation, smaller cards, adjusted fan geometry, tap-to-play alternative.

### Phase 7: Polish & Testing ⬜
Performance, cross-browser, real devices, theme switching, accessibility.

---

## What to Bring to the Next Session

1. **`card-navigation-handoff.md`** — this file
2. **`page-transition-prototype.html`** — the working prototype
3. **`destruction.js`** — if integrating the reform effect later
4. **Site files:** `index.html`, `coffin-likker.html`, `logifuture.html`, `lost-satellite.html`, `css/shared.css`, `js/shared.js` — needed for actual integration
5. **`spire-colors-v2.jsx`** — color/palette reference (Weathered Bone selected)
