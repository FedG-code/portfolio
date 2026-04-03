# Handoff: Build Formal Test Suite for Destruction System

## What changed (branch: `remove-mobile-downgrades`)

We removed all mobile-specific visual downgrades from `destruction.js` and `plane.js` by fixing three root-cause bottlenecks:

1. **Document-relative cache** — `charRectCache` now stores `{el, docX, docY}` (document-relative coords). No more scroll listener, no more O(n) scroll-delta adjustment. Cache only rebuilds on init/resize/theme change.

2. **Spatial grid** — `getCharsInBlastRadius()` uses an 80px grid (`spatialGrid`) for O(1) hit detection instead of O(n) linear scan through all visible characters.

3. **Tween pressure monitor** — `activeBatchCount` tracks in-flight scatter batches. `onProjectileAt()` returns early when `activeBatchCount >= MAX_ACTIVE_BATCHES` (6). Cache rebuilds are also deferred while batches are in-flight to avoid layout thrashing from `getBoundingClientRect()` during active animation.

All `_isMob` branches removed. Mobile now gets physics2D gravity arcs, color flash, 720deg rotation, full stagger timing — identical to desktop.

## What the current tests (`tests/perf-test-destruction.js`, `tests/perf-test.js`) do

- Emulate iPhone 14 with **4x CPU throttle** (very aggressive)
- Measure frame timing across 7 destruction scenarios + 4 general scenarios
- Report flags when metrics exceed hardcoded thresholds
- **Do NOT exit non-zero on failure** — purely diagnostic JSON output
- Thresholds were calibrated for the OLD throttled mobile experience and need recalibrating

## What the current tests DON'T catch

**Correctness:**
- Whether the spatial grid returns the same hits as the old linear scan (could miss edge-case chars near cell boundaries)
- Whether document-relative coords stay accurate after scroll (the core assumption of Phase 1 — never tested in isolation)
- Whether the tween pressure monitor (`activeBatchCount`) correctly increments/decrements (a leaked increment = permanent throttle, a missed increment = no protection)
- Whether deferred cache rebuild actually fires when all batches complete (if `activeBatchCount` never reaches 0, cache stays stale forever)
- Whether reformed characters re-enter the cache and grid after rebuild

**Behavioural:**
- Desktop regression — no desktop viewport tests exist at all, everything is iPhone 14 emulation
- The actual user-facing issue: whether rapid sustained firing causes visible stutter or animation corruption on real devices (not just frame timing numbers)
- Whether `MAX_ACTIVE_BATCHES = 6` is the right threshold — too low means dropped visual feedback, too high means jank
- Card play animation still working after destruction changes (page-transition.js depends on destruction's `revertElement()` and `onThemeChange()`)

**Structural:**
- No pass/fail exit codes — CI can't gate on these
- No baseline comparison — can't tell if a commit regressed or improved without manually comparing JSON
- No test for the "cache not stale after resize" warning that appeared in Phase 2 of destruction tests

## What a proper suite should cover

### 1. Unit-level correctness tests (headless, no visual)

- Spatial grid: given known char positions, verify `getCharsInBlastRadius()` returns exact same results as a brute-force linear scan
- Document-relative coords: scroll the page, verify cache entries still map to correct screen positions via `docY - scrollY`
- Pressure monitor: fire N impacts rapidly, verify `activeBatchCount` never exceeds `MAX_ACTIVE_BATCHES`, verify it returns to 0 after all animations complete
- Cache lifecycle: trigger reform -> verify `cacheStale = true` -> verify rebuild fires after last batch completes -> verify reformed chars are back in grid

### 2. Integration tests (Playwright, multiple viewports)

- Desktop (1920x1080): fire at text, verify chars scatter with physics2D arcs, reform correctly
- Mobile (375x812): same test — should now look identical to desktop
- Tablet (1024x768): same test
- Cross-page: trigger card play -> navigate -> verify destruction re-initializes on new page

### 3. Performance regression tests (with proper baselines)

- Run perf scenarios, compare against stored baseline JSON, flag regressions >10%
- Separate thresholds for desktop vs mobile (mobile will always be slower)
- Exit non-zero when regression exceeds tolerance
- Recalibrate mobile thresholds for the unified (non-throttled) experience

### 4. Stress tests (keep existing scenarios but fix thresholds)

- `sustained_annihilation` threshold should be ~2x the old mobile threshold since we're now running full physics
- `figure8_scroll_fire` should account for scroll NOT triggering cache rebuilds anymore (it's cheaper now, but physics is heavier)

## Key files

- `js/destruction.js` — all cache, grid, pressure monitor, animation code
- `js/plane.js` — projectile impact trigger (lines ~648-655)
- `tests/perf-test-destruction.js` — existing destruction perf scenarios
- `tests/perf-test.js` — existing general perf scenarios
- `tests/CLAUDE.md` — test documentation (update with new suite)

## Key constants to test around

```
MAX_ACTIVE_BATCHES = 6    // tween pressure cap
GRID_CELL_SIZE = 80       // spatial grid cell size (2x BLAST_RADIUS)
BLAST_RADIUS = 40         // impact radius
MAX_SHATTERED = 300       // concurrent shattered char cap
```
