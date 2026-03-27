Bugs / Issues

1. Space Mono loaded twice (index.html, logifuture.html, coffin-likker.html, lost-satellite.html)

The Brutalist link and the Neon link both request Space Mono:

<link href="...family=Space+Mono...&family=Literata..." rel="stylesheet">

<link href="...family=Sora...&family=Space+Mono..." rel="stylesheet">

The second Space Mono request is redundant. Consolidate Space Mono into a single link (either one) to avoid the extra network round-trip on all four pages. Fix this →

2. files/direction-5-bold-accent.html is a development artifact

This HTML direction/exploration file was added but doesn't belong in production. The other planning files (files/phase-1-css.md etc.) were deleted in this PR — this one was missed. Fix this →

3. Dead CSS — .scroll-hidden class is now unreachable

shared.js removed the scroll event listener that applied .scroll-hidden to .theme-switcher and .plane-toggle. The CSS in the mobile media query still references these:

/* css/shared.css ~line 901 */
.theme-switcher.scroll-hidden, .plane-toggle.scroll-hidden { opacity: 0; pointer-events: none; transition: opacity 0.3s; }

Since no JS applies .scroll-hidden anymore, these rules are dead. Either re-add the scroll-hide logic or remove these CSS rules. Fix this →
Minor Issues

4. Redundant migration IIFE in shared.js

The migration at lines 21–28 of shared.js can never execute. By the time shared.js runs, the inline <head> script has already migrated coral/slate to bold in both localStorage and the data-theme attribute. The IIFE always sees 'bold' — never 'coral' or 'slate'. It's harmless but adds noise; remove it.

5. Magic number in contact padding

/* css/shared.css */
.contact { padding: 6rem 0 220px; }

No comment explains why 220px. Add a short comment: /* bottom: extra clearance for card hand */.

6. Convention: hardcoded colours in theme blocks

CLAUDE.md says: "Use CSS custom properties (var(--...)) for all colours; never hardcode colour values in element styles." There are many hardcoded hex values in the new theme blocks (e.g. color: white, background: #1A5C52, color: #F0EBE0). Most of these are inside [data-theme="..."] overrides and are intentionally fixed values, but it's worth deciding if these should be additional per-theme CSS variables (e.g. --retro-teal, --retro-cream) to keep the convention consistent and make future tweaks easier.
