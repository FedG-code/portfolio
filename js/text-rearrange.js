/* ═══════════════════════════════════════════════════════════════
   TEXT REARRANGE — character-level layout transition animation
   Splits title text into individual chars, measures positions
   directly on both source (card) and target (page h1) DOM elements,
   then animates each character sequentially along alternating
   bezier arcs from its source position to its target position.

   Direct DOM measurement guarantees pixel-perfect landing at any
   viewport width — no hidden-div replication of CSS needed.

   Requires: GSAP core, SplitText (both already loaded).
   ═══════════════════════════════════════════════════════════════ */

var TextRearrange = (function () {

  /* ── Tuning constants ── */
  var CHAR_STAGGER  = 0.05;   // seconds between each character launch
  var CHAR_DURATION = 0.20;   // seconds each character takes to fly
  var ARC_HEIGHT    = 150;    // pixels of perpendicular arc offset
  var DISCRETE_SWAP = 0.30;   // progress (0-1) at which discrete props swap

  /* ── Quadratic bezier helper ── */
  function quadBezier(t, p0x, p0y, p1x, p1y, p2x, p2y) {
    var mt = 1 - t;
    return {
      x: mt * mt * p0x + 2 * mt * t * p1x + t * t * p2x,
      y: mt * mt * p0y + 2 * mt * t * p1y + t * t * p2y
    };
  }

  /* ── Measure character positions directly on a live DOM element ──
     Uses SplitText on the actual element (which is in the DOM and laid out),
     capturing absolute screen positions and per-char computed styles.
     SplitText is reverted in a finally block to restore the element.
     If keepSplit is true, the split is kept alive and returned so the
     caller can hide individual source chars during the animation. */
  function measureDirect(el, keepSplit) {
    var split = null;
    try {
      split = SplitText.create(el, { type: 'chars', tag: 'span' });

      var elRect = el.getBoundingClientRect();
      if (elRect.width === 0 && elRect.height === 0) {
        console.warn('TextRearrange.measureDirect: element has zero size (display:none ancestor?)');
      }

      var positions = [];
      var charEls = [];
      for (var i = 0; i < split.chars.length; i++) {
        var charSpan = split.chars[i];
        var r = charSpan.getBoundingClientRect();
        var cs = getComputedStyle(charSpan);

        positions.push({
          x:  r.left,
          y:  r.top,
          w:  r.width,
          h:  r.height,
          ch: charSpan.textContent,
          // Per-char styles (handles <em>, inline markup, inherited styles)
          fontSize:      parseFloat(cs.fontSize),
          fontFamily:    cs.fontFamily,
          fontWeight:    cs.fontWeight,
          fontStyle:     cs.fontStyle,
          lineHeight:    cs.lineHeight,
          letterSpacing: cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing,
          textTransform: cs.textTransform,
          color:         cs.color
        });
        charEls.push(charSpan);
      }

      var elCS = getComputedStyle(el);
      var result = { positions: positions, sourceChars: charEls, split: split, elRect: elRect, lineHeight: elCS.lineHeight };
      if (keepSplit) split = null; // prevent finally from reverting
      return result;
    } finally {
      if (split) split.revert();
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     fly() — main entry point
     Replaces the simple bounding-box tween in page-transition.js.

     Returns { timeline, destroy, wrapper, charEls } or null on failure.

     Parameters:
       sourceEl   — the card title DOM element (e.g. .card-title h3)
       targetEl   — the page title DOM element (e.g. .project-hero-title)
       overlay    — container for flying chars (flyOverlay)
       onStart    — optional callback when animation begins
     ═══════════════════════════════════════════════════════════════ */
  function fly(opts) {
    var sourceEl = opts.sourceEl;
    var targetEl = opts.targetEl;
    var overlay  = opts.overlay;
    var onStart  = opts.onStart || null;

    // Guard: bail if fonts haven't loaded (measurements would use fallback fonts)
    if (document.fonts && document.fonts.status !== 'loaded') {
      console.warn('TextRearrange.fly(): fonts not yet loaded — bailing to avoid wrong measurements');
      return null;
    }

    // ── Measure both layouts directly on the live DOM elements ──
    // Keep source split alive — these chars ARE the flying elements (no clones)
    var srcData = measureDirect(sourceEl, true);
    var tgtData = measureDirect(targetEl);

    var count = Math.min(srcData.positions.length, tgtData.positions.length);
    if (count === 0) return null;

    if (srcData.positions.length !== tgtData.positions.length) {
      console.warn('TextRearrange: char count mismatch — source:', srcData.positions.length, 'target:', tgtData.positions.length);
      if (Math.abs(srcData.positions.length - tgtData.positions.length) > 2) {
        return null;  // large mismatch — fall back to whole-element tween
      }
    }

    // ── Correct target positions for inline vs inline-block glyph offset ──
    // measureDirect returns inline span glyph bounds (ascenders/italic overhangs
    // extend beyond the element box). Flying chars are display:inline-block, where
    // the box edges ARE the positioned coordinates. Shift target positions so the
    // inline-block boxes align with the element box, keeping glyphs at the correct
    // visual position when the real element appears.
    if (tgtData.elRect && tgtData.positions.length > 0) {
      var minCharY = tgtData.positions[0].y;
      for (var j = 1; j < tgtData.positions.length; j++) {
        if (tgtData.positions[j].y < minCharY) minCharY = tgtData.positions[j].y;
      }
      var yCorrection = tgtData.elRect.top - minCharY;
      if (yCorrection !== 0) {
        for (var j = 0; j < tgtData.positions.length; j++) {
          tgtData.positions[j].y += yCorrection;
        }
      }
    }

    // ── Pull source chars out of sourceEl into overlay directly ──
    var charEls = [];
    for (var i = 0; i < count; i++) {
      var charSpan = srcData.sourceChars[i];
      var sp = srcData.positions[i];

      charSpan.style.cssText =
        'position:fixed;display:inline-block;white-space:pre;pointer-events:none;' +
        'will-change:transform;left:0;top:0;' +
        'font-family:'    + sp.fontFamily    + ';' +
        'font-size:'      + sp.fontSize      + 'px;' +
        'font-weight:'    + sp.fontWeight    + ';' +
        'font-style:'     + sp.fontStyle     + ';' +
        'letter-spacing:' + sp.letterSpacing + ';' +
        'text-transform:' + sp.textTransform + ';' +
        'color:'          + sp.color         + ';' +
        'line-height:'   + sp.lineHeight   + ';';

      overlay.appendChild(charSpan);
      gsap.set(charSpan, { x: sp.x, y: sp.y });
      charEls.push(charSpan);
    }

    // Remove the now-empty sourceEl from overlay
    sourceEl.remove();

    // ── Build animation timeline ──
    var tl = gsap.timeline();

    if (onStart) tl.call(onStart);

    // ── Animate each character sequentially along bezier arcs ──
    for (var i = 0; i < count; i++) {
      (function (idx) {
        var sp = srcData.positions[idx];
        var tp = tgtData.positions[idx];

        var sx = sp.x;
        var sy = sp.y;
        var tx = tp.x;
        var ty = tp.y;

        // Compute bezier control point: perpendicular offset at midpoint
        var mx = (sx + tx) / 2;
        var my = (sy + ty) / 2;
        var dx = tx - sx;
        var dy = ty - sy;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var px = -dy / len;
        var py =  dx / len;
        var sign = (idx % 2 === 0) ? 1 : -1;
        var cpx = mx + px * ARC_HEIGHT * sign;
        var cpy = my + py * ARC_HEIGHT * sign;

        var charEl = charEls[idx];
        var swapped = false;
        var proxy = { t: 0 };

        var startTime = idx * CHAR_STAGGER;

        tl.to(proxy, {
          t: 1,
          duration: CHAR_DURATION,
          ease: 'power3.inOut',
          onUpdate: function () {
            var t = proxy.t;

            // Position along bezier arc
            var pos = quadBezier(t, sx, sy, cpx, cpy, tx, ty);
            gsap.set(charEl, { x: pos.x, y: pos.y });

            // Interpolate font size
            var srcFS = sp.fontSize;
            var tgtFS = tp.fontSize;
            charEl.style.fontSize = (srcFS + (tgtFS - srcFS) * t) + 'px';

            // Interpolate font weight (numeric)
            var srcW = parseFloat(sp.fontWeight) || 400;
            var tgtW = parseFloat(tp.fontWeight) || 400;
            charEl.style.fontWeight = Math.round(srcW + (tgtW - srcW) * t);

            // Interpolate letter spacing
            var srcLS = parseFloat(sp.letterSpacing) || 0;
            var tgtLS = parseFloat(tp.letterSpacing) || 0;
            charEl.style.letterSpacing = (srcLS + (tgtLS - srcLS) * t) + 'px';

            // Interpolate line height
            var srcLH = parseFloat(sp.lineHeight) || sp.fontSize;
            var tgtLH = parseFloat(tp.lineHeight) || tp.fontSize;
            charEl.style.lineHeight = (srcLH + (tgtLH - srcLH) * t) + 'px';

            // Swap discrete (non-interpolatable) properties once
            if (!swapped && t >= DISCRETE_SWAP) {
              swapped = true;
              charEl.style.fontFamily    = tp.fontFamily;
              charEl.style.fontStyle     = tp.fontStyle;
              charEl.style.textTransform = tp.textTransform;
            }
          }
        }, startTime);

        // Color tween (GSAP can interpolate CSS colors natively)
        tl.to(charEl, {
          color:    tp.color,
          duration: CHAR_DURATION,
          ease:     'power2.inOut',
        }, startTime);

      })(i);
    }

    // Time at which the last char launches
    var lastLaunchTime = (count - 1) * CHAR_STAGGER;

    return {
      timeline: tl,
      lastLaunchTime: lastLaunchTime,
      destroy: function () {
        charEls.forEach(function(el) { el.remove(); });
      },
      charEls: charEls
    };
  }

  /* ── Public API ── */
  return { fly: fly };

})();
