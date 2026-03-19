# Work Cards System Backup

Created before card-hand navigation conversion. Use this to restore the original work card system if needed.

---

## Restoration Guide

1. **Restore work section HTML** in `index.html` — insert between the hero section and the `<!-- ABOUT -->` comment
2. **Restore blur overlay** — add `<div class="blur-overlay" id="blurOverlay"></div>` after `<div id="plane-canvas"></div>`
3. **Restore card expand JS** in `js/shared.js` — add the overlay block after the scroll reveal code
4. **Remove SPA elements** from `index.html` — remove `.drag-blur-overlay`, `.page-container`, `.hand-container`, `.perspective-container`, `.fly-overlay`, and the `.spa-page` wrapper
5. **Remove new scripts** — remove `card-hand.js` and `page-transition.js` script tags
6. **Unhide nav** — remove `style="display: none;"` from `<nav>`
7. **Remove `css/cards.css`** link from `<head>` and `css/project.css` link
8. **Restore neon grain z-index** to `9999` in `css/shared.css`

---

## Work Section HTML (index.html lines 70-187)

```html
<!-- WORK -->
<section id="work" class="work-section">
  <div class="container">
    <p class="section-label reveal">01 - Selected Work</p>
    <h2 class="section-heading reveal">Work.</h2>

    <div class="work-grid">
      <!-- Card 1 -->
      <a href="logifuture.html" class="work-card reveal">
        <div class="work-card-header">
          <div class="work-card-left">
            <div class="work-icon orange"><svg width="28" height="28" viewBox="0 0 512 512" fill="none"><g stroke="#000000" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M 79 191.5 L 149 99.5 L 364 99.5 L 433 191.5 L 256 412.5 L 79 191.5"/><path d="M 79 191.5 L 433 191.5"/><path d="M 149 191.5 L 256 99.5 L 364 191.5"/><path d="M 149 191.5 L 149 99.5"/><path d="M 364 99.5 L 364 191.5"/><path d="M 149 191.5 L 256 412.5"/><path d="M 364 191.5 L 256 412.5"/></g></svg></div>
            <div class="work-card-info">
              <h3>Casino Games</h3>
              <p>Logifuture - 2023-Present</p>
            </div>
          </div>
          <div class="work-card-right">
            <div class="work-pills">
              <span class="work-pill">Game Development</span>
              <span class="work-pill">UX</span>
              <span class="work-pill">PixiJS</span>
            </div>
            <span class="work-card-arrow">&rarr;</span>
          </div>
        </div>
        <div class="work-expand">
          <div class="work-expand-inner">
            <div class="work-expand-grid">
              <img class="work-image" src="assets/spin+.gif" alt="Casino game gameplay" loading="lazy">
              <div class="work-details">
                <h4>Casino Games for Logifuture</h4>
                <p>Built and released several casino games working closely with designers and artists. Redesigned, pitched and implemented mini versions of casino games for sportsbook crossover. Maintained 40+ existing games.</p>
                <div class="work-stats">
                  <div class="work-stat"><span class="work-stat-num">1.5M</span><span class="work-stat-label">Bets a month</span></div>
                  <div class="work-stat"><span class="work-stat-num">10+</span><span class="work-stat-label">Games shipped</span></div>
                  <div class="work-stat"><span class="work-stat-num">500k</span><span class="work-stat-label">Monthly users</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </a>

      <!-- Card 2 -->
      <a href="coffin-likker.html" class="work-card reveal">
        <div class="work-card-header">
          <div class="work-card-left">
            <div class="work-icon blue"><svg width="28" height="28" viewBox="0 0 512 512" fill="currentColor"><path d="M256,0C88.266,0,2.063,134.656,2.063,274.906c0,52.594,11.484,95.813,37.281,121.141 c34.094,33.484,74.25,30.078,78.281,33.641c0,0,0,35.391,0,58.922v9.203c0,7.844,6.344,14.188,14.188,14.188h34.047 c7.828,0,14.172-6.344,14.172-14.188v-43.219c3.313-1.906,6.344,0.313,9.063-1.094c0,0.125-0.031,0.219-0.031,0.328v43.984 c0,7.844,6.344,14.188,14.188,14.188h34.047c7.844,0,14.203-6.344,14.203-14.188v-43.984c0-1.422-0.281-2.766-0.688-4.078H256 h5.188c-0.406,1.313-0.688,2.656-0.688,4.078v43.984c0,7.844,6.359,14.188,14.203,14.188h34.047 c7.844,0,14.188-6.344,14.188-14.188v-43.984c0-0.109-0.031-0.203-0.031-0.328c2.703,1.406,5.75-0.813,9.063,1.094v43.219 c0,7.844,6.344,14.188,14.156,14.188h34.063c7.844,0,14.188-6.344,14.188-14.188v-9.203c0-23.531,0-58.922,0-58.922 c4.031-3.563,44.172-0.156,78.281-33.641c25.797-25.328,37.281-68.547,37.281-121.141C509.938,134.656,423.734,0,256,0z M147.672,339.281c-34.109,0-61.734-27.641-61.734-61.734v-13.984c0-34.094,27.625-61.719,61.734-61.719 c34.078,0,61.734,27.625,61.734,61.719v13.984C209.406,311.641,181.75,339.281,147.672,339.281z M256,397h-48.922L256,334.313 L304.922,397H256z M426.063,277.547c0,34.094-27.641,61.734-61.734,61.734s-61.734-27.641-61.734-61.734v-13.984 c0-34.094,27.641-61.719,61.734-61.719s61.734,27.625,61.734,61.719V277.547z"/></svg></div>
            <div class="work-card-info">
              <h3>Coffin-Likker</h3>
              <p>Personal Project (Part Time) - 2025-Present</p>
            </div>
          </div>
          <div class="work-card-right">
            <div class="work-pills">
              <span class="work-pill">System Design</span>
              <span class="work-pill">Unity</span>
              <span class="work-pill">C#</span>
            </div>
            <span class="work-card-arrow">&rarr;</span>
          </div>
        </div>
        <div class="work-expand">
          <div class="work-expand-inner">
            <div class="work-expand-grid">
              <img class="work-image" src="assets/soundring.gif" alt="Coffin-Likker gameplay" loading="lazy">
              <div class="work-details">
                <h4>2D stealth game with shader driven visibility system</h4>
                <p>Solo-developing stealth action game in Unity. Players can only see enemies and interactables that their light touches. High emphasis on tension of the unknown, further highlighted by the limited colour palette.</p>
                <div class="work-stats">
                  <div class="work-stat"><span class="work-stat-num">Unity 6</span><span class="work-stat-label">Engine</span></div>
                  <div class="work-stat"><span class="work-stat-num">HLSL</span><span class="work-stat-label">Custom Shaders</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </a>

      <!-- Card 3 -->
      <a href="lost-satellite.html" class="work-card reveal">
        <div class="work-card-header">
          <div class="work-card-left">
            <div class="work-icon green"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="11" y="11" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="8" y1="14" x2="3" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="25" y1="14" x2="20" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="14" y1="8" x2="14" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="14" y1="25" x2="14" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3" y1="12" x2="3" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="25" y1="12" x2="25" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>
            <div class="work-card-info">
              <h3>Lost Satellite Studios</h3>
              <p>Technical Designer (Part Time) - 2024</p>
            </div>
          </div>
          <div class="work-card-right">
            <div class="work-pills">
              <span class="work-pill">Mechanics</span>
              <span class="work-pill">Godot</span>
              <span class="work-pill">Prototyping</span>
            </div>
            <span class="work-card-arrow">&rarr;</span>
          </div>
        </div>
        <div class="work-expand">
          <div class="work-expand-inner">
            <div class="work-expand-grid">
              <img class="work-image" src="assets/ult+bossfightgif.gif" alt="Lost Satellite Studios gameplay">
              <div class="work-details">
                <h4>Combat, Enemies and Movement 2D metroidvania</h4>
                <p>Designed and built the combat, enemies and movement system for a narrative-driven metroidvania in Godot.</p>
                <div class="work-stats">
                  <div class="work-stat"><span class="work-stat-num">6 Months</span><span class="work-stat-label">Timeline</span></div>
                  <div class="work-stat"><span class="work-stat-num">Steam</span><span class="work-stat-label">Demo Live</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </a>
    </div>
  </div>
</section>
```

---

## Card Expand Overlay JS (js/shared.js lines 13-65)

```javascript
// Expand cards with blur overlay
const overlay = document.getElementById('blurOverlay');
if (overlay) {
  const cards = document.querySelectorAll('.work-card');
  let activeCard = null;

  const isTouchLike = (type) => type === 'touch' || type === 'pen';

  function closeActive() {
    if (activeCard) {
      activeCard.classList.remove('expanded');
      overlay.classList.remove('active');
      activeCard = null;
    }
  }

  cards.forEach(card => {
    card.addEventListener('pointerenter', (e) => {
      if (isTouchLike(e.pointerType)) return;
      closeActive();
      card.classList.add('expanded');
      overlay.classList.add('active');
      activeCard = card;
    });
    card.addEventListener('pointerleave', (e) => {
      if (isTouchLike(e.pointerType)) return;
      if (card === activeCard) closeActive();
    });

    card.addEventListener('pointerdown', (e) => {
      card.lastPointerType = e.pointerType;
    });

    card.addEventListener('click', (e) => {
      if (!isTouchLike(card.lastPointerType)) return;
      if (card === activeCard) return;
      e.preventDefault();
      if (activeCard) {
        closeActive();
        return;
      }
      card.classList.add('expanded');
      overlay.classList.add('active');
      activeCard = card;
    });
  });

  overlay.addEventListener('click', () => closeActive());
}
```

---

## Relevant CSS (css/shared.css)

### Work card styles

```css
.work-section { position: relative; }

.work-grid {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.blur-overlay {
  position: fixed;
  inset: 0;
  z-index: 101;
  backdrop-filter: blur(6px);
  background: rgba(0,0,0,0.15);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s var(--ease-out);
}

.blur-overlay.active {
  opacity: 1;
  pointer-events: auto;
}

.work-card {
  display: block;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  position: relative;
  cursor: pointer;
  transition: border-color 0.3s ease, box-shadow 0.4s var(--ease-out);
}

.work-card.expanded {
  z-index: 102;
  border-color: var(--accent);
  box-shadow: 0 40px 100px var(--accent-mid);
}

/* ... plus all .work-card-header, .work-expand, .work-stats, etc. styles */
```
