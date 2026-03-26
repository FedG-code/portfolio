# Phase 3: JS & Cleanup

## Context

This is Phase 3 of a 4-phase theme overhaul. Phase 1 (CSS) and Phase 2 (HTML) are complete. All 5 theme CSS blocks are in place, index.html has correct fonts, data-theme="bold", brutalist/retro layouts, and nav removed.

This phase updates the JavaScript — theme switcher array, localStorage migration, nav JS removal, and destruction.js selectors. Also updates CLAUDE.md documentation.

**Read `CLAUDE.md` first** for project conventions.

## Workflow

All 4 phases run on branch `feature/new-themes` in the main repo. Do **not** merge to master until Phase 4 is completed and approved. Commit after each phase, but stay on the same branch. Do **not** use worktrees.

**Prerequisites**: Phase 1 and Phase 2 must be complete.

---

## Step 1: Update theme switcher in `js/shared.js`

### 1a: Update themes array (line 16)
```js
// FROM
const themes = ['coral', 'slate', 'neon'];
// TO
const themes = ['bold', 'cinematic', 'brutalist', 'retro', 'neon'];
```

### 1b: Update default fallback (line 17)
```js
// FROM
let currentIndex = themes.indexOf(document.documentElement.getAttribute('data-theme') || 'coral');
// TO
let currentIndex = themes.indexOf(document.documentElement.getAttribute('data-theme') || 'bold');
```

### 1c: Add localStorage migration

Add right after the `currentIndex` line (before the `updateLabel` function):
```js
// Migrate removed themes
(function() {
  var stored = localStorage.getItem('portfolio-theme');
  if (stored === 'coral' || stored === 'slate') {
    localStorage.setItem('portfolio-theme', 'bold');
    document.documentElement.setAttribute('data-theme', 'bold');
    currentIndex = 0;
  }
})();
```

### 1d: Remove mobile auto-hide nav IIFE

Delete the entire IIFE at lines 37-86 (the `(function () { var nav = document.querySelector('nav'); ...` block). This code references `document.querySelector('nav')` which no longer exists in the HTML.

The theme switcher and plane toggle don't need scroll-hide behavior — they're small fixed buttons. If desired later it can be re-added.

**After this step, `shared.js` should be roughly 35 lines** (scroll reveal + theme switcher, no nav code).

---

## Step 2: Update `js/destruction.js` selectors

### 2a: Expand DESTRUCTIBLE_SELECTOR (lines 28-42)

The current selector list targets standard page elements. Add brutalist and retro elements so text destruction works on the alternate layouts too.

```js
// FROM
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

// TO
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
  'footer span',
  // Brutalist layout elements
  '.field-value', '.field-label',
  '.about-header', '.skills-mono',
  '.data-row-value', '.data-row-label',
  // Retro panel elements
  '.hero-panel .tidbit-value', '.hero-panel .tidbit-label'
].join(', ');
```

**Why this works**: The `splitAllText()` function (line 50) already checks `if (el.offsetParent === null) return;` — this skips hidden elements. So brutalist elements are only split when brutalist is active (`.hero-brutalist` is `display: none` otherwise). The `TextDestruction.onThemeChange()` callback reverts all splits and re-splits, correctly picking up newly visible elements.

### 2b: Update exclusion check (line 55)

Remove `nav` from the closest check since nav no longer exists:
```js
// FROM
if (el.closest('nav, .theme-switcher, .plane-toggle, .btn, .work-expand')) return;
// TO
if (el.closest('.theme-switcher, .plane-toggle, .btn, .work-expand')) return;
```

---

## Step 3: Update CLAUDE.md

Update the theme system documentation in CLAUDE.md. Find the theme-related sections and update:

### Theme system description
Change:
- Three themes → Five themes
- `coral → slate → neon → coral` → `bold → cinematic → brutalist → retro → neon → bold`
- `data-theme` attribute: default is now `bold` (was `coral`)
- `js/shared.js` has `const themes = ['bold', 'cinematic', 'brutalist', 'retro', 'neon']`

### Theme design notes
Replace the coral, slate, neon descriptions with:
- **bold** (default): Warm light theme. Full-width fixed nav (if re-enabled). Archivo Black headings, Archivo body, IBM Plex Mono labels. Orange accent (#FF6123). Sharp corners (0px radius). Dark about section, orange contact section. Hero accent circle.
- **cinematic**: Dark tech-noir theme. Syne headings, system body, Commit Mono labels. Red accent (#D6001C). Scanline overlay in hero, red glow, film grain on body. Sharp corners.
- **brutalist**: Typographic grid theme. Space Mono headings, Literata body. Electric blue accent (#0038FF). Status bar below nav. 2-column hero grid, data-row about section. Heavy black borders (2px). Uses alternate HTML layouts (.hero-brutalist, .about-brutalist).
- **retro**: 1970s warm theme. Shrikhand headings, Bitter body, IBM Plex Mono labels. Red accent (#D94230) + mustard secondary (#E8A825). Split hero with teal panel. Deep teal about section. Rounded corners (10px). Uses .hero-panel HTML element.
- **neon** (unchanged): Dark techy theme. Sora headings/body, Space Mono labels. Lime green accent (#c9f059). Grid pattern in hero. Grain overlay. Sharp corners.

### Fonts section
Update the Google Fonts description:
- Bold: Archivo Black, Archivo, IBM Plex Mono
- Cinematic: Syne, Commit Mono
- Brutalist: Space Mono, Literata
- Retro: Shrikhand, Bitter, IBM Plex Mono
- Neon: Sora, Space Mono

### Key Details - Persistence
Update the inline `<script>` description to note it also migrates stored `coral`/`slate` values to `bold`.

### Structure section
Note the new HTML elements:
- `.hero-default` / `.hero-brutalist` — dual-layout hero (brutalist has alternate grid)
- `.about-default` / `.about-brutalist` — dual-layout about (brutalist has data rows)
- `.hero-panel` — retro teal panel (right side of split hero)
- `.status-bar` — brutalist status bar (hidden by default)

### Nav
Note that nav has been removed from all pages. Navigation is handled by the card-hand system only. Nav CSS is archived in `backup/nav-styles.css`.

---

## Step 4: Clean up theme-update files

The `theme-update/` directory contains the source theme files that have now been integrated. Move it to backup:
```bash
mv theme-update backup/theme-update
```

Or if the user prefers, delete it:
```bash
rm -rf theme-update
```

Ask the user which they prefer before acting.

---

## Verification

1. Start local server if not running: `npx http-server -p 8080 -c-1`
2. Open `http://localhost:8080/index.html`

### Theme switcher:
- [ ] Click theme switcher button — cycles through: bold → cinematic → brutalist → retro → neon → bold
- [ ] Button label shows the NEXT theme name at each step
- [ ] Theme changes are visually correct for each theme

### localStorage:
- [ ] Switch to "retro", reload page — retro persists
- [ ] Open devtools → Application → Local Storage → set `portfolio-theme` to `coral` → reload → page loads as bold (migration worked)
- [ ] Same test with `slate` → migrates to bold

### Text destruction:
- [ ] Activate plane mode, fire at text — shatters and reforms
- [ ] Switch to brutalist — fire at the 2-column hero text (h1, hero-desc, field-values) — they shatter
- [ ] Switch to retro — fire at hero-panel tidbit text — it shatters
- [ ] Switch from brutalist to bold — hero text is intact (no broken splits)

### Card hand:
- [ ] Cards render correctly at bottom of viewport on all 5 themes
- [ ] Drag a card — proximity glow works
- [ ] Play a card — page transition animation works

### Console:
- [ ] No JavaScript errors in console on any theme
- [ ] No warnings about missing elements

## What NOT to change in this phase
- Do NOT modify project pages (logifuture.html etc — that's Phase 4)
- Do NOT modify CSS files (Phase 1 handled all CSS)
- Do NOT modify index.html (Phase 2 handled all HTML)
