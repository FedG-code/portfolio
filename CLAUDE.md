# Portfolio Site

## Structure
Multi-page portfolio site with shared CSS/JS (no build step).

```
index.html              — Main landing page (hero, work cards, about, approach, contact)
logifuture.html         — Logifuture project breakdown (~3 sub-projects)
coffin-likker.html      — Coffin-Likker project breakdown (3 sub-projects)
lost-satellite.html     — Lost Satellite Studios breakdown (1 project + screenshot gallery)
css/
  shared.css            — All shared styles (variables, nav, layout, components)
  project.css           — Project page-specific styles (hero, sections, gallery)
js/
  shared.js             — Scroll reveal + theme switcher with localStorage persistence
```

## Key Details
- **Fonts**: Instrument Serif, DM Sans, JetBrains Mono (loaded from Google Fonts)
- **CSS variables**: Defined in `:root`, swapped via `data-theme` attribute on `<html>` (`coral` default, `slate` alternate)
- **Theme persistence**: `localStorage.getItem('portfolio-theme')` — set inline in `<head>` of every page to prevent flash
- **Work cards**: `<a>` links in `index.html` that navigate to individual project pages; hover highlight effect (accent border + lift + shadow)
- **JS features**: Scroll reveal (IntersectionObserver), theme switcher with localStorage
- **Project pages**: Shared template — nav, theme switcher, back link, project hero, repeatable sub-project sections, footer

## Serving Locally
```
npx http-server -p 8080 -c-1
```

## Verification
After making visual changes, use `playwright-cli` to screenshot the page and verify the result.

The local server must be running (`npx http-server -p 8080 -c-1`) before taking screenshots.

```bash
playwright-cli open http://localhost:8080/index.html
playwright-cli screenshot --filename=screenshot.png
```

For project pages:
```bash
playwright-cli open http://localhost:8080/logifuture.html
playwright-cli screenshot --filename=screenshot.png
```

If not installed: `npm install -g @playwright/cli@latest`

## Conventions
- No build tools or bundler — static HTML/CSS/JS only
- Shared styles in `css/shared.css`, project-specific styles in `css/project.css`
- Use CSS custom properties (`var(--...)`) for all colours; never hardcode colour values in element styles
- Theme-specific overrides go in `[data-theme="<name>"]` selector blocks
- Every page must include the inline `<script>` in `<head>` for theme persistence (before CSS loads)
- Nav links on project pages must be prefixed with `index.html#` (e.g., `index.html#work`)
- `@playwright/cli` is used for screenshots/testing (`npm install -g @playwright/cli@latest` if not installed)
