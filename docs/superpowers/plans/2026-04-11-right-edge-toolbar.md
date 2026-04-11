# Right-Edge Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `.theme-switcher` (cycling button) and `.plane-toggle` (fixed button + attractor) with a single fixed right-edge `.toolbar` component containing direct-select theme swatches, a hover preview panel (desktop only), and a plane toggle, on all four live pages across all five themes.

**Architecture:** One fixed-position toolbar element injected by JS into each page (mirrors the prototype DOM in `toolbar-variation-d.html`). Base + per-theme styles live in `css/shared.css`. Swatch click wires directly into the existing `setTheme(name)` logic in `js/shared.js`. Plane button reuses the existing `toggle()` function in `js/plane.js` (unchanged behaviour) but is now adopted into the toolbar DOM instead of being appended to `document.body` standalone. All old `.theme-switcher` / `.plane-toggle` CSS, HTML, and the attractor/bounce code are deleted.

**Tech Stack:** Static HTML/CSS/JS, no build step. CSS custom properties + per-theme `[data-theme="..."]` blocks. `data-theme` lives on `<html>`.

---

## Resolved Decisions (locked in before implementation)

1. **Swatch dot colours:** use `--theme-*-accent` cross-theme constants in `:root` (Task 2).
2. **Plane button icon:** use the paper-plane SVG only (rest state). Drop the crosshair, drop the `"Fly"/"Stop"` text label, and do NOT swap to a "stop" square when active. The active state is conveyed purely by CSS recolouring the same SVG via `.plane-btn.active` → `color: var(--accent)` (+ `background: var(--accent-soft)`), which picks up a theme-appropriate colour automatically.
3. **Retro `var(--pop)` scope:** applies only to live toolbar chrome (border, box-shadow, active swatch ring, plane-btn active colour). The preview panel's stripe/name/chip colours continue to show the *target* theme's identity colours from the `PREVIEW` object in toolbar.js — they are not affected by the retro override.
4. **Mobile:** shrink only (≤768px padding + swatch + icon size). No hide-on-drag rule. Revisit later if overlap becomes a visual issue.
5. **`toolbar-variation-d.html`:** delete in the final task.
6. **`lost-satellite copy for games.html`:** user has moved it into the backup folder — out of scope.

---

## File Structure

**Modified:**
- `css/shared.css` — add `.toolbar` base rules + per-theme overrides + responsive rules; delete all `.theme-switcher` and `.plane-toggle` rules (base and per-theme).
- `js/shared.js` — replace the cycling `themeSwitcher` button handler with a `setTheme(name)` function callable from any swatch click. Keep the three theme-change hook calls.
- `js/plane.js` — delete `startBounce/stopBounce/triggerBounce`, delete the attractor class + `sessionStorage('plane-attractor-seen')` logic, change `createToggleButton()` to build a `.plane-btn` element whose parent is the toolbar (not `document.body`), swap crosshair SVG for paper-plane SVG, drop text label. Keep everything else.
- `js/analytics.js` — update selectors from `.plane-toggle` / `.theme-switcher` to `.plane-btn` / `.swatch-btn`.
- `js/destruction.js` — update exclusion selector at L59 from `.theme-switcher, .plane-toggle` to `.toolbar`.
- `js/page-transition.js` — update removeSelectors list (L39) and infraIds list (L73) and button-skip check (L81) from `.theme-switcher` / `.plane-toggle` to `.toolbar` / `#toolbar`.
- `index.html`, `casino_games.html`, `my_games.html`, `eve_of_destruction.html` — delete the `<button class="theme-switcher" id="themeSwitcher">...</button>` line. The toolbar is injected by JS (single source of truth), so pages get no new markup.

**Created:**
- `js/toolbar.js` — new file. Owns toolbar DOM creation, swatch rendering, hover-preview panel, and plane-btn adoption. Loaded before `shared.js` and `plane.js` via a new `<script>` tag on all four pages.

**Deleted:**
- `toolbar-variation-d.html` (prototype, after verification)

---

## Task 1: Grep sweep to confirm every removal target

Before touching any file, enumerate the blast radius so nothing is missed.

- [ ] **Step 1: List every file that references the old classes**

Run in order and save output to a scratch note:

```
Grep pattern: theme-switcher    → expect 12 files (CLAUDE.md, shared.css, 4 live html, 1 backup html, analytics.js, destruction.js, page-transition.js, plane.js, plans/page-transition.js)
Grep pattern: plane-toggle      → expect 13 files (similar set + tests/)
Grep pattern: attractor         → scope to js/plane.js only (card-hand attractor is separate and must NOT be touched)
Grep pattern: themeSwitcher     → js/shared.js, js/page-transition.js, 5 html files
Grep pattern: plane-attractor-seen → js/plane.js only (session-storage key to delete)
```

- [ ] **Step 2: Confirm the file line ranges you will delete in shared.css**

Exact line numbers to remove (confirm with Grep before deleting — file grows, so re-grep after each deletion):

```
53-74    .theme-switcher base + :hover
83-126   .plane-toggle base + :hover + .attractor + .attractor.bouncing + .attractor:hover
708-732  @keyframes nudgeBounce (inside ANIMATIONS block — DELETE only if nothing else uses it; grep first)
789-803  [data-theme="neon"] .theme-switcher + .plane-toggle + .attractor
867-871  @media 768px .plane-toggle
876-882  @media 600px .plane-toggle + [data-theme="neon"] .theme-switcher
1146-1152  [data-theme="bold"] .theme-switcher + .plane-toggle + .attractor
1169-... [data-theme="bold"] responsive .theme-switcher (grep for exact end)
1445-1469  [data-theme="cinematic"] theme-switcher + plane-toggle + attractor
1495-... [data-theme="cinematic"] responsive theme-switcher
2089-2111  [data-theme="brutalist"] theme-switcher + plane-toggle + attractor
2180-... [data-theme="brutalist"] responsive theme-switcher
2461-2489  [data-theme="retro"] theme-switcher + plane-toggle + attractor
2573-... [data-theme="retro"] responsive theme-switcher
```

- [ ] **Step 3: Verify `nudgeBounce` usage**

```
Grep pattern: nudgeBounce → should only appear in (a) the @keyframes definition, (b) .plane-toggle.attractor.bouncing rule. If either card-hand.js, attractor-label CSS, or any other file references it, DO NOT DELETE the keyframes.
```

- [ ] **Step 4: Commit a scratch note**

Paste the grep results into a comment at the top of a tracking file or your PR description. Do not commit yet — this is a read-only audit.

---

## Task 2: Add new CSS variables for cross-theme swatch colours

**Files:**
- Modify: `css/shared.css:3-26` (inside `:root`)

- [ ] **Step 1: Append five constant swatch-accent variables to `:root`**

In `css/shared.css`, find `:root {` (line 3) and immediately before the closing `}` (around line 26) add:

```css
  /* Cross-theme swatch accent identities (NEVER overridden per theme) */
  --theme-bold-accent: #ff3d00;
  --theme-brutalist-accent: #0000ff;
  --theme-retro-accent: #dc322f;
  --theme-cinematic-accent: #c9a84c;
  --theme-neon-accent: #c9f059;
```

Note: neon uses the site's real lime `#c9f059` (from `[data-theme="neon"]`), not the prototype's `#39ff14`. This keeps the swatch honest.

- [ ] **Step 2: Verify no per-theme block overrides these**

```
Grep pattern: --theme-bold-accent → expect 1 match (the :root definition)
```

- [ ] **Step 3: Commit**

```
git add css/shared.css
git commit -m "css: add cross-theme swatch accent constants"
```

---

## Task 3: Write `.toolbar` base styles in shared.css

**Files:**
- Modify: `css/shared.css` — insert new block right before the current `.theme-switcher` rule at line 53 (which will be deleted in a later task)

- [ ] **Step 1: Insert toolbar base CSS**

Insert this block just before `.theme-switcher {` at line 53:

```css
/* ========== RIGHT-EDGE TOOLBAR ========== */
.toolbar {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 10px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-right: none;
  border-top-left-radius: var(--radius);
  border-bottom-left-radius: var(--radius);
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  transition: background 0.3s, border-color 0.3s, box-shadow 0.3s, border-radius 0.3s;
  z-index: 99;
}

.toolbar .swatches {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.toolbar .swatch-btn {
  border: none;
  cursor: pointer;
  padding: 0;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s;
  position: relative;
}
.toolbar .swatch-btn:hover { transform: scale(1.15); }

.toolbar .swatch-dot {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  transition: all 0.2s;
}

.toolbar .swatch-btn.active .swatch-dot {
  width: 26px;
  height: 26px;
  border-radius: 5px;
  box-shadow: 0 0 0 2.5px var(--accent);
}

/* Individual swatch dot colours (cross-theme constants) */
.toolbar .swatch-btn[data-theme-id="bold"] .swatch-dot      { background: var(--theme-bold-accent); }
.toolbar .swatch-btn[data-theme-id="brutalist"] .swatch-dot { background: var(--theme-brutalist-accent); }
.toolbar .swatch-btn[data-theme-id="retro"] .swatch-dot     { background: var(--theme-retro-accent); }
.toolbar .swatch-btn[data-theme-id="cinematic"] .swatch-dot { background: var(--theme-cinematic-accent); }
.toolbar .swatch-btn[data-theme-id="neon"] .swatch-dot      { background: var(--theme-neon-accent); }

.toolbar .divider {
  width: 18px;
  height: 1px;
  background: var(--border);
  margin: 14px auto;
}

.toolbar .plane-btn {
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-secondary);
  padding: 8px 10px;
  border-radius: 6px;
  transition: background 0.2s, color 0.2s;
}
.toolbar .plane-btn svg { width: 22px; height: 22px; transition: color 0.2s; }
.toolbar .plane-btn:hover:not(.active) { color: var(--text-primary); }
.toolbar .plane-btn.active {
  background: var(--accent-soft);
  color: var(--accent);
}

/* Preview panel — desktop only (enabled via @media hover below) */
.toolbar .preview-panel {
  position: absolute;
  right: calc(100% + 12px);
  pointer-events: none;
  z-index: 20;
  width: 170px;
  padding: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  opacity: 0;
  transform: translateX(-8px);
  transition: opacity 0.2s, transform 0.2s;
  display: none; /* hidden unless desktop hover media matches */
}
.toolbar .preview-panel.visible { opacity: 1; transform: translateX(0); }
.toolbar .preview-stripe { height: 4px; border-radius: 2px; margin-bottom: 8px; }
.toolbar .preview-name {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-primary);
  margin-bottom: 2px;
}
.toolbar .preview-sub {
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}
.toolbar .preview-chips { display: flex; gap: 4px; }
.toolbar .preview-chip {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid rgba(128, 128, 128, 0.2);
}

@media (hover: hover) and (pointer: fine) {
  .toolbar .preview-panel { display: block; }
}

@media (prefers-reduced-motion: reduce) {
  .toolbar,
  .toolbar .swatch-btn,
  .toolbar .preview-panel,
  .toolbar .plane-btn { transition: none; }
}

/* Mobile: shrink + hide while dragging a card */
@media (max-width: 768px) {
  .toolbar { padding: 14px 8px; }
  .toolbar .swatch-dot { width: 18px; height: 18px; }
  .toolbar .swatch-btn.active .swatch-dot { width: 22px; height: 22px; }
  .toolbar .plane-btn svg { width: 18px; height: 18px; }
  .toolbar .swatches { gap: 10px; }
}
```

- [ ] **Step 2: Commit**

```
git add css/shared.css
git commit -m "css: add right-edge toolbar base styles"
```

---

## Task 4: Write per-theme toolbar overrides

**Files:**
- Modify: `css/shared.css` — one small override block per theme, placed at the END of each theme's existing override section

Each override block adjusts `border-radius`, `border-width`, `box-shadow`, and `border-color` to match the theme's identity, mirroring the prototype. Colours use existing CSS variables only — no hex.

- [ ] **Step 1: Bold overrides**

Append at the end of the BOLD THEME OVERRIDES section (just before the CINEMATIC section, around the current line 1182):

```css
[data-theme="bold"] .toolbar {
  border-radius: 12px 0 0 12px;
}
```

Bold's `--radius` may already be suitable; include this line only if `--radius` differs. Re-grep for `--radius:` inside `[data-theme="bold"]` block first — if `--radius` is `12px`, skip this override entirely.

- [ ] **Step 2: Brutalist overrides**

Append at end of BRUTALIST OVERRIDES section (around line 2184):

```css
[data-theme="brutalist"] .toolbar {
  border-width: 2px;
  border-color: var(--border);
  border-radius: 0;
  box-shadow: 4px 4px 0 var(--border);
}
[data-theme="brutalist"] .toolbar .preview-panel {
  border-width: 2px;
  border-radius: 0;
  box-shadow: 4px 4px 0 var(--border);
}
```

- [ ] **Step 3: Retro overrides (uses `--pop` as described in constraints)**

Append at end of RETRO OVERRIDES section (around line 2576):

```css
[data-theme="retro"] .toolbar {
  border-width: 2px;
  border-color: var(--pop);
  border-radius: 8px 0 0 8px;
  box-shadow: 3px 3px 0 var(--pop);
}
[data-theme="retro"] .toolbar .swatch-btn.active .swatch-dot {
  box-shadow: 0 0 0 2.5px var(--pop);
}
[data-theme="retro"] .toolbar .plane-btn.active {
  color: var(--pop);
  background: var(--pop-soft, rgba(42, 161, 152, 0.1));
}
[data-theme="retro"] .toolbar .preview-panel {
  border-width: 2px;
  border-color: var(--pop);
  border-radius: 8px;
  box-shadow: 3px 3px 0 var(--pop);
}
```

If `--pop-soft` isn't defined in the retro theme, fall back to the rgba literal — but first grep `[data-theme="retro"]` for `--pop-soft` and prefer the variable.

- [ ] **Step 4: Cinematic overrides**

Append at end of CINEMATIC OVERRIDES section (around line 1502):

```css
[data-theme="cinematic"] .toolbar {
  border-radius: 14px 0 0 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
[data-theme="cinematic"] .toolbar .preview-panel {
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
```

- [ ] **Step 5: Neon overrides**

Append at end of NEON THEME OVERRIDES section (around line 844):

```css
[data-theme="neon"] .toolbar {
  border-radius: 16px 0 0 16px;
  border-color: var(--accent);
  box-shadow: 0 0 20px var(--accent-glow, rgba(201, 240, 89, 0.15)),
              0 4px 16px rgba(0, 0, 0, 0.4);
}
[data-theme="neon"] .toolbar .preview-panel {
  border-radius: 16px;
  border-color: var(--accent);
  box-shadow: 0 0 20px var(--accent-glow, rgba(201, 240, 89, 0.15));
}
```

- [ ] **Step 6: Commit**

```
git add css/shared.css
git commit -m "css: per-theme toolbar overrides"
```

---

## Task 5: Create `js/toolbar.js`

**Files:**
- Create: `js/toolbar.js`

- [ ] **Step 1: Write the file**

```js
// js/toolbar.js — right-edge toolbar with theme swatches + plane button slot
(function () {
  'use strict';

  var THEMES = ['bold', 'brutalist', 'retro', 'cinematic', 'neon'];
  var LABELS = {
    bold: 'Bold',
    brutalist: 'Brutalist',
    retro: 'Retro',
    cinematic: 'Cinematic',
    neon: 'Neon'
  };

  // Preview panel content (uses the cross-theme accent constants declared in :root).
  // Hex values mirror the CSS vars; kept in JS purely for the preview chips since we
  // render them inline for speed. NOTE: if you change a --theme-*-accent in shared.css,
  // update the matching entry here.
  var PREVIEW = {
    bold:      { accent: '#ff3d00', bg: '#f4f4f4', text: '#111',    sub: '#555',    chips: ['#ff3d00', '#ffe100', '#111',    '#f4f4f4'] },
    brutalist: { accent: '#0000ff', bg: '#fff',    text: '#000',    sub: '#333',    chips: ['#0000ff', '#ff0000', '#000',    '#fff']    },
    retro:     { accent: '#dc322f', bg: '#fff8eb', text: '#3b2e1a', sub: '#7a6955', chips: ['#dc322f', '#2aa198', '#3b2e1a', '#fdf6e3'] },
    cinematic: { accent: '#c9a84c', bg: '#16161e', text: '#e8e8ec', sub: '#8888a0', chips: ['#c9a84c', '#e8d5a0', '#e8e8ec', '#0d0d12'] },
    neon:      { accent: '#c9f059', bg: '#111118', text: '#e0ffe0', sub: '#7aaa7a', chips: ['#c9f059', '#59b8f0', '#e0ffe0', '#0a0a0f'] }
  };

  function buildToolbar() {
    var current = document.documentElement.getAttribute('data-theme') || 'bold';

    var toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    toolbar.id = 'toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Site controls');

    var swatches = document.createElement('div');
    swatches.className = 'swatches';
    toolbar.appendChild(swatches);

    THEMES.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch-btn' + (t === current ? ' active' : '');
      btn.setAttribute('data-theme-id', t);
      btn.setAttribute('aria-label', 'Switch to ' + LABELS[t] + ' theme');
      btn.setAttribute('aria-pressed', t === current ? 'true' : 'false');
      var dot = document.createElement('span');
      dot.className = 'swatch-dot';
      btn.appendChild(dot);
      swatches.appendChild(btn);
    });

    var divider = document.createElement('div');
    divider.className = 'divider';
    toolbar.appendChild(divider);

    // Plane button is injected here by plane.js — leave a marker slot.
    var slot = document.createElement('div');
    slot.id = 'toolbar-plane-slot';
    toolbar.appendChild(slot);

    // Preview panel (hover, desktop only)
    var preview = document.createElement('div');
    preview.className = 'preview-panel';
    preview.id = 'toolbar-preview';
    preview.innerHTML =
      '<div class="preview-stripe"></div>' +
      '<div class="preview-name"></div>' +
      '<div class="preview-sub">Theme preview</div>' +
      '<div class="preview-chips"></div>';
    toolbar.appendChild(preview);

    document.body.appendChild(toolbar);

    wireSwatchClicks(swatches);
    wireHoverPreview(toolbar, swatches, preview);

    return toolbar;
  }

  function wireSwatchClicks(swatches) {
    swatches.addEventListener('click', function (e) {
      var btn = e.target.closest('.swatch-btn');
      if (!btn) return;
      var t = btn.getAttribute('data-theme-id');
      if (!t) return;
      if (typeof window.setTheme === 'function') {
        window.setTheme(t);
      }
    });
  }

  function wireHoverPreview(toolbar, swatches, preview) {
    // Only run hover wiring on devices with true hover + fine pointer
    var mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!mq.matches) return;

    swatches.addEventListener('mouseover', function (e) {
      var btn = e.target.closest('.swatch-btn');
      if (!btn) return;
      if (btn.classList.contains('active')) {
        preview.classList.remove('visible');
        return;
      }
      var t = btn.getAttribute('data-theme-id');
      var p = PREVIEW[t];
      if (!p) return;
      preview.querySelector('.preview-stripe').style.background = p.accent;
      var nameEl = preview.querySelector('.preview-name');
      nameEl.textContent = LABELS[t];
      nameEl.style.color = p.text;
      preview.querySelector('.preview-sub').style.color = p.sub;
      preview.style.background = p.bg;
      preview.querySelector('.preview-chips').innerHTML =
        p.chips.map(function (c) {
          return '<span class="preview-chip" style="background:' + c + '"></span>';
        }).join('');
      var tr = toolbar.getBoundingClientRect();
      var br = btn.getBoundingClientRect();
      preview.style.top = Math.max(4, br.top - tr.top + btn.offsetHeight / 2 - 40) + 'px';
      preview.classList.add('visible');
    });

    swatches.addEventListener('mouseleave', function () {
      preview.classList.remove('visible');
    });
  }

  // Called by shared.js after it changes data-theme
  function syncActive(themeName) {
    document.querySelectorAll('#toolbar .swatch-btn').forEach(function (b) {
      var on = b.getAttribute('data-theme-id') === themeName;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // Hide preview if it was showing the now-active theme
    var preview = document.getElementById('toolbar-preview');
    if (preview) preview.classList.remove('visible');
  }

  // Build immediately if body exists, else wait
  if (document.body) {
    buildToolbar();
  } else {
    document.addEventListener('DOMContentLoaded', buildToolbar);
  }

  window.Toolbar = { syncActive: syncActive };
})();
```

- [ ] **Step 2: Commit**

```
git add js/toolbar.js
git commit -m "js: add toolbar.js with swatches + hover preview"
```

---

## Task 6: Refactor `js/shared.js` to expose `setTheme(name)` and drop the cycling button

**Files:**
- Modify: `js/shared.js:14-36`

- [ ] **Step 1: Replace the theme-switcher block**

Replace lines 14-36 with:

```js
// Theme switcher (direct-select via toolbar swatches)
const themes = ['bold', 'brutalist', 'retro', 'cinematic', 'neon'];

function setTheme(name) {
  if (themes.indexOf(name) === -1) return;
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('portfolio-theme', name);
  if (window.Toolbar && window.Toolbar.syncActive) window.Toolbar.syncActive(name);
  if (window.TextDestruction) TextDestruction.onThemeChange();
  if (window._planeOnThemeChange) window._planeOnThemeChange();
  if (window._cardHandOnThemeChange) window._cardHandOnThemeChange();
}
window.setTheme = setTheme;
```

No more `themeSwitcher` DOM lookup, no more `updateLabel()`, no more cycling click handler.

- [ ] **Step 2: Commit**

```
git add js/shared.js
git commit -m "js: replace cycling theme switcher with setTheme(name)"
```

---

## Task 7: Rework `js/plane.js` — drop attractor, adopt into toolbar, swap icon

**Files:**
- Modify: `js/plane.js:127-214, 440-441, 519-521`

- [ ] **Step 1: Delete bounce state variables + functions**

Remove lines 129-154 (`bounceInterval`, `bounceTimeout`, `bounceDelayId`, `startBounce`, `triggerBounce`, `stopBounce`). Also remove any `stopBounce()` call sites inside `toggle()` (lines ~220-221).

- [ ] **Step 2: Rewrite `createToggleButton()`**

Replace lines 157-201 with:

```js
  var planeIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2' +
      'c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2' +
      ' 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>' +
    '</svg>';

  // --- Toggle Button ---
  function createToggleButton() {
    toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'plane-btn';
    toggleBtn.setAttribute('aria-label', 'Toggle paper plane overlay');
    toggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    toggleBtn.innerHTML = planeIcon;
    if (enabled) toggleBtn.classList.add('active');

    toggleBtn.addEventListener('click', toggle);

    // Adopt into toolbar slot (toolbar.js runs first). Fallback: append to body.
    var slot = document.getElementById('toolbar-plane-slot');
    if (slot) {
      slot.appendChild(toggleBtn);
    } else {
      document.body.appendChild(toggleBtn);
    }
  }
```

Note: the icon does not change between states. The active visual comes entirely from `.toolbar .plane-btn.active` in CSS (Task 3) which sets `color: var(--accent)` (theme-appropriate) and `background: var(--accent-soft)`. `currentColor` in the SVG stroke picks up that recolour automatically.

- [ ] **Step 3: Rewrite `updateButtonLabel()`**

Replace lines 203-212 with:

```js
  function updateButtonLabel() {
    if (!toggleBtn) return;
    toggleBtn.classList.toggle('active', enabled);
    toggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }
```

Consider renaming to `updateButtonState()` since there is no longer a label — rename call sites too (grep `updateButtonLabel` in plane.js).

- [ ] **Step 4: Remove remaining attractor references inside `toggle()`**

In `toggle()` (starts ~L214), delete the two lines:
```js
toggleBtn.classList.remove('attractor');
stopBounce();
```

Keep the rest of `toggle()` intact (plane-active class, init/start, TextDestruction hooks, nav scroll-hidden sync).

- [ ] **Step 5: Drop `.theme-switcher` from internal click-ignore selectors**

At lines 441 and 521:
```js
if (e.target.closest('.plane-toggle, nav, .theme-switcher')) return;
```
→
```js
if (e.target.closest('.toolbar')) return;
```

- [ ] **Step 6: Delete `plane-attractor-seen` sessionStorage lookups**

Grep for `plane-attractor-seen` and remove any remaining reference.

- [ ] **Step 7: Commit**

```
git add js/plane.js
git commit -m "js: retire plane attractor, adopt plane button into toolbar, swap icon"
```

---

## Task 8: Update remaining JS references to old classes

**Files:**
- Modify: `js/analytics.js:11, 20`
- Modify: `js/destruction.js:59`
- Modify: `js/page-transition.js:39, 73, 81`

- [ ] **Step 1: analytics.js**

Read lines 1-40 first.

```js
// L11: .plane-toggle → .toolbar .plane-btn
if (!e.target.closest('.toolbar .plane-btn')) return;
// L20: .theme-switcher → .toolbar .swatch-btn
if (!e.target.closest('.toolbar .swatch-btn')) return;
```

Ensure the analytics labels/values downstream of these checks still make sense (swatches now have a `data-theme-id` — prefer logging that as the event label).

- [ ] **Step 2: destruction.js L59**

```js
// Before:
if (el.closest('.theme-switcher, .plane-toggle, .btn, .work-expand')) return;
// After:
if (el.closest('.toolbar, .btn, .work-expand')) return;
```

- [ ] **Step 3: page-transition.js L39**

```js
// Before:
'nav', '.theme-switcher', 'footer', 'script',
// After:
'nav', '.toolbar', 'footer', 'script',
```

- [ ] **Step 4: page-transition.js L73**

```js
// Before:
var infraIds = ['plane-canvas', 'dragBlurOverlay', 'pageContainer',
                'handContainer', 'perspectiveContainer', 'flyOverlay',
                'themeSwitcher', 'statusBar'];
// After:
var infraIds = ['plane-canvas', 'dragBlurOverlay', 'pageContainer',
                'handContainer', 'perspectiveContainer', 'flyOverlay',
                'toolbar', 'statusBar'];
```

- [ ] **Step 5: page-transition.js L81**

```js
// Before:
if (child.tagName === 'BUTTON' && (child.classList.contains('theme-switcher') || child.classList.contains('plane-toggle'))) continue;
// After:
if (child.id === 'toolbar') continue;
```

- [ ] **Step 6: Commit**

```
git add js/analytics.js js/destruction.js js/page-transition.js
git commit -m "js: update class references for new toolbar"
```

---

## Task 9: Delete old CSS rules

**Files:**
- Modify: `css/shared.css`

Delete in reverse-line-number order so earlier line numbers stay stable. Re-grep after each deletion to confirm the next target.

- [ ] **Step 1: Re-grep to get fresh line numbers**

```
Grep pattern: theme-switcher|plane-toggle in css/shared.css, output: content with -n
```

- [ ] **Step 2: Delete retro overrides**

Delete the `[data-theme="retro"] .theme-switcher`, `.plane-toggle`, `.attractor` blocks (currently ~2461-2489) and the retro responsive `.theme-switcher` block (~2573).

- [ ] **Step 3: Delete brutalist overrides**

Delete `[data-theme="brutalist"] .theme-switcher`, `.plane-toggle`, `.attractor` blocks (~2089-2111) and the brutalist responsive `.theme-switcher` (~2180).

- [ ] **Step 4: Delete cinematic overrides**

Delete `[data-theme="cinematic"]` theme-switcher + plane-toggle + attractor blocks (~1445-1469) and responsive (~1495).

- [ ] **Step 5: Delete bold overrides**

Delete `[data-theme="bold"]` theme-switcher + plane-toggle + attractor (~1146-1152) and responsive (~1169).

- [ ] **Step 6: Delete 600px and 768px responsive rules**

Delete the `.plane-toggle` rules in both `@media (max-width: 768px)` and `@media (max-width: 600px)` (around 867-871 and 876-882), and delete the `[data-theme="neon"] .theme-switcher` rule at ~880.

- [ ] **Step 7: Delete neon overrides**

Delete `[data-theme="neon"] .theme-switcher` and `.plane-toggle` rules (~789-803).

- [ ] **Step 8: Delete base rules**

Delete the entire `.theme-switcher` base block (~53-74, now shifted) and the entire `.plane-toggle` base block including `.attractor`, `.attractor.bouncing`, `.attractor:hover` (~84-126).

- [ ] **Step 9: Conditionally delete `@keyframes nudgeBounce`**

Re-grep for `nudgeBounce`. If it only appears in its own @keyframes definition (no remaining consumers), delete the keyframes block. Otherwise leave it alone.

- [ ] **Step 10: Final verification grep**

```
Grep pattern: theme-switcher in css/shared.css → expect 0 matches
Grep pattern: plane-toggle in css/shared.css → expect 0 matches
Grep pattern: attractor in css/shared.css → expect 0 matches (the attractor-label in cards.css is separate)
```

- [ ] **Step 11: Commit**

```
git add css/shared.css
git commit -m "css: remove obsolete theme-switcher and plane-toggle rules"
```

---

## Task 10: Remove `<button class="theme-switcher">` from HTML pages + add `toolbar.js` script tag

**Files:**
- Modify: `index.html`, `casino_games.html`, `my_games.html`, `eve_of_destruction.html`

For each of the four live HTML files:

- [ ] **Step 1: Delete the theme-switcher button line**

Grep shows the line is at the same relative position in all four (index.html:46, the three project pages at :44). Delete the two lines:

```html
<!-- THEME SWITCHER -->
<button class="theme-switcher" id="themeSwitcher">Cinematic</button>
```

- [ ] **Step 2: Add `<script src="js/toolbar.js"></script>` BEFORE the existing `shared.js` script**

Grep each file for `<script src="js/shared.js"` to find the exact insertion point. Toolbar.js must load before shared.js so that `window.Toolbar` exists when `setTheme()` is first called, AND before plane.js so that `#toolbar-plane-slot` exists when `createToggleButton()` runs.

Insert `<script src="js/toolbar.js"></script>` immediately above the `shared.js` tag.

- [ ] **Step 3: Repeat for all four pages**

Apply identical changes to:
- `index.html`
- `casino_games.html`
- `my_games.html`
- `eve_of_destruction.html`

Do NOT modify `lost-satellite copy for games.html` (backup file).

- [ ] **Step 4: Final grep sweep — nothing should reference the old names**

```
Grep pattern: theme-switcher → expect only CLAUDE.md, the backup html, plans/*, and tests/* (audit each result)
Grep pattern: plane-toggle → expect only tests/* + plans/*
Grep pattern: themeSwitcher → expect only the backup html
Grep pattern: id="themeSwitcher" → expect only the backup html
```

If any live file still references the old names, stop and fix.

- [ ] **Step 5: Commit**

```
git add index.html casino_games.html my_games.html eve_of_destruction.html
git commit -m "html: remove theme-switcher button, load toolbar.js"
```

---

## Task 11: Verification — load + basic interaction

**Prerequisite:** start the dev server yourself.

- [ ] **Step 1: Ensure server is running**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080
```

If 000 / connection refused, start in the background:
```bash
npx http-server -p 8080 -c-1
```

- [ ] **Step 2: Manual smoke test via Playwright**

```bash
npx playwright-cli open http://localhost:8080/index.html
npx playwright-cli eval "() => document.querySelectorAll('.toolbar .swatch-btn').length"
# Expected: 5
npx playwright-cli eval "() => document.documentElement.getAttribute('data-theme')"
# Expected: whatever was in localStorage, default 'bold'
```

- [ ] **Step 3: Click each swatch in sequence, screenshot each**

```bash
for theme in bold brutalist retro cinematic neon; do
  npx playwright-cli eval "() => window.setTheme('$theme')"
  sleep 1
  npx playwright-cli screenshot --filename=toolbar-$theme.png
done
```

Open each screenshot visually. For each: toolbar pinned to right edge, vertically centred, five swatches visible, active swatch has accent ring, plane button visible below divider, theme-appropriate colours/radius/border.

- [ ] **Step 4: Hover preview test (desktop)**

```bash
npx playwright-cli eval "() => { const b = document.querySelector('.toolbar .swatch-btn:not(.active)'); b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); return document.querySelector('.toolbar .preview-panel').classList.contains('visible'); }"
# Expected: true
```

- [ ] **Step 5: Plane button test**

```bash
npx playwright-cli eval "() => document.querySelector('.toolbar .plane-btn').click()"
sleep 1
npx playwright-cli eval "() => document.documentElement.classList.contains('plane-active')"
# Expected: true
npx playwright-cli screenshot --filename=toolbar-plane-active.png
npx playwright-cli eval "() => document.querySelector('.toolbar .plane-btn').click()"
npx playwright-cli eval "() => document.documentElement.classList.contains('plane-active')"
# Expected: false
```

- [ ] **Step 6: Mobile viewport test**

```bash
# Playwright CLI doesn't set viewport on-the-fly; if needed write a tiny node script using
# playwright directly. For now, use browser devtools emulation via page.setViewportSize in a
# test file tests/toolbar-mobile-test.js if one is introduced.
```

For each mobile viewport (375x812, 812x375, 768x1024) manually:
- Toolbar is visible, does not overlap the card hand
- Swatch dots are smaller (18px)
- Plane button icon is 18px

- [ ] **Step 7: Reduced motion test**

```bash
# Emulate prefers-reduced-motion: reduce. Verify no transitions on toolbar/swatch/preview.
# Manual check — inspect computed style for .toolbar and confirm transition is 'none'.
```

- [ ] **Step 8: Accessibility spot-check**

```bash
npx playwright-cli eval "() => ({
  role: document.querySelector('.toolbar').getAttribute('role'),
  label: document.querySelector('.toolbar').getAttribute('aria-label'),
  swatchLabels: Array.from(document.querySelectorAll('.toolbar .swatch-btn')).map(b => b.getAttribute('aria-label')),
  planeLabel: document.querySelector('.toolbar .plane-btn').getAttribute('aria-label'),
  planePressed: document.querySelector('.toolbar .plane-btn').getAttribute('aria-pressed')
})"
```
Expected: `role: "toolbar"`, `label: "Site controls"`, five labels of the form "Switch to Foo theme", plane label "Toggle paper plane overlay", plane pressed "true"/"false".

- [ ] **Step 9: Keyboard navigation**

Tab into the toolbar, confirm each swatch and the plane button receive focus in DOM order, Enter/Space activates each. If focus outlines are invisible in some themes, add `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` on `.toolbar .swatch-btn, .toolbar .plane-btn` in shared.css.

- [ ] **Step 10: Cross-page test**

Navigate from `index.html` via a card drag to `casino_games.html`. Confirm:
- Toolbar is still visible and functional on project page
- `setTheme('retro')` on project page switches theme without errors
- Plane button on project page still toggles plane overlay
- Page transition still runs (page-transition.js's toolbar exclusion works)

Repeat from index → `my_games.html` and index → `eve_of_destruction.html`.

- [ ] **Step 11: Console clean**

Open devtools console on each page; zero errors or warnings (aside from pre-existing unrelated messages).

- [ ] **Step 12: Delete screenshot files**

```bash
rm toolbar-*.png
```

- [ ] **Step 13: Commit if any follow-ups needed**

Only if Step 9 or 11 turned up small CSS/JS fixes, commit them:
```
git add -p
git commit -m "fix: toolbar verification follow-ups"
```

---

## Task 12: Delete the prototype + update CLAUDE.md

**Files:**
- Delete: `toolbar-variation-d.html`
- Modify: `CLAUDE.md`, `css/CLAUDE.md`, `js/CLAUDE.md`

- [ ] **Step 1: Delete the prototype**

```bash
rm toolbar-variation-d.html
```

- [ ] **Step 2: Update root `CLAUDE.md`**

Find the `- **Attractor (drag-me hint)**:` bullet — it describes the **card-hand** attractor and stays. But any reference to the **plane-toggle** attractor must be removed. Grep CLAUDE.md for `plane-attractor` / `plane-toggle` / `theme-switcher`.

- [ ] **Step 3: Update `css/CLAUDE.md`**

Remove table rows / bullets for:
- `.theme-switcher` (line 53 reference)
- `.plane-toggle` (line 83 reference)
- Responsive `plane-toggle` mentions

Add a one-line entry for the new `.toolbar` section.

- [ ] **Step 4: Update `js/CLAUDE.md`**

- Under `plane.js`: remove mentions of `startBounce/stopBounce/triggerBounce`, update "Toggle button UI" section, remove attractor-related lines.
- Under `shared.js`: replace the cycling-handler description with the new `setTheme(name)` function signature and `window.setTheme` export.
- Add a new `toolbar.js` section in the dependency graph and section map with constants table + API (`window.Toolbar.syncActive`).

- [ ] **Step 5: Commit**

```
git add CLAUDE.md css/CLAUDE.md js/CLAUDE.md
git rm toolbar-variation-d.html
git commit -m "docs: update CLAUDE.md for toolbar; remove prototype"
```

---

## Self-Review Checklist (run before handing off)

- [ ] Every spec requirement mapped to a task? (HTML ✓ T10, CSS base ✓ T3, CSS per-theme ✓ T4, CSS deletion ✓ T9, JS direct-select ✓ T5/T6, JS hover-preview desktop-only ✓ T5, JS plane unchanged ✓ T7 retains toggle(), attractor retired ✓ T7, mobile ✓ T3 Step 1 responsive block, a11y ✓ T5 + T11 Step 8, grep sweep ✓ T1 + T10 Step 4, verification ✓ T11)
- [ ] No placeholders / TODO / "similar to" without code
- [ ] File paths exact, line numbers verified against current shared.css (≈2576 lines) — if the file has shifted since this plan was written, re-grep
- [ ] Type/name consistency: `window.setTheme`, `window.Toolbar.syncActive`, `#toolbar`, `#toolbar-plane-slot`, `.plane-btn`, `.swatch-btn`, `data-theme-id` — all used consistently across tasks
- [ ] Grep pre-check done in T1, grep post-check done in T9 Step 10 and T10 Step 4
- [ ] Don't touch: card-hand attractor, plane overlay logic, destruction system internals, text-rearrange
- [ ] "No hardcoded hex in element CSS" respected via `--theme-*-accent` constants (T2). The PREVIEW object in toolbar.js is JS data, not element CSS; the prototype pattern is preserved but flagged in T5 comment.
