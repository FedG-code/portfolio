# Phase 2: HTML & Font Changes

## Context

This is Phase 2 of a 4-phase theme overhaul. Phase 1 (CSS) has been completed — all 5 theme CSS blocks are now in `shared.css`, `cards.css`, and `project.css`. Coral and slate have been removed, bold is now `:root`.

This phase updates `index.html` with correct fonts, data-theme attribute, removes the nav, adds brutalist dual-layout HTML, retro hero panel, and other structural changes.

**Read `CLAUDE.md` first** for project conventions and serving instructions.

## Workflow

All 4 phases run on branch `feature/new-themes` in the main repo. Do **not** merge to master until Phase 4 is completed and approved. Commit after each phase, but stay on the same branch. Do **not** use worktrees.

**Prerequisite**: Phase 1 must be complete (bold `:root`, new theme CSS blocks appended, visibility toggles in place).

---

## Step 1: Update Google Fonts in `<head>`

In `index.html`, find the two Google Fonts `<link>` tags (currently lines 9-10):
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:...">
<link href="https://fonts.googleapis.com/css2?family=Sora:...&family=Space+Mono:...">
```

Replace line 9 (DM Sans / Instrument Serif / JetBrains Mono) with these 4 new links:
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

**Keep** line 10 (Sora + Space Mono for neon) unchanged.

---

## Step 2: Change default theme attribute

Line 2 of `index.html`:
```html
<!-- FROM -->
<html lang="en" data-theme="coral">
<!-- TO -->
<html lang="en" data-theme="bold">
```

---

## Step 3: Update localStorage inline script

Replace the inline `<script>` in `<head>` (currently around lines 14-17):
```html
<script>
  var t = localStorage.getItem('portfolio-theme');
  if (t === 'coral' || t === 'slate') { t = 'bold'; localStorage.setItem('portfolio-theme', 'bold'); }
  if (t) document.documentElement.setAttribute('data-theme', t);
</script>
```

---

## Step 4: Remove `<nav>` element

Delete the entire nav block (currently around lines 30-40):
```html
<!-- NAV (hidden for card-hand navigation) -->
<nav style="display: none;">
  <div class="container nav-inner">
    <a href="#" class="nav-logo">Federico</a>
    <ul class="nav-links">
      <li><a href="#work">Work</a></li>
      <li><a href="#about">About</a></li>
      <li><a href="#contact">Contact</a></li>
    </ul>
  </div>
</nav>
```

---

## Step 5: Add status bar HTML

After the theme switcher button (`<button class="theme-switcher" id="themeSwitcher">...</button>`), before `<div class="spa-page active" id="page-home">`, add:

```html
<!-- BRUTALIST STATUS BAR (hidden by default, shown for brutalist theme) -->
<div class="status-bar" id="statusBar">
  <span>STATUS: OPEN TO OPPORTUNITIES</span>
  <span>LONDON, UK &middot; 2026</span>
</div>
```

---

## Step 6: Update theme switcher button text

Change the theme switcher button text from "Slate" to "Cinematic" (the next theme after bold in the cycle):
```html
<button class="theme-switcher" id="themeSwitcher">Cinematic</button>
```

---

## Step 7: Brutalist dual-layout — Hero section

The hero section needs restructuring. The existing `.container` gets wrapped in `.hero-default`, and a `.hero-brutalist` sibling is added.

### Current hero structure (simplified):
```html
<section class="hero">
  <div class="doodle-circle doodle"></div>
  <div class="doodle-squiggle doodle"></div>
  <div class="container">
    <!-- badge, h1, hero-body with desc + tidbits -->
  </div>
</section>
```

### New hero structure:
```html
<section class="hero">
  <div class="doodle-circle doodle"></div>
  <div class="doodle-squiggle doodle"></div>

  <!-- Default layout (bold/cinematic/neon/retro) -->
  <div class="container hero-default">
    <div class="hero-badge">Open to opportunities</div>
    <h1>
      <span class="serif-line"><em>Never</em> shipped a</span>
      <span class="serif-line">bo<span class="kern-ri">r</span>ing product.</span>
    </h1>
    <div class="hero-body">
      <p class="hero-desc">
        Developer with three years of experience shipping a variety of web and gaming products.
        I have a passion for design and champion high standards of polish.
      </p>
      <div class="hero-tidbits">
        <div class="tidbit">
          <p class="tidbit-label">Based in</p>
          <p class="tidbit-value">London, UK</p>
        </div>
        <div class="tidbit">
          <p class="tidbit-label">Currently</p>
          <p class="tidbit-value">Logifuture</p>
        </div>
        <div class="tidbit">
          <p class="tidbit-label">Side project</p>
          <p class="tidbit-value">Coffin-Likker</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Brutalist layout (hidden by default, shown for brutalist theme) -->
  <div class="hero-brutalist">
    <div class="hero-main">
      <h1>
        <span class="serif-line">Never shipped a</span>
        <span class="serif-line">boring product.</span>
      </h1>
      <p class="hero-desc">
        Developer with three years of experience shipping a variety of web and gaming products.
        I have a passion for design and champion high standards of polish.
      </p>
    </div>
    <div class="hero-sidebar">
      <div>
        <div class="sidebar-field">
          <div class="field-label">Based in</div>
          <div class="field-value">London, UK</div>
        </div>
        <div class="sidebar-field">
          <div class="field-label">Currently</div>
          <div class="field-value">Logifuture</div>
        </div>
        <div class="sidebar-field">
          <div class="field-label">Side project</div>
          <div class="field-value">Coffin-Likker</div>
        </div>
      </div>
      <div>
        <div class="sidebar-field">
          <div class="field-label">Status</div>
          <div class="field-value field-value--accent">Available</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Retro teal panel (hidden by default, shown for retro theme) -->
  <div class="hero-panel">
    <div class="tidbit">
      <p class="tidbit-label">Based in</p>
      <p class="tidbit-value">London, UK</p>
    </div>
    <div class="tidbit">
      <p class="tidbit-label">Currently</p>
      <p class="tidbit-value">Logifuture</p>
    </div>
    <div class="tidbit">
      <p class="tidbit-label">Side project</p>
      <p class="tidbit-value">Coffin-Likker</p>
    </div>
  </div>
</section>
```

**Key change**: The existing `.container` class gains an additional `.hero-default` class. This preserves all existing CSS targeting `.container` while adding the toggle mechanism.

---

## Step 8: Brutalist dual-layout — About section

Same pattern for the about section. Wrap existing content in `.about-default`, add `.about-brutalist` sibling.

### Current about structure:
```html
<section id="about">
  <div class="container">
    <!-- section-label, section-heading, about-content -->
  </div>
</section>
```

### New about structure:
```html
<section id="about">
  <!-- Default layout (bold/cinematic/neon/retro) -->
  <div class="container about-default">
    <p class="section-label reveal">02 - About</p>
    <h2 class="section-heading reveal">A bit about me.</h2>
    <div class="about-content">
      <!-- existing about-prose and about-sidebar unchanged -->
    </div>
  </div>

  <!-- Brutalist layout (hidden by default) -->
  <div class="about-brutalist">
    <div class="about-header reveal">
      About
      <span>Background &amp; Skills</span>
    </div>
    <div class="about-grid">
      <div class="about-left reveal">
        <div class="about-prose">
          <p>
            I'm a <strong>design-minded developer</strong> with three years of experience
            across web applications and games. I like working in teams and take pride in the quality of my communication.
            I've been closely keeping up with how AI has been improving and constantly test new tools and methodologies.
            Fun fact: I built this whole website over the weekend, letting Claude handle the code whilst I focused on
            structure, content and visuals.
          </p>
          <p>
            Outside of work I chase my passions: I build games, I exercise and I do stand-up. I also
            <a href="https://medium.com/@federico.giovannini/how-to-rock-and-stone-your-way-to-a-more-positive-community-aa5a6cf99d05" target="_blank">interviewed Deep Rock Galactic's design director</a>
            about how the game was designed to foster positivity among players.
            How games shape behaviour is something I keep coming back to.
          </p>
        </div>
        <div class="skills-table">
          <div class="skills-table-title">Stack</div>
          <div class="skills-mono">
            <span>JavaScript</span><span>C#</span><span>C++</span>
            <span>Python</span><span>GDScript</span><span>Node.js</span>
            <span>PixiJS</span><span>GSAP</span><span>Unity</span>
            <span>Godot</span><span>Three.js</span><span>Figma</span>
            <span>Miro</span>
          </div>
        </div>
      </div>
      <div class="about-right">
        <div class="data-row reveal">
          <div class="data-row-label">Education</div>
          <div class="data-row-value">BSc Physics &amp; Astronomy — Queen Mary<br>Game Programming — CG Spectrum</div>
        </div>
        <div class="data-row reveal">
          <div class="data-row-label">Languages</div>
          <div class="data-row-value">English &amp; Italian (fluent)<br>French (conversational)</div>
        </div>
        <div class="data-row reveal">
          <div class="data-row-label">Interests</div>
          <div class="data-row-value">Sports climbing, stand-up comedy, game community design, AI tooling</div>
        </div>
        <div class="data-row reveal">
          <div class="data-row-label">Fun fact</div>
          <div class="data-row-value">Built this website with Claude over a single weekend</div>
        </div>
      </div>
    </div>
  </div>
</section>
```

**Note**: The about-prose content is duplicated between about-default and about-brutalist. Keep both in sync. The brutalist version has a different structure (skills-table with slash-separated spans, data-rows instead of about-boxes).

---

## Step 9: Contact heading span for retro

Change the contact heading:
```html
<!-- FROM -->
<h2 class="contact-heading reveal">Like what you see?<br>Get in touch.</h2>
<!-- TO -->
<h2 class="contact-heading reveal">Like what you see?<br><span class="teal">Get in touch.</span></h2>
```

The base `.teal { color: inherit; }` (added in Phase 1) ensures no visual change for non-retro themes. The retro CSS section in `shared.css` should include:
```css
[data-theme="retro"] .contact-heading .teal { color: #1A5C52; }
```
If this rule isn't already in the retro CSS block from Phase 1, add it.

---

## Verification

1. Start local server if not running: `npx http-server -p 8080 -c-1`
2. Open `http://localhost:8080/index.html`
3. The page should load with the bold theme by default
4. **Screenshot each theme** — use the Playwright approach from CLAUDE.md:
   - For each theme, run in browser console: `document.documentElement.setAttribute('data-theme', '<name>')`
   - Override `.reveal` for screenshots (see CLAUDE.md verification section)
   - Screenshot and verify:

### Bold:
- [ ] Archivo Black font renders for headings
- [ ] Hero accent circle visible (orange, clipped at right edge)
- [ ] About section has dark (#1A1714) background
- [ ] Contact section has orange (#FF6123) background

### Cinematic:
- [ ] Syne font renders
- [ ] Dark background (#0A0A0A)
- [ ] Scanline overlay in hero (subtle)
- [ ] Red glow behind hero heading (very subtle)

### Brutalist:
- [ ] Status bar visible below top of page (blue #0038FF)
- [ ] Hero shows 2-column grid: heading+desc left, data sidebar right
- [ ] About shows header bar + data rows (not the default about boxes)
- [ ] Space Mono font renders

### Retro:
- [ ] Split hero: cream content left, teal panel right
- [ ] Shrikhand font renders (chunky display font)
- [ ] "Never" has mustard underline
- [ ] About section is deep teal (#0F3E37)
- [ ] Tidbits hidden from default position, shown in teal panel

### Neon:
- [ ] Still works exactly as before (lime green, dark bg, grid pattern)
- [ ] No visual regressions

### Cross-theme:
- [ ] Nav element is gone (no nav visible or in DOM)
- [ ] Theme switcher button visible and positioned correctly
- [ ] Card hand renders at bottom of viewport

## What NOT to change in this phase
- Do NOT modify `js/shared.js` or any JS files (theme switcher won't cycle correctly yet — that's Phase 3)
- Do NOT modify project pages (logifuture.html etc — that's Phase 4)

## Note on HTML changes in later phases
Brutalist and retro themes require HTML changes beyond what this phase covers. The brutalist single-screen layout and the retro hero panel may need additional HTML tweaks (e.g. `.contact-brutalist` variant) during CSS integration. HTML is NOT frozen after this phase — treat it as a living document that can be updated alongside CSS fixes.
