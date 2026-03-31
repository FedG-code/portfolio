/**
 * Home Card Title Jump Diagnostic
 *
 * Captures positions and screenshots at each phase of card-to-page
 * transitions to identify what causes the title to shift/pop after landing.
 *
 * Flow for Home card (id=3): load index -> play a project card to get Home
 *   card in hand -> wait for settle -> play Home card -> poll hero h1 position.
 * Flow for project cards (id=0,1,2): load index -> play card -> poll title.
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   # Run default suite (5 themes x 2 cards x 7 viewports = 70 tests)
 *   node tests/home-title-jump-diagnostic.js
 *
 *   # Single theme, single viewport (named shortcut)
 *   node tests/home-title-jump-diagnostic.js --theme=bold --viewport=mobile
 *
 *   # Multiple themes and viewports
 *   node tests/home-title-jump-diagnostic.js --theme=bold,retro --viewport=375x812,1920x1080
 *
 *   # All 4 cards at desktop resolution
 *   node tests/home-title-jump-diagnostic.js --all-cards --viewport=desktop
 *
 *   # Legacy width/height still works
 *   node tests/home-title-jump-diagnostic.js --theme=bold --card=0 --width=1920 --height=1080
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
 *   mobile  = 375x812   (iPhone SE / 13 mini)
 *   tablet  = 768x1024  (iPad portrait)
 *   desktop = 1920x1080 (Full HD)
 *
 * When no flags are given, runs the full matrix.
 *
 * Important note: this test is correct, so do not edit it if it returns failures
 * multiple times
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';
const JUMP_THRESHOLD = 2; // px — anything above this is a visible jump

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

// ── Measurement helpers ────────────────────────────────────

async function measureHeroElements(page, label, cardId) {
  return await page.evaluate(function(args) {
    var lbl = args.lbl;
    var cid = args.cid;
    var result = {
      phase: lbl,
      scrollY: window.scrollY,
      clone: null,
      h1: null,
      badge: null,
      heroBody: null,
    };

    // Check for flying char spans in fly-overlay (TextRearrange animation)
    var flyOverlay = document.getElementById('flyOverlay');
    if (flyOverlay) {
      var charSpans = flyOverlay.querySelectorAll('span[style*="position"]');
      if (charSpans.length > 0) {
        var minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
        var totalOpacity = 0;
        for (var i = 0; i < charSpans.length; i++) {
          var r = charSpans[i].getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (r.left < minL) minL = r.left;
          if (r.top < minT) minT = r.top;
          if (r.right > maxR) maxR = r.right;
          if (r.bottom > maxB) maxB = r.bottom;
          totalOpacity += parseFloat(getComputedStyle(charSpans[i]).opacity) || 0;
        }
        if (minL !== Infinity) {
          result.clone = {
            top: minT, left: minL, width: maxR - minL, height: maxB - minT,
            opacity: (totalOpacity / charSpans.length).toFixed(2),
            charCount: charSpans.length,
          };
        }
      }
    }

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

    if (cid === 3) {
      // Home card — measure hero elements on #page-home
      var homePage = document.getElementById('page-home');
      if (!homePage) return result;
      result.h1 = measure(homePage.querySelector('.hero h1'));
      result.badge = measure(homePage.querySelector('.hero-badge'));
      result.heroBody = measure(homePage.querySelector('.hero-body'));
    } else {
      // Project card — measure project hero title
      result.h1 = measure(document.querySelector('.project-hero-title'));
    }

    return result;
  }, { lbl: label, cid: cardId });
}

/**
 * Polls for flying chars and a target title element, then checks that the
 * chars' final bounding box matches the title's bounding box within threshold.
 * Returns { miss: bool, dx, dy } or null if chars/title never appeared.
 */
async function checkLandingAccuracy(page, titleSelector, durationMs, label) {
  var intervalMs = 50;
  var iterations = Math.ceil(durationMs / intervalMs);
  var lastChars = null;
  var firstTitle = null;

  for (var i = 0; i < iterations; i++) {
    var m = await page.evaluate(function(sel) {
      var r = {};
      var fly = document.getElementById('flyOverlay');
      if (fly) {
        var spans = fly.querySelectorAll('span[style*="position"]');
        if (spans.length > 0) {
          var minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
          for (var i = 0; i < spans.length; i++) {
            var rect = spans[i].getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            if (rect.left < minL) minL = rect.left;
            if (rect.top < minT) minT = rect.top;
            if (rect.right > maxR) maxR = rect.right;
            if (rect.bottom > maxB) maxB = rect.bottom;
          }
          if (minL !== Infinity) r.chars = { left: minL, top: minT, width: maxR - minL, height: maxB - minT };
        }
      }
      var t = document.querySelector(sel);
      if (t) {
        var tr = t.getBoundingClientRect();
        var op = parseFloat(getComputedStyle(t).opacity);
        if (tr.height > 0 && op > 0) r.title = { left: tr.left, top: tr.top, width: tr.width, height: tr.height };
      }
      return r;
    }, titleSelector);

    if (m.chars) lastChars = m.chars;
    if (!firstTitle && m.title) firstTitle = m.title;
    await page.waitForTimeout(intervalMs);
  }

  if (!lastChars || !firstTitle) return null;

  var dx = lastChars.left - firstTitle.left;
  var dy = lastChars.top - firstTitle.top;
  var miss = Math.abs(dx) > JUMP_THRESHOLD || Math.abs(dy) > JUMP_THRESHOLD;

  console.log('  ' + label + ' landing:');
  console.log('    Chars bbox:  left=' + lastChars.left.toFixed(1) + ', top=' + lastChars.top.toFixed(1));
  console.log('    Title rect:  left=' + firstTitle.left.toFixed(1) + ', top=' + firstTitle.top.toFixed(1));
  console.log('    Delta: dx=' + dx.toFixed(1) + 'px, dy=' + dy.toFixed(1) + 'px' +
    (miss ? ' *** MISS ***' : ' (accurate)'));

  return { miss: miss, dx: dx, dy: dy };
}

// ── Per-combination diagnostic ─────────────────────────────

async function runDiagnostic(browser, theme, cardId, viewport) {
  var label = theme + ' card=' + cardId + ' ' + viewport.label;
  var filePrefix = 'tests/diag-' + theme + '-card' + cardId + '-' + viewport.width + 'x' + viewport.height;
  var isHomeCard = cardId === 3;
  var titleSelector = isHomeCard ? '#page-home .hero h1' : '.project-hero-title';

  console.log('\n--- [' + label + '] ---');

  var context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  var page = await context.newPage();

  try {
    // Step 1: Load index page
    console.log('  Loading index page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(function() {
      return typeof gsap !== 'undefined' && typeof playCard === 'function';
    }, { timeout: 15000 });
    await page.waitForTimeout(1500);

    // Step 2: Set theme
    await page.evaluate(function(t) {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('portfolio-theme', t);
    }, theme);
    await page.waitForTimeout(300);

    // Step 3: For Home card, navigate to a project page first
    var projectLanding = null;
    if (isHomeCard) {
      console.log('  Playing card 0 to get Home card in hand...');
      await page.evaluate(function() {
        var el = document.querySelector('[data-card-id="0"]');
        if (!el) throw new Error('Card 0 not found');
        playCard(el, 0);
      });

      projectLanding = await checkLandingAccuracy(page, '.project-hero-title', 5000, 'Project page');
      await page.waitForTimeout(2000);

      // Verify Home card is now in hand
      var hasHome = await page.evaluate(function() {
        return !!document.querySelector('[data-card-id="3"]');
      });
      if (!hasHome) {
        console.log('  ERROR: Home card (id=3) not found in hand after project transition');
        results.push({ name: label, passed: false, detail: 'Home card not in hand' });
        allPassed = false;
        return;
      }
      console.log('  Home card confirmed in hand.');
    }

    // Step 4: Instrument fly overlay + beginPageTransition
    await page.evaluate(function() {
      window.__flyDebug = {};

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

      var obs = new MutationObserver(function(muts) {
        if (window.__flyDebug.charsStart) return;
        var flyOv = document.getElementById('flyOverlay');
        if (!flyOv) return;
        var spans = flyOv.querySelectorAll('span[style*="position"]');
        if (spans.length === 0) return;
        var minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
        for (var i = 0; i < spans.length; i++) {
          var r = spans[i].getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (r.left < minL) minL = r.left;
          if (r.top < minT) minT = r.top;
          if (r.right > maxR) maxR = r.right;
          if (r.bottom > maxB) maxB = r.bottom;
        }
        if (minL !== Infinity) {
          window.__flyDebug.charsStart = {
            left: minL, top: minT, width: maxR - minL, height: maxB - minT,
            charCount: spans.length,
          };
        }
      });
      var flyOv = document.getElementById('flyOverlay');
      if (flyOv) obs.observe(flyOv, { childList: true, subtree: true });
    });

    // Step 5: Capture card title position, then play the card
    console.log('  Playing card ' + cardId + '...');
    await page.evaluate(function(cid) {
      window.__flyDebug = window.__flyDebug || {};
      var cardEl = document.querySelector('[data-card-id="' + cid + '"]');
      var artTitle = cardEl ? cardEl.querySelector('.card-art-title') : null;
      if (artTitle) {
        var r = artTitle.getBoundingClientRect();
        var cs = getComputedStyle(artTitle);
        window.__flyDebug.cardTitleBeforeExpand = {
          top: r.top, left: r.left, width: r.width, height: r.height,
          padL: parseFloat(cs.paddingLeft), padT: parseFloat(cs.paddingTop),
        };
      }
    }, cardId);
    await page.evaluate(function(cid) {
      var el = document.querySelector('[data-card-id="' + cid + '"]');
      if (!el) throw new Error('Card ' + cid + ' not found');
      playCard(el, cid);
    }, cardId);

    // Step 6: Variable-frequency polling
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
      var sample = await measureHeroElements(page, 't=' + elapsed + 'ms', cardId);
      sample.elapsedMs = elapsed;
      samples.push(sample);

      if (screenshotTimes.some(function(st) { return elapsed >= st && elapsed < st + interval; })) {
        var idx = screenshotTimes.findIndex(function(st) { return elapsed >= st && elapsed < st + interval; });
        if (!screenshotsTaken[idx]) {
          await page.screenshot({ path: filePrefix + '-' + elapsed + 'ms.png' });
          screenshotsTaken[idx] = true;
          console.log('  Screenshot: ' + filePrefix + '-' + elapsed + 'ms.png');
        }
      }
    }

    // Summary table
    console.log('\n  === Title Position Over Time ===');
    console.log(
      '  elapsed  | h1.top     | h1.height  | h1.opacity | h1.transform             | badge.top  | badge.opacity | body.top   | body.opacity | chars.top  | chars# | scrollY'
    );
    console.log('  ' + '-'.repeat(173));

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
      var cc = s.clone ? String(s.clone.charCount) : '-';

      var h1Top = s.h1 ? s.h1.top : null;
      var h1Height = s.h1 ? s.h1.height : null;
      var h1Visible = s.h1 && parseFloat(s.h1.opacity) > 0 && s.h1.top > 0;
      var marker = '';
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
        '  ' + String(s.elapsedMs).padStart(6) + 'ms | ' +
        String(h1t).padStart(9) + ' | ' +
        String(h1h).padStart(9) + ' | ' +
        String(h1o).padStart(10) + ' | ' +
        String(h1tr).padEnd(24) + ' | ' +
        String(bt).padStart(9) + ' | ' +
        String(bo).padStart(13) + ' | ' +
        String(bdt).padStart(9) + ' | ' +
        String(bdo).padStart(12) + ' | ' +
        String(ct).padStart(9) + ' | ' +
        String(cc).padStart(6) + ' | ' +
        String(s.scrollY) +
        marker
      );
    }

    // Fly trajectory debug
    var flyDebug = await page.evaluate(function() { return window.__flyDebug; });
    console.log('\n  === Fly Trajectory ===');
    if (flyDebug.cardTitleAtTransition) {
      var ct = flyDebug.cardTitleAtTransition;
      console.log(
        '  Card title (at transition): left=' + ct.left.toFixed(1) +
        ', top=' + ct.top.toFixed(1) +
        ', w=' + ct.width.toFixed(1) +
        ', h=' + ct.height.toFixed(1)
      );
      console.log(
        '    padding: L=' + ct.padL.toFixed(1) + ', T=' + ct.padT.toFixed(1) +
        ', R=' + ct.padR.toFixed(1) + ', B=' + ct.padB.toFixed(1)
      );
      console.log(
        '    fontSize=' + ct.fontSize +
        ', lineHeight=' + ct.lineHeight +
        ', letterSpacing=' + ct.letterSpacing
      );
      console.log('    (padding is CSS-level; multiply by card scale for visual position)');
    }
    if (flyDebug.charsStart) {
      console.log(
        '  Chars START: left=' + flyDebug.charsStart.left.toFixed(1) +
        ', top=' + flyDebug.charsStart.top.toFixed(1) +
        ', w=' + flyDebug.charsStart.width.toFixed(1) +
        ', h=' + flyDebug.charsStart.height.toFixed(1) +
        ', chars=' + flyDebug.charsStart.charCount
      );
      if (flyDebug.cardTitleAtTransition) {
        var ct2 = flyDebug.cardTitleAtTransition;
        var dx = flyDebug.charsStart.left - ct2.left;
        var dy = flyDebug.charsStart.top - ct2.top;
        console.log(
          '    DELTA from card title: dx=' + dx.toFixed(1) + 'px, dy=' + dy.toFixed(1) + 'px' +
          (Math.abs(dx) > 2 || Math.abs(dy) > 2 ? ' *** MISMATCH ***' : ' (aligned)')
        );
      }
    } else {
      console.log('  WARNING: No char spans detected in flyOverlay — TextRearrange.fly() may have returned null');
    }

    // Check fly landing accuracy: last sample with chars vs first sample with visible h1
    var lastChars = null;
    var firstH1 = null;
    for (var j = 0; j < samples.length; j++) {
      if (samples[j].clone) lastChars = samples[j].clone;
      if (!firstH1 && samples[j].h1 && parseFloat(samples[j].h1.opacity) > 0 && samples[j].h1.top > 0) {
        firstH1 = samples[j].h1;
      }
    }

    var landingMiss = false;
    var landingDx = 0;
    var landingDy = 0;
    console.log('\n  === Fly Landing Accuracy ===');
    if (lastChars && firstH1) {
      landingDx = lastChars.left - firstH1.left;
      landingDy = lastChars.top - firstH1.top;
      console.log(
        '  Last chars bbox: left=' + lastChars.left.toFixed(1) + ', top=' + lastChars.top.toFixed(1) +
        ', w=' + lastChars.width.toFixed(1) + ', h=' + lastChars.height.toFixed(1)
      );
      console.log(
        '  First visible h1: left=' + firstH1.left.toFixed(1) + ', top=' + firstH1.top.toFixed(1) +
        ', w=' + firstH1.width.toFixed(1) + ', h=' + firstH1.height.toFixed(1)
      );
      console.log(
        '  Landing delta: dx=' + landingDx.toFixed(1) + 'px, dy=' + landingDy.toFixed(1) + 'px' +
        (Math.abs(landingDx) > JUMP_THRESHOLD || Math.abs(landingDy) > JUMP_THRESHOLD ? ' *** MISS ***' : ' (accurate)')
      );
      landingMiss = Math.abs(landingDx) > JUMP_THRESHOLD || Math.abs(landingDy) > JUMP_THRESHOLD;
    } else if (!lastChars) {
      console.log('  WARNING: No char span samples captured — cannot check landing accuracy');
    } else {
      console.log('  WARNING: h1 never became visible — cannot check landing accuracy');
    }

    // Result for this combination
    var projectMiss = projectLanding && projectLanding.miss;
    var totalJumps = jumpCount + heightJumpCount;
    var totalFails = totalJumps + (landingMiss ? 1 : 0) + (projectMiss ? 1 : 0);
    var passed = totalFails === 0;

    console.log('\n  === Result ===');
    if (passed) {
      console.log('  PASS: No title jumps or landing misses detected (threshold: ' + JUMP_THRESHOLD + 'px)');
    } else {
      if (projectMiss) {
        console.log('  FAIL: Project page chars missed target. dx=' + projectLanding.dx.toFixed(1) + 'px, dy=' + projectLanding.dy.toFixed(1) + 'px');
      }
      if (jumpCount > 0) {
        console.log('  FAIL: ' + jumpCount + ' top jump(s) detected. Max top jump: ' + maxJump.toFixed(1) + 'px');
      }
      if (heightJumpCount > 0) {
        console.log('  FAIL: ' + heightJumpCount + ' height jump(s) detected. Max height jump: ' + maxHeightJump.toFixed(1) + 'px');
      }
      if (landingMiss) {
        console.log('  FAIL: Chars missed target h1 position. dx=' + landingDx.toFixed(1) + 'px, dy=' + landingDy.toFixed(1) + 'px');
      }
    }

    results.push({ name: label, passed: passed });
    if (!passed) allPassed = false;

  } catch (err) {
    console.log('  ERROR: ' + err.message);
    results.push({ name: label, passed: false, detail: err.message });
    allPassed = false;
  } finally {
    await context.close();
  }
}

// ── Main ───────────────────────────────────────────────────
async function run() {
  var flags = parseFlags();

  if (flags.help) {
    console.log('Usage: node tests/home-title-jump-diagnostic.js [flags]');
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
    console.log('  node tests/home-title-jump-diagnostic.js');
    console.log('  node tests/home-title-jump-diagnostic.js --theme=bold,brutalist --viewport=mobile');
    console.log('  node tests/home-title-jump-diagnostic.js --theme=retro --card=0,1,2,3 --viewport=375x812,1920x1080');
    console.log('  node tests/home-title-jump-diagnostic.js --all-cards --viewport=desktop');
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

  console.log('=== Title Landing Diagnostic ===');
  console.log('Themes:    ' + themes.join(', '));
  console.log('Cards:     ' + cards.join(', '));
  console.log('Viewports: ' + viewports.map(function(v) { return v.label; }).join(', '));
  console.log('');

  var browser = await chromium.launch({ headless: false });

  for (var ti = 0; ti < themes.length; ti++) {
    var theme = themes[ti];
    console.log('\n[' + theme + ']');
    for (var ci = 0; ci < cards.length; ci++) {
      var cardId = cards[ci];
      for (var vi = 0; vi < viewports.length; vi++) {
        await runDiagnostic(browser, theme, cardId, viewports[vi]);
      }
    }
  }

  await browser.close();

  // Summary
  console.log('\n════════════════════════════════');
  var passed = results.filter(function(r) { return r.passed; }).length;
  var failed = results.filter(function(r) { return !r.passed; }).length;
  console.log('Passed: ' + passed + '  Failed: ' + failed + '  Total: ' + results.length);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.forEach(function(r) {
      if (!r.passed) console.log('  [FAIL] ' + r.name + (r.detail ? ' — ' + r.detail : ''));
    });
  }

  console.log('\nScreenshots saved to tests/diag-*.png');
  process.exit(allPassed ? 0 : 1);
}

run().catch(function(err) {
  console.error('Error:', err);
  process.exit(1);
});
