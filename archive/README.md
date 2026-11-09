# Archive

Code the live site no longer uses, kept for reference. Nothing in here is loaded by any page. Paths inside these files are the ones they had when they were live (e.g. `js/card-hand.js`, `assets/...`), so they won't run from this folder without moving them back.

| Folder | What | From |
|--------|------|------|
| `card-hand/` | The card-hand homepage: `card-hand.js` (fan, drag, play zone, attractor), `page-transition.js` (card play + SPA transitions), `text-rearrange.js` (title flight), `toolbar.js` (theme switcher), `cards.css`, the card icons (`assets/`), and their Playwright tests. | Last live at commit `2ad4150` (before the Dolly Gallery). |
| `paper-plane/` | The paper plane and text destruction: `plane.js`, `destruction.js`, `plane-key.js` (P-key loader), and the destruction/perf test suites with baselines. | Last live at commit `7471f29`. |
| `legacy/` | Older leftovers that were already unused: `backup/` (nav styles, two unused themes, a work-cards note, an old project page copy) and `plans/` (early copies of page-transition.js and text-rearrange.js). | Moved here on 2026-11-09. |

Not archived: the plane's 3D model (`assets/plane.glb`) was deleted at the user's request; it's in git history (commit `7471f29`). `plane.js` loads it from `assets/plane.glb`, so restore it from history if the plane ever comes back.

Notes for reviving:
- The card hand expects the old homepage markup (`#handContainer`, `#pageContainer`, `.spa-page`, the hero) and GSAP + SplitText from the CDN. Its docs were in `js/CLAUDE.md` and `css/CLAUDE.md` at commit `2ad4150`.
- The plane draws in its own WebGL canvas (the homepage gallery already uses one), needs GSAP + SplitText + Physics2DPlugin, and `destruction.js`'s `DESTRUCTIBLE_SELECTOR` targets the gallery and project page text as of `7471f29`.
- `card-hand/tests/toolbar-shadow-test.js` needs `pngjs`, which was dropped from `package.json`.
