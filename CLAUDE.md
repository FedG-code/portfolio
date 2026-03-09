# Portfolio Site

## Structure
Multi-page portfolio site with shared CSS/JS (no build step).

```
index.html              - Main landing page (hero, work cards, about, contact)
logifuture.html         - Logifuture project breakdown (~3 sub-projects)
coffin-likker.html      - Coffin-Likker project breakdown (3 sub-projects)
lost-satellite.html     - Lost Satellite Studios breakdown (1 project + screenshot gallery)
css/
  shared.css            - All shared styles (variables, nav, layout, components)
  project.css           - Project page-specific styles (hero, sections, gallery)
js/
  shared.js             - Scroll reveal + theme switcher with localStorage persistence
```

## Key Details
- **Fonts**: 3 fonts loaded from Google Fonts, defined as CSS variables in `shared.css`:
  - `--font-serif`: Instrument Serif (headings, hero text, emphasis)
  - `--font-body`: DM Sans (body text, paragraphs)
  - `--font-mono`: JetBrains Mono (labels, badges, nav, stats, chips, buttons)
- **CSS variables**: Defined in `:root`, swapped via `data-theme` attribute on `<html>` (`coral` default, `slate` alternate)
- **Theme persistence**: `localStorage.getItem('portfolio-theme')` - set inline in `<head>` of every page to prevent flash
- **Work cards**: `<a>` links in `index.html` that navigate to individual project pages; hover highlight effect (accent border + lift + shadow)
- **JS features**: Scroll reveal (IntersectionObserver), theme switcher with localStorage
- **Project pages**: Shared template - nav, theme switcher, back link, project hero, repeatable sub-project sections, footer

## Serving Locally
```
npx http-server -p 8080 -c-1
```

## Verification
After making visual changes, start the local server yourself (`npx http-server -p 8080 -c-1` in background) and use `playwright-cli` to screenshot the page and verify the result. Do not prompt the user to start the server.

Before starting the server, check if port 8080 is already in use (e.g. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080`). Skip starting if it's already running.

The local server must be running before taking screenshots.

The `.reveal` class sets `opacity: 0` and `translateY(24px)` - elements only become visible when the IntersectionObserver adds `.visible` on scroll. Playwright screenshots don't trigger scroll events, so `.reveal` elements below the fold appear invisible. **Fix**: temporarily override `.reveal` to `opacity: 1; transform: translateY(0)` in `shared.css` before screenshots, then revert after. Delete any screenshot files (e.g., `screenshot.png`) after verification is complete.

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

### Playwright Tips
- **Scrolling to sections**: Use `npx playwright-cli eval "() => document.querySelector('#work').scrollIntoView()"` to scroll to a specific element before taking a screenshot.
- **Expanding work cards**: Work cards use `.expanded` class toggled by JS. To expand a card for screenshots, use `npx playwright-cli eval "() => document.querySelector('.work-card').classList.add('expanded')"` then wait ~2s for the `max-height` transition before screenshotting. Use `.querySelectorAll('.work-card')[N]` to target a specific card by index.
- **Running JS on page**: Use `npx playwright-cli eval "() => { ... }"` (arrow function string) for page-level JavaScript execution.
- **Reload after CSS changes**: After editing CSS files, run `npx playwright-cli reload` before screenshotting, as the browser may cache old styles.

## Writing & Tone
- **No em dashes**. Never use `—`, `&mdash;`, or long dashes anywhere. Use commas, periods, or restructure the sentence instead. Hyphens (`-`) are fine for separators in labels and metadata.
- **Serious, direct tone**. No grandiose or marketing-style language. State what was built and how, not how impressive it is.
- **No filler phrases** like "I care deeply about", "relentlessly", "from zero", or "let's build something together".
- **Technical writing should be digestible**. If describing a system, lead with what the player/user experiences, then explain the implementation.
- **Factual subheadings**. Describe what the project is, not a tagline pitch.

## Conventions
- No build tools or bundler - static HTML/CSS/JS only
- Shared styles in `css/shared.css`, project-specific styles in `css/project.css`
- Use CSS custom properties (`var(--...)`) for all colours; never hardcode colour values in element styles
- Theme-specific overrides go in `[data-theme="<name>"]` selector blocks
- Every page must include the inline `<script>` in `<head>` for theme persistence (before CSS loads)
- Nav links on project pages must be prefixed with `index.html#` (e.g., `index.html#work`)
- `@playwright/cli` is used for screenshots/testing (`npm install -g @playwright/cli@latest` if not installed)

## Preferences
- **Use CLAUDE.md for persistent notes**, not the auto-memory directory. If something needs to be remembered across sessions, add it here.
