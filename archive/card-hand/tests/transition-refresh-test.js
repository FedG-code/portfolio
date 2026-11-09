/**
 * Transition Refresh Test
 *
 * Detects visible "refresh" or layout shift after the card fly-in animation
 * completes on project pages. The bug: when the fly clone is removed, the
 * real .work-image is inside a .project-content.reveal parent that still has
 * opacity: 0 (the IntersectionObserver hasn't fired yet). The image is
 * invisible for ~0.6s+ while the .reveal transition fades it in.
 *
 * This test uses requestAnimationFrame to check the **effective visual
 * opacity** (product of all ancestor opacities) of the .work-image every
 * frame. If the clone is gone and the effective opacity is near zero, that's
 * the gap the user sees.
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   node tests/transition-refresh-test.js
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';
const VIEWPORT = { width: 1280, height: 800 };

// Time budget: card animation ~2.5s + fly ~0.5s + fade ~0.4s + swap + reveal
const TRANSITION_SETTLE_MS = 5000;
// How long to collect data after page visible
const OBSERVATION_WINDOW_MS = 2000;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  // Let the hand settle
  await page.waitForTimeout(1500);

  // Inject observers
  await page.evaluate(() => {
    window.__testResults = {
      layoutShifts: [],
      domMutationBursts: [],
    };

    // Layout Shift observer
    if (window.PerformanceObserver) {
      const lso = new PerformanceObserver((list) => {
        const wrapper = document.querySelector('#pageContainer .spa-page');
        const wrapperOpacity = wrapper
          ? parseFloat(wrapper.style.opacity || getComputedStyle(wrapper).opacity)
          : 0;
        for (const entry of list.getEntries()) {
          window.__testResults.layoutShifts.push({
            value: entry.value,
            time: entry.startTime,
            hadRecentInput: entry.hadRecentInput,
            wrapperOpacity: wrapperOpacity,
          });
        }
      });
      try { lso.observe({ type: 'layout-shift', buffered: false }); } catch(e) {}
    }

    // Mutation + rAF probe — started before transition
    window.__startProbe = function() {
      const target = document.getElementById('pageContainer');
      if (!target) return;

      // DOM mutation burst tracker
      let burstCount = 0;
      let burstStart = 0;
      const mo = new MutationObserver((mutations) => {
        const now = performance.now();
        const wrapper = target.querySelector('.spa-page');
        if (!wrapper) return;
        const opacity = parseFloat(wrapper.style.opacity || getComputedStyle(wrapper).opacity);
        if (opacity < 0.5) return;
        if (now - burstStart > 100) {
          if (burstCount > 0) {
            window.__testResults.domMutationBursts.push({
              count: burstCount,
              time: burstStart,
              wrapperOpacity: opacity,
            });
          }
          burstCount = 0;
          burstStart = now;
        }
        burstCount += mutations.length;
      });
      mo.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

      // rAF probe: effective opacity chain
      window.__probeLog = [];
      window.__probeRunning = true;

      function getEffectiveOpacity(el) {
        var opacity = 1;
        while (el && el !== document.body) {
          opacity *= parseFloat(getComputedStyle(el).opacity);
          el = el.parentElement;
        }
        return opacity;
      }

      function probe() {
        if (!window.__probeRunning) return;
        var img = document.querySelector('#pageContainer .work-image');
        if (img) {
          var effectiveOpacity = getEffectiveOpacity(img);
          var flyOverlay = document.getElementById('flyOverlay');
          var hasClone = flyOverlay && flyOverlay.children.length > 0;
          var cloneOpacity = 0;
          if (hasClone) {
            Array.from(flyOverlay.children).forEach(function(c) {
              var co = parseFloat(getComputedStyle(c).opacity);
              if (co > cloneOpacity) cloneOpacity = co;
            });
          }
          window.__probeLog.push({
            time: performance.now(),
            effectiveOpacity: effectiveOpacity,
            cloneOpacity: cloneOpacity,
            hasClone: hasClone,
            imgLoaded: img.complete && img.naturalWidth > 0,
          });
        }
        requestAnimationFrame(probe);
      }
      requestAnimationFrame(probe);
    };
  });

  // Start probe before triggering transition
  await page.evaluate(() => window.__startProbe());

  // Trigger card play to Coffin-Likker (card id 1)
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.card');
    let targetCard = null;
    cards.forEach(c => {
      if (c.dataset.cardId === '1') targetCard = c;
    });
    if (!targetCard) {
      targetCard = cards[1];
    }
    if (targetCard && window.playCard) {
      window.playCard(targetCard, 1);
    } else {
      throw new Error('Could not find card or playCard function');
    }
  });

  // Wait for the full transition to settle
  await page.waitForTimeout(TRANSITION_SETTLE_MS);

  // Collect an additional observation window
  await page.waitForTimeout(OBSERVATION_WINDOW_MS);

  // Gather results
  const results = await page.evaluate(() => {
    window.__probeRunning = false;

    const r = window.__testResults;
    const probeLog = window.__probeLog || [];

    // --- Image gap analysis ---
    // Gap frames: clone is gone/transparent AND image effectively invisible
    const gapFrames = probeLog.filter(
      f => f.cloneOpacity < 0.05 && f.effectiveOpacity < 0.1 && f.imgLoaded
    );

    // Fade-in frames: clone gone, image fading in (partially visible)
    const fadeInFrames = probeLog.filter(
      f => f.cloneOpacity < 0.05 && f.effectiveOpacity >= 0.1 && f.effectiveOpacity < 0.9
    );

    // Compute gap duration
    let gapDurationMs = 0;
    if (gapFrames.length > 0) {
      gapDurationMs = gapFrames[gapFrames.length - 1].time - gapFrames[0].time;
    }

    // Compute fade-in duration (time from clone removal to full effective opacity)
    let fadeInDurationMs = 0;
    if (fadeInFrames.length > 0) {
      fadeInDurationMs = fadeInFrames[fadeInFrames.length - 1].time - fadeInFrames[0].time;
    }

    // --- Layout shift analysis (unchanged) ---
    const significantShifts = r.layoutShifts.filter(
      s => !s.hadRecentInput && s.value > 0.01 && s.wrapperOpacity > 0.8
    );
    const allShifts = r.layoutShifts.filter(s => !s.hadRecentInput && s.value > 0.01);
    const visibleMutationBursts = r.domMutationBursts.filter(b => b.wrapperOpacity > 0.9 && b.count > 10);

    return {
      // Image handoff
      gapFrameCount: gapFrames.length,
      gapDurationMs: gapDurationMs,
      fadeInFrameCount: fadeInFrames.length,
      fadeInDurationMs: fadeInDurationMs,
      probeLogLength: probeLog.length,
      // Sample data for debugging
      gapSample: gapFrames.slice(0, 3).map(f => ({
        time: f.time.toFixed(1),
        effectiveOpacity: f.effectiveOpacity.toFixed(4),
        cloneOpacity: f.cloneOpacity.toFixed(4),
      })),
      fadeInSample: fadeInFrames.slice(0, 3).map(f => ({
        time: f.time.toFixed(1),
        effectiveOpacity: f.effectiveOpacity.toFixed(4),
      })),
      // CLS
      layoutShifts: significantShifts,
      totalCLS: significantShifts.reduce((sum, s) => sum + s.value, 0),
      allShifts: allShifts,
      totalCLSAll: allShifts.reduce((sum, s) => sum + s.value, 0),
      visibleMutationBursts: visibleMutationBursts,
    };
  });

  await browser.close();

  // Report
  console.log('\n=== Transition Refresh Test (Coffin-Likker) ===\n');

  let passed = true;

  // Check 1: No significant layout shifts while page is visible
  if (results.totalCLS > 0.05) {
    console.log('FAIL: Visible CLS too high:', results.totalCLS.toFixed(4));
    console.log('  Visible shifts:', JSON.stringify(results.layoutShifts, null, 2));
    passed = false;
  } else {
    console.log('PASS: Visible CLS within threshold:', results.totalCLS.toFixed(4));
  }
  if (results.totalCLSAll > results.totalCLS) {
    console.log('  (Info: total CLS including invisible:', results.totalCLSAll.toFixed(4) + ')');
  }

  // Check 2: No large DOM mutation bursts while wrapper is fully visible
  if (results.visibleMutationBursts.length > 0) {
    console.log('FAIL: DOM mutation bursts while page visible:');
    results.visibleMutationBursts.forEach(b => {
      console.log('  ' + b.count + ' mutations at opacity ' + b.wrapperOpacity.toFixed(2));
    });
    passed = false;
  } else {
    console.log('PASS: No large DOM mutation bursts while page visible');
  }

  // Check 3: Image not invisible after clone removal
  if (results.gapFrameCount > 0) {
    console.log('FAIL: Image invisible after clone removal — ' + results.gapFrameCount + ' gap frames (' + results.gapDurationMs.toFixed(0) + 'ms)');
    console.log('  Sample gap frames:', JSON.stringify(results.gapSample, null, 2));
    passed = false;
  } else {
    console.log('PASS: No image gap after clone removal');
  }

  // Check 4: Image doesn't slowly fade in (visible re-appear)
  if (results.fadeInFrameCount > 5) {
    console.log('FAIL: Image slowly fading in after handoff — ' + results.fadeInFrameCount + ' frames (' + results.fadeInDurationMs.toFixed(0) + 'ms)');
    console.log('  Sample fade-in frames:', JSON.stringify(results.fadeInSample, null, 2));
    passed = false;
  } else {
    console.log('PASS: No slow image fade-in (' + results.fadeInFrameCount + ' transitional frames)');
  }

  console.log('\n  (' + results.probeLogLength + ' frames probed total)');
  console.log('\nOverall:', passed ? 'PASS' : 'FAIL');
  console.log('');

  process.exit(passed ? 0 : 1);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
