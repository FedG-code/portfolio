# Handoff: Home Card Char-Fly Landing Miss

## Problem

When playing the Home card (card 3) to return to the index page, the TextRearrange char-fly animation lands at the wrong position. The flying characters end up near `(0, 0)` while the real hero `<h1>` renders at `(48, 209.6)` — a ~210px vertical and ~48px horizontal miss.

## Test

`tests/home-title-jump-diagnostic.js` now detects this. Run:

```bash
node tests/home-title-jump-diagnostic.js
```

The test checks two things:
1. **Title jumps** — frame-to-frame position jumps on the hero h1 (original check, currently passing)
2. **Landing accuracy** — whether the last char span positions match the final h1 position (currently FAILING: dx=-48px, dy=-210px)

The threshold for both checks is `JUMP_THRESHOLD` (2px).

## Root Cause

`transitionToHome()` in `page-transition.js` calls `TextRearrange.fly()` with the card's `.card-art-title` as `sourceEl` and the hero `h1` as `targetEl`. The fly function measures the target's `getBoundingClientRect()` to compute landing positions, but:

- The home page wrapper may not be fully laid out when measurements are taken (the wrapper is injected and `.measuring` class is used, but scroll position and layout may not have settled)
- The `#page-home` element's position in the DOM at measurement time may differ from its final rendered position
- The h1 could still be affected by `.reveal` (opacity:0, translateY:24px) when measured, giving wrong coordinates

## Key Files

- `js/page-transition.js` — `transitionToHome()` (~line 362-427) where fly() is called for the Home card
- `js/text-rearrange.js` — `fly()` and `measureDirect()` which compute source/target char positions
- `tests/home-title-jump-diagnostic.js` — the diagnostic test (updated to detect landing misses)

## What Was Changed in This Session

- Updated `tests/home-title-jump-diagnostic.js` to work with the new TextRearrange char-fly animation (previously looked for a single clone element, now measures combined char span bounding boxes)
- Added fly landing accuracy check: compares last char span positions against the first visible h1 position, fails if delta exceeds 2px
- Added `chars#` column to the diagnostic table showing active char span count per sample
- MutationObserver now watches for char span insertion with `subtree: true`

## Diagnostic Data (bold theme, 1280x800)

```
Chars START: left=381.5, top=211.9 (27 chars)
Card title:  left=367.5, top=221.9  → start MISMATCH dx=14px, dy=-10px

Last chars:      left=0.0,  top=0.0
First visible h1: left=48.0, top=209.6  → landing MISS dx=-48px, dy=-210px
```

The chars fly to roughly `(0, 0)` instead of `(48, 210)`. The start mismatch (14px dx) is likely the card title's CSS padding offset.
