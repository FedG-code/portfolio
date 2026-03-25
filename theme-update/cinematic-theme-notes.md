# Cinematic Theme — Integration Notes

## Google Fonts `<link>` tag
```html
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Commit+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

## Font / Colour Audit — Card ↔ Index Mapping

| Card Element | Card Value | Index Source |
|---|---|---|
| `.card-inner` background | `#161616` (opaque) | `--bg-card` |
| `.card-inner` border | `#222222` (opaque) | `--border` |
| `.card-title h3` font | Syne 600 | Hero h1 uses Syne 800; section headings Syne 800. Cards use 600 to match sub-heading weight. |
| `.card-title h3` color | `#E8E6E1` | `--text-primary` |
| `.card-art-inner` background | `#0e0e0e` (opaque) | Slightly darker than `--bg` (#0A0A0A), matches hero glow zone. |
| `.card-art-inner` border | `#222222` | `--border` |
| `.type-bar` background | `#161616` | `--bg-card` |
| `.type-bar` border | `rgba(214,0,28,0.25)` | `--accent` tinted — echoes red glow line on hero |
| `.type-bar` text color | `#D6001C` | `--accent` |
| `.type-bar` font | Commit Mono | `--font-mono` (used for badge, labels, nav links) |
| `.card-textbox p` font | Commit Mono | `--font-mono` |
| `.card-textbox p` color | `#8A8580` | `--text-muted` |
| `.card-art-title` font | Syne 800 uppercase | Direct match: hero h1 is Syne 800 uppercase |
| `.card-art-title em` color | `#D6001C` | `--accent` — matches hero h1 em |
| `.card-art-blurb` font | Commit Mono | `--font-mono` |
| Home card background | `#0e0e0e` | Close to `--bg` — mimics hero background |
| Top glow line | Red gradient `rgba(214,0,28,0.5)` | Matches hero `::after` red glow |
| Accent strip | `#D6001C` at 40% opacity | Unified `--accent` across all card accents |
| Home card scanline | `rgba(255,255,255,0.015)` repeating | Matches hero `::before` scanline overlay |

**Verdict:** Every colour and font on the cards traces back to the index page. No orphan styles.

---

## Decisions Made

### 1. Hero alignment — Kept centered (not bottom-aligned)
The brief's mockup uses `align-items: flex-end` for a bottom-heavy hero. The real site's card hand sits at the bottom of the viewport, so bottom-aligning the hero text would collide with the cards. Kept `justify-content: center` (the default).

### 2. Section labels — Kept as-is
Kept the "02 - About" numbered label format. Styled as subtle mono uppercase text in `--text-muted`, which already reads as functional rather than decorative. Changing to a right-aligned alternative would require HTML changes or fragile CSS `content` hacks.

### 3. Work icon backgrounds — Unified to red tint
Changed `.work-icon.orange`, `.work-icon.green` to use `rgba(214,0,28,0.15)` and `rgba(214,0,28,0.10)` respectively, keeping everything in the red-dark palette. `.work-icon.blue` uses `--pop-soft` (warm white at 8% opacity) for subtle contrast.

### 4. Card border-radius — 8px exception
Brief says `--radius: 0px` (sharp everywhere), but cards keep `border-radius: 8px` as specified in the brief's card section. This gives them a tactile, physical-card feel that works better when being dragged around the hand UI. Inner card elements (`.card-art`, `.type-bar`) use smaller radii (3–4px).

### 5. Per-card accent colours — Overridden to unified dark
All four card accent backgrounds (red, purple, green, gold) are overridden to `#0e0e0e` with `!important`. The cards look like dark film stills — the only colour accent comes from the red type-bar border, top glow line, and accent strip.

### 6. Home card scanline
Added a `::after` pseudo-element on `.card-inner--home` that reproduces the hero's CRT scanline pattern at card scale. This makes the home card feel like a miniature TV showing the index page. Title text gets `position: relative; z-index: 3` to sit above it.

### 7. Readability lift — `--text-muted` raised to `#8A8580`
The brief specified `#6B6965` for `--text-muted`, but against the `#0A0A0A` background it was too hard to read — particularly the hero description, card textbox text, and skill chips. Lifted to `#8A8580` which maintains the muted hierarchy below `--text-secondary` (`#9A9590`) while being comfortably legible.

### 8. Hero glow — wider and subtler
The original brief specified a 40vw circular glow at 0.15 opacity, which created an unintentional spotlight effect on individual letters in the hero heading. Changed to a 90vw ellipse at 0.07 opacity with 100px blur, positioned lower (`top: 25vh`). Reads as ambient atmosphere rather than a focused halo.

---

## Things to Verify After Integration

1. **Theme switcher cycle order** — The `themes` array in `shared.js` needs `'cinematic'` added. Current: `['coral', 'slate', 'neon']`. Update to `['coral', 'slate', 'neon', 'cinematic']`.

2. **Card drag glow** — The `card-hand.js` proximity feedback applies inline `borderColor` and `boxShadow`. The `_cardHandOnThemeChange` callback resets these, so switching themes mid-drag should be clean.

3. **Font loading** — Syne and Commit Mono are not used by any other theme. Verify the Google Fonts `<link>` tag is present in `<head>`. If lazy-loading fonts, both families should be preconnected.

4. **Hero overflow** — Added `overflow: hidden` on `.hero` to contain the `::after` red glow. Verify this doesn't clip any hero content on small viewports.

5. **Mobile nav** — On `≤600px`, nav becomes `position: static` (matching neon behavior). The theme switcher moves to `top: 0.75rem`. Test that this doesn't overlap with the card hand UI.

6. **Body `::before` grain z-index** — Set to `z-index: 40`, same as neon. Verify it doesn't interfere with card dragging (`z-index: 60+`) or page transitions (`z-index: 200`).
