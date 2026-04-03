# Tests Reference Map

Overview: 14 Playwright test files (~5,400 lines). Three categories: destruction correctness/integration/regression (4 files), performance benchmarks (2 files), and visual/interaction regression tests (8 files). All require `npx http-server -p 8080 -c-1` running locally. All use Chromium.

## Running Tests

All tests: `node tests/<filename>.js`
Prerequisite: local server on port 8080.

Run full destruction suite: `node tests/run-destruction-suite.js`

## Destruction Test Suite

### run-destruction-suite.js (~60 lines)

**Purpose**: Aggregate runner for CI. Runs correctness, integration, and perf regression tests in sequence.

**Exit**: 0 = all pass, 1 = any failure.

---

### destruction-correctness-test.js (~350 lines)

**Purpose**: Validates correctness of the three bottleneck fixes from remove-mobile-downgrades: spatial grid, document-relative cache, tween pressure monitor, and cache lifecycle.

**Setup**: Chromium headless, desktop 1920x1080, no CPU throttle.

#### Suites
| Suite | Tests | What It Validates |
|-------|-------|-------------------|
| Spatial Grid Accuracy | 20 test points | `getCharsInBlastRadius()` returns identical results to brute-force linear scan |
| Document-Relative Coords | 30 checks (3 scroll states x 10 entries) | Cache entries map to correct screen positions after scrolling |
| Tween Pressure Monitor | 4 checks | `activeBatchCount` never exceeds MAX_ACTIVE_BATCHES (6), returns to 0 after completion |
| Cache Lifecycle | 6 checks | Shatter -> reform -> cacheStale -> rebuild -> reformed chars back in grid |

**Key technique**: Brute-force reference scan runs before grid lookup (non-destructive read vs destructive splice). Cache rebuilt between test points.

**Pass/fail**: `process.exit(0/1)` based on all assertions.

---

### destruction-integration-test.js (~280 lines)

**Purpose**: Validates scatter + reform across multiple viewports and verifies mobile-desktop parity.

**Setup**: Chromium headless, 3 viewports (desktop 1920x1080, mobile 375x812, tablet 1024x768).

#### Tests
| Test | Viewports | What It Validates |
|------|-----------|-------------------|
| Scatter and Reform | All 3 | Chars shatter on impact, reform back to original state |
| Mobile-Desktop Parity | Desktop + Mobile | Animation constants identical (GRAVITY, MAX_ROTATION, etc.), mobile can fire multiple batches |
| Cross-Page Re-init | Desktop | Destruction works after SPA card play navigation to project page |

**Pass/fail**: `process.exit(0/1)`.

---

### destruction-perf-regression-test.js (~400 lines)

**Purpose**: Baseline-aware performance regression detection with proper exit codes.

**Setup**: Chromium headless, desktop (1920x1080, no throttle) + mobile (375x812, 2x throttle).

#### Scenarios (subset of perf-test-destruction.js)
| Scenario | What It Measures |
|----------|-----------------|
| scatter_spike | Single impact scatter frame timing |
| dense_burst | 6 rapid-fire impacts burst + scatter |
| figure8_scroll_fire | Lissajous scroll + destruction |
| sustained_annihilation | Dense grid fired 6 cycles |

**Baselines**: Stored in `tests/baselines/<viewport>.json`. First run creates baseline. Subsequent runs compare.

**Tolerance**: 10% desktop, 15% mobile (configurable via `--tolerance`).

**CLI flags**: `--update-baseline`, `--viewport desktop|mobile|all`, `--tolerance N`.

**Exit**: 0 = pass/baseline created, 1 = regression, 2 = crash.

## Performance Tests

### perf-test.js (412 lines)

**Purpose**: Mobile frame timing under 4x CPU throttle across scroll + plane scenarios.

**Setup**: Chromium headless, iPhone 14 (390x844, 3x DPR), 4x CPU throttle, dropped-frame threshold 20ms.

#### Section Map
| Section | Lines | Notes |
|---------|-------|-------|
| Imports & constants | 0-35 | Viewport 390x844, 3x DPR, 4x CPU throttle, 20ms drop threshold |
| Frame timing helpers | 39-82 | injectFrameCollector(), collectFrames(), computeFrameStats() -- RAF-based |
| CDP metrics helpers | 84-109 | getCdpMetrics(), diffMetrics() -- LayoutCount, RecalcStyleCount, ScriptDuration |
| programmaticScroll() | 113-137 | Ease-in-out scroll over 5000ms |
| Reveal override | 141-148 | Forces .reveal opacity:1 |
| waitForPageReady() | 152-169 | Navigates, waits for GSAP/TextDestruction/button |
| activatePlaneMode() | 173-188 | Clicks toggle, waits for plane-active + canvas + GLB |
| runScenario() | 192-207 | Wraps scenario with metric capture |
| Scenario functions | 211-256 | 4 scenarios |
| buildAnalysis() | 260-313 | Compares baseline vs plane overhead, identifies bottleneck |
| main() | 317-412 | Browser launch, 2 phases (baseline then plane), JSON output |

#### Scenarios
| Scenario | Lines | Measures |
|----------|-------|----------|
| baseline_scroll | 211-216 | Scroll without plane -- frame baseline |
| plane_idle_scroll | 218-223 | Scroll with plane active but not firing |
| plane_firing_scroll | 225-248 | Sine-wave mouse + scroll -- triggers firing & auto-scroll |
| post_scroll_reform | 250-256 | Mouse release + 3000ms idle for reform animations |

**Output**: JSON to stdout with scenarios + analysis (baselineOk, planeOverheadMs, firingOverheadMs, worstOffender, likelyBottleneck).

**Key thresholds** (in buildAnalysis): avgFrameMs > 25 = bad baseline.

---

### perf-test-destruction.js (1021 lines)

**Purpose**: Isolates destruction.js frame spikes via direct `TextDestruction.onProjectileAt()` calls. Windowed measurement prevents broad averaging from hiding spikes.

**Setup**: Same as perf-test.js (Chromium headless, iPhone 14, 4x CPU throttle).

#### Section Map
| Section | Lines | Notes |
|---------|-------|-------|
| Imports & constants | 0-36 | Same viewport/throttle as perf-test.js |
| Thresholds | 38-77 | Per-scenario metric limits |
| Frame/CDP helpers | 82-124 | computeFrameStats() with droppedFramePct, getCdpMetrics(), diffMetrics() |
| Reveal override + page ready | 126-158 | Reused from perf-test.js |
| Marker-aware frame collector | 162-211 | injectMarkerFrameCollector(), stopFrameCollector(), sliceFramesByMarkers() |
| Direct impact helper | 213-220 | directImpact(page, x, y) -- calls onProjectileAt directly |
| Destruction stats helpers | 222-281 | getElementCenter(), getDestructionStats(), scrollToElement(), ensureDestructionArmed(), resetDestructionState() |
| Scenario: scatter_spike | 283-334 | Single impact on #about |
| Scenario: cache_rebuild | 336-383 | Stale cache via resize + impact |
| Scenario: dense_burst | 385-480 | 6 impacts at 100ms intervals |
| Scenario: overlap_scatter_reform | 482-551 | 3 staggered impacts on hero |
| Scenario: high_count_reform | 553-620 | 8-10 impacts, reform observation |
| Scenario: figure8_scroll_fire | 622-688 | Lissajous pattern + scroll |
| Scenario: sustained_annihilation | 690-797 | 60+ grid points x 6 cycles |
| buildAnalysis() | 799-936 | Checks all 7 vs thresholds |
| main() | 938-1021 | 7 phases, JSON output |

#### Scenarios & Thresholds
| Scenario | Lines | Measures | Key Thresholds |
|----------|-------|----------|----------------|
| scatter_spike | 283-334 | Single impact scatter window | maxFrame <=40ms, p95 <=30ms, avg <=22ms |
| cache_rebuild | 336-383 | rebuildCharCache() cost after resize | maxFrame <=50ms |
| dense_burst | 385-480 | 6 rapid impacts, burst vs scatter phases | p95 <=35ms, dropped <=30%, Script <=800ms |
| overlap_scatter_reform | 482-551 | Triple wave overlap (scatter+reform) | maxFrame <=50ms, p95 <=35ms |
| high_count_reform | 553-620 | Reform at near MAX_SHATTERED chars | maxFrame <=60ms, p95 <=30ms |
| figure8_scroll_fire | 622-688 | Scroll + destruction simultaneously | maxFrame <=60ms, p95 <=35ms, avg <=25ms, dropped <=40% |
| sustained_annihilation | 690-797 | All text destroyed repeatedly | overlap: maxFrame <=70ms, p95 <=40ms, avg <=25ms, dropped <=40% |

**Output**: JSON to stdout with scenarios (each with sub-windows) + analysis (flags array, flagCount, worstScenario).

**Key technique**: Marker-based windowed measurement -- `window.__perfMark(name)` inserts named markers into RAF frame array, then `sliceFramesByMarkers()` extracts stats for specific time windows.

---

## Transition & Animation Tests

### title-jump-diagnostic.js (257 lines)

**Purpose**: Detects vertical position jumps in `.project-hero-title` after card-to-page fly-in.

| Section | Lines | Notes |
|---------|-------|-------|
| Constants | 0-15 | JUMP_THRESHOLD=2px, default card id=1 |
| measureAllHeroElements() | 16-74 | BBox on clone + title/badge/desc/meta |
| Browser setup | 76-91 | Headless:false, 1280x800 |
| Instrumentation | 92-117 | MutationObserver on flyOverlay |
| Card trigger | 119-127 | playCard(el, CARD_ID) |
| Polling loop | 128-149 | 8s, 200ms intervals, 6 screenshots |
| Summary + detection | 150-233 | Flags jumps >2px |
| Result | 235-257 | PASS if jumpCount==0 |

**Config**: Headless:false, 1280x800, single card (default id=1, configurable via argv).
**Pass/fail**: No title jumps >2px. Screenshots to `tests/diag-ck-*.png`.

---

### home-title-jump-diagnostic.js (680 lines)

**Purpose**: Extended title jump diagnostics for home card transitions. Tests char-based fly animation (TextRearrange), plus project transitions as prerequisite.

| Section | Lines | Notes |
|---------|-------|-------|
| Constants & config | 0-76 | JUMP_THRESHOLD=2px, 5 themes x 2 cards x 7 viewports |
| Viewport matrix | 55-72 | 7 viewports: 375x812 to 2560x1440 |
| parseFlags() | 79-101 | CLI: --theme, --card, --viewport |
| measureHeroElements() | 109-175 | Measures char spans from TextRearrange + h1/badge/heroBody |
| checkLandingAccuracy() | 182-234 | Polls chars vs title at 50ms intervals |
| runDiagnostic() | 238-581 | Per-combo: load, set theme, instrument, play, poll, report |
| Main loop | 583-675 | Matrix of theme x card x viewport combos |

**Config**: Headless:false, 7 viewports, 5 themes. For home card: plays card 0 first (5s), then card 3 (8s).
**Pass/fail**: No jumps >2px, landing miss <=2px, reflow miss <=2px.

---

### fly-clone-alignment-test.js (459 lines)

**Purpose**: Verifies flying title clone lands aligned on real target across all theme/card/viewport combos.

| Section | Lines | Notes |
|---------|-------|-------|
| Constants & config | 0-76 | POSITION_TOLERANCE=5px, SIZE_TOLERANCE=10px, 7 viewports |
| CLI parsing | 77-100 | --theme, --card, --all-cards, --viewport, --width/--height |
| testFlyAlignment() | 114-361 | Core: load, set theme, inject probe, play card, measure clone vs target |
| MutationObserver probe | 154-272 | Same-frame paired BBox measurement of clone + target |
| Alignment checks | 318-341 | Position <=5px, size <=10px, text <=5px |
| Main loop | 363-454 | Matrix: themes x cards x viewports |

**Config**: Headless:true, 7 viewports, 5 themes, cards 0+3 default.
**Measurement**: MutationObserver + rAF loop measuring clone and target getBoundingClientRect on same frame. Also measures first text node via Range.
**Pass/fail**: Position delta <=5px, size delta <=10px, text delta <=5px.

---

### transition-refresh-test.js (285 lines)

**Purpose**: Detects invisible "flash" or slow fade-in of `.work-image` after flying clone removal.

| Section | Lines | Notes |
|---------|-------|-------|
| Constants | 0-31 | TIME_SETTLE=5000ms, OBSERVATION_WINDOW=2000ms, card 1 |
| run() setup | 32-40 | Headless:true, 1280x800 |
| Perf + Mutation observers | 41-135 | PerformanceObserver for CLS, rAF probe for effective opacity |
| Card trigger | 141-156 | playCard on card 1 |
| Gap/fade analysis | 158-225 | Counts frames where clone gone + image invisible |
| Result | 230-279 | 4 checks: CLS <=0.05, no DOM bursts, no gap, <=5 fade-in frames |

**Config**: Headless:true, 1280x800, card 1 only.
**Key technique**: Effective opacity = product of all ancestor opacities (traverses chain).
**Pass/fail**: CLS <=0.05, no image gap frames, <=5 fade-in frames.

---

### blur-overlay-cleanup-test.js (266 lines)

**Purpose**: Verifies #dragBlurOverlay is fully cleared after card play. Catches WebKit bug where webkitBackdropFilter persists.

| Section | Lines | Notes |
|---------|-------|-------|
| Constants | 0-21 | MOBILE 390x844, DESKTOP 1280x800, SETTLE 6000ms |
| triggerCardPlayAndWait() | 31-49 | Plays card 1, waits 6s |
| getOverlayState() | 52-68 | Reads inline + computed styles |
| isBlurCleared() / isBgCleared() | 70-76 | Checks for 'none', 'blur(0px)', transparent, etc. |
| Test: mobile-webkit | 80-118 | Inline webkitBackdropFilter cleared |
| Test: desktop-webkit | 120-152 | Same on desktop |
| Test: mobile-computed | 154-186 | Computed blur value < 0.5px |
| Test: overlay-non-blocking | 188-234 | No residual blur/bg in computed styles |
| Runner | 236-266 | 4 tests, exit 0/1 |

**Config**: Mobile (390x844) + Desktop (1280x800).
**Pass/fail**: All blur/bg values cleared after 6s settle.

---

## Mobile Tests

### mobile-touch-test.js (360 lines)

**Purpose**: Verifies card hand touch interactions: tap-to-lift, unlift, drag, scroll-lock, plane blocking, outside dismissal, play zone scaling, hover suppression.

| Section | Lines | Notes |
|---------|-------|-------|
| Setup | 0-32 | iPhone 14 (390x844, 2x, hasTouch) |
| CDP touch helpers | 34-97 | touchTap() (50ms hold), touchDrag() (interpolated steps, 16ms each) |
| Test: tap-to-lift | 101-118 | Verify hover-active class |
| Test: tap-to-unlift | 120-141 | Second tap removes class |
| Test: drag-without-lift | 143-166 | No DRAGGING state after drag |
| Test: scroll-lock | 168-210 | card-dragging class during drag |
| Test: plane-mode-block | 212-235 | plane-active blocks tap |
| Test: outside-dismiss | 237-269 | Tap away clears lifted state |
| Test: play-zone-scaling | 271-293 | Zone caps at 385/289 |
| Test: hover-suppressed | 295-325 | Touch pointerover doesn't trigger hover |
| Runner | 329-360 | 8 tests |

**Config**: iPhone 14 (390x844, 2x scale, isMobile, hasTouch).
**Touch simulation**: CDP Input.dispatchTouchEvent (not Playwright gestures).

---

### mobile-hand-test.js (112 lines)

**Purpose**: Verifies all cards visible and fit within viewport across 4 sizes.

| Section | Lines | Notes |
|---------|-------|-------|
| Setup | 0-16 | 4 viewports |
| VIEWPORTS | 18-23 | iPhone SE 375x667, iPhone 14 390x844, Pro Max 430x932, QHD 2560x1440 |
| Viewport loop | 30-94 | Per-viewport: count cards, check hFits + visibleAboveFold |
| Output | 96-106 | JSON results |

**Pass/fail**: >=3 cards, each within +/-5px horizontal bounds and >=30px visible above fold.

---

## Layout Tests

### hero-layout-test.js (179 lines)

**Purpose**: Checks bold theme hero layout (tidbits below desc, content flush-left, no circle overlap).

| Section | Lines | Notes |
|---------|-------|-------|
| Setup | 0-21 | 5 resolutions |
| RESOLUTIONS | 23-29 | 2560x1440, 1920x1080, 1440x900, 1024x768, 375x812 |
| Resolution loop | 42-163 | Set bold theme, measure hero elements, 4 layout checks |
| Screenshot | 118-123 | tests/screenshots/hero-bold-{w}x{h}.png |

**Layout checks** (bold theme):
1. `tidbits_below_desc`: tidbits top >= desc bottom - 2px
2. `content_flush_left`: body left <= 80px
3. `content_left_aligned`: body right <= vw x ratio (0.6 desktop, 0.75 tablet, 1.0 mobile)
4. `tidbits_no_circle_overlap`: tidbits right <= vw x 0.56 (only checked at vw > 1200)

---

## Cross-File Patterns

| Pattern | Files |
|---------|-------|
| iPhone 14 emulation (390x844) | perf-test, perf-test-destruction, mobile-touch-test, blur-overlay-cleanup |
| CDP touch events | mobile-touch-test |
| playCard() trigger | title-jump, home-title-jump, fly-clone, transition-refresh, blur-overlay |
| RAF-based frame collection | perf-test, perf-test-destruction |
| MutationObserver on flyOverlay | title-jump, home-title-jump, fly-clone |
| Reveal override CSS | perf-test, perf-test-destruction, hero-layout |
| Multi-theme matrix | fly-clone, home-title-jump |
| Multi-viewport matrix | fly-clone, home-title-jump, mobile-hand |

## Common Uncertainties
- Several tests call `window.playCard()` without defining it -- it is expected to exist on the page (from page-transition.js)
- Headless:false tests (title-jump, home-title-jump) require a display
- Home card tests require playing a project card first to get the home card into the hand -- complex setup with 5s+ waits
- Touch simulation uses CDP directly rather than Playwright's built-in touch API
