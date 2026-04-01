/**
 * Fullstop & "t" Shift Diagnostic
 *
 * Tests whether TextDestruction.onThemeChange() causes individual characters
 * in the home page hero h1 ("Never shipped a boring product.") to shift
 * position — specifically the "t" and "." at the end of the second line.
 *
 * This test does NOT run the fly animation. It isolates the SplitText
 * revert/re-split cycle to confirm whether that alone causes the shift.
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   node tests/fullstop-shift-test.js
 */

const { chromium } = require('playwright');

var BASE_URL = 'http://localhost:8081';
var SHIFT_THRESHOLD = 0.5; // px — anything above this is a detectable shift

// Characters of interest (will flag shifts on these specifically)
var WATCH_CHARS = ['.', 't'];

/**
 * Measures individual character positions in an element using the Range API.
 * This avoids introducing any DOM changes (unlike SplitText).
 * Returns array of { char, left, top, width, height } for each character.
 */
function getMeasureCharsFn() {
  return function measureCharPositions(selector) {
    var el = document.querySelector(selector);
    if (!el) return null;

    // Collect all characters from text nodes via TreeWalker
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var positions = [];
    var node;
    while ((node = walker.nextNode())) {
      for (var i = 0; i < node.length; i++) {
        var ch = node.textContent[i];
        // Skip whitespace-only characters (spaces, newlines)
        if (/^\s$/.test(ch)) continue;

        var range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        var rect = range.getBoundingClientRect();
        positions.push({
          char: ch,
          left: Math.round(rect.left * 100) / 100,
          top: Math.round(rect.top * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        });
        range.detach();
      }
    }
    return positions;
  };
}

function comparePositions(before, after, label) {
  var passed = true;
  var shifts = [];

  // Match by index — both arrays should have same char sequence
  var len = Math.min(before.length, after.length);
  if (before.length !== after.length) {
    console.log('  WARNING: Character count changed (' + before.length + ' -> ' + after.length + ')');
  }

  for (var i = 0; i < len; i++) {
    var b = before[i];
    var a = after[i];
    if (b.char !== a.char) {
      console.log('  WARNING: Character mismatch at index ' + i + ': "' + b.char + '" vs "' + a.char + '"');
      continue;
    }

    var dx = a.left - b.left;
    var dy = a.top - b.top;
    var dw = a.width - b.width;
    var dh = a.height - b.height;

    var isWatched = WATCH_CHARS.indexOf(b.char) !== -1;
    var hasShift = Math.abs(dx) > SHIFT_THRESHOLD || Math.abs(dy) > SHIFT_THRESHOLD ||
                   Math.abs(dw) > SHIFT_THRESHOLD || Math.abs(dh) > SHIFT_THRESHOLD;

    if (hasShift) {
      var entry = {
        index: i,
        char: b.char,
        dx: dx,
        dy: dy,
        dw: dw,
        dh: dh,
        watched: isWatched,
      };
      shifts.push(entry);
      if (isWatched) passed = false;
    }
  }

  console.log('\n  === ' + label + ' ===');
  if (shifts.length === 0) {
    console.log('  No character shifts detected (threshold: ' + SHIFT_THRESHOLD + 'px)');
  } else {
    console.log('  ' + shifts.length + ' character(s) shifted:');
    shifts.forEach(function(s) {
      var marker = s.watched ? ' *** WATCHED ***' : '';
      console.log(
        '    [' + s.index + '] "' + s.char + '"' +
        '  dx=' + s.dx.toFixed(2) + 'px' +
        '  dy=' + s.dy.toFixed(2) + 'px' +
        '  dw=' + s.dw.toFixed(2) + 'px' +
        '  dh=' + s.dh.toFixed(2) + 'px' +
        marker
      );
    });
  }

  return { passed: passed, shifts: shifts };
}

async function run() {
  console.log('=== Fullstop & "t" Shift Diagnostic ===');
  console.log('Threshold: ' + SHIFT_THRESHOLD + 'px');
  console.log('Watched chars: ' + WATCH_CHARS.join(', '));

  var browser = await chromium.launch({ headless: false });
  var context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  var page = await context.newPage();
  var allPassed = true;

  try {
    // Load page
    console.log('\nLoading index page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Wait for GSAP + SplitText + TextDestruction
    await page.waitForFunction(function() {
      return typeof gsap !== 'undefined' &&
             typeof SplitText !== 'undefined' &&
             window.TextDestruction;
    }, { timeout: 15000 });

    // Set bold theme
    await page.evaluate(function() {
      document.documentElement.setAttribute('data-theme', 'bold');
      localStorage.setItem('portfolio-theme', 'bold');
    });

    // Wait for fonts to load
    await page.waitForFunction(function() {
      return document.fonts.status === 'loaded';
    }, { timeout: 10000 });
    await page.waitForTimeout(500);

    // Make sure .reveal elements are visible
    await page.evaluate(function() {
      document.querySelectorAll('.reveal').forEach(function(el) {
        el.classList.add('visible');
      });
    });
    await page.waitForTimeout(300);

    var selector = '.hero h1';

    // ─── Test 1: Fresh page → onThemeChange() ───────────────
    console.log('\n--- Test 1: Fresh page -> onThemeChange() ---');

    // Check if text is already split from page load
    var alreadySplit = await page.evaluate(function() {
      var h1 = document.querySelector('.hero h1');
      return h1 ? h1.querySelector('.destruct-char') !== null : false;
    });
    console.log('  Text already split on load: ' + alreadySplit);

    if (alreadySplit) {
      // Revert first to get clean baseline
      console.log('  Reverting existing split for clean baseline...');
      await page.evaluate(function() {
        TextDestruction.onThemeChange(); // revert + re-split
      });
      await page.waitForTimeout(200);
      // Now revert again to get truly clean state
      // We need to access the internal revert — call onThemeChange which does revert+split,
      // but we want just reverted. Instead, destroy + revert approach:
      await page.evaluate(function() {
        // onThemeChange does revertAll then splitAll, so calling destroy
        // leaves the text in split state. Let's just measure in whatever state it is.
      });
    }

    // Measure baseline (whatever state the page is in after load)
    console.log('  Measuring baseline character positions...');
    var baseline1 = await page.evaluate(getMeasureCharsFn(), selector);
    if (!baseline1) {
      console.log('  ERROR: Could not find ' + selector);
      allPassed = false;
    } else {
      console.log('  Found ' + baseline1.length + ' characters');

      // Print all char positions for debugging
      console.log('  Characters:');
      baseline1.forEach(function(c, i) {
        var marker = WATCH_CHARS.indexOf(c.char) !== -1 ? ' <--' : '';
        console.log('    [' + i + '] "' + c.char + '"  left=' + c.left + '  top=' + c.top + '  w=' + c.width + '  h=' + c.height + marker);
      });

      // Call onThemeChange (revert + re-split)
      console.log('\n  Calling TextDestruction.onThemeChange()...');
      await page.evaluate(function() {
        TextDestruction.onThemeChange();
      });
      await page.waitForTimeout(300);

      // Measure after
      var after1 = await page.evaluate(getMeasureCharsFn(), selector);
      if (!after1) {
        console.log('  ERROR: Could not measure after onThemeChange');
        allPassed = false;
      } else {
        console.log('  Found ' + after1.length + ' characters after onThemeChange');

        // Print post positions
        console.log('  Characters after:');
        after1.forEach(function(c, i) {
          var marker = WATCH_CHARS.indexOf(c.char) !== -1 ? ' <--' : '';
          console.log('    [' + i + '] "' + c.char + '"  left=' + c.left + '  top=' + c.top + '  w=' + c.width + '  h=' + c.height + marker);
        });

        var result1 = comparePositions(baseline1, after1, 'Test 1: Fresh -> onThemeChange');
        if (!result1.passed) allPassed = false;
      }
    }

    // ─── Test 2: Repeated onThemeChange() cycles ─────────────
    console.log('\n--- Test 2: Repeated onThemeChange() cycles (drift check) ---');

    // Measure current state
    var baseline2 = await page.evaluate(getMeasureCharsFn(), selector);

    // Run 3 more cycles
    for (var cycle = 0; cycle < 3; cycle++) {
      await page.evaluate(function() {
        TextDestruction.onThemeChange();
      });
      await page.waitForTimeout(200);
    }

    var after2 = await page.evaluate(getMeasureCharsFn(), selector);
    if (baseline2 && after2) {
      var result2 = comparePositions(baseline2, after2, 'Test 2: 3x onThemeChange cycles');
      if (!result2.passed) allPassed = false;
    }

    // ─── Test 3: Revert only (no re-split) ───────────────────
    console.log('\n--- Test 3: Measure split vs reverted (no re-split) ---');

    // Current state is split. Measure it.
    var baseline3 = await page.evaluate(getMeasureCharsFn(), selector);

    // Revert without re-splitting by calling the internal function
    // We can access it via a trick: call onThemeChange but intercept
    // Actually, let's just use the public API differently:
    // destroy() kills tweens but doesn't revert. We need to trigger revert.
    // The cleanest way: evaluate the revert directly
    await page.evaluate(function() {
      // onThemeChange does: revertAll -> splitAll
      // We want just revertAll. But it's not exposed.
      // Workaround: call onThemeChange, then immediately check if we can
      // access the reverted state. Actually onThemeChange is synchronous,
      // so by the time it returns, text is already re-split.
      // Alternative: just compare split state before and after full revert+split
      // which is what Test 1 already does.
      // For this test, let's measure the h1 innerHTML to see DOM structure changes.
    });

    // Instead, let's check the DOM structure difference
    var domBefore = await page.evaluate(function() {
      var h1 = document.querySelector('.hero h1');
      return h1 ? h1.innerHTML : null;
    });
    console.log('  DOM structure (split): ' + (domBefore ? domBefore.substring(0, 120) + '...' : 'null'));

    // Check if kern-ri span survives the split
    var kernRiSurvived = await page.evaluate(function() {
      var h1 = document.querySelector('.hero h1');
      if (!h1) return { exists: false };
      var kernSpan = h1.querySelector('.kern-ri');
      if (!kernSpan) return { exists: false, innerHTML: h1.innerHTML };
      return {
        exists: true,
        text: kernSpan.textContent,
        parentTag: kernSpan.parentElement ? kernSpan.parentElement.className : 'none',
      };
    });
    console.log('  .kern-ri span after split: ' + JSON.stringify(kernRiSurvived));

    if (!kernRiSurvived.exists) {
      console.log('  WARNING: .kern-ri span was destroyed by SplitText — this may cause the "t"/"." shift!');
    }

    // ─── Summary ─────────────────────────────────────────────
    console.log('\n════════════════════════════════');
    console.log(allPassed ? 'RESULT: PASS — no watched character shifts detected' : 'RESULT: FAIL — watched characters shifted');

  } catch (err) {
    console.log('ERROR: ' + err.message);
    allPassed = false;
  } finally {
    await context.close();
    await browser.close();
  }

  process.exit(allPassed ? 0 : 1);
}

run().catch(function(err) {
  console.error('Error:', err);
  process.exit(1);
});
