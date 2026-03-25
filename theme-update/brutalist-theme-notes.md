# Brutalist Theme — Integration Notes

## Google Fonts `<link>` tag

Add to `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,700;1,7..72,400&display=swap" rel="stylesheet">
```

---

## HTML Changes Required

### 1. Status Bar

Add after `</nav>`, before the theme switcher:

```html
<div class="status-bar" id="statusBar">
  <span>STATUS: OPEN TO OPPORTUNITIES</span>
  <span>LONDON, UK · 2026</span>
</div>
```

Hidden by default (`display: none`), shown only when `data-theme="brutalist"`.

### 2. Hero Section — restructured for exposed grid

The existing hero HTML needs to change. The mockup uses a 2-column grid layout (heading+desc left, data sidebar right) instead of the current layout (badge → h1 → hero-body grid).

**Replace the current hero section** with:

```html
<section class="hero">
  <div class="doodle-circle doodle"></div>
  <div class="doodle-squiggle doodle"></div>
  <!-- Original layout wrapper (used by coral/slate/neon) -->
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
  <!-- Brutalist layout (hidden by default, shown only for brutalist) -->
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
</section>
```

And add to shared.css:

```css
/* Hide brutalist layout by default */
.hero-brutalist { display: none; }
.hero-default { display: block; }

[data-theme="brutalist"] .hero-default { display: none; }
[data-theme="brutalist"] .hero-brutalist {
  display: grid;
  grid-template-columns: 2fr 1fr;
}
[data-theme="brutalist"] .hero-main {
  padding: 5rem clamp(1.5rem, 5vw, 3.5rem) 4rem;
  border-right: 1px solid var(--border);
}
[data-theme="brutalist"] .hero-sidebar {
  padding: clamp(1.5rem, 5vw, 3.5rem);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
[data-theme="brutalist"] .sidebar-field { margin-bottom: 1.5rem; }
[data-theme="brutalist"] .sidebar-field:last-child { margin-bottom: 0; }
[data-theme="brutalist"] .field-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 0.2rem;
}
[data-theme="brutalist"] .field-value {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 0.8rem;
}
[data-theme="brutalist"] .field-value--accent {
  color: var(--accent);
}
```

### 3. About Section — restructured for data grid

The mockup's about section has a fundamentally different structure: full-width header bar, prose + slash-separated skills on the left, data rows on the right. Similar dual-layout approach:

```html
<section id="about">
  <!-- Original layout (coral/slate/neon) -->
  <div class="container about-default">
    <!-- ... existing about HTML unchanged ... -->
  </div>
  <!-- Brutalist layout -->
  <div class="about-brutalist">
    <div class="about-header">
      About
      <span>Background &amp; Skills</span>
    </div>
    <div class="about-grid">
      <div class="about-left">
        <div class="about-prose">
          <!-- same prose content -->
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
        <div class="data-row">
          <div class="data-row-label">Education</div>
          <div class="data-row-value">BSc Physics & Astronomy — Queen Mary<br>Game Programming — CG Spectrum</div>
        </div>
        <div class="data-row">
          <div class="data-row-label">Languages</div>
          <div class="data-row-value">English & Italian (fluent)<br>French (conversational)</div>
        </div>
        <div class="data-row">
          <div class="data-row-label">Interests</div>
          <div class="data-row-value">Sports climbing, stand-up comedy, game community design, AI tooling</div>
        </div>
        <div class="data-row">
          <div class="data-row-label">Fun fact</div>
          <div class="data-row-value">Built this website with Claude over a single weekend</div>
        </div>
      </div>
    </div>
  </div>
</section>
```

And the CSS:

```css
.about-brutalist { display: none; }
.about-default { display: block; }

[data-theme="brutalist"] .about-default { display: none; }
[data-theme="brutalist"] .about-brutalist { display: block; }

[data-theme="brutalist"] #about { border-bottom: 2px solid var(--border); padding: 0; }

[data-theme="brutalist"] .about-header {
  padding: 1.5rem clamp(1.5rem, 5vw, 3.5rem);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 1.5rem;
  text-transform: uppercase;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
[data-theme="brutalist"] .about-header span {
  font-size: 0.65rem;
  font-weight: 400;
  color: var(--text-muted);
}

[data-theme="brutalist"] .about-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
[data-theme="brutalist"] .about-left {
  padding: 2rem clamp(1.5rem, 5vw, 3.5rem);
  border-right: 1px solid var(--border);
}
[data-theme="brutalist"] .about-right { padding: 0; }

[data-theme="brutalist"] .skills-table {
  border-top: 1px solid var(--border);
  margin-top: 1.5rem;
  padding-top: 1.5rem;
}
[data-theme="brutalist"] .skills-table-title {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 0.8rem;
  letter-spacing: 0.04em;
}
[data-theme="brutalist"] .skills-mono {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  line-height: 2.2;
  color: var(--text-primary);
}
[data-theme="brutalist"] .skills-mono span + span::before {
  content: ' / ';
  color: var(--text-muted);
}

[data-theme="brutalist"] .data-row {
  padding: 1.2rem clamp(1.5rem, 5vw, 3.5rem);
  border-bottom: 1px solid var(--border);
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 1rem;
  align-items: baseline;
}
[data-theme="brutalist"] .data-row:last-child { border-bottom: none; }
[data-theme="brutalist"] .data-row-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}
[data-theme="brutalist"] .data-row-value {
  font-family: var(--font-body);
  font-size: 0.85rem;
  line-height: 1.6;
}
```

### 4. Theme Switcher

Add `'brutalist'` to the `themes` array in `shared.js`:

```js
const themes = ['coral', 'slate', 'neon', 'brutalist'];
```

---

## Font / Colour Audit — Card ↔ Index Mapping

| Card Element | Hex / Value | Index Source |
|---|---|---|
| `.card-inner` bg | `#E8E4DC` | `--bg` (page background) |
| `.card-inner--home` bg | `#D9D4CA` | `--bg-warm` (hero sidebar bg area) |
| `.card-art-inner` bg | `#D9D4CA` | `--bg-warm` |
| `.card-title h3` font | Space Mono 700, uppercase | Hero `h1` — same font, same treatment |
| `.card-art-title` font | Space Mono 700, uppercase | Hero `h1` — same font, same treatment |
| `.card-art-title em` colour | `#0C0C0C` (black) | Hero — no accent on "Never" |
| Home card blue stripe | `#0038FF` bg, white text | Status bar — same blue, same mono type |
| `.type-bar` bg | `#E8E4DC` | `--bg` |
| `.type-bar` border | `#0C0C0C` | `--border` |
| `.type-bar` font | Space Mono | All UI labels use Space Mono |
| `.card-textbox p` font | Literata | About prose / body font |
| `.card-textbox p` colour | `#5C584F` | `--text-secondary` |
| Accent strips | `#0038FF` | `--accent` (electric blue) |
| All borders | `#0C0C0C` 2px/1px | Site-wide black border signature |

**Every colour and font on the cards traces back to the index page.**

---

## Decisions Made

1. **Status bar: Option A (included).** The strongest brutalist signature element. Fixed below the nav.

2. **Dual-layout HTML approach.** The mockup's hero and about sections have fundamentally different structures (2-col exposed grid with visible column dividers) that can't be achieved by CSS override alone on the existing HTML. Added `.hero-brutalist` and `.about-brutalist` blocks, hidden by default, shown only for `data-theme="brutalist"`. The original layouts (`.hero-default`, `.about-default`) remain untouched for coral/slate/neon.

3. **Home card blue stripe.** Instead of the grid pattern from v1, the home card now has a miniature blue status bar (via `::after`) reading "OPEN TO OPPORTUNITIES" — directly echoing the index page's most distinctive element.

4. **Hero heading:** No `<em>` accent colour, all black uppercase Space Mono. Consistent with the mockup's treatment.

5. **About section data rows:** The mockup uses `label | value` grid rows separated by 1px borders. The brutalist about layout reproduces this exactly.

6. **Contact:** Section gets `border-bottom: 2px solid` to continue the exposed-grid language. Buttons share borders via negative margins.

7. **Card art backgrounds:** All unified to `#D9D4CA` with `!important`.

8. **Type bar font-size:** `7.5px` with overflow ellipsis to handle long labels.

---

## Things to Verify

- **Status bar `top` value** (`56px`) — depends on actual nav height with padding.
- **Mobile:** At ≤600px, nav and status bar become `position: static`.
- **Hero-brutalist responsive:** At ≤900px, collapses to single column with border switching from vertical to horizontal.
- **About-brutalist responsive:** Same — data rows stack below prose at ≤900px.
- **Reveal animations:** The brutalist layouts use different class names — may need `reveal` classes added to the new elements for scroll-triggered animations to work.
