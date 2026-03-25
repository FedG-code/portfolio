# Phase 1: CSS Integration

## Context

This is Phase 1 of a 4-phase theme overhaul. The portfolio currently has 3 themes (coral, slate, neon). We're replacing them with 5: **bold** (new default), **cinematic**, **brutalist**, **retro**, and **neon** (kept). This phase handles all CSS changes — archiving old themes, replacing `:root`, removing nav CSS, and appending 4 new theme blocks.

After this phase the CSS structure will be correct, but the site won't render perfectly yet because fonts and HTML haven't been updated (that's Phase 2).

**Read `CLAUDE.md` first** for project conventions and serving instructions.

---

## Step 1: Create `backup/` directory and archive coral + slate + nav CSS

Create `backup/` in the project root.

### `backup/theme-coral.css`
Extract from `css/shared.css` lines 3-26 (the `:root { ... }` block). This IS the coral theme — coral has no component overrides. Add a comment header:
```css
/* Archived coral theme — was the :root default. Removed 2026-03-25. */
```

### `backup/theme-slate.css`
Extract and combine into one file:
- From `css/shared.css` lines 28-47: the `[data-theme="slate"]` variable block + `.btn` hover overrides
- From `css/cards.css` lines 271-293: all `[data-theme="slate"]` blocks
- From `css/project.css` lines 117-119: all `[data-theme="slate"]` blocks

Add a comment header:
```css
/* Archived slate theme — removed 2026-03-25. Contains shared.css, cards.css, and project.css blocks. */
```

### `backup/nav-styles.css`
Extract and combine:
- From `css/shared.css` lines 171-217: base nav styles (`/* ========== NAV ========== */` through `.nav-links a:hover`)
- From `css/shared.css` lines 828-886: neon nav overrides (`[data-theme="neon"] nav` through `[data-theme="neon"] .nav-links a:hover::after`)
- From `css/shared.css` line 1011-1012: mobile `.nav-links { display: none }` and `nav { padding: ... }`
- From `css/shared.css` lines 1014-1018: mobile `[data-theme="neon"] nav` block
- The `nav.scroll-hidden` portion from line 1013

Add a comment header:
```css
/* Archived nav styles — removed 2026-03-25. Nav replaced by card-hand navigation. */
```

---

## Step 2: Replace `:root` with bold's variables

In `css/shared.css`, replace lines 3-26 (the current `:root` block) with:

```css
:root {
  --bg: #FAFAF7;
  --bg-warm: #F0EDE5;
  --bg-card: #FFFFFF;
  --border: #E0DCD4;
  --border-hover: #C8C3B8;
  --text-primary: #1A1714;
  --text-secondary: #7A7570;
  --text-muted: #9A9590;
  --accent: #FF6123;
  --accent-soft: rgba(255, 97, 35, 0.10);
  --accent-mid: rgba(255, 97, 35, 0.30);
  --pop: #FF6123;
  --pop-soft: rgba(255, 97, 35, 0.08);
  --cream: #FAFAF7;
  --accent-glow: rgba(255, 97, 35, 0.25);
  --font-serif: 'Archivo Black', sans-serif;
  --font-body: 'Archivo', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --radius: 0px;
  --radius-sm: 0px;
}
```

**Important**: Keep `--ease-out` and `--ease-spring` — they're global and don't change per theme.

---

## Step 3: Remove slate from all CSS files

### `css/shared.css`
Delete lines 28-47 (the `[data-theme="slate"]` variable block + the two `.btn` hover overrides). After step 2 these will be right after the new `:root` closing brace.

### `css/cards.css`
Delete lines 271-293 (all `[data-theme="slate"]` blocks — card-inner, art-inner gradients, card-inner--home, type-bar, accent-strips).

### `css/project.css`
Delete lines 117-119 (the three `[data-theme="slate"] .work-image-placeholder` rules).

---

## Step 4: Remove ALL nav CSS from `css/shared.css`

**Do these deletions bottom-to-top to avoid line number shifts:**

1. **Lines 1014-1018**: Mobile `[data-theme="neon"] nav` block (inside the `@media (max-width: 600px)` block)
2. **Line 1013**: Remove `nav.scroll-hidden,` from the selector (keep `.theme-switcher.scroll-hidden, .plane-toggle.scroll-hidden` part)
3. **Lines 1011-1012**: `.nav-links { display: none; }` and `nav { padding: 0.6rem 1.25rem; }`
4. **Lines 828-886**: The entire neon nav section (from `[data-theme="neon"] nav {` through `[data-theme="neon"] .nav-links a:hover::after { width: 100%; }`)
5. **Lines 171-217**: The base `/* ========== NAV ========== */` section (from `nav {` through `.nav-links a:hover { ... }`)
6. **Line 70**: Remove `nav,` from the transition selector. Change:
   ```css
   body, nav, .work-card, .approach-card, .about-box, .tidbit, .chip, .btn, footer {
   ```
   to:
   ```css
   body, .work-card, .approach-card, .about-box, .tidbit, .chip, .btn, footer {
   ```

---

## Step 5: Add base visibility toggles

Add these rules to `css/shared.css` somewhere after the hero section CSS and before any theme-specific override blocks. A good location is right after the `/* ========== HERO ========== */` section ends (before `/* ========== NEON THEME OVERRIDES ========== */`):

```css
/* ========== THEME LAYOUT TOGGLES ========== */
.status-bar { display: none; }
.hero-brutalist { display: none; }
.about-brutalist { display: none; }
.hero-panel { display: none; }
.hero-default { display: block; }
.about-default { display: block; }
.teal { color: inherit; }
```

---

## Step 6: Append new theme CSS blocks

### 6a: `css/shared.css` — append after the neon section (after its last mobile media query)

For each theme file, **skip** the variable block and all nav selectors, then append everything else.

#### Bold (`theme-update/bold-theme-shared.css`)
- **Skip** lines 1-28 (variable block — now in `:root`)
- **Skip** lines 30-72 (nav selectors)
- **Include** lines 74-347 (hero, doodle, about, contact, footer, buttons, chips, etc.)
- **Skip** lines 349-354 (mobile nav block inside `@media (max-width: 600px)`)
- **Include** lines 355-365 (theme-switcher and hero::after mobile rules)
- **Skip** lines 367-385 (NOTES comment block)
- Wrap the mobile rules in their own `@media` block if they lose their enclosing one

**Important**: The `@media (max-width: 600px)` block at line 349 contains BOTH nav rules (skip) AND theme-switcher + hero rules (keep). Extract just the non-nav rules.

#### Cinematic (`theme-update/cinematic-theme-shared.css`)
- **Skip** lines 1-24 (variable block)
- **Skip** lines 26-70 (nav selectors)
- **Include** lines 72-363 (hero, body grain, scanlines, glow, about, contact, etc.)
- **Skip** lines 366-370 (mobile nav inside `@media (max-width: 600px)`)
- **Include** lines 371-373 (theme-switcher mobile rule)
- Close the media query properly

#### Brutalist (`theme-update/brutalist-theme-shared.css`)
- **Skip** lines 1-27 (variable block)
- **Skip** line 32 (`.status-bar { display: none; }` — already in base toggles from Step 5)
- **Include** lines 34-51 (status bar brutalist styles)
- **Skip** lines 53-97 (nav section)
- **Include** lines 99-547 (hero, about, contact, work cards, footer, responsive, etc.)
- **Skip** lines 550-553 (mobile nav inside `@media (max-width: 600px)`)
- **Include** lines 554-560 (status-bar mobile + theme-switcher mobile)
- Close the media query properly

#### Retro (`theme-update/retro-theme-shared.css`)
- **Skip** lines 1-29 (variable block)
- **Skip** lines 31-73 (nav section)
- **Include** lines 75-393 (hero, sections, about, contact, footer, responsive, etc.)
- **Skip** lines 396-400 (mobile nav inside `@media (max-width: 600px)`)
- **Include** lines 401-403 (theme-switcher mobile rule)
- Close the media query properly

### 6b: `css/cards.css` — append after the neon section

Append these files in full (they contain no nav selectors):
1. `theme-update/bold-theme-cards.css` (124 lines)
2. `theme-update/cinematic-theme-cards.css` (124 lines)
3. `theme-update/brutalist-theme-cards.css` (125 lines)
4. `theme-update/retro-theme-cards.css` (155 lines)

### 6c: `css/project.css` — append after the neon section

Append these files in full:
1. `theme-update/bold-theme-project.css` (41 lines)
2. `theme-update/cinematic-theme-project.css` (39 lines)
3. `theme-update/brutalist-theme-project.css` (39 lines)
4. `theme-update/retro-theme-project.css` (43 lines)

---

## Step 7: Write retro hero-panel CSS

The retro theme CSS hides `.hero-tidbits` (line 155-157 of retro-theme-shared.css) expecting a `.hero-panel` to replace them, but the actual `.hero-panel` styling is only a comment block (lines 164-190). Add this CSS to the retro section in shared.css:

```css
/* Retro teal panel — right side of split hero */
[data-theme="retro"] .hero-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.5rem;
  background: #1A5C52;
  padding: 2rem clamp(1.5rem, 5vw, 2.5rem);
  color: #F0EBE0;
}

[data-theme="retro"] .hero-panel .tidbit {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
}

[data-theme="retro"] .hero-panel .tidbit-label {
  color: #E8A825;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

[data-theme="retro"] .hero-panel .tidbit-value {
  color: #F0EBE0;
  font-family: 'Shrikhand', cursive;
  font-weight: 400;
  font-size: 1rem;
}
```

Also add responsive collapse:
```css
@media (max-width: 900px) {
  [data-theme="retro"] .hero-panel {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 1rem;
  }
}
```

---

## Verification

1. Check if server is already running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080`
2. If not, start: `npx http-server -p 8080 -c-1` (background)
3. Open `http://localhost:8080/index.html` in a browser
4. In devtools, set `document.documentElement.setAttribute('data-theme', 'bold')` — check page renders without CSS errors
5. Set `data-theme="neon"` — verify neon still works unchanged (lime green, dark, grid pattern)
6. Set `data-theme="cinematic"` — should see dark background, red variables
7. Set `data-theme="brutalist"` — should see beige/black variables
8. Set `data-theme="retro"` — should see cream/teal variables
9. Check browser console for CSS parse errors
10. **Note**: Full visual verification happens in Phase 2 after fonts + HTML are updated

## What NOT to change in this phase
- Do NOT modify `index.html` or any HTML files
- Do NOT modify `js/shared.js` or any JS files
- Do NOT change the theme switcher or localStorage
