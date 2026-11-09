# CSS Reference Map

| File | Used by | Notes |
|------|---------|-------|
| `gallery.css` (~200 lines) | `index.html` only | The Dolly Gallery. Self-contained: does not load shared.css. |
| `shared.css` (~2.6k lines) | project pages | Base + theme blocks. Only `bold` is live now (pages hard-code `data-theme="bold"`); the brutalist/retro/cinematic/neon blocks, toolbar, card and destruction rules are dead CSS kept in place, safe to prune in a cleanup pass. |
| `project.css` (~450 lines) | project pages | Project hero/sections, back link (`.project-nav-link.back-link`), title focus ring, `.project-content--text` (text-only block), `.work-figure` caption, `.work-capture-tbc` placeholder. |

`cards.css` was deleted with the card hand (2026-11-09).

## gallery.css

One identity, engine-debug greybox. Tokens on `:root`: `--p` paper, `--p2` light paper, `--ink`, `--mut`, `--ln` rule, `--link`, `--sig` orange (**selection only**), `--col` green (**colliders/triggers only**), `--chip`, `--stage`. Fonts: Archivo (variable, `font-stretch` up to 125%) + IBM Plex Mono.

| Block | Selectors |
|-------|-----------|
| Base | reset, `[hidden]{display:none !important}` (needed: see js/CLAUDE.md gotchas), `.pg` (max 1280px, 44px gutters) |
| Name strip | `.tb`, `.tb-id`, `.nm`, `.rl`, `.tb-city`, `.edu` (`.full`/`.short` swap on phone), `.tb-ln` (contact links) |
| About | `.ab`, `.ab-lead`, `.ab-txt`; phone body under the stage: `.ab-m` |
| Plain list | `.mn`, `.menu`, `.row` (`.lead`, `.on`), `.rt`, `.rs`, `.pv*` preview + spec, `.pv-open` |
| Gizmo marks | `.pv-mk`, `.mk`, `.mk-chip` |
| Paper plane | `#plane-canvas`, `html.plane-active`, `.destruct-char`, `.destruct-word`; `--accent` aliases `--sig` for the plane |
| Stage | `.st` (`.no3d` = plain list), `.st-cv`, `.pin` (transform-origin 0 0; JS adds scale), `.dbg`, `.tp` placards, `.sign`, `.tl`, `.bub` (+ `.side` on phone, `.its` University items), `.openb`, `.vov` motion overlay |
| Shot list | `.keys`, `.key` (`.on`, `.lead`, `.abk`), `.track` playhead |
| Breakpoints | 1100px (smaller key text), 900px (name strip 2x2), 639px (phone: matches `PHONE` in gallery.js), reduced motion |

## shared.css (2570 lines)

### Section Map

| Section | Lines | Key Details |
|---------|-------|-------------|
| Universal reset + :root variables | 1-26 | --bg, --bg-warm, --bg-card, --border, --border-hover, --text-primary, --text-secondary, --text-muted, --accent, --accent-soft, --accent-mid, --pop, --pop-soft, --cream, --accent-glow, --font-serif, --font-body, --font-mono, --ease-out, --ease-spring, --radius, --radius-sm |
| [data-theme="neon"] variables | 28-47 | Dark grays, lime accent (#c9f059), blue pop (#59b8f0), Sora/Space Mono fonts |
| Global transitions | 49-51 | body, .work-card, .approach-card transitions |
| RIGHT-EDGE TOOLBAR | 59-183 | .toolbar fixed-right container, .swatches stack, .swatch-btn[data-theme-id] dots, .plane-btn active state, .preview-panel (desktop hover only), responsive @768px shrink, prefers-reduced-motion disable |
| PLANE ACTIVE | ~185 | html.plane-active styles (user-select: none) |
| Global html/body/links | ~190 | Base typography, .container max-width 1140px |
| HERO | 150-257 | .hero min-height 100vh, .hero-badge fadeUp, .hero h1 clamp(3rem-6.5rem), .hero-body grid, .hero-tidbits |
| SECTIONS | 258-279 | section padding 7rem, .section-label, .section-heading |
| WORK CARDS | 280-491 | .work-grid, .work-card, .work-card-header, .work-icon, .work-expand, .work-image-placeholder (warm/cool/fresh), .work-details, .work-stats |
| ABOUT | 493-562 | .about-content grid (1.2fr 1fr), .about-prose, .about-box, .chip-grid |
| APPROACH | 564-608 | .approach-cards grid, .approach-card |
| CONTACT | 609-672 | .contact, .btn primary/secondary |
| DOODLE DECORATION | 674-707 | .doodle positioning and animation |
| ANIMATIONS | ~708 | @keyframes: fadeUp, pulse |
| 3D PLANE OVERLAY | 733-740 | #plane-canvas fixed overlay |
| THEME LAYOUT TOGGLES | 741-749 | .hero-brutalist, .about-brutalist, .hero-panel display toggles |
| NEON THEME OVERRIDES | 750-844 | Font weights 600-700, sharp corners, grain overlay, doodle hidden |
| RESPONSIVE (general) | 845-884 | @media 900px, 768px, 600px breakpoints |
| Destruction system | 857-865 | .destruct-char, .destruct-word rules |
| BOLD THEME OVERRIDES | 885-1182 | Hero circle ::after, uppercase h1, work/approach/contact overrides |
| CINEMATIC THEME OVERRIDES | 1183-1502 | Dark red accent #D6001C, Syne/Segoe UI/Commit Mono, uppercase h1 |
| BRUTALIST THEME OVERRIDES | 1503-2184 | Blue accent #0038FF, Space Mono/Literata, single-screen flex, .hero-brutalist grid |
| RETRO THEME OVERRIDES | 2185-2576 | Cream bg, red #D94230, teal #1A5C52, Shrikhand/Bitter, hero split grid, .hero-panel |

### Custom Properties (defined in :root)

All variables defined in lines 3-26:

- `--bg`, `--bg-warm`, `--bg-card` -- background colors
- `--border`, `--border-hover` -- border colors
- `--text-primary`, `--text-secondary`, `--text-muted` -- text colors
- `--accent`, `--accent-soft`, `--accent-mid`, `--accent-glow` -- accent color + opacity variants
- `--pop`, `--pop-soft` -- pop color (same as accent in bold theme)
- `--theme-bold-accent`, `--theme-brutalist-accent`, `--theme-retro-accent`, `--theme-cinematic-accent`, `--theme-neon-accent` -- cross-theme swatch identity colors (used by `.toolbar .swatch-dot`, never overridden per theme)
- `--cream` -- cream background
- `--font-serif`, `--font-body`, `--font-mono` -- font stacks
- `--ease-out`, `--ease-spring` -- easing functions
- `--radius`, `--radius-sm` -- border-radius values

### Alternate Layout Selectors

- `.hero-default` (display: block) / `.hero-brutalist` (display: none by default, shown in brutalist)
- `.about-default` / `.about-brutalist` (same pattern)
- `.hero-panel` (display: none, shown in retro)

### Responsive Breakpoints

- max-width: 900px -- hero-body 1fr, about-content 1fr
- max-width: 768px -- .toolbar shrink (smaller swatches + plane icon)
- max-width: 600px -- overflow-x: hidden

## project.css (412 lines)

### Section Map

| Section | Lines | Key Details |
|---------|-------|-------------|
| PROJECT NAV | 1-19 | .project-nav flex, .project-nav-link font-mono 0.75rem |
| PROJECT HERO | 21-62 | .project-hero padding 2rem 0 4rem, .project-hero-badge, .project-hero-title clamp(2.5rem-4.5rem), .project-meta |
| PROJECT SECTIONS | 64-96 | .project-section, .project-content grid (1.2fr 1fr), --reversed variant |
| IMAGES | 98-122 | .work-image-placeholder aspect-ratio 16/10 (warm/cool/fresh), .work-image |
| STATS | 124-152 | .work-stats flex, .work-stat-num font-mono accent |
| SCREENSHOT GALLERY | 154-169 | .screenshot-gallery flex, .screenshot-thumb 120px |
| VIDEO EMBED | 170-190 | .video-embed-wrapper aspect-ratio 16/9 |
| WIP BADGE | 191-205 | .wip-badge yellow/orange #FFC107 |
| PROJECT LINK | 207-211 | .project-link accent color |
| PORTRAIT DUO | 213-225 | .project-images-duo flex |
| NEON OVERRIDES | 227-235 | 600 weight, 6-8px radius, dark radial-gradient placeholders |
| RESPONSIVE | 237-250 | @media 900px (1fr grid), 480px (image sizing) |
| BOLD OVERRIDES | 251-291 | Uppercase, 0 radius, linear-gradient placeholders |
| CINEMATIC OVERRIDES | 292-330 | 700 weight uppercase, dark radial-gradient placeholders |
| BRUTALIST OVERRIDES | 331-369 | Monospace, 2px border badge, solid color placeholders |
| RETRO OVERRIDES | 370-412 | Shrikhand, 2px border badge, cream/teal/olive gradients |

### Responsive Breakpoints

- 900px -- grid to 1fr
- 480px -- mobile image sizing

## Cross-File Notes

- All files use the same CSS custom property names from :root
- Theme override pattern: `[data-theme="X"]` blocks redefine variables AND add theme-specific component styles
- Brutalist is the most complex theme (~685 lines in shared.css) due to alternate hero/about HTML layouts
- Image placeholder gradients vary by theme (linear, radial, or solid)

## Uncertainties

- NEON section boundaries (lines 849-860) have image/icon tweaks that could be grouped with responsive or with neon overrides -- boundary is ambiguous
