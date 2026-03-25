# Retro Theme — Integration Notes

## Google Fonts `<link>` tag

```html
<link href="https://fonts.googleapis.com/css2?family=Shrikhand&family=Bitter:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

## Theme name

`data-theme="retro"` — add to the themes array in `shared.js`.

---

## Colour Audit — Card → Index Source

| Card Element | Hex | Index Source |
|---|---|---|
| `.card-inner` bg | `#FDF6EC` | Hero left / page background (cream) |
| `.card-inner` border | `#D4CBBA` | Page border colour |
| `.card-title h3` colour | `#1A1A16` | Primary text |
| `.card-art-inner` bg (all accents) | `#1A5C52` | Hero teal panel |
| `.card-art-icon` colour | `#E8A825` | Mustard accent (labels, sidebar borders) |
| `.type-bar` bg | `#FDF6EC` | Page cream |
| `.type-bar` border | `#D4CBBA` | Page border |
| `.type-bar` text | `#6D6A5E` | Muted text |
| `.card-textbox p` colour | `#6D6A5E` | Muted text |
| Home card bg | `#FDF6EC` | Hero cream (exact match) |
| Home card teal stripe | `#1A5C52` | Hero panel teal |
| Home card circle | `#E8A825` | Hero decorative circle |
| Home card "Never" | `#D94230` | Red accent |

**Result**: Every colour on the cards traces back to the index page. ✓

---

## Font Audit — Card → Index Source

| Card Element | Font | Index Source |
|---|---|---|
| `.card-title h3` | Shrikhand 400 | Hero h1, section headings |
| `.type-bar` | IBM Plex Mono 500, 7px | Hero badge, section labels, tidbit labels |
| `.card-textbox p` | Bitter 300, 8.5px | Hero description, about prose |
| `.card-art-title` (home) | Shrikhand 400, 20px | Hero h1 |
| `.card-art-title em` (home) | Shrikhand 400, red | Hero h1 em |

**Result**: Every font/weight on the cards matches something on the index. ✓

---

## Key Design Decisions

1. **Split hero layout**: The hero is a CSS grid with `1fr 340px` — left cream with content, right teal panel with tidbits. This requires HTML changes to `index.html` (a `.hero-panel` div as sibling to `.container` inside `.hero`). A fallback is provided in `retro-theme-shared.css` that keeps tidbits in their current position, styled as teal cards.

2. **No border-radius on UI elements**: Type bars, buttons, chips, badges all use `border-radius: 0` — sharp rectangles throughout. Cards themselves keep a subtle `10px` radius to not look broken, but everything inside is angular.

3. **Unified teal card art**: All per-card accent colours (red/purple/green/gold) are overridden to the same `#1A5C52` teal using `!important`. Icons are mustard-tinted. This gives the cards a cohesive retro feel.

4. **Mustard as the secondary accent**: Used for the "Never" underline, icon tints, sidebar borders, and section labels. Red (`#D94230`) is reserved for the primary accent (badge, "Never" text colour, primary button).

5. **No accent strips or top glow lines on cards**: Both removed for a cleaner look. The card's visual interest comes from the teal art panel and the cream/border contrast.

6. **Home card mini-screenshot**: Uses `::after` pseudo-element on `.card-art-inner` for a 28%-width teal stripe on the right side, mirroring the split layout. `::before` adds a faded mustard circle matching the hero's decorative element.

7. **About section goes deep teal** (`#0F3E37`): This is the darkest section, giving the page good contrast rhythm: cream → teal → cream → teal footer.

8. **Shrikhand has no italic**: All `font-style: italic` is overridden to `normal`. Emphasis uses colour instead (red for "Never", teal for "Get in touch"). "Never" also gets a mustard underline via `::after` — on both the hero h1 and the home card title.

---

## Things to Verify

- [ ] **Hero HTML**: The split layout needs a `.hero-panel` div. If you want to avoid HTML changes, uncomment the fallback block in `retro-theme-shared.css`.
- [ ] **Theme switcher array**: Add `'retro'` to the themes array in `shared.js`.
- [ ] **Card art with GIF images**: The unified teal background works as a base; GIF images will overlay it naturally. Verify the teal doesn't peek through transparent GIF edges.
- [ ] **Type bar overflow**: Long labels like "Lost Satellite Studios · Tech Designer" should truncate at 7px font-size. Test on mobile.
- [ ] **Mobile hero**: At ≤900px the grid collapses to single column. The teal panel becomes a horizontal row. Verify spacing.
- [ ] **Contact section heading**: Uses `<span class="teal">` for the second line — verify this class exists or add it.
