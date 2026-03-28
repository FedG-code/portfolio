# Bug Fix: Brutalist Home Card Fly-Clone Text Misalignment

## The Bug

The fly-clone alignment test fails on **brutalist theme, card 3 (Home)** at all viewport sizes. Text delta x is ~56px (tolerance is 5px). All other theme/card combinations pass.

```
node tests/fly-clone-alignment-test.js --theme=brutalist --card=3 --viewport=desktop
```

## Root Cause

The fly animation in `js/page-transition.js` doesn't account for the target element's padding when positioning the clone.

**Clone creation** (`applyCloneStyles`, line ~486): strips source padding and sets `padding: 0` on the clone. Positions the clone at the source's text edge — this is correct.

**Fly tween** (`transitionToHome`, line ~253): animates the clone to `targetTitleRect.left` / `targetTitleRect.width` — the target's **bounding box**. But the clone still has `padding: 0`, so its text sits at the left edge of the bounding box. The real target (`[data-theme="brutalist"] .hero h1`, shared.css:1775) has `padding: 0 clamp(1.5rem, 5vw, 3.5rem) 0`, so its text starts ~56px inward. The clone's text and the target's text don't align.

**Why only brutalist card 3:** Other themes' hero h1 has no horizontal padding. Cards 0-2 fly to `.project-hero-title` which also has no horizontal padding.


### Key files
- `js/page-transition.js` — `applyCloneStyles()` (~486), `getTargetTypography()` (~518), `transitionToHome()` (~192), `transitionToProject()` (~330)
- `css/shared.css:1775` — the brutalist h1 padding rule (do not change)
- `tests/fly-clone-alignment-test.js` — run to verify

### Verification
```
npx http-server -p 8080 -c-1
node tests/fly-clone-alignment-test.js --theme=brutalist --card=3 --viewport=desktop
node tests/fly-clone-alignment-test.js   # full suite, 70 tests
```
