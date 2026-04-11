# CSS Reference Map

Brief overview: 3 CSS files totaling ~3,900 lines. Five themes (bold, cinematic, brutalist, retro, neon). Pattern: base component styles followed by theme override blocks.

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
| THEME LAYOUT TOGGLES | 741-749 | .status-bar, .hero-brutalist, .about-brutalist, .hero-panel display toggles |
| NEON THEME OVERRIDES | 750-844 | Font weights 600-700, sharp corners, grain overlay, doodle hidden |
| RESPONSIVE (general) | 845-884 | @media 900px, 768px, 600px breakpoints |
| Destruction system | 857-865 | .destruct-char, .destruct-word rules |
| BOLD THEME OVERRIDES | 885-1182 | Hero circle ::after, uppercase h1, work/approach/contact overrides |
| CINEMATIC THEME OVERRIDES | 1183-1502 | Dark red accent #D6001C, Syne/Segoe UI/Commit Mono, uppercase h1 |
| BRUTALIST THEME OVERRIDES | 1503-2184 | Blue accent #0038FF, Space Mono/Literata, single-screen flex, .hero-brutalist grid, .status-bar |
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
- `.status-bar` (display: none, shown in brutalist)

### Responsive Breakpoints

- max-width: 900px -- hero-body 1fr, about-content 1fr
- max-width: 768px -- .toolbar shrink (smaller swatches + plane icon)
- max-width: 600px -- overflow-x: hidden

## cards.css (864 lines)

### Section Map

| Section | Lines | Key Details |
|---------|-------|-------------|
| SPA PAGE SYSTEM | 1-18 | .spa-page display states (active, measuring, transitioning), z-index 200 |
| PAGE CONTAINER | 20-28 | .page-container absolute, inset 0, z-index 5, overflow-y auto, padding-bottom 220px |
| DRAG BLUR OVERLAY | 30-40 | .drag-blur-overlay fixed, backdrop-filter blur(0px), will-change |
| HAND CONTAINER | 42-59 | .hand-container bottom 0, translateX(-50%), height 400px (768px+: 260px), max-width 700px |
| ATTRACTOR LABEL | 61-81 | .attractor-label absolute, font-mono, var(--accent), z-index 30, pointer-events none |
| PERSPECTIVE + FLY | 83-96 | .perspective-container, .fly-overlay fixed, z-index 60/500 |
| CARD BASE | 76-105 | .card 220x320px (768px+: 132x192), cursor grab, transition 0.55s cubic-bezier |
| CARD INNER | 107-246 | .card-inner radius 14px, .card-title h3, .card-art height 155px, .card-art-icon, .card-inner--home, .type-bar, .card-textbox, .accent-strip |
| MOBILE CARD SCALING | 248-261 | @media 768px: radius 9px, font-sizes reduced |
| NEON OVERRIDES | 263-342 | Dark card bg #131318, lime accent glow |
| TOUCH SUPPORT | 344-356 | html.card-dragging overflow hidden |
| BOLD OVERRIDES | 358-475 | White/opaque, uppercase, orange accent, no accent-strip |
| CINEMATIC OVERRIDES | 476-594 | Dark #161616, red accent, 800 weight |
| BRUTALIST OVERRIDES | 596-713 | White/monospace, blue accent, 2px borders, hand positioning overrides |
| RETRO OVERRIDES | 714-864 | Rounded 10px, red top line, Shrikhand, decorative elements, hardcoded hex palette |

### Card Dimensions

- Desktop: 220px x 320px
- Mobile (<=768px): 132px x 192px

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
- Card dimensions defined in both cards.css (CSS) and card-hand.js (JS constants CARD_W/CARD_H) -- keep in sync

## Uncertainties

- NEON section boundaries (lines 849-860) have image/icon tweaks that could be grouped with responsive or with neon overrides -- boundary is ambiguous
