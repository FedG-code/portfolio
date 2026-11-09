# CSS Reference Map

| File | Used by | Notes |
|------|---------|-------|
| `gallery.css` (~199 lines) | `index.html` only | The Dolly Gallery. Self-contained: does not load shared.css. |
| `shared.css` (~228 lines) | project pages | Base reset, `:root` tokens (bold palette, Archivo Black / Archivo / IBM Plex Mono), container, tidbits, section headings, buttons, `.reveal`. |
| `project.css` (~286 lines) | project pages | Back link, project hero, sections, captures, stats, video embed, responsive rules. |

Pruned on 2026-11-09: the other themes (brutalist, retro, cinematic, neon), toolbar, card hand, paper plane, destruction and old homepage rules were removed by a script that dropped every selector naming a non-bold theme or a class/id absent from the live HTML/JS, checked with before/after screenshots of all five project pages at 1440, 1024 and 390px (identical within rendering noise). `cards.css` is in `archive/card-hand/css/`.

## gallery.css

One identity, engine-debug greybox. Tokens on `:root`: `--p` paper, `--p2` light paper, `--ink`, `--mut`, `--ln` rule, `--link`, `--sig` orange (**selection only**), `--col` green (**colliders/triggers only**), `--chip`, `--stage`. Fonts: Archivo (variable, `font-stretch` up to 125%) + IBM Plex Mono.

| Block | Selectors |
|-------|-----------|
| Base | reset, `[hidden]{display:none !important}` (needed: see js/CLAUDE.md gotchas), `.pg` (max 1280px, 44px gutters) |
| Name strip | `.tb`, `.tb-id`, `.nm`, `.rl`, `.tb-city`, `.edu` (`.full`/`.short` swap on phone), `.tb-ln` (contact links) |
| About | `.ab`, `.ab-lead`, `.ab-txt`; phone body under the stage: `.ab-m` |
| Plain list | `.mn`, `.menu`, `.row` (`.lead`, `.on`), `.rt`, `.rs`, `.pv*` preview + spec (`.pv-view.go` = clickable), `.pv-open` |
| Gizmo marks | `.pv-mk`, `.mk`, `.mk-chip` |
| Stage | `.st` (`.no3d` = plain list), `.st-cv`, `.st.over` (pointer over a capture), `.pin` (transform-origin 0 0; JS adds scale), `.tp` placards, `.sign`, `.tl`, `.bub` (+ `.side` on phone, `.its` University items), `.openb`, `.vov` motion overlay |
| Shot list | `.keys`, `.key` (`.on`, `.lead`, `.abk`), `.track` playhead |
| Breakpoints | 1100px (smaller key text), 900px (name strip 2x2), 639px (phone: matches `PHONE` in gallery.js), reduced motion |


## shared.css
Project pages are fixed to `data-theme="bold"`, so the `[data-theme="bold"]` blocks at the end of the file are the live overrides (uppercase tidbit labels, section headings, buttons). Classes styled: `.btn`, `.chip`, `.container`, `.css`, `.reveal`, `.section-heading`, `.tidbit`, `.tidbit-label`, `.tidbit-value`, `.visible`, `.work-image`, `.work-image-placeholder`, `.work-stat`, `.work-stat-label`, `.work-stat-num`, `.work-stats`.

`.reveal` starts at `opacity: 0` + `translateY(24px)`; `js/shared.js` adds `.visible` on scroll. Override it before full-page screenshots.

## project.css
Classes styled: `.back-link`, `.css`, `.project-content`, `.project-content--reversed`, `.project-content--text`, `.project-hero`, `.project-hero-badge`, `.project-hero-desc`, `.project-hero-title`, `.project-images-duo`, `.project-link`, `.project-meta`, `.project-nav`, `.project-nav-link`, `.project-section`, `.project-text`, `.video-embed`, `.work-capture-tbc`, `.work-figure`, `.work-image`, `.work-image-placeholder`, `.work-stat`, `.work-stat-label`, `.work-stat-num`, `.work-stats`.

- `.project-content` is a 1.2fr/1fr grid (media, text); `--reversed` swaps sides; `--text` is a single reading-width column for text-only blocks. All collapse to one column at 900px.
- `.work-image` is 16:10 `object-fit: cover` (used on `<video>` loops and `<img>`); inside `.work-figure` it keeps its own ratio and gets a mono caption.
- `.work-capture-tbc` is the dashed "Capture to come" placeholder.
- `.project-nav-link.back-link` is the "← All projects" link; `.project-hero-title:focus-visible` shows the focus ring when the title receives focus on arrival from the gallery.
