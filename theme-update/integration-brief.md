# Theme Integration Brief

> **For the Claude Code session** that merges all 4 new themes into the live site. This document covers everything: what to add, what to remove, what to archive, and what to verify.

---

## Overview

The portfolio currently has 3 themes: **coral** (`:root` default), **slate**, and **neon**. After integration:

- **coral** and **slate** are removed (archived to `backup/`)
- **bold** becomes the new `:root` default
- **neon** stays (existing, no changes)
- **cinematic**, **brutalist**, and **retro** are added

Theme cycle order: **bold** → cinematic → brutalist → retro → neon → bold

---

## Files You Have

### Current site files (the codebase you're editing):
- `index.html` — main page
- `logifuture.html` — project page (and any other project pages)
- `css/shared.css` — theme variables + all page styles
- `css/cards.css` — card hand styles
- `css/project.css` — project page styles
- `js/shared.js` — theme switcher logic
- `js/card-hand.js` — card system

### Theme CSS to integrate (one set per theme):
- `bold-theme-shared.css`, `bold-theme-cards.css`, `bold-theme-project.css`
- `cinematic-theme-shared.css`, `cinematic-theme-cards.css`, `cinematic-theme-project.css`
- `brutalist-theme-shared.css`, `brutalist-theme-cards.css`, `brutalist-theme-project.css`
- `retro-theme-shared.css`, `retro-theme-cards.css`, `retro-theme-project.css`

### Theme notes (decisions, audits, things to verify):
- `bold-theme-notes.md`
- `cinematic-theme-notes.md`
- `brutalist-theme-notes.md`
- `retro-theme-notes.md`

### Visual references (for verification, don't integrate these):
- `*-index-preview.html` — standalone page previews
- `*-card-mockup.html` — standalone card mockups

---

## Step 1: Archive Coral & Slate

Before removing anything, copy the current coral and slate theme CSS to a backup folder.

### What to extract for `backup/`:

**`backup/theme-coral.css`** — Extract from `shared.css`:
- The `:root { ... }` block (lines 2–26 of current shared.css) — this IS the coral theme
- Any coral-specific component overrides (there are none — coral is just `:root`)

**`backup/theme-slate.css`** — Extract from `shared.css`:
- The `[data-theme="slate"] { ... }` variable block
- The two `[data-theme="slate"] .btn` hover overrides

Also extract from `cards.css`:
- All `[data-theme="slate"]` blocks (card inner, art backgrounds, type bar, accent strips)

Also extract from `project.css`:
- All `[data-theme="slate"]` blocks (image placeholders)

**Recommendation:** Create two self-contained CSS files in `backup/` that contain all the relevant CSS for each removed theme, with a comment header noting when they were archived and why. This way they can be re-added later if needed.

---

## Step 2: Update `:root` to Bold

Replace the current `:root` variables in `shared.css` with Bold's values. Bold becomes the default theme — what loads when no `data-theme` attribute is set or when `data-theme="bold"` is set.

### Current `:root` (coral — remove):
```css
:root {
  --bg: #f5f0e8;
  --bg-warm: #ebe5d9;
  /* ... coral values ... */
  --font-serif: 'Instrument Serif', Georgia, serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

### New `:root` (bold):
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

**Important:** Keep `--ease-out` and `--ease-spring` in `:root` — they're used globally and don't change per theme.

Since Bold is now `:root`, you still need the `[data-theme="bold"]` overrides from `bold-theme-shared.css` for the **component-level** changes (nav, hero, about dark zone, contact orange zone, buttons, etc). The variable block can be removed from `bold-theme-shared.css` since `:root` handles it, but all the `[data-theme="bold"]` component overrides must stay.

**Decision:** Either keep `[data-theme="bold"]` selectors for component overrides (cleaner — they only apply when explicitly set), OR convert them to un-scoped base styles. The `[data-theme="bold"]` approach is safer since it doesn't risk breaking other themes. Just make sure `index.html` starts with `data-theme="bold"`.

---

## Step 3: Remove Slate

Delete from `shared.css`:
- `[data-theme="slate"] { ... }` variable block
- `[data-theme="slate"] .btn:hover` and `.btn.primary:hover` overrides

Delete from `cards.css`:
- All `[data-theme="slate"]` blocks

Delete from `project.css`:
- All `[data-theme="slate"]` blocks

---

## Step 4: Add New Theme CSS

Append each theme's CSS to the appropriate file:

### shared.css
Append in order after the `[data-theme="neon"]` section:
1. Bold component overrides (from `bold-theme-shared.css` — skip the variable block since it's now in `:root`)
2. Cinematic (from `cinematic-theme-shared.css`)
3. Brutalist (from `brutalist-theme-shared.css`)
4. Retro (from `retro-theme-shared.css`)

### cards.css
Append after the `[data-theme="neon"]` section:
1. Bold (from `bold-theme-cards.css`)
2. Cinematic (from `cinematic-theme-cards.css`)
3. Brutalist (from `brutalist-theme-cards.css`)
4. Retro (from `retro-theme-cards.css`)

### project.css
Append after the `[data-theme="neon"]` section:
1. Bold (from `bold-theme-project.css`)
2. Cinematic (from `cinematic-theme-project.css`)
3. Brutalist (from `brutalist-theme-project.css`)
4. Retro (from `retro-theme-project.css`)

---

## Step 5: Google Fonts

Replace the current font imports in `index.html` `<head>` (and `logifuture.html` and any other HTML files):

### Current (remove):
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

### New (add all — each theme needs its fonts):
```html
<!-- Bold (default) -->
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<!-- Cinematic -->
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Commit+Mono:wght@400;500&display=swap" rel="stylesheet">
<!-- Brutalist -->
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,700;1,7..72,400&display=swap" rel="stylesheet">
<!-- Retro -->
<link href="https://fonts.googleapis.com/css2?family=Shrikhand&family=Bitter:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap" rel="stylesheet">
<!-- Neon (already loaded — keep existing) -->
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
```

**Note:** Space Mono appears in both Brutalist and Neon. The imports can be combined or left separate — the browser deduplicates.

**Remove** the DM Sans + Instrument Serif + JetBrains Mono import — those were coral/slate fonts no longer used.

---

## Step 6: HTML Changes

### 6a. Default theme attribute

Change `index.html`:
```html
<!-- FROM -->
<html lang="en" data-theme="coral">
<!-- TO -->
<html lang="en" data-theme="bold">
```

Same for `logifuture.html` and any other HTML files.

Also update the localStorage init script:
```html
<script>
  var t = localStorage.getItem('portfolio-theme');
  if (t) document.documentElement.setAttribute('data-theme', t);
</script>
```
This stays the same — it'll just load `bold` as default now.

### 6b. Brutalist HTML additions

**Status bar** — add after `</nav>`, before the theme switcher button:
```html
<div class="status-bar" id="statusBar">
  <span>STATUS: OPEN TO OPPORTUNITIES</span>
  <span>LONDON, UK · 2026</span>
</div>
```

Hidden by default (`display: none` in base CSS), shown only for brutalist.

**Brutalist hero layout** — add inside `.hero` section, as a sibling to the existing `.container`:
See `brutalist-theme-notes.md` section "2. Hero Section" for the full HTML block. The existing hero `.container` gets wrapped in a `.hero-default` div. The new `.hero-brutalist` div sits alongside it. CSS toggles visibility based on theme.

**Brutalist about layout** — add inside `#about` section:
See `brutalist-theme-notes.md` section "3. About Section" for the full HTML block. Same dual-layout pattern: `.about-default` wraps existing content, `.about-brutalist` sits alongside.

Add base CSS to `shared.css` (outside any theme scope):
```css
.status-bar { display: none; }
.hero-brutalist { display: none; }
.about-brutalist { display: none; }
.hero-default { display: block; }
.about-default { display: block; }
```

### 6c. Retro HTML additions

**Hero panel** — The retro theme's split hero (cream left / teal right) needs a `.hero-panel` div inside `.hero`, as a sibling to `.container`. See the retro index preview for the structure.

However, `retro-theme-shared.css` includes a **CSS-only fallback** (commented out) that styles the existing tidbits as teal cards without any HTML changes. This is simpler.

**Recommendation:** Start with the CSS-only fallback. The tidbits become teal-background cards. If it looks good enough, skip the HTML change. If the split panel is essential, add the HTML later.

To use the fallback, in `retro-theme-shared.css`:
- Remove `[data-theme="retro"] .hero-tidbits { display: none; }` 
- Uncomment the fallback block
- Remove or comment out the hero grid override (`grid-template-columns: 1fr 340px`)

### 6d. Contact heading span

The retro theme uses `<span class="teal">Get in touch.</span>` in the contact heading. The current HTML has the heading as plain text. Either:
- Add the span to the HTML (affects all themes — other themes would need to style `.teal` or ignore it)
- Use a retro-specific `::after` approach
- Or just let it be un-teal-colored for retro and live with it

**Simplest:** Add the span, make `.teal` color transparent/inherit by default, override for retro:
```css
.contact-heading .teal { color: inherit; }
[data-theme="retro"] .contact-heading .teal { color: #1A5C52; }
```

---

## Step 7: Theme Switcher

Update `js/shared.js` — find the themes array and replace:

```js
// FROM
const themes = ['coral', 'slate', 'neon'];

// TO  
const themes = ['bold', 'cinematic', 'brutalist', 'retro', 'neon'];
```

The switcher button label should show the NEXT theme name (what you'll switch to), matching the current pattern.

Also clear any stored 'coral' or 'slate' values:
```js
// Add near the top of the theme init
var t = localStorage.getItem('portfolio-theme');
if (t === 'coral' || t === 'slate') {
  t = 'bold';
  localStorage.setItem('portfolio-theme', 'bold');
}
```

---

## Step 8: Verify

After integration, check each theme:

### All themes:
- [ ] Theme switcher cycles through all 5 in order
- [ ] Card hand renders correctly (drag, hover, play)
- [ ] Cards look correct on both light and dark page sections
- [ ] Font loading — no flash of unstyled text
- [ ] Mobile responsive (≤600px nav, ≤900px grids)
- [ ] Project pages (logifuture.html etc) inherit theme correctly

### Bold (default):
- [ ] Hero accent circle visible, clipped at right edge
- [ ] About section has dark `#1A1714` background
- [ ] Contact section has orange `#FF6123` background
- [ ] Orange contact bg extends through `padding-bottom: 220px`

### Cinematic:
- [ ] Scanline overlay visible on hero
- [ ] Red glow visible (subtle) behind hero heading
- [ ] Film grain overlay visible (very subtle)
- [ ] Cards have red top glow line

### Brutalist:
- [ ] Status bar visible below nav (blue)
- [ ] Hero shows 2-column grid with visible divider
- [ ] About shows header bar + data rows (not the default about boxes)
- [ ] Adjacent contact buttons share borders
- [ ] Skills show as `JavaScript / C# / C++` with slashes

### Retro:
- [ ] Teal nav or tidbits-as-teal-cards (depending on approach chosen)
- [ ] "Never" has mustard underline
- [ ] About section is deep teal `#0F3E37`
- [ ] Mustard-bordered sidebar cards in about
- [ ] Footer is teal
- [ ] Shrikhand renders (chunky display font)

### Neon (unchanged):
- [ ] Still works exactly as before
- [ ] Lime green accent, dark bg, grid pattern
- [ ] No visual regressions

---

## File Reference Summary

| What | Where it goes |
|------|--------------|
| Coral theme CSS | `backup/theme-coral.css` |
| Slate theme CSS | `backup/theme-slate.css` |
| Bold variables | `:root` in `shared.css` |
| Bold component CSS | `[data-theme="bold"]` blocks in shared/cards/project.css |
| Cinematic CSS | `[data-theme="cinematic"]` blocks in shared/cards/project.css |
| Brutalist CSS | `[data-theme="brutalist"]` blocks in shared/cards/project.css |
| Retro CSS | `[data-theme="retro"]` blocks in shared/cards/project.css |
| Status bar HTML | `index.html` (after nav) |
| Brutalist dual layouts | `index.html` (hero + about sections) |
| Theme switcher array | `js/shared.js` |
| Font imports | `<head>` of all HTML files |
