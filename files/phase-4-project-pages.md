# Phase 4: Project Pages

## Context

This is Phase 4 (final) of a 4-phase theme overhaul. Phases 1-3 are complete — all CSS, index.html HTML, and JS have been updated. The 5-theme system (bold, cinematic, brutalist, retro, neon) is fully working on the index page.

This phase applies the same HTML-level changes to the three project pages: `logifuture.html`, `coffin-likker.html`, and `lost-satellite.html`.

**Read `CLAUDE.md` first** for project conventions.

**Prerequisites**: Phases 1, 2, and 3 must all be complete.

---

## Changes for each project page

Apply these changes to ALL three files:
- `logifuture.html`
- `coffin-likker.html`
- `lost-satellite.html`

### 1. Change data-theme attribute

```html
<!-- FROM -->
<html lang="en" data-theme="coral">
<!-- TO -->
<html lang="en" data-theme="bold">
```

### 2. Update Google Fonts

Find the Google Fonts `<link>` tags in `<head>`. Replace the DM Sans / Instrument Serif / JetBrains Mono link with the 4 new font links:

```html
<!-- Bold (default) -->
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<!-- Cinematic -->
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Commit+Mono:wght@400;500&display=swap" rel="stylesheet">
<!-- Brutalist -->
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,700;1,7..72,400&display=swap" rel="stylesheet">
<!-- Retro -->
<link href="https://fonts.googleapis.com/css2?family=Shrikhand&family=Bitter:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap" rel="stylesheet">
```

**Keep** the Sora + Space Mono link (neon fonts) unchanged.

### 3. Update localStorage inline script

Replace the inline `<script>` in `<head>` with the migration version:

```html
<script>
  var t = localStorage.getItem('portfolio-theme');
  if (t === 'coral' || t === 'slate') { t = 'bold'; localStorage.setItem('portfolio-theme', 'bold'); }
  if (t) document.documentElement.setAttribute('data-theme', t);
</script>
```

### 4. Remove `<nav>` element

Each project page has a `<nav>` block — delete it entirely. The project pages also have a `.project-nav` element (back link + theme indicator) which is **separate** from `<nav>` and must be **kept**.

Look for something like:
```html
<nav>
  <div class="container nav-inner">
    <a href="index.html" class="nav-logo">Federico</a>
    <ul class="nav-links">
      <li><a href="index.html#work">Work</a></li>
      <li><a href="index.html#about">About</a></li>
      <li><a href="index.html#contact">Contact</a></li>
    </ul>
  </div>
</nav>
```

Delete the `<nav>...</nav>` block only. Keep `.project-nav`.

### 5. Update theme switcher button text

Change the button text:
```html
<!-- FROM -->
<button class="theme-switcher" id="themeSwitcher">Slate</button>
<!-- TO -->
<button class="theme-switcher" id="themeSwitcher">Cinematic</button>
```

### 6. NO brutalist/retro HTML additions needed

Project pages do **not** need the dual-layout hero/about, status bar, hero-panel, or contact .teal span. Those are index.html-only. The project-page CSS theme overrides (added in Phase 1 via `project.css`) handle visual styling only (colors, borders, fonts), not structural changes.

---

## Verification

1. Start local server if not running: `npx http-server -p 8080 -c-1`

### Per project page:

For each page (`logifuture.html`, `coffin-likker.html`, `lost-satellite.html`):

1. Open directly: `http://localhost:8080/<page>.html`
2. Cycle through all 5 themes via browser console:
   ```js
   document.documentElement.setAttribute('data-theme', 'bold')
   document.documentElement.setAttribute('data-theme', 'cinematic')
   document.documentElement.setAttribute('data-theme', 'brutalist')
   document.documentElement.setAttribute('data-theme', 'retro')
   document.documentElement.setAttribute('data-theme', 'neon')
   ```

Check for each theme:
- [ ] Correct fonts render (no fallback fonts visible)
- [ ] Colors/backgrounds match the theme
- [ ] Project hero, sections, image placeholders, stats all styled correctly
- [ ] Theme switcher button visible and clickable
- [ ] No nav element in the DOM

### SPA transitions:

From `http://localhost:8080/index.html`:
1. Drag a work card into the play zone
2. Verify the fly animation works (title clone flies to target position)
3. Verify the project page loads correctly in the SPA container
4. Switch themes on the loaded project page — should work
5. Test back navigation (if available) — should return to index

### Cross-page consistency:
- [ ] Setting a theme on index.html → navigating to a project page via SPA → theme persists
- [ ] Setting a theme on a project page → reload → theme persists (localStorage)
- [ ] Stored `coral` or `slate` migrates to `bold` on any page

### Screenshots (using CLAUDE.md approach):
Take screenshots of each project page with at least bold and neon themes to verify visuals. Remember to override `.reveal` class temporarily for below-fold content.

---

## Post-completion

After Phase 4 is verified, the full theme overhaul is complete. Consider:
- Running the performance test suite (`node tests/perf-test.js`) to check for regressions
- Running the destruction-specific tests (`node tests/perf-test-destruction.js`)
- Committing all changes with a descriptive message covering the full overhaul
- The `backup/` directory contains archived coral, slate, and nav CSS for potential future use
