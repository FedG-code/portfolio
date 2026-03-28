/**
 * Fly-Clone Alignment Test
 *
 * Verifies that the flying title clone lands on top of the real target title
 * during card-play page transitions. Catches misalignment caused by theme-
 * specific layouts, wrong font metrics, or measurement bugs.
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   # Run default suite (5 themes × 2 cards × 7 viewports = 70 tests)
 *   node tests/fly-clone-alignment-test.js
 *
 *   # Single theme, single viewport (named shortcut)
 *   node tests/fly-clone-alignment-test.js --theme=brutalist --viewport=mobile
 *
 *   # Multiple themes and viewports
 *   node tests/fly-clone-alignment-test.js --theme=bold,retro --viewport=375x812,1920x1080
 *
 *   # All 4 cards at desktop resolution
 *   node tests/fly-clone-alignment-test.js --all-cards --viewport=desktop
 *
 *   # Legacy width/height still works
 *   node tests/fly-clone-alignment-test.js --theme=bold --card=0 --width=1920 --height=1080
 *
 * Flags:
 *   --theme=<name,...>      Comma-separated themes (bold|cinematic|brutalist|retro|neon)
 *   --card=<id,...>         Comma-separated card IDs (0=Logifuture, 1=Coffin-Likker, 2=Lost Satellite, 3=Home)
 *   --all-cards             Test all 4 cards (equivalent to --card=0,1,2,3)
 *   --viewport=<spec,...>   Comma-separated viewports: WxH or shortcut (mobile|tablet|desktop)
 *   --width=<px>            Viewport width  (legacy, prefer --viewport)
 *   --height=<px>           Viewport height (legacy, prefer --viewport)
 *   --help                  Show usage information
 *
 * Viewport shortcuts:
 *   mobile  = 375×812   (iPhone SE / 13 mini)
 *   tablet  = 768×1024  (iPad portrait)
 *   desktop = 1920×1080 (Full HD)
 *
 * When no flags are given, runs the full matrix.
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';

// ── Tolerance ──────────────────────────────────────────────
// Max pixel difference between clone final position and real target position.
// Accounts for sub-pixel rounding and minor font metric variance.
const POSITION_TOLERANCE = 5;
const SIZE_TOLERANCE = 10;

// ── Default matrix ─────────────────────────────────────────
const ALL_THEMES = ['bold', 'cinematic', 'brutalist', 'retro', 'neon'];

const ALL_VIEWPORTS = [
  { width: 1280, height: 800,  label: '1280×800'  },
  { width: 1920, height: 1080, label: '1920×1080' },
  { width: 2560, height: 1440, label: '2560×1440' },
  { width: 1024, height: 768,  label: '1024×768'  },
  { width: 375,  height: 812,  label: '375×812'   },
  { width: 390,  height: 844,  label: '390×844'   },
  { width: 768,  height: 1024, label: '768×1024'  },
];

const VIEWPORT_SHORTCUTS = {
  mobile:  { width: 375,  height: 812,  label: '375×812'  },
  tablet:  { width: 768,  height: 1024, label: '768×1024' },
  desktop: { width: 1920, height: 1080, label: '1920×1080' },
};

// Card 3 = Home (targets .hero h1). Other cards target .project-hero-title.
const DEFAULT_CARDS = [0, 3];
const ALL_CARD_IDS = [0, 1, 2, 3];

// ── CLI flag parsing ───────────────────────────────────────
function parseFlags() {
  var flags = {};
  process.argv.slice(2).forEach(function(arg) {
    var m = arg.match(/^--([\w-]+)=(.+)$/);
    if (m) { flags[m[1]] = m[2]; return; }
    var b = arg.match(/^--([\w-]+)$/);
    if (b) { flags[b[1]] = true; return; }
  });
  return flags;
}

function resolveViewport(token) {
  var lower = token.toLowerCase();
  if (VIEWPORT_SHORTCUTS[lower]) return VIEWPORT_SHORTCUTS[lower];
  var m = token.match(/^(\d+)[xX×](\d+)$/);
  if (m) {
    var w = parseInt(m[1], 10);
    var h = parseInt(m[2], 10);
    return { width: w, height: h, label: w + '×' + h };
  }
  return null;
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

    // 4. Inject measurement probe — captures clone AND target rects on the same
    //    frame to eliminate cross-frame reflow drift.
    await page.evaluate(function(cid) {
      window.__flyTestResult = null;

      var overlay = document.getElementById('flyOverlay');
      if (!overlay) { window.__flyTestResult = { error: 'No flyOverlay found' }; return; }

      var lastCloneRect = null;
      var lastTargetRect = null;
      var lastCloneTextRect = null;
      var cloneStyle = null;
      var cloneFound = false;
      var framePairCount = 0;

      function findTarget() {
        var isHome = cid === 3;
        if (isHome) {
          var homePage = document.getElementById('page-home');
          var h1s = homePage ? homePage.querySelectorAll('.hero h1') : [];
          for (var j = 0; j < h1s.length; j++) {
            if (h1s[j].offsetHeight > 0) return h1s[j];
          }
          return h1s.length ? h1s[0] : null;
        } else {
          return document.querySelector('.project-hero-title');
        }
      }

      // Measure the first text node's rendered position via Range.
      // This captures where the actual text starts, not just the container box.
      function getTextRect(el) {
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        var textNode = null;
        while ((textNode = walker.nextNode())) {
          if (textNode.textContent.trim().length > 0) break;
        }
        if (!textNode) return null;
        var range = document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(textNode, Math.min(1, textNode.textContent.length));
        var r = range.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      }

      var observer = new MutationObserver(function() {
        if (cloneFound) return;
        var children = overlay.children;
        var clone = null;
        for (var i = 0; i < children.length; i++) {
          if (children[i].style.position === 'fixed') { clone = children[i]; break; }
        }
        if (!clone) return;
        cloneFound = true;

        function pollClone() {
          if (!overlay.contains(clone)) {
            if (!lastCloneRect) {
              window.__flyTestResult = { error: 'Clone rect was never recorded' };
              return;
            }
            // Clone removed — wait a few frames for post-swap reflow to settle
            // (scrollTo, class removal, TextDestruction, opacity restore all
            // fire in the same GSAP callback and may need multiple frames).
            var settleFrames = 3;
            function waitSettle() {
              if (--settleFrames > 0) { requestAnimationFrame(waitSettle); return; }
              var target = findTarget();
              if (!target) {
                window.__flyTestResult = { error: 'Target element not found after swap' };
                return;
              }
              var tr = target.getBoundingClientRect();
              var postSwapRect = { left: tr.left, top: tr.top, width: tr.width, height: tr.height };
              var postSwapTextRect = getTextRect(target);
              window.__flyTestResult = {
                cloneRect: lastCloneRect,
                cloneTextRect: lastCloneTextRect,
                targetRect: lastTargetRect,
                postSwapRect: postSwapRect,
                postSwapTextRect: postSwapTextRect,
                cloneStyle: cloneStyle,
                framePairCount: framePairCount,
              };
            }
            requestAnimationFrame(waitSettle);
            return;
          }

          // Clone still in DOM — measure it
          var r = clone.getBoundingClientRect();
          lastCloneRect = { left: r.left, top: r.top, width: r.width, height: r.height };
          lastCloneTextRect = getTextRect(clone);
          var cs = getComputedStyle(clone);
          cloneStyle = {
            fontFamily: cs.fontFamily,
            fontWeight: cs.fontWeight,
            fontStyle: cs.fontStyle,
            textTransform: cs.textTransform,
            letterSpacing: cs.letterSpacing,
            textAlign: cs.textAlign,
          };

          // Measure target on the SAME frame — no DOM mutations between calls
          var target = findTarget();
          if (target) {
            var tr = target.getBoundingClientRect();
            lastTargetRect = { left: tr.left, top: tr.top, width: tr.width, height: tr.height };
            framePairCount++;
          }

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
    var sr = result.postSwapRect;

    if (!sr) {
      report(label, false, 'Post-swap target rect missing');
      return;
    }
    if (cr.width === 0 || cr.height === 0) {
      report(label, false, 'Clone has zero dimensions — measurement failed. clone(' + cr.left.toFixed(0) + ',' + cr.top.toFixed(0) + ' ' + cr.width.toFixed(0) + '×' + cr.height.toFixed(0) + ')');
      return;
    }
    if (sr.width === 0 || sr.height === 0) {
      report(label, false, 'Post-swap target has zero dimensions — wrong element. target(' + sr.left.toFixed(0) + ',' + sr.top.toFixed(0) + ' ' + sr.width.toFixed(0) + '×' + sr.height.toFixed(0) + ')');
      return;
    }

    // Swap delta: where the clone last was vs where the real title actually is
    // after removal. This is what the user sees — any gap here is the slingshot.
    var dLeft = Math.abs(cr.left - sr.left);
    var dTop = Math.abs(cr.top - sr.top);
    var dWidth = Math.abs(cr.width - sr.width);
    var dHeight = Math.abs(cr.height - sr.height);

    var posOk = dLeft <= POSITION_TOLERANCE && dTop <= POSITION_TOLERANCE;
    var sizeOk = dWidth <= SIZE_TOLERANCE && dHeight <= SIZE_TOLERANCE;

    // Text-level check: compare where the first character renders in the clone
    // vs the real target. Catches text-align mismatches, font metric shifts, etc.
    // that don't show up in bounding box comparison.
    var ctr = result.cloneTextRect;
    var str = result.postSwapTextRect;
    var textOk = true;
    var textDetail = '';

    if (ctr && str) {
      var dtLeft = Math.abs(ctr.left - str.left);
      var dtTop = Math.abs(ctr.top - str.top);
      textOk = dtLeft <= POSITION_TOLERANCE && dtTop <= POSITION_TOLERANCE;
      textDetail = ' text Δ(' + dtLeft.toFixed(1) + ', ' + dtTop.toFixed(1) + ')';
    } else {
      textDetail = ' text Δ(n/a)';
    }

    var passed = posOk && sizeOk && textOk;

    var detail = 'swap Δ(' + dLeft.toFixed(1) + ', ' + dTop.toFixed(1) + ') '
      + 'size Δ(' + dWidth.toFixed(1) + ', ' + dHeight.toFixed(1) + ')'
      + textDetail
      + ' | lastClone(' + cr.left.toFixed(0) + ',' + cr.top.toFixed(0)
      + ' ' + cr.width.toFixed(0) + '×' + cr.height.toFixed(0) + ') '
      + 'postSwap(' + sr.left.toFixed(0) + ',' + sr.top.toFixed(0)
      + ' ' + sr.width.toFixed(0) + '×' + sr.height.toFixed(0) + ')'
      + ' pairs=' + (result.framePairCount || 0);

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

  if (flags.help) {
    console.log('Usage: node tests/fly-clone-alignment-test.js [flags]');
    console.log('');
    console.log('Flags:');
    console.log('  --theme=<name,...>      Theme(s) to test (bold|cinematic|brutalist|retro|neon)');
    console.log('  --card=<id,...>         Card ID(s) to play (0=Logifuture, 1=Coffin-Likker, 2=Lost Satellite, 3=Home)');
    console.log('  --all-cards             Test all 4 cards (equivalent to --card=0,1,2,3)');
    console.log('  --viewport=<spec,...>   Viewport(s): WxH or named shortcut (mobile|tablet|desktop)');
    console.log('  --width=<px>            Viewport width  (legacy, use --viewport instead)');
    console.log('  --height=<px>           Viewport height (legacy, use --viewport instead)');
    console.log('  --help                  Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  node tests/fly-clone-alignment-test.js');
    console.log('  node tests/fly-clone-alignment-test.js --theme=bold,brutalist --viewport=mobile');
    console.log('  node tests/fly-clone-alignment-test.js --theme=retro --card=0,1,2,3 --viewport=375x812,1920x1080');
    console.log('  node tests/fly-clone-alignment-test.js --all-cards --viewport=desktop');
    process.exit(0);
  }

  // Themes: comma-separated or all
  var themes = flags.theme
    ? flags.theme.split(',').map(function(s) { return s.trim(); })
    : ALL_THEMES;

  // Cards: --all-cards, comma-separated, or default subset
  var cards;
  if (flags['all-cards']) {
    cards = ALL_CARD_IDS;
  } else if (flags.card !== undefined) {
    cards = String(flags.card).split(',').map(function(s) { return parseInt(s.trim(), 10); });
  } else {
    cards = DEFAULT_CARDS;
  }

  // Viewports: --viewport (new), --width+--height (legacy), or all
  var viewports;
  if (flags.viewport) {
    viewports = flags.viewport.split(',').map(function(token) {
      var vp = resolveViewport(token.trim());
      if (!vp) {
        console.error('Unknown viewport: "' + token.trim() + '". Use WxH or: mobile, tablet, desktop');
        process.exit(1);
      }
      return vp;
    });
  } else if (flags.width && flags.height) {
    viewports = [{ width: parseInt(flags.width), height: parseInt(flags.height), label: flags.width + '×' + flags.height }];
  } else {
    viewports = ALL_VIEWPORTS;
  }

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
