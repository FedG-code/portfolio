# Bold Theme — Integration Notes (Final)

## Deliverables

| # | File | Purpose |
|---|------|---------|
| 1 | `bold-theme-shared.css` | Complete `[data-theme="bold"]` block for `shared.css` |
| 2 | `bold-theme-cards.css` | Complete `[data-theme="bold"]` block for `cards.css` |
| 3 | `bold-theme-project.css` | Complete `[data-theme="bold"]` block for `project.css` |
| 4 | `bold-card-mockup.html` | Standalone card mockup — all 4 card types on light + dark bgs |
| 5 | `bold-index-preview.html` | Full index page preview showing all three zones |

## Font Audit

| Card element | Font | Weight | Matches index element |
|---|---|---|---|
| Card title | Archivo | 600 | Section headings, strong text |
| Type bar | IBM Plex Mono | 500 | Chips, labels, badges |
| Card textbox | Archivo | 300 | Body prose, hero-desc |
| Home card title | Archivo Black | 400 | Hero h1 |

## Colour Audit — every card colour traced to index

| Card element | Hex | Index source |
|---|---|---|
| Card bg | `#FFFFFF` | Work cards, about boxes |
| Card title bg | `#FFFFFF` | Same |
| Card textbox bg | `#FFFFFF` | Same |
| Card art bg | `#F0EDE5` | --bg-warm |
| Type bar bg | `#FDEEE6` | Opaque equivalent of chip rgba(255,97,35,0.12) |
| Type bar border | `#F5C8A8` | Opaque equivalent of chip rgba(255,97,35,0.25) |
| Type bar text | `#FF6123` | --accent |
| Card border | `#E0DCD4` | --border |
| Title text | `#1A1714` | --text-primary |
| Body text | `#7A7570` | --text-secondary |
| Art icon | `#FF6123` at 0.15 | --accent |
| Home card bg | `#FAFAF7` | --bg (hero background) |
| Home card circle | `#FF6123` | Hero accent circle |

## Key Decisions

1. **Theme selector**: `[data-theme="bold"]` (not `:root` default)
2. **Full-bleed sections**: No negative margins — sections are already full-width
3. **Hero accent circle**: CSS `::after` on `.hero`, clipped by `overflow: hidden`
4. **Card border-radius**: 8px (everything else 0)
5. **All card backgrounds**: Hardcoded opaque hex, no var() or rgba()
6. **Per-card accent colours**: Removed — unified to `#F0EDE5`
7. **Accent strips**: Removed via `display: none`
8. **Type bar**: Chip-styled, font-size reduced to 7.5px with overflow protection
9. **Home card**: Mini index page with scaled accent circle via ::after

## Font Import Required
```html
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

## Verify During Integration

1. Card hand z-index layering over hero circle
2. Home card circle clipping at card edge
3. Dark about section chip readability
4. Orange contact bg extending through `padding-bottom: 220px`
5. Theme switcher cycle with 'bold' added to themes array
