/* ==========================================================
   Text Destruction System
   Shatters text on projectile collision, reforms after delay.
   Requires: GSAP core, SplitText, Physics2DPlugin
   ========================================================== */

gsap.registerPlugin(SplitText, Physics2DPlugin);

// --- Mobile detection ---
var _isMob = window.innerWidth <= 768 ||
  ('ontouchstart' in window && window.matchMedia('(pointer: coarse)').matches);

// --- Tuneable Constants (mobile-gated where noted) ---
var BLAST_RADIUS       = 40;
var MAX_SHATTERED      = _isMob ? 150 : 300;       // halve on mobile — caps concurrent physics2D tweens
var SCATTER_DURATION   = 1.2;
var REFORM_PAUSE       = _isMob ? 1.0 : 0.8;       // longer pause on mobile — less scatter/reform overlap
var CHAR_LAND_DURATION = 0.12;
var CHAR_STAGGER       = _isMob ? 0.035 : 0.055;   // faster stagger on mobile — shorter reform window
var WORD_EXTRA_STAGGER = _isMob ? 0.03 : 0.05;     // proportional reduction
var DROP_DISTANCE      = 16;
var GRAVITY            = 600;
var MIN_VELOCITY       = 150;
var MAX_VELOCITY       = _isMob ? 350 : 500;        // less velocity on mobile — simpler physics
var ANGLE_SPREAD       = 60;
var MAX_ROTATION       = _isMob ? 360 : 720;        // halve rotation on mobile — fewer transform recalcs

var DESTRUCTIBLE_SELECTOR = [
  'h1', 'h2', 'h3', 'h4',
  '.hero-desc', '.hero-badge',
  '.tidbit-value', '.tidbit-label',
  '.section-label', '.section-heading',
  '.work-card-info h3', '.work-card-info p',
  '.work-pill',
  '.about-prose p', '.about-box-title', '.about-box-text',
  '.chip',
  '.contact-heading', '.contact-sub',
  '.project-hero-title', '.project-hero-desc',
  '.project-text p', '.project-text h4',
  '.work-stat-num', '.work-stat-label',
  'footer span'
].join(', ');

// --- TextSplitter ---
var splitInstances = [];
var allChars = [];
var isSplit = false;
var isArmed = false;

function splitAllText() {
  revertAllText();

  var elements = document.querySelectorAll(DESTRUCTIBLE_SELECTOR);
  elements.forEach(function(el) {
    if (el.closest('nav, .theme-switcher, .plane-toggle, .btn, .work-expand')) return;
    if (el.offsetParent === null) return;

    var instance = SplitText.create(el, {
      type: 'words, chars',
      tag: 'span',
      charsClass: 'destruct-char',
      wordsClass: 'destruct-word'
    });

    splitInstances.push(instance);

    // Cache computed color on parent so shatterChars() avoids per-char getComputedStyle
    var parentColor = getComputedStyle(el).color;
    instance.chars.forEach(function(ch) {
      ch.dataset.computedColor = parentColor;
    });

    allChars = allChars.concat(instance.chars);
  });
}

function revertAllText() {
  splitInstances.forEach(function(inst) {
    inst.revert();
  });
  splitInstances = [];
  allChars = [];
}

function preloadSplit() {
  if (window.innerWidth <= 768) return;  // same gate as plane.js MIN_VIEWPORT
  splitAllText();
  isSplit = true;
}

// --- CollisionDetector ---
var charRectCache = [];
var cacheStale = true;
var cacheRebuilding = false;
var scrollStale = false;
var lastCacheScrollY = 0;

function scheduleEagerCacheWarm() {
  if (!cacheRebuilding) {
    cacheRebuilding = true;
    requestAnimationFrame(rebuildCharCache);
  }
}

function rebuildCharCache() {
  cacheRebuilding = false;
  charRectCache = [];
  var viewH = window.innerHeight;
  var viewW = window.innerWidth;

  // Pre-filter: check parent visibility to skip entire off-screen text blocks
  var visibleParents = new Set();
  var checkedParents = new Map();
  for (var p = 0; p < allChars.length; p++) {
    var parent = allChars[p].parentElement;
    if (checkedParents.has(parent)) continue;
    var pRect = parent.getBoundingClientRect();
    var visible = pRect.bottom >= 0 && pRect.top <= viewH && pRect.right >= 0 && pRect.left <= viewW;
    checkedParents.set(parent, visible);
    if (visible) visibleParents.add(parent);
  }

  for (var i = 0; i < allChars.length; i++) {
    var el = allChars[i];
    if (el.dataset.shattered === '1') continue;
    if (!visibleParents.has(el.parentElement)) continue;

    var rect = el.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > viewH) continue;
    if (rect.right < 0 || rect.left > viewW) continue;

    charRectCache.push({
      el: el,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2
    });
  }
  cacheStale = false;
  scrollStale = false;
  lastCacheScrollY = window.scrollY;
}

function getCharsInBlastRadius(screenX, screenY) {
  if (cacheStale) {
    rebuildCharCache();
  } else if (scrollStale) {
    var scrollDelta = window.scrollY - lastCacheScrollY;
    for (var j = 0; j < charRectCache.length; j++) {
      charRectCache[j].cy -= scrollDelta;
    }
    lastCacheScrollY = window.scrollY;
    scrollStale = false;
  }

  var hits = [];
  var rSq = BLAST_RADIUS * BLAST_RADIUS;

  for (var i = charRectCache.length - 1; i >= 0; i--) {
    var c = charRectCache[i];
    var dx = c.cx - screenX;
    var dy = c.cy - screenY;
    if (dx * dx + dy * dy <= rSq) {
      hits.push({
        el: c.el,
        dx: dx,
        dy: dy,
        dist: Math.sqrt(dx * dx + dy * dy)
      });
      charRectCache[i] = charRectCache[charRectCache.length - 1];
      charRectCache.pop();
    }
  }
  return hits;
}

window.addEventListener('scroll', function() { scrollStale = true; }, { passive: true });
window.addEventListener('resize', function() { cacheStale = true; scheduleEagerCacheWarm(); });

// --- Impact coalescing (mobile-only) ---
var pendingHits = [];
var coalescePending = false;

function flushPendingHits() {
  coalescePending = false;
  if (pendingHits.length === 0) return;
  var batch = pendingHits;
  pendingHits = [];
  shatterChars(batch, 0, 0);
}

// --- ShatterAnimator ---
var currentShattered = 0;
var accentColor = '';

function readAccentColor() {
  accentColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent').trim();
}

function shatterChars(hits, impactScreenX, impactScreenY) {
  if (!accentColor) readAccentColor();

  var blastChars = [];

  var angles = [];
  var velocities = [];
  var rotations = [];
  var origColors = [];

  hits.forEach(function(hit) {
    if (currentShattered >= MAX_SHATTERED) return;

    var el = hit.el;
    el.dataset.shattered = '1';
    currentShattered++;
    blastChars.push(el);

    // Scatter angle: away from impact point
    var angle = Math.atan2(hit.dy, hit.dx) * (180 / Math.PI);
    angle += (Math.random() - 0.5) * ANGLE_SPREAD;
    angles.push(angle);

    // Velocity inversely proportional to distance
    var velocityFactor = 1 - (hit.dist / BLAST_RADIUS);
    velocities.push(MIN_VELOCITY + (MAX_VELOCITY - MIN_VELOCITY) * velocityFactor);

    rotations.push((Math.random() - 0.5) * MAX_ROTATION);

    // Store original color for reform
    var originalColor = el.style.color || '';
    el.dataset.originalColor = originalColor;
    origColors.push(originalColor || el.dataset.computedColor || getComputedStyle(el).color);
  });

  if (blastChars.length > 0) {
    // Batch color flash (1 tween instead of N) — skip on mobile to reduce tween count
    if (!_isMob) {
      gsap.fromTo(blastChars, { color: accentColor }, {
        duration: 0.15,
        color: function(i) { return origColors[i]; },
        ease: 'power1.out'
      });
    }

    // Batch scatter with physics (1 tween instead of N)
    var scatterProps = {
      duration: SCATTER_DURATION,
      physics2D: {
        velocity: function(i) { return velocities[i]; },
        angle: function(i) { return angles[i]; },
        gravity: GRAVITY
      },
      opacity: 0,
      ease: 'none'
    };
    // Skip rotation on mobile — fewer transform recalcs per frame
    if (!_isMob) {
      scatterProps.rotation = function(i) { return rotations[i]; };
    }
    gsap.to(blastChars, scatterProps);

    scheduleTypingReform(blastChars);
  }
}

function scheduleTypingReform(chars) {
  // Sort by DOM reading order (no layout forced)
  chars.sort(function(a, b) {
    var pos = a.compareDocumentPosition(b);
    return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
  });
  var charRects = chars.map(function(el) { return { el: el }; });

  // Compute sequential delays with extra pause at word boundaries
  var delays = [];
  var cumulative = 0;
  for (var i = 0; i < charRects.length; i++) {
    if (i > 0) {
      cumulative += CHAR_STAGGER;
      // Detect word boundary by parent element change
      if (charRects[i].el.parentElement !== charRects[i - 1].el.parentElement) {
        cumulative += WORD_EXTRA_STAGGER;
      }
    }
    delays.push(cumulative);
  }

  var startDelay = SCATTER_DURATION + REFORM_PAUSE;
  var els = charRects.map(function(c) { return c.el; });

  // Pre-position all chars just before reform starts (1 delayedCall instead of N)
  gsap.delayedCall(startDelay - 0.01, function() {
    for (var k = 0; k < els.length; k++) {
      gsap.killTweensOf(els[k]);
    }
    // Single batched set (1 call instead of N)
    gsap.set(els, { x: 0, y: -DROP_DISTANCE, rotation: 0, opacity: 0 });

    function reformComplete() {
      if (_isMob) {
        // Chunk cleanup across frames to avoid synchronous DOM write storm
        var CHUNK = 40;
        var idx = 0;
        function cleanChunk() {
          var end = Math.min(idx + CHUNK, els.length);
          for (var m = idx; m < end; m++) {
            els[m].dataset.shattered = '0';
            els[m].style.color = els[m].dataset.originalColor || '';
            els[m].style.display = '';
          }
          idx = end;
          if (idx < els.length) {
            requestAnimationFrame(cleanChunk);
          } else {
            currentShattered -= els.length;
            cacheStale = true;
            scheduleEagerCacheWarm();
          }
        }
        cleanChunk();
      } else {
        for (var m = 0; m < els.length; m++) {
          els[m].dataset.shattered = '0';
          els[m].style.color = els[m].dataset.originalColor || '';
          els[m].style.display = '';
        }
        currentShattered -= els.length;
        cacheStale = true;
        scheduleEagerCacheWarm();
      }
    }

    if (_isMob) {
      // Single merged tween on mobile (1 tween instead of 2)
      gsap.to(els, {
        duration: CHAR_LAND_DURATION,
        y: 0,
        opacity: 1,
        ease: 'power2.out',
        stagger: function(i) { return delays[i]; },
        onComplete: reformComplete
      });
    } else {
      // Desktop: separate tweens for y (power2.out) and opacity (linear) for better visual
      gsap.to(els, {
        duration: CHAR_LAND_DURATION,
        y: 0,
        ease: 'power2.out',
        stagger: function(i) { return delays[i]; }
      });
      gsap.to(els, {
        duration: CHAR_LAND_DURATION * 0.4,
        opacity: 1,
        ease: 'none',
        stagger: function(i) { return delays[i]; },
        onComplete: reformComplete
      });
    }
  });
}

// --- Resize debounce for re-split ---
var resizeTimer = null;
function onResizeDebounced() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function() {
    if (splitInstances.length > 0) {
      splitAllText();
      cacheStale = true;
      scheduleEagerCacheWarm();
    }
  }, 300);
}

// --- Lifecycle Manager ---
var resizeListenerActive = false;

window.TextDestruction = {
  init: function() {
    readAccentColor();
    if (!isSplit) {
      splitAllText();
      isSplit = true;
    }
    isArmed = true;
    cacheStale = true;
    scheduleEagerCacheWarm();
    if (!resizeListenerActive) {
      window.addEventListener('resize', onResizeDebounced);
      resizeListenerActive = true;
    }
  },

  destroy: function() {
    isArmed = false;
    allChars.forEach(function(el) {
      gsap.killTweensOf(el);
      if (el.dataset.shattered === '1') {
        gsap.set(el, { x: 0, y: 0, rotation: 0, opacity: 1 });
        el.style.display = '';
        el.dataset.shattered = '0';
      }
    });
    currentShattered = 0;
    charRectCache = [];
    // Do NOT revert split or remove resize listener — spans persist
  },

  onProjectileAt: function(screenX, screenY) {
    if (!isArmed) return;
    var hits = getCharsInBlastRadius(screenX, screenY);
    if (hits.length > 0) {
      if (_isMob) {
        // Coalesce same-frame hits into one batched shatterChars call
        pendingHits = pendingHits.concat(hits);
        if (!coalescePending) {
          coalescePending = true;
          requestAnimationFrame(flushPendingHits);
        }
      } else {
        shatterChars(hits, screenX, screenY);
      }
    }
  },

  onThemeChange: function() {
    var wasArmed = isArmed;
    allChars.forEach(function(el) {
      gsap.killTweensOf(el);
    });
    currentShattered = 0;
    charRectCache = [];
    revertAllText();
    isSplit = false;
    splitAllText();
    isSplit = true;
    readAccentColor();
    isArmed = wasArmed;
    cacheStale = true;
    scheduleEagerCacheWarm();
  }
};

// --- Auto-run preload on script load ---
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(preloadSplit);
} else {
  setTimeout(preloadSplit, 100);
}
