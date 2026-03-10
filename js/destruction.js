/* ==========================================================
   Text Destruction System
   Shatters text on projectile collision, reforms after delay.
   Requires: GSAP core, SplitText, Physics2DPlugin
   ========================================================== */

gsap.registerPlugin(SplitText, Physics2DPlugin);

// --- Tuneable Constants ---
var BLAST_RADIUS = 40;
var MAX_SHATTERED = 300;
var SCATTER_DURATION = 1.2;
var REFORM_PAUSE       = 0.8;
var CHAR_LAND_DURATION = 0.12;
var CHAR_STAGGER       = 0.055;
var WORD_EXTRA_STAGGER = 0.05;
var DROP_DISTANCE      = 16;
var GRAVITY = 600;
var MIN_VELOCITY = 150;
var MAX_VELOCITY = 500;
var ANGLE_SPREAD = 60;
var MAX_ROTATION = 720;

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

function rebuildCharCache() {
  charRectCache = [];
  var viewH = window.innerHeight;
  var viewW = window.innerWidth;

  for (var i = 0; i < allChars.length; i++) {
    var el = allChars[i];
    if (el.dataset.shattered === '1') continue;

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
}

function getCharsInBlastRadius(screenX, screenY) {
  if (cacheStale) rebuildCharCache();

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
      charRectCache.splice(i, 1);
    }
  }
  return hits;
}

window.addEventListener('scroll', function() { cacheStale = true; }, { passive: true });
window.addEventListener('resize', function() { cacheStale = true; });

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

  hits.forEach(function(hit) {
    if (currentShattered >= MAX_SHATTERED) return;

    var el = hit.el;
    el.dataset.shattered = '1';
    currentShattered++;
    el.style.display = 'inline-block';
    blastChars.push(el);

    // Scatter angle: away from impact point
    var angle = Math.atan2(hit.dy, hit.dx) * (180 / Math.PI);
    angle += (Math.random() - 0.5) * ANGLE_SPREAD;

    // Velocity inversely proportional to distance
    var velocityFactor = 1 - (hit.dist / BLAST_RADIUS);
    var velocity = MIN_VELOCITY + (MAX_VELOCITY - MIN_VELOCITY) * velocityFactor;

    var rotationVelocity = (Math.random() - 0.5) * MAX_ROTATION;

    // Store original color for reform
    var originalColor = el.style.color || '';
    el.dataset.originalColor = originalColor;

    // Color flash: briefly tint to accent
    gsap.fromTo(el, { color: accentColor }, {
      duration: 0.15,
      color: originalColor || getComputedStyle(el).color,
      ease: 'power1.out'
    });

    // Scatter with physics
    gsap.to(el, {
      duration: SCATTER_DURATION,
      physics2D: {
        velocity: velocity,
        angle: angle,
        gravity: GRAVITY
      },
      rotation: rotationVelocity,
      opacity: 0,
      ease: 'none'
    });
  });

  if (blastChars.length > 0) {
    scheduleTypingReform(blastChars);
  }
}

function scheduleTypingReform(chars) {
  // Sort by DOM reading order: top-to-bottom, left-to-right (5px line tolerance)
  var charRects = chars.map(function(el) {
    var rect = el.getBoundingClientRect();
    return { el: el, top: rect.top, left: rect.left };
  });

  charRects.sort(function(a, b) {
    var lineDiff = a.top - b.top;
    if (Math.abs(lineDiff) > 5) return lineDiff;
    return a.left - b.left;
  });

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

  for (var j = 0; j < charRects.length; j++) {
    (function(el, delay) {
      // Pre-position: kill scatter tween, set drop start pose
      gsap.delayedCall(startDelay - 0.01, function() {
        gsap.killTweensOf(el);
        el.style.display = 'inline-block';
        gsap.set(el, { x: 0, y: -DROP_DISTANCE, rotation: 0, opacity: 0 });
      });

      // Drop-in animation
      gsap.delayedCall(startDelay + delay, function() {
        gsap.to(el, {
          duration: CHAR_LAND_DURATION,
          y: 0,
          ease: 'power2.out'
        });
        gsap.to(el, {
          duration: CHAR_LAND_DURATION * 0.4,
          opacity: 1,
          ease: 'none',
          onComplete: function() {
            el.dataset.shattered = '0';
            el.style.color = el.dataset.originalColor || '';
            el.style.display = '';
            currentShattered--;
            cacheStale = true;
          }
        });
      });
    })(charRects[j].el, delays[j]);
  }
}

// --- Resize debounce for re-split ---
var resizeTimer = null;
function onResizeDebounced() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function() {
    if (splitInstances.length > 0) {
      splitAllText();
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
      shatterChars(hits, screenX, screenY);
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
  }
};

// --- Auto-run preload on script load ---
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(preloadSplit);
} else {
  setTimeout(preloadSplit, 100);
}
