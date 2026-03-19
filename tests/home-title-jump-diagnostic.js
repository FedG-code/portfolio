/**
 * Home Card Title Jump Diagnostic
 *
 * Captures positions and screenshots at each phase of the Home card-to-page
 * transition to identify what causes the title to shift/pop after landing.
 *
 * Flow: load index → play a project card (card 0) to get Home card in hand →
 *       wait for settle → play Home card (card 3) → poll hero h1 position.
 *
 * Prerequisite: local server on port 8080 (npx http-server -p 8080 -c-1)
 * Run: node tests/home-title-jump-diagnostic.js
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';
const JUMP_THRESHOLD = 2; // px — anything above this is a visible jump

async function measureHeroElements(page, label) {
  return await page.evaluate(function(lbl) {
    var result = {
      phase: lbl,
      scrollY: window.scrollY,
      clone: null,
      h1: null,
      badge: null,
      heroBody: null,
    };

    // Check for flying clone in fly-overlay
    var flyOverlay = document.getElementById('flyOverlay');
    if (flyOverlay) {
      var cloneEls = flyOverlay.querySelectorAll('*');
      for (var i = 0; i < cloneEls.length; i++) {
        var el = cloneEls[i];
        if (el.style.position === 'fixed' && el.style.fontFamily) {
          var r = el.getBoundingClientRect();
          result.clone = {
            top: r.top, left: r.left, width: r.width, height: r.height,
            opacity: getComputedStyle(el).opacity,
            text: el.textContent.trim().substring(0, 30),
          };
          break;
        }
      }
    }

    // Measure hero elements on #page-home
    var homePage = document.getElementById('page-home');
    if (!homePage) return result;

    function measure(el) {
      if (!el) return null;
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      return {
        top: r.top, left: r.left, width: r.width, height: r.height,
        opacity: cs.opacity,
        transform: cs.transform,
        animation: cs.animation || cs.webkitAnimation || 'none',
        text: el.textContent.trim().substring(0, 30),
      };
    }

    result.h1 = measure(homePage.querySelector('.hero h1'));
    result.badge = measure(homePage.querySelector('.hero-badge'));
    result.heroBody = measure(homePage.querySelector('.hero-body'));

    return result;
  }, label);
}

async function run() {
  console.log('=== Home Card Title Jump Diagnostic ===\n');

  var browser = await chromium.launch({ headless: false });
  var context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  var page = await context.newPage();

  // Step 1: Load index page
  console.log('Step 1: Loading index page...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(function() {
    return typeof gsap !== 'undefined' && typeof playCard === 'function';
  }, { timeout: 15000 });
  await page.waitForTimeout(1500); // let initial animations settle

  // Step 2: Play a project card (card 0 = Logifuture) to get Home card in hand
  console.log('Step 2: Playing Logifuture card to put Home card in hand...');
  await page.evaluate(function() {
    var el = document.querySelector('[data-card-id="0"]');
    if (!el) throw new Error('Card 0 not found');
    playCard(el, 0);
  });
  await page.waitForTimeout(6000); // wait for full transition + hand rebuild

  // Verify Home card is now in hand
  var hasHome = await page.evaluate(function() {
    return !!document.querySelector('[data-card-id="3"]');
  });
  if (!hasHome) {
    console.error('ERROR: Home card (id=3) not found in hand after project transition');
    await browser.close();
    process.exit(1);
  }
  console.log('  Home card confirmed in hand.\n');

  // Step 3: Instrument fly overlay + beginPageTransition
  await page.evaluate(function() {
    window.__flyDebug = {};

    // Hook beginPageTransition to capture card title rect at transition moment
    var origBegin = window.beginPageTransition;
    window.beginPageTransition = function(cardEl, cardId, cardData) {
      var titleEl = cardEl.querySelector('.card-title h3') || cardEl.querySelector('.card-art-title');
      if (titleEl) {
        var r = titleEl.getBoundingClientRect();
        var cs = getComputedStyle(titleEl);
        window.__flyDebug.cardTitleAtTransition = {
          top: r.top, left: r.left, width: r.width, height: r.height,
          padL: parseFloat(cs.paddingLeft) || 0,
          padT: parseFloat(cs.paddingTop) || 0,
          padR: parseFloat(cs.paddingRight) || 0,
          padB: parseFloat(cs.paddingBottom) || 0,
          fontSize: cs.fontSize,
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
        };
      }
      return origBegin.apply(this, arguments);
    };

    // Observe clone insertion
    var obs = new MutationObserver(function(muts) {
      muts.forEach(function(m) {
        m.addedNodes.forEach(function(n) {
          if (n.style && n.style.position === 'fixed' && n.style.fontFamily) {
            window.__flyDebug.cloneStart = {
              left: parseFloat(n.style.left),
              top: parseFloat(n.style.top),
              width: parseFloat(n.style.width),
              height: parseFloat(n.style.height),
              fontSize: n.style.fontSize,
              lineHeight: n.style.lineHeight,
              text: n.textContent.trim().substring(0, 30),
            };
          }
        });
      });
    });
    var flyOv = document.getElementById('flyOverlay');
    if (flyOv) obs.observe(flyOv, { childList: true });
  });

  // Step 4: Capture card title position, then play Home card
  console.log('Step 3: Playing Home card...\n');
  await page.evaluate(function() {
    window.__flyDebug = window.__flyDebug || {};
    // Capture card art-title position before playCard
    var cardEl = document.querySelector('[data-card-id="3"]');
    var artTitle = cardEl ? cardEl.querySelector('.card-art-title') : null;
    if (artTitle) {
      var r = artTitle.getBoundingClientRect();
      var cs = getComputedStyle(artTitle);
      window.__flyDebug.cardTitleBeforeExpand = {
        top: r.top, left: r.left, width: r.width, height: r.height,
        padL: parseFloat(cs.paddingLeft), padT: parseFloat(cs.paddingTop),
      };
    }
  });
  await page.evaluate(function() {
    var el = document.querySelector('[data-card-id="3"]');
    if (!el) throw new Error('Home card not found');
    playCard(el, 3);
  });

  // Step 5: Variable-frequency polling — 100ms during fly window, 200ms otherwise
  // Card play animation ~2.35s before beginPageTransition, fly is 0.5s (t≈2350-2850ms)
  var samples = [];
  var screenshotsTaken = {};
  var screenshotTimes = [1800, 2200, 2400, 2600, 2800, 3200];
  var FLY_WINDOW_START = 2000;
  var FLY_WINDOW_END = 3000;

  var elapsed = 0;
  while (elapsed < 8000) {
    var interval = (elapsed >= FLY_WINDOW_START && elapsed < FLY_WINDOW_END) ? 100 : 200;
    await page.waitForTimeout(interval);
    elapsed += interval;
    var sample = await measureHeroElements(page, 't=' + elapsed + 'ms');
    sample.elapsedMs = elapsed;
    samples.push(sample);

    // Take screenshots at key times
    if (screenshotTimes.some(function(st) { return elapsed >= st && elapsed < st + interval; })) {
      var idx = screenshotTimes.findIndex(function(st) { return elapsed >= st && elapsed < st + interval; });
      if (!screenshotsTaken[idx]) {
        await page.screenshot({ path: 'tests/diag-home-' + elapsed + 'ms.png' });
        screenshotsTaken[idx] = true;
        console.log('  Screenshot: diag-home-' + elapsed + 'ms.png');
      }
    }
  }

  // Summary table
  console.log('\n=== Hero h1 Position Over Time ===');
  console.log(
    'elapsed  | h1.top     | h1.height  | h1.opacity | h1.transform             | badge.top  | badge.opacity | body.top   | body.opacity | clone.top  | scrollY'
  );
  console.log('-'.repeat(175));

  var prevH1Top = null;
  var prevH1Height = null;
  var jumpCount = 0;
  var maxJump = 0;
  var heightJumpCount = 0;
  var maxHeightJump = 0;

  for (var i = 0; i < samples.length; i++) {
    var s = samples[i];
    var h1t = s.h1 ? s.h1.top.toFixed(1) : '-';
    var h1h = s.h1 ? s.h1.height.toFixed(1) : '-';
    var h1o = s.h1 ? s.h1.opacity : '-';
    var h1tr = s.h1 ? s.h1.transform : '-';
    var bt = s.badge ? s.badge.top.toFixed(1) : '-';
    var bo = s.badge ? s.badge.opacity : '-';
    var bdt = s.heroBody ? s.heroBody.top.toFixed(1) : '-';
    var bdo = s.heroBody ? s.heroBody.opacity : '-';
    var ct = s.clone ? s.clone.top.toFixed(1) : '-';

    var h1Top = s.h1 ? s.h1.top : null;
    var h1Height = s.h1 ? s.h1.height : null;
    var h1Visible = s.h1 && parseFloat(s.h1.opacity) > 0 && s.h1.top > 0;
    var marker = '';
    // Only track jumps when h1 is visible (ignore 0→real when page activates)
    if (prevH1Top !== null && h1Top !== null && h1Visible && Math.abs(h1Top - prevH1Top) > JUMP_THRESHOLD) {
      var delta = h1Top - prevH1Top;
      marker = ' *** TOP JUMP: ' + delta.toFixed(1) + 'px ***';
      jumpCount++;
      if (Math.abs(delta) > Math.abs(maxJump)) maxJump = delta;
    }
    if (prevH1Height !== null && h1Height !== null && h1Visible && Math.abs(h1Height - prevH1Height) > JUMP_THRESHOLD) {
      var hDelta = h1Height - prevH1Height;
      marker += ' *** HEIGHT JUMP: ' + hDelta.toFixed(1) + 'px ***';
      heightJumpCount++;
      if (Math.abs(hDelta) > Math.abs(maxHeightJump)) maxHeightJump = hDelta;
    }
    if (h1Visible && h1Top !== null) prevH1Top = h1Top;
    if (h1Visible && h1Height !== null) prevH1Height = h1Height;

    console.log(
      String(s.elapsedMs).padStart(6) + 'ms | ' +
      String(h1t).padStart(9) + ' | ' +
      String(h1h).padStart(9) + ' | ' +
      String(h1o).padStart(10) + ' | ' +
      String(h1tr).padEnd(24) + ' | ' +
      String(bt).padStart(9) + ' | ' +
      String(bo).padStart(13) + ' | ' +
      String(bdt).padStart(9) + ' | ' +
      String(bdo).padStart(12) + ' | ' +
      String(ct).padStart(9) + ' | ' +
      String(s.scrollY) +
      marker
    );
  }

  // Fly trajectory debug
  var flyDebug = await page.evaluate(function() { return window.__flyDebug; });
  console.log('\n=== Fly Trajectory ===');
  if (flyDebug.cardTitleAtTransition) {
    var ct = flyDebug.cardTitleAtTransition;
    console.log(
      'Card title (at transition): left=' + ct.left.toFixed(1) +
      ', top=' + ct.top.toFixed(1) +
      ', w=' + ct.width.toFixed(1) +
      ', h=' + ct.height.toFixed(1)
    );
    console.log(
      '  padding: L=' + ct.padL.toFixed(1) + ', T=' + ct.padT.toFixed(1) +
      ', R=' + ct.padR.toFixed(1) + ', B=' + ct.padB.toFixed(1)
    );
    console.log(
      '  fontSize=' + ct.fontSize +
      ', lineHeight=' + ct.lineHeight +
      ', letterSpacing=' + ct.letterSpacing
    );
    // Derive scale from visual vs natural dimensions
    // Note: padding in computed style is unscaled; visual padding = padL * scale
    var naturalH = ct.height; // includes scaled padding, this is visual
    console.log('  (padding is CSS-level; multiply by card scale for visual position)');
  }
  if (flyDebug.cloneStart) {
    console.log(
      'Clone START: left=' + flyDebug.cloneStart.left.toFixed(1) +
      ', top=' + flyDebug.cloneStart.top.toFixed(1) +
      ', w=' + flyDebug.cloneStart.width.toFixed(1) +
      ', h=' + flyDebug.cloneStart.height.toFixed(1) +
      ', fontSize=' + flyDebug.cloneStart.fontSize +
      ', lineHeight=' + flyDebug.cloneStart.lineHeight
    );
    if (flyDebug.cardTitleAtTransition) {
      var ct2 = flyDebug.cardTitleAtTransition;
      // Scale factor: clone fontSize / raw fontSize tells us the card scale
      var cloneFs = parseFloat(flyDebug.cloneStart.fontSize);
      var rawFs = parseFloat(ct2.fontSize);
      var scl = rawFs > 0 ? cloneFs / rawFs : 1;
      var textLeft = ct2.left + ct2.padL * scl;
      var textTop = ct2.top + ct2.padT * scl;
      var dx = flyDebug.cloneStart.left - textLeft;
      var dy = flyDebug.cloneStart.top - textTop;
      console.log(
        '  DELTA from card text (scale=' + scl.toFixed(2) + '): dx=' + dx.toFixed(1) + 'px, dy=' + dy.toFixed(1) + 'px' +
        (Math.abs(dx) > 2 || Math.abs(dy) > 2 ? ' *** MISMATCH ***' : ' (aligned)')
      );
    }
  }

  // Result
  console.log('\n=== Result ===');
  var totalJumps = jumpCount + heightJumpCount;
  if (totalJumps === 0) {
    console.log('PASS: No title jumps detected (threshold: ' + JUMP_THRESHOLD + 'px)');
  } else {
    if (jumpCount > 0) {
      console.log('FAIL: ' + jumpCount + ' top jump(s) detected. Max top jump: ' + maxJump.toFixed(1) + 'px');
    }
    if (heightJumpCount > 0) {
      console.log('FAIL: ' + heightJumpCount + ' height jump(s) detected. Max height jump: ' + maxHeightJump.toFixed(1) + 'px');
    }
  }

  console.log('\nScreenshots saved to tests/diag-home-*.png');
  await browser.close();
  process.exit(totalJumps > 0 ? 1 : 0);
}

run().catch(function(err) {
  console.error('Error:', err);
  process.exit(1);
});
