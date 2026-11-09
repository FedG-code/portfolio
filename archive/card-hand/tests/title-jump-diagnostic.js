/**
 * Title Jump Diagnostic
 *
 * Captures positions and screenshots at each phase of the card-to-page
 * transition to identify what causes the title to shift/pop after landing.
 *
 * Prerequisite: local server on port 8080 (npx http-server -p 8080 -c-1)
 * Run: node tests/title-jump-diagnostic.js
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';
const CARD_ID = parseInt(process.argv[2]) || 1; // default Coffin-Likker, pass 0/1/2 as arg
const JUMP_THRESHOLD = 2; // px — anything above this is a visible jump

async function measureAllHeroElements(page, label) {
  return await page.evaluate((lbl) => {
    var result = {
      phase: lbl,
      scrollY: window.scrollY,
      clone: null,
      title: null,
      badge: null,
      desc: null,
      meta: null,
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

    // Measure all hero elements
    var container = document.querySelector('#pageContainer') || document;
    var titleEl = container.querySelector('.project-hero-title');
    var badgeEl = container.querySelector('.project-hero-badge');
    var descEl = container.querySelector('.project-hero-desc');
    var metaEl = container.querySelector('.project-meta');

    function measure(el) {
      if (!el) return null;
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      return {
        top: r.top, left: r.left, width: r.width, height: r.height,
        opacity: cs.opacity,
        transform: cs.transform,
        hasReveal: el.classList.contains('reveal'),
        hasVisible: el.classList.contains('visible'),
        text: el.textContent.trim().substring(0, 30),
      };
    }

    result.title = measure(titleEl);
    result.badge = measure(badgeEl);
    result.desc = measure(descEl);
    result.meta = measure(metaEl);

    return result;
  }, label);
}

async function run() {
  console.log('=== Title Jump Diagnostic (Coffin-Likker) ===\n');

  var browser = await chromium.launch({ headless: false });
  var context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  var page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(function() {
    return typeof gsap !== 'undefined' && typeof playCard === 'function';
  }, { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Instrument: capture fly start/end positions
  await page.evaluate(function() {
    window.__flyDebug = {};
    var origBegin = window.beginPageTransition;
    if (origBegin) {
      // Can't easily hook — instrument via titleRect capture in applyCloneStyles
    }
    // Hook into flyOverlay to capture clone position when it appears
    var obs = new MutationObserver(function(muts) {
      muts.forEach(function(m) {
        m.addedNodes.forEach(function(n) {
          if (n.style && n.style.position === 'fixed' && n.style.fontFamily) {
            window.__flyDebug.cloneStart = {
              left: parseFloat(n.style.left),
              top: parseFloat(n.style.top),
              width: parseFloat(n.style.width),
              height: parseFloat(n.style.height),
              text: n.textContent.trim().substring(0, 30),
            };
          }
        });
      });
    });
    var flyOv = document.getElementById('flyOverlay');
    if (flyOv) obs.observe(flyOv, { childList: true });
  });

  // Trigger playCard
  var cardTitle = await page.evaluate(function(cid) { return CARDS[cid].title; }, CARD_ID);
  console.log('Triggering playCard for "' + cardTitle + '" (card ' + CARD_ID + ')...\n');
  await page.evaluate(function(cid) {
    var el = document.querySelector('[data-card-id="' + cid + '"]');
    if (!el) throw new Error('Card element not found for id ' + cid);
    playCard(el, cid);
  }, CARD_ID);

  // High-frequency polling: sample every 200ms for 8 seconds
  var samples = [];
  var screenshotsTaken = {};
  var screenshotTimes = [2300, 3200, 3800, 4400, 5000, 6000]; // ms to screenshot

  for (var t = 0; t <= 8000; t += 200) {
    await page.waitForTimeout(t === 0 ? 200 : 200);
    var elapsed = (t + 200);
    var sample = await measureAllHeroElements(page, 't=' + elapsed + 'ms');
    sample.elapsedMs = elapsed;
    samples.push(sample);

    // Take screenshots at key times
    if (screenshotTimes.some(function(st) { return elapsed >= st && elapsed < st + 200; })) {
      var idx = screenshotTimes.findIndex(function(st) { return elapsed >= st && elapsed < st + 200; });
      if (!screenshotsTaken[idx]) {
        await page.screenshot({ path: 'tests/diag-ck-' + elapsed + 'ms.png' });
        screenshotsTaken[idx] = true;
        console.log('  Screenshot: diag-ck-' + elapsed + 'ms.png');
      }
    }
  }

  // Summary table
  console.log('\n=== Title Position Over Time ===');
  console.log('elapsed  | title.top  | title.h    | title.transform          | badge.top | desc.top  | desc.transform           | desc.reveal | desc.visible');
  console.log('-'.repeat(155));

  var prevTitleTop = null;
  var prevTitleHeight = null;
  var jumpCount = 0;
  var maxJump = 0;
  var heightJumpCount = 0;
  var maxHeightJump = 0;

  for (var i = 0; i < samples.length; i++) {
    var s = samples[i];
    var tt = s.title ? s.title.top.toFixed(1) : '-';
    var th = s.title ? s.title.height.toFixed(1) : '-';
    var ttrans = s.title ? s.title.transform : '-';
    var bt = s.badge ? s.badge.top.toFixed(1) : '-';
    var dt = s.desc ? s.desc.top.toFixed(1) : '-';
    var dtrans = s.desc ? s.desc.transform : '-';
    var drev = s.desc ? s.desc.hasReveal : '-';
    var dvis = s.desc ? s.desc.hasVisible : '-';

    var titleTop = s.title ? s.title.top : null;
    var titleHeight = s.title ? s.title.height : null;
    var titleVisible = s.title && parseFloat(s.title.opacity) > 0 && s.title.top > 0;
    var marker = '';
    if (prevTitleTop !== null && titleTop !== null && titleVisible && Math.abs(titleTop - prevTitleTop) > JUMP_THRESHOLD) {
      var delta = titleTop - prevTitleTop;
      marker = ' *** TOP JUMP: ' + delta.toFixed(1) + 'px ***';
      jumpCount++;
      if (Math.abs(delta) > Math.abs(maxJump)) maxJump = delta;
    }
    if (prevTitleHeight !== null && titleHeight !== null && titleVisible && Math.abs(titleHeight - prevTitleHeight) > JUMP_THRESHOLD) {
      var hDelta = titleHeight - prevTitleHeight;
      marker += ' *** HEIGHT JUMP: ' + hDelta.toFixed(1) + 'px ***';
      heightJumpCount++;
      if (Math.abs(hDelta) > Math.abs(maxHeightJump)) maxHeightJump = hDelta;
    }
    if (titleVisible && titleTop !== null) prevTitleTop = titleTop;
    if (titleVisible && titleHeight !== null) prevTitleHeight = titleHeight;

    console.log(
      String(s.elapsedMs).padStart(6) + 'ms | ' +
      String(tt).padStart(9) + ' | ' +
      String(th).padStart(9) + ' | ' +
      String(ttrans).padEnd(24) + ' | ' +
      String(bt).padStart(9) + ' | ' +
      String(dt).padStart(9) + ' | ' +
      String(dtrans).padEnd(24) + ' | ' +
      String(drev).padEnd(11) + ' | ' +
      String(dvis) +
      marker
    );
  }

  // Fly trajectory debug
  var flyDebug = await page.evaluate(function() { return window.__flyDebug; });
  var firstTitle = samples.find(function(s) { return s.title; });
  console.log('\n=== Fly Trajectory ===');
  if (flyDebug.cloneStart) {
    console.log('Clone START: left=' + flyDebug.cloneStart.left.toFixed(1) +
      ', top=' + flyDebug.cloneStart.top.toFixed(1) +
      ', w=' + flyDebug.cloneStart.width.toFixed(1) +
      ', h=' + flyDebug.cloneStart.height.toFixed(1) +
      ' ("' + flyDebug.cloneStart.text + '")');
  } else {
    console.log('Clone start: not captured');
  }
  if (firstTitle && firstTitle.title) {
    console.log('Target END:  left=' + firstTitle.title.left.toFixed(1) +
      ', top=' + firstTitle.title.top.toFixed(1) +
      ', w=' + firstTitle.title.width.toFixed(1) +
      ', h=' + firstTitle.title.height.toFixed(1) +
      ' ("' + firstTitle.title.text + '")');
  }
  if (flyDebug.cloneStart && firstTitle && firstTitle.title) {
    var dx = firstTitle.title.left - flyDebug.cloneStart.left;
    var dy = firstTitle.title.top - flyDebug.cloneStart.top;
    var angle = Math.atan2(dy, dx) * 180 / Math.PI;
    console.log('Delta: dx=' + dx.toFixed(1) + ', dy=' + dy.toFixed(1) +
      ', angle=' + angle.toFixed(1) + '°');
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

  console.log('\nScreenshots saved to tests/diag-ck-*.png');
  await browser.close();
  process.exit(totalJumps > 0 ? 1 : 0);
}

run().catch(function(err) {
  console.error('Error:', err);
  process.exit(1);
});
