/* ==========================================================
   Text Destruction System
   Shatters text on projectile collision, reforms after delay.
   Requires: GSAP core, SplitText, Physics2DPlugin
   ========================================================== */

gsap.registerPlugin(SplitText, Physics2DPlugin);

// --- Tuneable Constants ---
var BLAST_RADIUS       = 40;
var MAX_SHATTERED      = 300;
var SCATTER_DURATION   = 1.2;
var SCATTER_MS         = SCATTER_DURATION * 1000;
var REFORM_PAUSE       = 0.8;
var CHAR_LAND_DURATION = 0.12;
var CHAR_STAGGER       = 0.055;
var WORD_EXTRA_STAGGER = 0.05;
var DROP_DISTANCE      = 16;
var GRAVITY            = 600;
var MIN_VELOCITY       = 150;
var MAX_VELOCITY       = 500;
var ANGLE_SPREAD       = 60;
var MAX_ROTATION       = 720;

// --- Animation pressure monitor ---
// WAAPI runs on the compositor, so the limit is generous.
var activeBatchCount = 0;
var MAX_ACTIVE_BATCHES = 20;
var pendingReformTimeouts = [];

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
  'footer span',
  // Brutalist layout elements
  '.field-value', '.field-label',
  '.about-header', '.skills-mono',
  '.data-row-value', '.data-row-label',
  // Retro panel elements
  '.hero-panel .tidbit-value', '.hero-panel .tidbit-label'
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
    if (el.closest('.theme-switcher, .plane-toggle, .btn, .work-expand')) return;
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

function revertElement(el) {
  for (var i = splitInstances.length - 1; i >= 0; i--) {
    if (splitInstances[i].elements && splitInstances[i].elements[0] === el) {
      splitInstances[i].revert();
      splitInstances.splice(i, 1);
      allChars = [];
      splitInstances.forEach(function(inst) {
        allChars = allChars.concat(inst.chars);
      });
      return true;
    }
  }
  return false;
}

function preloadSplit() {
  splitAllText();
  isSplit = true;
}

// --- CollisionDetector ---
var charRectCache = [];
var cacheStale = true;
var cacheRebuilding = false;

// Spatial grid for O(1) hit detection (Phase 2)
var GRID_CELL_SIZE = BLAST_RADIUS * 2; // 80px cells
var spatialGrid = {};                   // key: "col,row" -> array of cache entries

function scheduleEagerCacheWarm() {
  // Defer rebuild while scatter batches are in-flight to avoid layout thrashing
  if (!cacheRebuilding && activeBatchCount === 0) {
    cacheRebuilding = true;
    requestAnimationFrame(function() { rebuildCharCache(); });
  }
}

function rebuildCharCache() {
  cacheRebuilding = false;
  var viewH = window.innerHeight;
  var viewW = window.innerWidth;
  var scrollY = window.scrollY;

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

  var newCache = [];
  for (var i = 0; i < allChars.length; i++) {
    var el = allChars[i];
    if (el.dataset.shattered === '1') continue;
    if (!visibleParents.has(el.parentElement)) continue;

    var rect = el.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > viewH) continue;
    if (rect.right < 0 || rect.left > viewW) continue;

    newCache.push({
      el: el,
      docX: rect.left + rect.width / 2,
      docY: rect.top + rect.height / 2 + scrollY
    });
  }
  charRectCache = newCache;
  cacheStale = false;

  // Build spatial grid for fast hit detection
  spatialGrid = {};
  for (var g = 0; g < newCache.length; g++) {
    var col = Math.floor(newCache[g].docX / GRID_CELL_SIZE);
    var row = Math.floor(newCache[g].docY / GRID_CELL_SIZE);
    var key = col + ',' + row;
    if (!spatialGrid[key]) spatialGrid[key] = [];
    spatialGrid[key].push(newCache[g]);
  }
}

function getCharsInBlastRadius(screenX, screenY) {
  if (cacheStale && activeBatchCount === 0) {
    rebuildCharCache();
  }

  // Convert screen coords to document-relative
  var docX = screenX;
  var docY = screenY + window.scrollY;

  var hits = [];
  var rSq = BLAST_RADIUS * BLAST_RADIUS;
  var col = Math.floor(docX / GRID_CELL_SIZE);
  var row = Math.floor(docY / GRID_CELL_SIZE);

  // Check 3x3 grid neighborhood
  for (var dr = -1; dr <= 1; dr++) {
    for (var dc = -1; dc <= 1; dc++) {
      var key = (col + dc) + ',' + (row + dr);
      var cell = spatialGrid[key];
      if (!cell) continue;
      for (var i = cell.length - 1; i >= 0; i--) {
        var c = cell[i];
        var dx = c.docX - docX;
        var dy = c.docY - docY;
        if (dx * dx + dy * dy <= rSq) {
          hits.push({
            el: c.el,
            dx: dx,
            dy: dy,
            dist: Math.sqrt(dx * dx + dy * dy)
          });
          cell.splice(i, 1);
        }
      }
    }
  }
  return hits;
}

window.addEventListener('resize', function() { cacheStale = true; scheduleEagerCacheWarm(); });

// --- Animation helpers (Web Animations API) ---
// WAAPI runs on the compositor thread — zero per-frame JS cost.
// Scatter trajectories are pre-computed from the same physics equations
// that Physics2DPlugin solves per-frame, but sampled into keyframes.

function cancelElementAnimations(el) {
  var anims = el.getAnimations();
  for (var a = 0; a < anims.length; a++) {
    anims[a].cancel();
  }
}

// Pre-compute parabolic scatter keyframes from physics equations.
// Physics2D: x(t) = v*cos(a)*t, y(t) = -v*sin(a)*t + 0.5*g*t²
// Sampled at t=0, T/3, 2T/3, T with linear interpolation between keyframes.
function makeScatterKeyframes(angle, velocity, rotation) {
  var rad = angle * Math.PI / 180;
  var vx = velocity * Math.cos(rad);
  var vy = -velocity * Math.sin(rad);
  var halfG = 0.5 * GRAVITY;
  var T = SCATTER_DURATION;
  var t1 = T / 3, t2 = T * 2 / 3;

  var x1 = vx * t1, y1 = vy * t1 + halfG * t1 * t1;
  var x2 = vx * t2, y2 = vy * t2 + halfG * t2 * t2;
  var xE = vx * T,  yE = vy * T  + halfG * T  * T;
  var r1 = (rotation / 3) | 0, r2 = (rotation * 2 / 3) | 0, rE = rotation | 0;

  return [
    { offset: 0,     transform: 'translate(0px,0px) rotate(0deg)',                                      opacity: 1   },
    { offset: 0.333, transform: 'translate(' + (x1|0) + 'px,' + (y1|0) + 'px) rotate(' + r1 + 'deg)',  opacity: 0.7 },
    { offset: 0.667, transform: 'translate(' + (x2|0) + 'px,' + (y2|0) + 'px) rotate(' + r2 + 'deg)',  opacity: 0.3 },
    { offset: 1,     transform: 'translate(' + (xE|0) + 'px,' + (yE|0) + 'px) rotate(' + rE + 'deg)',  opacity: 0   }
  ];
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
    activeBatchCount++;

    // Promote to compositor layer for GPU-accelerated animation
    for (var w = 0; w < blastChars.length; w++) {
      blastChars[w].style.willChange = 'transform, opacity';
    }

    // Color flash via WAAPI (compositor-driven, no JS per-frame cost)
    for (var cf = 0; cf < blastChars.length; cf++) {
      blastChars[cf].animate(
        [{ color: accentColor }, { color: origColors[cf] }],
        { duration: 150, easing: 'ease-out' }
      );
    }

    // Scatter via WAAPI with pre-computed physics keyframes
    var lastScatterAnim = null;
    for (var s = 0; s < blastChars.length; s++) {
      lastScatterAnim = blastChars[s].animate(
        makeScatterKeyframes(angles[s], velocities[s], rotations[s]),
        { duration: SCATTER_MS, easing: 'linear', fill: 'forwards' }
      );
    }

    // Decrement batch count when scatter finishes (promise-based, no setTimeout)
    lastScatterAnim.finished.then(function() {
      activeBatchCount--;
      if (activeBatchCount === 0 && cacheStale) scheduleEagerCacheWarm();
    }).catch(function() {
      // Cancelled by destroy/theme change — activeBatchCount reset by those methods
    });

    scheduleTypingReform(blastChars);
  }
}

function scheduleTypingReform(chars) {
  // Sort by DOM reading order (no layout forced)
  chars.sort(function(a, b) {
    var pos = a.compareDocumentPosition(b);
    return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
  });

  // Compute sequential delays with extra pause at word boundaries
  var delays = [];
  var cumulative = 0;
  for (var i = 0; i < chars.length; i++) {
    if (i > 0) {
      cumulative += CHAR_STAGGER;
      // Detect word boundary by parent element change
      if (chars[i].parentElement !== chars[i - 1].parentElement) {
        cumulative += WORD_EXTRA_STAGGER;
      }
    }
    delays.push(cumulative);
  }

  var startDelay = SCATTER_DURATION + REFORM_PAUSE;
  var els = chars;

  var reformTimeoutId = setTimeout(function() {
    // Remove from pending list
    var tidx = pendingReformTimeouts.indexOf(reformTimeoutId);
    if (tidx !== -1) pendingReformTimeouts.splice(tidx, 1);

    // Cancel scatter animations; set inline styles to final reformed state.
    // Reform animations use fill:'backwards' to show the first keyframe during
    // their stagger delay. After finishing, animations auto-expire and the
    // inline styles (cleared = CSS default) become the visible state.
    for (var k = 0; k < els.length; k++) {
      cancelElementAnimations(els[k]);
      els[k].style.transform = '';
      els[k].style.opacity = '';
    }

    // Reform via WAAPI: combined transform + opacity with staggered delays.
    // fill:'backwards' applies first keyframe during delay (char stays hidden
    // until its turn). After finishing, no fill — inline styles take over.
    var lastReformAnim = null;
    for (var r = 0; r < els.length; r++) {
      lastReformAnim = els[r].animate(
        [
          { transform: 'translateY(-' + DROP_DISTANCE + 'px)', opacity: 0 },
          { transform: 'translateY(0px)', opacity: 1 }
        ],
        {
          duration: CHAR_LAND_DURATION * 1000,
          delay: delays[r] * 1000,
          easing: 'ease-out',
          fill: 'backwards'
        }
      );
    }

    // Cleanup after last char finishes reforming
    if (lastReformAnim) {
      lastReformAnim.finished.then(function() {
        reformCleanup(els);
      }).catch(function() {
        // Cancelled by destroy/theme change — cleanup handled there
      });
    }
  }, startDelay * 1000);

  pendingReformTimeouts.push(reformTimeoutId);
}

function reformCleanup(els) {
  // Chunk cleanup across frames to avoid DOM write storms.
  // Reform animations use fill:'backwards' so they auto-expire — no need
  // to call cancelElementAnimations here (saves getAnimations() overhead).
  // Inline transform/opacity were cleared before reform started.
  var CHUNK = 40;
  var idx = 0;
  var cleaned = 0;
  function cleanChunk() {
    var end = Math.min(idx + CHUNK, els.length);
    for (var m = idx; m < end; m++) {
      if (els[m].dataset.shattered !== '1') continue; // already cleaned by destroy
      els[m].dataset.shattered = '0';
      els[m].style.color = els[m].dataset.originalColor || '';
      els[m].style.display = '';
      els[m].style.willChange = '';
      cleaned++;
    }
    idx = end;
    if (idx < els.length) {
      requestAnimationFrame(cleanChunk);
    } else {
      currentShattered = Math.max(0, currentShattered - cleaned);
      cacheStale = true;
      scheduleEagerCacheWarm();
    }
  }
  cleanChunk();
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

function cancelAllAnimations() {
  pendingReformTimeouts.forEach(clearTimeout);
  pendingReformTimeouts = [];
  allChars.forEach(cancelElementAnimations);
}

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
    cancelAllAnimations();
    allChars.forEach(function(el) {
      if (el.dataset.shattered === '1') {
        el.style.transform = '';
        el.style.opacity = '';
        el.style.willChange = '';
        el.style.display = '';
        el.dataset.shattered = '0';
      }
    });
    currentShattered = 0;
    activeBatchCount = 0;
    charRectCache = [];
    spatialGrid = {};
    // Do NOT revert split or remove resize listener — spans persist
  },

  onProjectileAt: function(screenX, screenY) {
    if (!isArmed) return;
    if (activeBatchCount >= MAX_ACTIVE_BATCHES) return; // pressure relief
    var hits = getCharsInBlastRadius(screenX, screenY);
    if (hits.length > 0) {
      shatterChars(hits, screenX, screenY);
    }
  },

  onThemeChange: function() {
    var wasArmed = isArmed;
    cancelAllAnimations();
    currentShattered = 0;
    activeBatchCount = 0;
    charRectCache = [];
    spatialGrid = {};
    revertAllText();
    isSplit = false;
    splitAllText();
    isSplit = true;
    readAccentColor();
    isArmed = wasArmed;
    cacheStale = true;
    scheduleEagerCacheWarm();
  },

  revertElement: revertElement
};

// --- Auto-run preload on script load ---
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(preloadSplit);
} else {
  setTimeout(preloadSplit, 100);
}
