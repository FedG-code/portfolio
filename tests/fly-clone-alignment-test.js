/**
 * Fly-Clone Alignment Test
 *
 * Verifies that the flying title clone lands on top of the real target title
 * during card-play page transitions. Catches misalignment caused by theme-
 * specific layouts, wrong font metrics, or measurement bugs.
 *
 * Reusable: specify theme, card ID, and viewport via CLI flags.
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   # Run default suite (all themes × key viewports × home card)
 *   node tests/fly-clone-alignment-test.js
 *
 *   # Run a specific combination
 *   node tests/fly-clone-alignment-test.js --theme=brutalist --card=3 --width=2560 --height=1440
 *
 *   # Test a project page card on a single theme
 *   node tests/fly-clone-alignment-test.js --theme=bold --card=0 --width=1920 --height=1080
 *
 * Flags:
 *   --theme=<name>    Single theme to test (bold|cinematic|brutalist|retro|neon)
 *   --card=<id>       Card ID to play (0=Logifuture, 1=Coffin-Likker, 2=Lost Satellite, 3=Home)
 *   --width=<px>      Viewport width
 *   --height=<px>     Viewport height
 *
 * When no flags are given, runs the full matrix.
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';

// ── Tolerance ──────────────────────────────────────────────
// Max pixel difference between clone final position and real target position.
// Accounts for sub-pixel rounding and minor font metric variance.
const POSITION_TOLERANCE = 12;
const SIZE_TOLERANCE = 20;

// ── Default matrix ─────────────────────────────────────────
const ALL_THEMES = ['bold', 'cinematic', 'brutalist', 'retro', 'neon'];

const ALL_VIEWPORTS = [
  { width: 1280, height: 800,  label: '1280×800'  },
  { width: 1920, height: 1080, label: '1920×1080' },
  { width: 2560, height: 1440, label: '2560×1440' },
  { width: 1024, height: 768,  label: '1024×768'  },
];

// Card 3 = Home (targets .hero h1). Other cards target .project-hero-title.
const ALL_CARDS = [3];

// ── CLI flag parsing ───────────────────────────────────────
function parseFlags() {
  var flags = {};
  process.argv.slice(2).forEach(function(arg) {
    var m = arg.match(/^--(\w+)=(.+)$/);
    if (m) flags[m[1]] = m[2];
  });
  return flags;
}

// ── Results tracking ───────────────────────────────────────
var results = [];
var allPassed = true;

function report(name, passed, detail) {
  results.push({ name: name, passed: passed, detail: detail });
  if (!passed) allPassed = false;
  var icon = passed ? 'PASS' : 'FAIL';
  console.log('  [' + icon + '] ' + name + (detail ? ' — ' + detail : ''));
}

// ── Core test function ─────────────────────────────────────
async function testFlyAlignment(browser, theme, cardId, viewport) {
  var label = theme + ' card=' + cardId + ' ' + viewport.label;
  var context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  var page = await context.newPage();

  try {
    // 1. Load page and wait for hand to settle
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      function() { return typeof gsap !== 'undefined' && typeof playCard === 'function'; },
      { timeout: 15000 }
    );
    await page.waitForTimeout(1500);

    // 2. Set theme
    await page.evaluate(function(t) {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('portfolio-theme', t);
    }, theme);
    // Allow theme CSS to reflow
    await page.waitForTimeout(300);

    // 3. If we're testing a home-card transition, we need to first navigate
    //    AWAY from home (to a project page), then play the home card back.
    //    If testing a project card, we play it directly from the index.
    var isHomeCard = cardId === 3;

    if (isHomeCard) {
      // Navigate to a project page first by playing card 0
      await page.evaluate(function() {
        var el = document.querySelector('[data-card-id="0"]');
        if (!el) throw new Error('Card 0 not found for setup navigation');
        playCard(el, 0);
      });
      // Wait for transition to complete and hand to rebuild
      await page.waitForTimeout(5000);
    }

    // 4. Inject measurement probe — captures clone's final rect and target's rect
    await page.evaluate(function(cid) {
      window.__flyTestResult = null;

      // We'll observe the flyOverlay for clone insertion, then poll the clone's
      // position until the animation completes (clone removed from DOM).
      var overlay = document.getElementById('flyOverlay');
      if (!overlay) { window.__flyTestResult = { error: 'No flyOverlay found' }; return; }

      var lastCloneRect = null;
      var cloneStyle = null;
      var cloneFound = false;
      var observer = new MutationObserver(function() {
        if (cloneFound) return;
        // Grab the first fixed-position child — that's always the title clone
        var children = overlay.children;
        var clone = null;
        for (var i = 0; i < children.length; i++) {
          if (children[i].style.position === 'fixed') { clone = children[i]; break; }
        }
        if (!clone) return;
        cloneFound = true;

        // Poll clone position every frame until it's removed
        function pollClone() {
          if (!overlay.contains(clone)) {
            // Clone was removed — animation complete. Measure the real target.
            var isHome = cid === 3;
            var target;
            if (isHome) {
              var homePage = document.getElementById('page-home');
              // Find the visible h1 (themes have alternate hidden layouts)
              var h1s = homePage ? homePage.querySelectorAll('.hero h1') : [];
              for (var j = 0; j < h1s.length; j++) {
                if (h1s[j].offsetHeight > 0) { target = h1s[j]; break; }
              }
              if (!target && h1s.length) target = h1s[0];
            } else {
              target = document.querySelector('.project-hero-title');
            }

            if (!target) {
              window.__flyTestResult = { error: 'Target element not found after transition' };
              return;
            }

            var targetRect = target.getBoundingClientRect();
            window.__flyTestResult = {
              cloneRect: lastCloneRect,
              cloneStyle: cloneStyle,
              targetRect: {
                left: targetRect.left,
                top: targetRect.top,
                width: targetRect.width,
                height: targetRect.height,
              },
            };
            return;
          }

          // Clone still exists — record its current rect
          var r = clone.getBoundingClientRect();
          lastCloneRect = { left: r.left, top: r.top, width: r.width, height: r.height };
          var cs = getComputedStyle(clone);
          cloneStyle = {
            fontFamily: cs.fontFamily,
            fontWeight: cs.fontWeight,
            fontStyle: cs.fontStyle,
            textTransform: cs.textTransform,
            letterSpacing: cs.letterSpacing,
          };
          requestAnimationFrame(pollClone);
        }

        requestAnimationFrame(pollClone);
      });

      observer.observe(overlay, { childList: true });
    }, cardId);

    // 5. Play the card
    await page.evaluate(function(cid) {
      var el = document.querySelector('[data-card-id="' + cid + '"]');
      if (!el) throw new Error('Card ' + cid + ' not found');
      playCard(el, cid);
    }, cardId);

    // 6. Wait for transition to complete
    await page.waitForTimeout(5000);

    // 7. Collect results
    var result = await page.evaluate(function() { return window.__flyTestResult; });

    if (!result) {
      report(label, false, 'No measurement captured (probe never fired)');
      return;
    }
    if (result.error) {
      report(label, false, result.error);
      return;
    }
    if (!result.cloneRect) {
      report(label, false, 'Clone rect was never recorded');
      return;
    }

    var cr = result.cloneRect;
    var tr = result.targetRect;

    // Zero-dimension target means the wrong element was measured (e.g. hidden layout)
    if (tr.width === 0 || tr.height === 0) {
      report(label, false, 'Target has zero dimensions — wrong element selected. target(' + tr.left.toFixed(0) + ',' + tr.top.toFixed(0) + ' ' + tr.width.toFixed(0) + '×' + tr.height.toFixed(0) + ')');
      return;
    }
    if (cr.width === 0 || cr.height === 0) {
      report(label, false, 'Clone has zero dimensions — measurement failed. clone(' + cr.left.toFixed(0) + ',' + cr.top.toFixed(0) + ' ' + cr.width.toFixed(0) + '×' + cr.height.toFixed(0) + ')');
      return;
    }

    var dLeft = Math.abs(cr.left - tr.left);
    var dTop = Math.abs(cr.top - tr.top);
    var dWidth = Math.abs(cr.width - tr.width);
    var dHeight = Math.abs(cr.height - tr.height);

    var posOk = dLeft <= POSITION_TOLERANCE && dTop <= POSITION_TOLERANCE;
    var sizeOk = dWidth <= SIZE_TOLERANCE && dHeight <= SIZE_TOLERANCE;
    var passed = posOk && sizeOk;

    var detail = 'pos Δ(' + dLeft.toFixed(1) + ', ' + dTop.toFixed(1) + ') '
      + 'size Δ(' + dWidth.toFixed(1) + ', ' + dHeight.toFixed(1) + ') '
      + '| clone(' + cr.left.toFixed(0) + ',' + cr.top.toFixed(0)
      + ' ' + cr.width.toFixed(0) + '×' + cr.height.toFixed(0) + ') '
      + 'target(' + tr.left.toFixed(0) + ',' + tr.top.toFixed(0)
      + ' ' + tr.width.toFixed(0) + '×' + tr.height.toFixed(0) + ')';

    report(label, passed, detail);

  } catch (err) {
    report(label, false, 'Error: ' + err.message);
  } finally {
    await context.close();
  }
}

// ── Main ───────────────────────────────────────────────────
async function run() {
  var flags = parseFlags();

  var themes = flags.theme ? [flags.theme] : ALL_THEMES;
  var cards = flags.card !== undefined ? [parseInt(flags.card, 10)] : ALL_CARDS;
  var viewports = (flags.width && flags.height)
    ? [{ width: parseInt(flags.width), height: parseInt(flags.height), label: flags.width + '×' + flags.height }]
    : ALL_VIEWPORTS;

  console.log('Fly-Clone Alignment Test');
  console.log('========================');
  console.log('Themes:    ' + themes.join(', '));
  console.log('Cards:     ' + cards.join(', '));
  console.log('Viewports: ' + viewports.map(function(v) { return v.label; }).join(', '));
  console.log('');

  var browser = await chromium.launch({ headless: true });

  for (var ti = 0; ti < themes.length; ti++) {
    var theme = themes[ti];
    console.log('[' + theme + ']');
    for (var ci = 0; ci < cards.length; ci++) {
      var cardId = cards[ci];
      for (var vi = 0; vi < viewports.length; vi++) {
        await testFlyAlignment(browser, theme, cardId, viewports[vi]);
      }
    }
    console.log('');
  }

  await browser.close();

  // Summary
  console.log('────────────────────────────────');
  var passed = results.filter(function(r) { return r.passed; }).length;
  var failed = results.filter(function(r) { return !r.passed; }).length;
  console.log('Passed: ' + passed + '  Failed: ' + failed + '  Total: ' + results.length);

  if (!allPassed) {
    console.error('\nFAILED: Some alignment tests failed.');
    process.exit(1);
  }
  console.log('\nPASSED: All alignment tests passed.');
  process.exit(0);
}

run().catch(function(err) {
  console.error('Fatal:', err);
  process.exit(2);
});
