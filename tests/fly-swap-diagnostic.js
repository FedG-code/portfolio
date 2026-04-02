/**
 * Fly-Swap Diagnostic
 *
 * Measures the exact position delta between the flying chars (in #flyOverlay)
 * and the real hero h1 characters at the moment the swap happens — when
 * destroy() is about to remove the flying chars and the real title appears.
 *
 * This catches the "fullstop and t shift" bug that element-level bbox tests miss.
 *
 * Prerequisites:
 *   - Local server running on port 8081: npx http-server -p 8081 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   node tests/fly-swap-diagnostic.js
 *   node tests/fly-swap-diagnostic.js --viewport=mobile
 *   node tests/fly-swap-diagnostic.js --viewport=1920x1080
 */

const { chromium } = require('playwright');

var BASE_URL = 'http://localhost:8081';
var SHIFT_THRESHOLD = 2; // px — matches the jump threshold used in other tests

var VIEWPORT_SHORTCUTS = {
  mobile:  { width: 375,  height: 812,  label: '375x812'  },
  tablet:  { width: 768,  height: 1024, label: '768x1024' },
  desktop: { width: 1920, height: 1080, label: '1920x1080' },
};

var DEFAULT_VIEWPORTS = [
  { width: 1280, height: 800,  label: '1280x800'  },
  { width: 1920, height: 1080, label: '1920x1080' },
  { width: 375,  height: 812,  label: '375x812'   },
];

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
    return { width: w, height: h, label: w + 'x' + h };
  }
  return null;
}

async function runTest(browser, viewport) {
  var label = 'bold ' + viewport.label;
  console.log('\n--- [' + label + '] ---');

  var context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  var page = await context.newPage();
  var result = { name: label, passed: false, detail: null };

  try {
    // Step 1: Load page
    console.log('  Loading index page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(function() {
      return typeof gsap !== 'undefined' &&
             typeof playCard === 'function' &&
             window.TextDestruction &&
             window.TextRearrange;
    }, { timeout: 15000 });
    await page.waitForTimeout(1500);

    // Step 2: Set bold theme
    await page.evaluate(function() {
      document.documentElement.setAttribute('data-theme', 'bold');
      localStorage.setItem('portfolio-theme', 'bold');
    });
    await page.waitForTimeout(300);

    // Step 3: Install the swap-point hook
    // This monkey-patches rearrangeResult.destroy to capture measurements
    // right before the flying chars are removed.
    await page.evaluate(function() {
      window.__swapDiag = { captured: false, data: null, flyCount: 0 };

      // Measure chars in flyOverlay using getBoundingClientRect on each span
      function measureFlyingChars() {
        var flyOv = document.getElementById('flyOverlay');
        if (!flyOv) return [];
        var spans = flyOv.querySelectorAll('span[style*="position"]');
        var chars = [];
        for (var i = 0; i < spans.length; i++) {
          var span = spans[i];
          var text = span.textContent.trim();
          if (!text || /^\s+$/.test(text)) continue;
          var rect = span.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          chars.push({
            char: text,
            left: Math.round(rect.left * 100) / 100,
            top: Math.round(rect.top * 100) / 100,
            width: Math.round(rect.width * 100) / 100,
            height: Math.round(rect.height * 100) / 100,
          });
        }
        return chars;
      }

      // Measure chars in the real h1 using getBoundingClientRect on .destruct-char spans
      // (matches how flying chars are measured — both use box bounds, not glyph bounds).
      // Falls back to Range API if h1 isn't split yet.
      function measureRealTitle(selector) {
        var h1 = document.querySelector(selector);
        if (!h1) return [];
        // Force the h1 visible temporarily so we get real rects
        var prevOpacity = h1.style.opacity;
        h1.style.opacity = '1';
        // Force layout
        h1.offsetHeight;

        var charSpans = h1.querySelectorAll('.destruct-char');
        var chars = [];
        if (charSpans.length > 0) {
          // Measure via destruct-char span getBoundingClientRect (same as fly chars)
          for (var i = 0; i < charSpans.length; i++) {
            var text = charSpans[i].textContent.trim();
            if (!text || /^\s+$/.test(text)) continue;
            var rect = charSpans[i].getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            chars.push({
              char: text,
              left: Math.round(rect.left * 100) / 100,
              top: Math.round(rect.top * 100) / 100,
              width: Math.round(rect.width * 100) / 100,
              height: Math.round(rect.height * 100) / 100,
            });
          }
        } else {
          // Fallback: Range API for unsplit h1
          var walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
          var node;
          while ((node = walker.nextNode())) {
            for (var i = 0; i < node.length; i++) {
              var ch = node.textContent[i];
              if (/^\s$/.test(ch)) continue;
              var range = document.createRange();
              range.setStart(node, i);
              range.setEnd(node, i + 1);
              var rect = range.getBoundingClientRect();
              chars.push({
                char: ch,
                left: Math.round(rect.left * 100) / 100,
                top: Math.round(rect.top * 100) / 100,
                width: Math.round(rect.width * 100) / 100,
                height: Math.round(rect.height * 100) / 100,
              });
              range.detach();
            }
          }
        }
        // Restore original opacity
        h1.style.opacity = prevOpacity;
        return chars;
      }

      // Hook: patch TextRearrange.fly to wrap the returned destroy fn.
      // Only capture on the SECOND fly call (card 3 -> home), skip the first (card 0 -> project).
      var origFly = TextRearrange.fly;
      TextRearrange.fly = function(opts) {
        var result = origFly.call(this, opts);
        if (!result) return result;

        window.__swapDiag.flyCount++;
        var flyNum = window.__swapDiag.flyCount;

        // Only hook the second fly (home card transition)
        if (flyNum < 2) return result;

        var origDestroy = result.destroy;
        result.destroy = function() {
          // === THIS IS THE SWAP POINT ===
          // Flying chars are still in the DOM. Real h1 is about to get opacity:1.
          // Measure both right now, in the same frame.
          if (!window.__swapDiag.captured) {
            var flyChars = measureFlyingChars();
            var realChars = measureRealTitle('#page-home .hero h1');

            // Also capture DOM state of the h1
            var h1 = document.querySelector('#page-home .hero h1');
            var h1Html = h1 ? h1.innerHTML : 'NOT FOUND';
            var h1Opacity = h1 ? h1.style.opacity : 'N/A';
            var pageOpacity = '';
            var homePage = document.getElementById('page-home');
            if (homePage) pageOpacity = getComputedStyle(homePage).opacity;

            window.__swapDiag.captured = true;
            window.__swapDiag.data = {
              flyChars: flyChars,
              realChars: realChars,
              h1Html: h1Html,
              h1Opacity: h1Opacity,
              pageOpacity: pageOpacity,
              timestamp: performance.now(),
            };
          }

          // Run the real destroy
          return origDestroy.apply(this, arguments);
        };

        return result;
      };
    });

    // Step 4: Play card 0 to get Home card in hand
    console.log('  Playing card 0 to reach a project page...');
    await page.evaluate(function() {
      var el = document.querySelector('[data-card-id="0"]');
      if (!el) throw new Error('Card 0 not found');
      playCard(el, 0);
    });
    await page.waitForTimeout(7000);

    // Verify Home card is in hand
    var hasHome = await page.evaluate(function() {
      return !!document.querySelector('[data-card-id="3"]');
    });
    if (!hasHome) {
      console.log('  ERROR: Home card not found in hand after project transition');
      result.detail = 'Home card not in hand';
      return result;
    }
    console.log('  Home card confirmed in hand.');

    // Step 5: Play card 3 (Home)
    console.log('  Playing card 3 (Home)...');
    await page.evaluate(function() {
      var el = document.querySelector('[data-card-id="3"]');
      if (!el) throw new Error('Card 3 not found');
      playCard(el, 3);
    });

    // Wait for the full animation + cleanup
    await page.waitForTimeout(10000);

    // Step 6: Retrieve swap-point data
    var diag = await page.evaluate(function() {
      return window.__swapDiag;
    });

    if (!diag.captured || !diag.data) {
      console.log('  WARNING: Swap point was never reached — animation may have failed');
      result.detail = 'Swap hook not triggered';
      return result;
    }

    var flyChars = diag.data.flyChars;
    var realChars = diag.data.realChars;

    console.log('  Flying chars captured: ' + flyChars.length);
    console.log('  Real h1 chars captured: ' + realChars.length);
    console.log('  h1 opacity at swap: ' + diag.data.h1Opacity);
    console.log('  #page-home opacity at swap: ' + diag.data.pageOpacity);
    console.log('  h1 DOM at swap (first 200): ' + diag.data.h1Html.substring(0, 200));

    if (flyChars.length === 0) {
      console.log('  WARNING: No flying chars found at swap point');
      result.detail = 'No flying chars at swap';
      return result;
    }
    if (realChars.length === 0) {
      console.log('  WARNING: No real h1 chars found at swap point');
      result.detail = 'No real h1 chars at swap';
      return result;
    }

    // Step 7: Compare positions
    console.log('\n  === Character Comparison at Swap Point ===');
    console.log('  ' + 'idx'.padStart(4) + '  char  ' +
      'fly.left'.padStart(9) + '  ' + 'fly.top'.padStart(9) + '  ' +
      'real.left'.padStart(9) + '  ' + 'real.top'.padStart(9) + '  ' +
      'dx'.padStart(8) + '  ' + 'dy'.padStart(8) + '  ' +
      'dw'.padStart(8) + '  ' + 'dh'.padStart(8));
    console.log('  ' + '-'.repeat(100));

    var len = Math.min(flyChars.length, realChars.length);
    var shiftCount = 0;
    var maxDx = 0;
    var maxDy = 0;
    var watchedShifts = [];

    for (var i = 0; i < len; i++) {
      var f = flyChars[i];
      var r = realChars[i];
      var dx = f.left - r.left;
      var dy = f.top - r.top;
      var dw = f.width - r.width;
      var dh = f.height - r.height;
      var hasShift = Math.abs(dx) > SHIFT_THRESHOLD || Math.abs(dy) > SHIFT_THRESHOLD;
      var isWatched = ['.', 't'].indexOf(f.char) !== -1;

      var marker = '';
      if (hasShift) {
        shiftCount++;
        marker = ' ***';
        if (Math.abs(dx) > Math.abs(maxDx)) maxDx = dx;
        if (Math.abs(dy) > Math.abs(maxDy)) maxDy = dy;
      }
      if (isWatched) marker += ' <--';
      if (isWatched && hasShift) {
        watchedShifts.push({ char: f.char, index: i, dx: dx, dy: dy, dw: dw, dh: dh });
      }

      console.log('  ' +
        String(i).padStart(4) + '  ' +
        ('"' + f.char + '"').padEnd(6) + '' +
        f.left.toFixed(1).padStart(9) + '  ' +
        f.top.toFixed(1).padStart(9) + '  ' +
        r.left.toFixed(1).padStart(9) + '  ' +
        r.top.toFixed(1).padStart(9) + '  ' +
        dx.toFixed(2).padStart(8) + '  ' +
        dy.toFixed(2).padStart(8) + '  ' +
        dw.toFixed(2).padStart(8) + '  ' +
        dh.toFixed(2).padStart(8) +
        marker
      );
    }

    if (flyChars.length !== realChars.length) {
      console.log('\n  WARNING: Char count mismatch — fly=' + flyChars.length + ' real=' + realChars.length);
    }

    // Step 8: Also measure the real title AFTER onThemeChange runs
    // (it runs during cleanup, after destroy)
    console.log('\n  === Post-cleanup Measurement ===');
    var postChars = await page.evaluate(function() {
      var h1 = document.querySelector('#page-home .hero h1');
      if (!h1) return [];
      var charSpans = h1.querySelectorAll('.destruct-char');
      var chars = [];
      if (charSpans.length > 0) {
        for (var i = 0; i < charSpans.length; i++) {
          var text = charSpans[i].textContent.trim();
          if (!text || /^\s+$/.test(text)) continue;
          var rect = charSpans[i].getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          chars.push({
            char: text,
            left: Math.round(rect.left * 100) / 100,
            top: Math.round(rect.top * 100) / 100,
            width: Math.round(rect.width * 100) / 100,
            height: Math.round(rect.height * 100) / 100,
          });
        }
      } else {
        var walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
        var node;
        while ((node = walker.nextNode())) {
          for (var i = 0; i < node.length; i++) {
            var ch = node.textContent[i];
            if (/^\s$/.test(ch)) continue;
            var range = document.createRange();
            range.setStart(node, i);
            range.setEnd(node, i + 1);
            var rect = range.getBoundingClientRect();
            chars.push({
              char: ch,
              left: Math.round(rect.left * 100) / 100,
              top: Math.round(rect.top * 100) / 100,
              width: Math.round(rect.width * 100) / 100,
              height: Math.round(rect.height * 100) / 100,
            });
            range.detach();
          }
        }
      }
      return chars;
    });

    var postState = await page.evaluate(function() {
      var h1 = document.querySelector('#page-home .hero h1');
      if (!h1) return { html: 'NOT FOUND' };
      return {
        html: h1.innerHTML.substring(0, 300),
        inlineStyle: h1.getAttribute('style') || 'none',
        className: h1.className,
        parentStyle: h1.parentElement ? (h1.parentElement.getAttribute('style') || 'none') : 'N/A',
        parentClass: h1.parentElement ? h1.parentElement.className : 'N/A',
        computedWidth: getComputedStyle(h1).width,
        computedDisplay: getComputedStyle(h1).display,
        computedPosition: getComputedStyle(h1).position,
        // Check if .reveal or .visible is on hero ancestors
        heroClass: document.querySelector('#page-home .hero') ? document.querySelector('#page-home .hero').className : 'N/A',
      };
    });
    console.log('  h1 DOM after cleanup (first 300): ' + postState.html);
    console.log('  h1 inline style: ' + postState.inlineStyle);
    console.log('  h1 class: "' + postState.className + '"');
    console.log('  h1 parent style: ' + postState.parentStyle);
    console.log('  h1 parent class: "' + postState.parentClass + '"');
    console.log('  h1 computed width: ' + postState.computedWidth);
    console.log('  h1 computed display: ' + postState.computedDisplay);
    console.log('  .hero class: "' + postState.heroClass + '"');

    // Compare real-at-swap vs real-after-cleanup (catches onThemeChange drift)
    var postLen = Math.min(realChars.length, postChars.length);
    var postShiftCount = 0;
    for (var j = 0; j < postLen; j++) {
      var rr = realChars[j];
      var pp = postChars[j];
      var pdx = pp.left - rr.left;
      var pdy = pp.top - rr.top;
      if (Math.abs(pdx) > SHIFT_THRESHOLD || Math.abs(pdy) > SHIFT_THRESHOLD) {
        postShiftCount++;
        console.log('  Post-cleanup shift: [' + j + '] "' + rr.char + '" dx=' + pdx.toFixed(2) + ' dy=' + pdy.toFixed(2));
      }
    }
    if (postShiftCount === 0) {
      console.log('  No post-cleanup shifts (onThemeChange did not cause drift)');
    }

    // Step 9: Reproduce the measuring state on a fresh page load
    // Load a fresh page and check if .measuring class causes different layout
    console.log('\n  === Diagnostic: .measuring class effect ===');
    var measuringTest = await page.evaluate(function() {
      var h1 = document.querySelector('#page-home .hero h1');
      if (!h1) return null;

      // First revert SplitText so we have clean DOM
      if (window.TextDestruction) {
        TextDestruction.onThemeChange(); // revert + re-split
      }

      // Measure in current (normal) state — should be "correct" positions
      function measureLast5() {
        var walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
        var all = [];
        var n;
        while ((n = walker.nextNode())) {
          for (var i = 0; i < n.length; i++) {
            if (/^\s$/.test(n.textContent[i])) continue;
            var r = document.createRange();
            r.setStart(n, i); r.setEnd(n, i + 1);
            var rect = r.getBoundingClientRect();
            all.push({ char: n.textContent[i], left: Math.round(rect.left * 100) / 100 });
            r.detach();
          }
        }
        return all.slice(-5);
      }

      var normal = measureLast5();

      // Now simulate the measuring state: revert split, then check
      // Actually, let's test the effect of having display:none → display:block
      // by toggling the page class
      var page = document.getElementById('page-home');
      var origClasses = page.className;

      // Remove active, add measuring
      page.classList.remove('active');
      page.classList.add('measuring');
      page.offsetHeight; // force reflow

      // Revert SplitText split to match the swap-point state
      if (window.TextDestruction) {
        // We can't easily just revert without re-splitting, but let's try
        // calling onThemeChange which does revert+split
        TextDestruction.onThemeChange();
      }

      var measuring = measureLast5();

      // Restore
      page.classList.remove('measuring');
      page.classList.add('active');
      page.offsetHeight;

      // Re-split
      if (window.TextDestruction) {
        TextDestruction.onThemeChange();
      }

      var restored = measureLast5();

      return { normal: normal, measuring: measuring, restored: restored };
    });

    if (measuringTest) {
      console.log('  Last 5 chars — normal vs .measuring vs restored:');
      for (var mi = 0; mi < measuringTest.normal.length; mi++) {
        var mn = measuringTest.normal[mi];
        var mm = measuringTest.measuring[mi];
        var mr = measuringTest.restored[mi];
        console.log('    "' + mn.char + '" normal=' + mn.left + '  measuring=' + (mm ? mm.left : 'N/A') + '  restored=' + (mr ? mr.left : 'N/A') +
          (mm && Math.abs(mm.left - mn.left) > 0.5 ? '  *** DIFF ***' : ''));
      }
    }

    // Step 10: Check inline style effect
    console.log('\n  === Diagnostic: Revert split and remeasure ===');
    var revertedChars = await page.evaluate(function() {
      // Revert the SplitText split
      if (window.TextDestruction) {
        // Access the internal revertAllText via onThemeChange - but that re-splits.
        // Instead, call destroy which just disarms, then manually check.
      }
      // Actually, let's check the "t" and "." positions with and without the inline style
      var h1 = document.querySelector('#page-home .hero h1');
      var results = {};

      // Current state (after onThemeChange with inline styles)
      results.withInline = {};
      var walker1 = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
      var allChars1 = [];
      var n1;
      while ((n1 = walker1.nextNode())) {
        for (var i = 0; i < n1.length; i++) {
          if (/^\s$/.test(n1.textContent[i])) continue;
          var r = document.createRange();
          r.setStart(n1, i); r.setEnd(n1, i + 1);
          var rect = r.getBoundingClientRect();
          allChars1.push({ char: n1.textContent[i], left: rect.left, top: rect.top });
          r.detach();
        }
      }
      results.withInline.chars = allChars1;
      results.withInline.style = h1.getAttribute('style');

      // Remove inline styles, re-measure
      h1.removeAttribute('style');
      h1.offsetHeight; // force reflow

      // Also need to re-add .reveal.visible or the h1 might be invisible
      // Actually let's just check if removing inline style changes positions
      var walker2 = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
      var allChars2 = [];
      var n2;
      while ((n2 = walker2.nextNode())) {
        for (var i = 0; i < n2.length; i++) {
          if (/^\s$/.test(n2.textContent[i])) continue;
          var r = document.createRange();
          r.setStart(n2, i); r.setEnd(n2, i + 1);
          var rect = r.getBoundingClientRect();
          allChars2.push({ char: n2.textContent[i], left: rect.left, top: rect.top });
          r.detach();
        }
      }
      results.withoutInline = {};
      results.withoutInline.chars = allChars2;
      results.withoutInline.display = getComputedStyle(h1).display;
      results.withoutInline.opacity = getComputedStyle(h1).opacity;
      results.withoutInline.h1Class = h1.className;
      results.withoutInline.hasReveal = h1.classList.contains('reveal');
      results.withoutInline.hasVisible = h1.classList.contains('visible');

      // Restore inline style for consistency
      h1.style.opacity = '1';
      h1.style.transform = 'translateY(0px)';

      return results;
    });

    // Compare the "." position with vs without inline styles
    var withChars = revertedChars.withInline.chars;
    var withoutChars = revertedChars.withoutInline.chars;
    var len2 = Math.min(withChars.length, withoutChars.length);
    console.log('  h1 class: "' + revertedChars.withoutInline.h1Class + '"  .reveal=' + revertedChars.withoutInline.hasReveal + '  .visible=' + revertedChars.withoutInline.hasVisible);
    console.log('  Without inline style: display=' + revertedChars.withoutInline.display + ' opacity=' + revertedChars.withoutInline.opacity);
    for (var k = len2 - 5; k < len2; k++) {
      if (k < 0) continue;
      var wc = withChars[k];
      var woc = withoutChars[k];
      var ddx = woc.left - wc.left;
      console.log('    [' + k + '] "' + wc.char + '" with=' + wc.left.toFixed(1) + ' without=' + woc.left.toFixed(1) + ' delta=' + ddx.toFixed(2));
    }

    // Summary
    console.log('\n  === Result ===');
    var passed = shiftCount === 0 && watchedShifts.length === 0 && postShiftCount === 0;
    if (passed) {
      console.log('  PASS: Flying chars aligned with real title (threshold: ' + SHIFT_THRESHOLD + 'px)');
    } else {
      if (shiftCount > 0) {
        console.log('  FAIL: ' + shiftCount + ' char(s) misaligned at swap. Max dx=' + maxDx.toFixed(2) + 'px, dy=' + maxDy.toFixed(2) + 'px');
      }
      if (watchedShifts.length > 0) {
        console.log('  FAIL: Watched chars shifted:');
        watchedShifts.forEach(function(ws) {
          console.log('    "' + ws.char + '" [' + ws.index + '] dx=' + ws.dx.toFixed(2) + ' dy=' + ws.dy.toFixed(2));
        });
      }
      if (postShiftCount > 0) {
        console.log('  FAIL: ' + postShiftCount + ' char(s) shifted after onThemeChange cleanup');
      }
    }

    result.passed = passed;

  } catch (err) {
    console.log('  ERROR: ' + err.message);
    result.detail = err.message;
  } finally {
    await context.close();
  }

  return result;
}

async function main() {
  var flags = parseFlags();

  var viewports;
  if (flags.viewport) {
    viewports = flags.viewport.split(',').map(function(token) {
      var vp = resolveViewport(token.trim());
      if (!vp) {
        console.error('Unknown viewport: "' + token.trim() + '"');
        process.exit(1);
      }
      return vp;
    });
  } else {
    viewports = DEFAULT_VIEWPORTS;
  }

  console.log('=== Fly-Swap Diagnostic ===');
  console.log('Theme: bold');
  console.log('Viewports: ' + viewports.map(function(v) { return v.label; }).join(', '));
  console.log('Shift threshold: ' + SHIFT_THRESHOLD + 'px');

  var browser = await chromium.launch({ headless: false });
  var results = [];

  for (var i = 0; i < viewports.length; i++) {
    var r = await runTest(browser, viewports[i]);
    results.push(r);
  }

  await browser.close();

  // Summary
  console.log('\n════════════════════════════════');
  var passed = results.filter(function(r) { return r.passed; }).length;
  var failed = results.filter(function(r) { return !r.passed; }).length;
  console.log('Passed: ' + passed + '  Failed: ' + failed + '  Total: ' + results.length);

  if (failed > 0) {
    console.log('\nFailed:');
    results.forEach(function(r) {
      if (!r.passed) console.log('  [FAIL] ' + r.name + (r.detail ? ' — ' + r.detail : ''));
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(function(err) {
  console.error('Error:', err);
  process.exit(1);
});
