/* ═══════════════════════════════════════════════════════════════
   TEXT REARRANGE — character-level layout transition animation
   Splits title text into individual chars, measures positions in
   both source (card) and target (page h1) layouts, then animates
   each character sequentially along alternating bezier arcs from
   its source position to its target position.
   Handles arbitrary line-break mismatches gracefully.

   Requires: GSAP core, SplitText (both already loaded).
   ═══════════════════════════════════════════════════════════════ */

var TextRearrange = (function () {

  /* ── Tuning constants ── */
  var CHAR_STAGGER  = 0.17;   // seconds between each character launch
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

  /* ── Measure character positions for text at a given style/width ── */
  function measureLayout(text, styles, contentWidth) {
    var el = document.createElement('div');
    el.textContent = text;
    el.style.position   = 'fixed';
    el.style.left       = '-9999px';
    el.style.top        = '-9999px';
    el.style.visibility = 'hidden';
    el.style.width      = contentWidth + 'px';
    el.style.margin     = '0';
    el.style.padding    = '0';
    el.style.fontFamily     = styles.fontFamily;
    el.style.fontSize       = styles.fontSize + 'px';
    el.style.fontWeight     = styles.fontWeight;
    el.style.fontStyle      = styles.fontStyle;
    el.style.lineHeight     = styles.lineHeight + 'px';
    el.style.letterSpacing  = styles.letterSpacing;
    el.style.textTransform  = styles.textTransform;
    el.style.whiteSpace     = 'normal';
    el.style.wordWrap       = 'break-word';

    document.body.appendChild(el);

    var split = SplitText.create(el, { type: 'chars', tag: 'span' });
    var origin = el.getBoundingClientRect();

    var positions = [];
    for (var i = 0; i < split.chars.length; i++) {
      var r = split.chars[i].getBoundingClientRect();
      positions.push({
        x: r.left - origin.left,
        y: r.top  - origin.top,
        w: r.width,
        h: r.height,
        ch: split.chars[i].textContent
      });
    }

    var totalH = origin.height;
    split.revert();
    el.remove();

    return { positions: positions, height: totalH };
  }

  /* ── Extract scaled style values from a (possibly transformed) source ── */
  function getScaledSourceStyles(sourceEl, titleRect) {
    var cs = getComputedStyle(sourceEl);
    var padL = parseFloat(cs.paddingLeft)  || 0;
    var padR = parseFloat(cs.paddingRight) || 0;
    var padT = parseFloat(cs.paddingTop)   || 0;
    var padB = parseFloat(cs.paddingBottom)|| 0;

    // Derive visual scale (card may be CSS-transformed)
    var naturalH = sourceEl.offsetHeight;
    var visualH  = titleRect.height;
    var scale    = naturalH > 0 ? visualH / naturalH : 1;

    var fontSize   = parseFloat(cs.fontSize) * scale;
    var lineHeight = parseFloat(cs.lineHeight) * scale;
    // If lineHeight came back NaN (e.g. "normal"), approximate
    if (isNaN(lineHeight)) lineHeight = fontSize * 1.2;

    return {
      fontSize:      fontSize,
      fontFamily:    cs.fontFamily,
      fontWeight:    cs.fontWeight,
      fontStyle:     cs.fontStyle,
      lineHeight:    lineHeight,
      letterSpacing: cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing,
      textTransform: cs.textTransform,
      color:         cs.color,
      contentLeft:   titleRect.left + padL * scale,
      contentTop:    titleRect.top  + padT * scale,
      contentWidth:  titleRect.width  - (padL + padR) * scale,
      contentHeight: titleRect.height - (padT + padB) * scale,
    };
  }

  /* ── Extract style values from the target element ── */
  function getTargetStyles(targetEl, targetRect) {
    var cs = getComputedStyle(targetEl);
    var padL = parseFloat(cs.paddingLeft)  || 0;
    var padR = parseFloat(cs.paddingRight) || 0;
    var padT = parseFloat(cs.paddingTop)   || 0;

    var lineHeight = parseFloat(cs.lineHeight);
    var fontSize   = parseFloat(cs.fontSize);
    if (isNaN(lineHeight)) lineHeight = fontSize * 1.2;

    return {
      fontSize:      fontSize,
      fontFamily:    cs.fontFamily,
      fontWeight:    cs.fontWeight,
      fontStyle:     cs.fontStyle,
      lineHeight:    lineHeight,
      letterSpacing: cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing,
      textTransform: cs.textTransform,
      color:         cs.color,
      contentLeft:   targetRect.left + padL,
      contentTop:    targetRect.top  + padT,
      contentWidth:  targetRect.width - padL - padR,
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     fly() — main entry point
     Replaces the simple bounding-box tween in page-transition.js.

     Returns { timeline, destroy, wrapper, charEls }
       timeline — GSAP timeline (already playing)
       destroy  — call to remove all char elements

     Parameters:
       sourceEl      — the card title DOM element (e.g. .card-title h3)
       titleRect     — sourceEl.getBoundingClientRect() (visual rect)
       targetEl      — the page title DOM element (e.g. .project-hero-title)
       targetRect    — targetEl.getBoundingClientRect()
       overlay       — container for flying chars (flyOverlay)
       duration      — ignored (total computed from char count); kept for API compat
       onStart       — optional callback when animation begins
     ═══════════════════════════════════════════════════════════════ */
  function fly(opts) {
    var sourceEl   = opts.sourceEl;
    var titleRect  = opts.titleRect;
    var targetEl   = opts.targetEl;
    var targetRect = opts.targetRect;
    var overlay    = opts.overlay;
    var onStart    = opts.onStart   || null;

    var text = sourceEl.textContent;

    // ── Gather styles ──
    var src = getScaledSourceStyles(sourceEl, titleRect);
    var tgt = getTargetStyles(targetEl, targetRect);

    // ── Measure both layouts ──
    var srcLayout = measureLayout(text, src, src.contentWidth);
    var tgtLayout = measureLayout(text, tgt, tgt.contentWidth);

    var count = Math.min(srcLayout.positions.length, tgtLayout.positions.length);
    if (count === 0) return null;

    // ── Total duration computed from char count ──
    var totalDuration = (count - 1) * CHAR_STAGGER + CHAR_DURATION;

    // ── Create flying character elements ──
    var wrapper = document.createElement('div');
    wrapper.className = 'text-rearrange-wrapper';
    wrapper.style.cssText = 'position:fixed;left:0;top:0;z-index:501;pointer-events:none;';
    overlay.appendChild(wrapper);

    var charEls = [];

    for (var i = 0; i < count; i++) {
      var sp   = srcLayout.positions[i];
      var span = document.createElement('span');
      span.textContent = sp.ch;
      span.style.cssText =
        'position:fixed;display:inline-block;white-space:pre;pointer-events:none;' +
        'will-change:transform;' +
        'left:0;top:0;' +
        'font-family:'    + src.fontFamily    + ';' +
        'font-size:'      + src.fontSize      + 'px;' +
        'font-weight:'    + src.fontWeight    + ';' +
        'font-style:'     + src.fontStyle     + ';' +
        'letter-spacing:' + src.letterSpacing + ';' +
        'text-transform:' + src.textTransform + ';' +
        'color:'          + src.color         + ';' +
        'line-height:1;' +
        'opacity:0;';

      wrapper.appendChild(span);
      charEls.push(span);

      // Position at source screen location via GSAP transform
      gsap.set(span, {
        x: src.contentLeft + sp.x,
        y: src.contentTop  + sp.y
      });
    }

    // ── Build animation timeline ──
    var tl = gsap.timeline();

    if (onStart) tl.call(onStart);

    // ── Animate each character sequentially along bezier arcs ──
    for (var i = 0; i < count; i++) {
      (function (idx) {
        var sp = srcLayout.positions[idx];
        var tp = tgtLayout.positions[idx];

        var sx = src.contentLeft + sp.x;
        var sy = src.contentTop  + sp.y;
        var tx = tgt.contentLeft + tp.x;
        var ty = tgt.contentTop  + tp.y;

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
          onStart: function () {
            // Make character visible when its flight begins
            charEl.style.opacity = '1';
          },
          onUpdate: function () {
            var t = proxy.t;

            // Position along bezier arc
            var pos = quadBezier(t, sx, sy, cpx, cpy, tx, ty);
            gsap.set(charEl, { x: pos.x, y: pos.y });

            // Interpolate font size
            var fs = src.fontSize + (tgt.fontSize - src.fontSize) * t;
            charEl.style.fontSize = fs + 'px';

            // Interpolate font weight (numeric)
            var srcW = parseFloat(src.fontWeight) || 400;
            var tgtW = parseFloat(tgt.fontWeight) || 400;
            charEl.style.fontWeight = Math.round(srcW + (tgtW - srcW) * t);

            // Interpolate letter spacing
            var srcLS = parseFloat(src.letterSpacing) || 0;
            var tgtLS = parseFloat(tgt.letterSpacing) || 0;
            charEl.style.letterSpacing = (srcLS + (tgtLS - srcLS) * t) + 'px';

            // Swap discrete (non-interpolatable) properties once
            if (!swapped && t >= DISCRETE_SWAP) {
              swapped = true;
              charEl.style.fontFamily    = tgt.fontFamily;
              charEl.style.fontStyle     = tgt.fontStyle;
              charEl.style.textTransform = tgt.textTransform;
            }
          }
        }, startTime);

        // Color tween (GSAP can interpolate CSS colors natively)
        tl.to(charEl, {
          color:    tgt.color,
          duration: CHAR_DURATION,
          ease:     'power2.inOut',
        }, startTime);

      })(i);
    }

    return {
      timeline: tl,
      destroy: function () { wrapper.remove(); },
      wrapper: wrapper,
      charEls: charEls
    };
  }

  /* ── Public API ── */
  return { fly: fly };

})();
