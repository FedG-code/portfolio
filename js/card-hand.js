/* ═══════════════════════════════════════════════
   CARD DATA
   ═══════════════════════════════════════════════ */
var CARDS = [
  {
    id: 0, accent: 'red',
    title: 'Casino Games',
    typeLeft: 'Logifuture', typeRight: 'Game Developer',
    icon: '\u2666',
    text: 'Developed casino game features across web and mobile platforms, shipping live products to players worldwide.',
    pageUrl: 'casino_games.html',
    artImage: 'assets/spin+.gif',
    artThumb: 'assets/spin+img.png',
  },
  {
    id: 1, accent: 'green',
    title: 'Eve of Destruction',
    typeLeft: 'Lost Satellite Studios', typeRight: 'Tech Designer',
    icon: '\u263E',
    text: 'Combat, enemies and movement for a narrative-driven metroidvania in Godot.',
    pageUrl: 'eve_of_destruction.html',
    artImage: 'assets/ult+bossfightgif.gif',
    artThumb: 'assets/ult+bossfightimg.png',
  },
  {
    id: 2, accent: 'purple',
    title: 'My Games',
    typeLeft: 'Coffin-Likker', typeRight: 'Solo Developer',
    icon: '\u2620',
    text: 'Stealth-horror project focused on visibility, AI behavior, and environmental tension. Set in the bayou.',
    pageUrl: 'my_games.html',
    artImage: 'assets/visionsystem.gif',
    artThumb: 'assets/visionsystemimg.png',
  },
  {
    id: 3, accent: 'gold',
    title: 'Home',
    typeLeft: 'Index', typeRight: 'Portfolio',
    icon: '\u2302',
    text: 'Return to the main page. Overview of all projects and contact information.',
    pageUrl: null,
    artImage: null,
  },
];

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */
var _isMobHand = window.innerWidth <= 768;

var HOLD_RADIUS     = _isMobHand ? 900  : 1400;
var FAN_SPREAD      = _isMobHand ? 14   : 20;
var OVERLAP_SPACING = _isMobHand ? 90   : 155;
var SINK_BELOW      = _isMobHand ? 130  : 190;
var HOVER_LIFT      = _isMobHand ? 35   : 50;
var CARD_W          = _isMobHand ? 132  : 220;
var CARD_H          = _isMobHand ? 192  : 320;
var HAND_W          = _isMobHand ? Math.min(window.innerWidth, 400) : 700;
var HAND_H          = _isMobHand ? 260  : 400;

var PLAY_ZONE_HALF_W    = _isMobHand ? Math.min(Math.round(window.innerWidth * 0.45), 385)  : 385;
var PLAY_ZONE_HALF_H    = _isMobHand ? Math.min(Math.round(window.innerHeight * 0.35), 289) : 289;
var MAX_BLUR            = 8;
var MAX_OVERLAY_OPACITY = 0.3;
var MAX_GLOW_SIZE       = 30;

// Attractor (drag-me hint) constants
var ATTRACTOR_LS_KEY    = 'portfolio-card-attractor-seen';
var ATTRACTOR_FIRST_MS  = 10000;
var ATTRACTOR_TOUCH_MS  = 3500;
var ATTRACTOR_BOUNCE_Y  = _isMobHand ? -22 : -40;
var ATTRACTOR_LABEL_OFFSET = _isMobHand ? 18 : 26;

/* ═══════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════ */
var activePageCardId = (function() {
  var page = location.pathname.split('/').pop() || 'index.html';
  for (var i = 0; i < CARDS.length; i++) {
    if (CARDS[i].pageUrl && page.indexOf(CARDS[i].pageUrl) !== -1) return CARDS[i].id;
  }
  return 3; // default to Home
})();
var cardOrder = CARDS.filter(function(c) { return c.id !== activePageCardId; }).map(function(c) { return c.id; });
var dragState = null;
var animState = 'IDLE'; // IDLE | DRAGGING | RETURNING | PLAYING | TRANSITIONING
var _activePointerId = null;   // track first pointer to ignore second touch
var _liftedCardId   = -1;     // card ID in tap-lifted state (-1 = none)

var attractorState = {
  firstLandTimer: null,
  postTouchTimer: null,
  active: false,
  disabled: false,
  cardId: -1,
  labelEl: null,
  tween: null,
  planeObserver: null,
};

var handContainer = document.getElementById('handContainer');
handContainer.style.transformStyle = 'preserve-3d';
var dragBlurOverlay = document.getElementById('dragBlurOverlay');
var perspectiveContainer = document.getElementById('perspectiveContainer');
var flyOverlay = document.getElementById('flyOverlay');

/* ═══════════════════════════════════════════════
   CARD HTML + BUILD
   ═══════════════════════════════════════════════ */
function createCardHTML(c) {
  if (c.id === 3) {
    return '<div class="card-inner card-inner--home">' +
      '<div class="card-art card-art--home"><div class="card-art-inner">' +
        '<h3 class="card-art-title">' +
          '<span class="serif-line"><em>Never</em> shipped a</span>' +
          '<span class="serif-line">boring product.</span>' +
        '</h3>' +
      '</div></div>' +
    '</div>';
  }

  var artContent = c.artImage
    ? '<img src="' + c.artThumb + '" class="card-art-img" alt="' + c.title + '" data-gif="' + c.artImage + '" data-thumb="' + c.artThumb + '">'
    : '<span class="card-art-icon">' + c.icon + '</span>';

  return '<div class="card-inner">' +
    '<div class="card-title"><h3>' + c.title + '</h3></div>' +
    '<div class="card-art"><div class="card-art-inner">' + artContent + '</div></div>' +
    '<div class="type-bar">' + c.typeLeft + ' \u00B7 ' + c.typeRight + '</div>' +
    '<div class="card-textbox"><p>' + c.text + '</p></div>' +
    '<div class="accent-strip"></div>' +
  '</div>';
}

function freezeGif(img) {
  if (img.dataset.thumb) img.src = img.dataset.thumb;
}

function buildCards() {
  handContainer.innerHTML = '';
  cardOrder.forEach(function(cardId) {
    var c = CARDS[cardId];
    var el = document.createElement('div');
    el.className = 'card';
    el.dataset.accent = c.accent;
    el.dataset.cardId = cardId;
    el.style.transformOrigin = 'center bottom';
    el.innerHTML = createCardHTML(c);
    handContainer.appendChild(el);
  });
}

/* ═══════════════════════════════════════════════
   FAN GEOMETRY
   ═══════════════════════════════════════════════ */
function fanX(slot, total) {
  return (slot - (total - 1) / 2) * OVERLAP_SPACING;
}
function fanAngle(slot, total) {
  var step = total > 1 ? FAN_SPREAD / (total - 1) : 0;
  return total > 1 ? -FAN_SPREAD / 2 + step * slot : 0;
}
function fanArcY(angle) {
  var rad = (angle * Math.PI) / 180;
  return HOLD_RADIUS - HOLD_RADIUS * Math.cos(rad);
}
function getRestPosition(slot, total) {
  var cx = fanX(slot, total);
  var angle = fanAngle(slot, total);
  var arcY = fanArcY(angle);
  return {
    px: HAND_W / 2 + cx - CARD_W / 2,
    py: HAND_H - CARD_H + SINK_BELOW + arcY,
    angle: angle,
  };
}

/* ═══════════════════════════════════════════════
   LAYOUT
   ═══════════════════════════════════════════════ */
function layoutCards() {
  var cardEls = handContainer.querySelectorAll('.card');
  var total = cardOrder.length;
  var dragCardId = dragState ? dragState.cardId : -1;
  var elMap = {};
  cardEls.forEach(function(el) { elMap[parseInt(el.dataset.cardId)] = el; });

  cardOrder.forEach(function(cardId, slot) {
    var el = elMap[cardId];
    if (!el || cardId === dragCardId) return;
    if (attractorState.active && cardId === attractorState.cardId) return;
    var isHovered = el.classList.contains('hover-active');
    var pos = getRestPosition(slot, total);
    var lift = isHovered ? -HOVER_LIFT : 0;
    el.style.transform = 'translate(' + pos.px + 'px, ' + (pos.py + lift) + 'px) rotate(' + pos.angle + 'deg)';
    el.style.transformOrigin = 'center bottom';
    el.style.zIndex = isHovered ? 20 : (slot + 2);
  });
}

/* ═══════════════════════════════════════════════
   SLOT DETECTION + PROXIMITY
   ═══════════════════════════════════════════════ */
function getSlotForX(mouseXInHand) {
  var total = cardOrder.length;
  var closest = 0, minDist = Infinity;
  for (var i = 0; i < total; i++) {
    var slotCenterX = HAND_W / 2 + fanX(i, total);
    var d = Math.abs(mouseXInHand - slotCenterX);
    if (d < minDist) { minDist = d; closest = i; }
  }
  return closest;
}

function getCardCenter(el) {
  var rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
function getViewportCenter() {
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}
function getMaxDistance() {
  var vc = getViewportCenter();
  var handBottom = window.innerHeight - 40;
  return Math.sqrt(vc.x * vc.x + (handBottom - vc.y) * (handBottom - vc.y)) * 0.8;
}
var PROXIMITY_DEAD_ZONE = 0.35; // blur stays at 0 until card is 35% of the way to center
function calcProximity(cardEl) {
  var cc = getCardCenter(cardEl);
  var vc = getViewportCenter();
  var dx = cc.x - vc.x;
  var dy = cc.y - vc.y;
  var dist = Math.sqrt(dx * dx + dy * dy);
  var raw = Math.max(0, Math.min(1, 1 - dist / getMaxDistance()));
  if (raw <= PROXIMITY_DEAD_ZONE) return 0;
  return (raw - PROXIMITY_DEAD_ZONE) / (1 - PROXIMITY_DEAD_ZONE);
}
function isInPlayZone(cardEl) {
  var cc = getCardCenter(cardEl);
  var vc = getViewportCenter();
  return Math.abs(cc.x - vc.x) <= PLAY_ZONE_HALF_W && Math.abs(cc.y - vc.y) <= PLAY_ZONE_HALF_H;
}

/* ═══════════════════════════════════════════════
   PROXIMITY FEEDBACK
   ═══════════════════════════════════════════════ */
function applyProximityFeedback(cardEl, proximity) {
  var cardData = CARDS[parseInt(cardEl.dataset.cardId)];
  var inner = cardEl.querySelector('.card-inner');
  var blurVal = proximity * MAX_BLUR;
  var overlayVal = proximity * MAX_OVERLAY_OPACITY;
  dragBlurOverlay.style.backdropFilter = 'blur(' + blurVal + 'px)';
  dragBlurOverlay.style.webkitBackdropFilter = 'blur(' + blurVal + 'px)';
  dragBlurOverlay.style.background = 'rgba(0,0,0,' + overlayVal + ')';
  var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  var accentRGB = hexToRGB(accent);
  var glowSize = proximity * MAX_GLOW_SIZE;
  inner.style.boxShadow = '0 0 ' + glowSize + 'px ' + accent;
  var opacity = 0.3 + 0.7 * proximity;
  inner.style.borderColor = 'rgba(' + accentRGB.r + ',' + accentRGB.g + ',' + accentRGB.b + ',' + opacity + ')';
}

function resetProximityFeedback(cardEl) {
  var inner = cardEl.querySelector('.card-inner');
  dragBlurOverlay.style.transition = 'backdrop-filter 0.3s, background 0.3s';
  dragBlurOverlay.style.backdropFilter = 'blur(0px)';
  dragBlurOverlay.style.webkitBackdropFilter = 'blur(0px)';
  dragBlurOverlay.style.background = 'rgba(0,0,0,0)';
  setTimeout(function() { dragBlurOverlay.style.transition = ''; }, 350);
  inner.style.transition = 'box-shadow 0.3s, border-color 0.3s';
  inner.style.boxShadow = '0 0 0px transparent';
  inner.style.borderColor = '';
  setTimeout(function() { inner.style.transition = ''; }, 350);
}

function hexToRGB(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/* ═══════════════════════════════════════════════
   TOUCH HELPERS
   ═══════════════════════════════════════════════ */
function isPlaneActive() {
  return document.documentElement.classList.contains('plane-active');
}

function findNearestCardInRange(clientX, clientY, maxDist) {
  var cards = handContainer.querySelectorAll('.card');
  if (!cards.length) return null;
  var best = null, bestDist = Infinity;
  cards.forEach(function(c) {
    var rect = c.getBoundingClientRect();
    var dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
    var dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestDist) { bestDist = d; best = c; }
  });
  return bestDist <= maxDist ? best : null;
}

function dismissLift() {
  if (_liftedCardId === -1) return;
  handContainer.querySelectorAll('.card').forEach(function(c) {
    c.classList.remove('hover-active');
  });
  _liftedCardId = -1;
  layoutCards();
}

function liftCard(cardEl, cardId) {
  handContainer.querySelectorAll('.card').forEach(function(c) {
    c.classList.remove('hover-active');
  });
  cardEl.classList.add('hover-active');
  _liftedCardId = cardId;
  layoutCards();
}

/* ═══════════════════════════════════════════════
   DRAG HANDLERS
   ═══════════════════════════════════════════════ */
function onPointerDown(e) {
  // Dismiss lifted card on outside touch
  if (_liftedCardId !== -1 && !e.target.closest('.hand-container')) {
    dismissLift();
    return;
  }

  if (animState !== 'IDLE') return;
  if (isPlaneActive()) return;
  if (_activePointerId !== null) return;

  var cardEl = e.target.closest('.card');
  var isTouchEvent = e.pointerType === 'touch';

  // Touch: find nearest card if not directly on one (whole hand area)
  if (!cardEl && isTouchEvent) {
    cardEl = findNearestCardInRange(e.clientX, e.clientY, 20);
  }

  if (!cardEl) return;
  e.preventDefault();

  // Attractor: card press counts as interaction. If the first-land timer is
  // still running, cancel it and arm the post-touch timer. If the attractor
  // is already visible, stop it so its tween doesn't fight the drag transform.
  onAttractorCardInteraction();
  if (attractorState.active) stopAttractor();

  // Store previous lift state then clear it
  var prevLift = _liftedCardId;
  dismissLift();

  _activePointerId = e.pointerId;
  cardEl.setPointerCapture(e.pointerId);

  // Lock scrolling during touch drag
  if (isTouchEvent) {
    document.documentElement.classList.add('card-dragging');
  }

  var cardId = parseInt(cardEl.dataset.cardId);
  var cardRect = cardEl.getBoundingClientRect();
  dragState = {
    cardId: cardId, el: cardEl,
    currentSlot: cardOrder.indexOf(cardId),
    grabX: e.clientX - cardRect.left,
    grabY: e.clientY - cardRect.top,
    startClientX: e.clientX,
    startClientY: e.clientY,
    hasMoved: false,
    isTouch: isTouchEvent,
    prevLiftedCardId: prevLift,
  };
  animState = 'DRAGGING';
  cardEl.classList.add('dragging');
  cardEl.classList.remove('hover-active');
  cardEl.style.zIndex = 100;
  cardEl.style.transition = 'none';
  cardEl.style.transformOrigin = 'center center';

  // Unfreeze GIF while dragging
  var img = cardEl.querySelector('.card-art-img');
  if (img && img.dataset.gif) { img.src = img.dataset.gif; }

  // Prefetch the page this card points to
  var cardData = CARDS[cardId];
  if (cardData.pageUrl && window.prefetchPage) {
    window.prefetchPage(cardData.pageUrl);
  }
}

function onPointerMove(e) {
  if (!dragState || animState !== 'DRAGGING') return;
  e.preventDefault();
  var dx = e.clientX - dragState.startClientX;
  var dy = e.clientY - dragState.startClientY;
  if (!dragState.hasMoved && Math.abs(dx) + Math.abs(dy) < 5) return;
  if (!dragState.hasMoved) disableAttractorPermanently();
  dragState.hasMoved = true;
  var handRect = handContainer.getBoundingClientRect();
  var cardLeftInHand = e.clientX - dragState.grabX - handRect.left;
  var cardTopInHand = e.clientY - dragState.grabY - handRect.top;
  var handCenterX = handRect.left + HAND_W / 2;
  var dragAngle = Math.max(-12, Math.min(12, (e.clientX - handCenterX) * 0.03));
  dragState.el.style.transform = 'translate(' + cardLeftInHand + 'px, ' + cardTopInHand + 'px) rotate(' + dragAngle + 'deg)';
  var proximity = calcProximity(dragState.el);
  applyProximityFeedback(dragState.el, proximity);
  var mouseInHandX = e.clientX - handRect.left;
  var newSlot = getSlotForX(mouseInHandX);
  if (newSlot !== dragState.currentSlot) {
    var idx = cardOrder.indexOf(dragState.cardId);
    cardOrder.splice(idx, 1);
    cardOrder.splice(newSlot, 0, dragState.cardId);
    dragState.currentSlot = newSlot;
    layoutCards();
  }
}

function onPointerUp(e) {
  if (!dragState || animState !== 'DRAGGING') return;
  var el = dragState.el;
  var cardId = dragState.cardId;
  var wasMoved = dragState.hasMoved;
  var isTouch = dragState.isTouch;
  var prevLiftedCardId = dragState.prevLiftedCardId;
  var img = el.querySelector('.card-art-img');

  _activePointerId = null;
  if (isTouch) {
    document.documentElement.classList.remove('card-dragging');
  }

  if (!wasMoved) {
    if (img && img.dataset.gif) { freezeGif(img); }

    // Desktop click, or mobile second-tap on already-lifted card → play
    var shouldPlay = !isTouch || prevLiftedCardId === cardId;
    if (shouldPlay) {
      disableAttractorPermanently();
      animState = 'PLAYING';
      el.classList.remove('dragging');
      el.classList.add('playing');
      dragState = null;
      playCard(el, cardId);
      return;
    }

    // Mobile first-tap → lift
    el.classList.remove('dragging');
    el.style.transition = '';
    el.style.transformOrigin = 'center bottom';
    el.style.zIndex = '';
    dragState = null;
    animState = 'IDLE';
    liftCard(el, cardId);
    return;
  }
  if (isInPlayZone(el)) {
    animState = 'PLAYING';
    el.classList.remove('dragging');
    el.classList.add('playing');
    dragState = null;
    playCard(el, cardId);
  } else {
    if (img && img.dataset.gif) { freezeGif(img); }
    animState = 'RETURNING';
    resetProximityFeedback(el);
    el.classList.remove('dragging');
    el.style.transition = '';
    el.style.transformOrigin = 'center bottom';
    el.style.zIndex = '';
    dragState = null;
    layoutCards();
    setTimeout(function() { animState = 'IDLE'; }, 350);
  }
}

/* ═══════════════════════════════════════════════
   HOVER HANDLERS
   ═══════════════════════════════════════════════ */
document.body.addEventListener('pointerover', function(e) {
  if (e.pointerType === 'touch') return;
  if (_liftedCardId !== -1) _liftedCardId = -1; // mouse hover overrides touch lift
  if (animState !== 'IDLE') return;
  var cardEl = e.target.closest('.card');
  handContainer.querySelectorAll('.card').forEach(function(c) {
    if (c !== cardEl) c.classList.remove('hover-active');
  });
  if (cardEl && !cardEl.classList.contains('dragging')) {
    cardEl.classList.add('hover-active');
    onAttractorCardInteraction();
    layoutCards();
  }
}, true);

document.body.addEventListener('pointerout', function(e) {
  if (e.pointerType === 'touch') return;
  if (animState !== 'IDLE') return;
  var cardEl = e.target.closest('.card');
  if (cardEl) {
    cardEl.classList.remove('hover-active');
    layoutCards();
  }
}, true);

/* ═══════════════════════════════════════════════
   ATTRACTOR (drag-me hint)
   ═══════════════════════════════════════════════ */
function onAttractorCardInteraction() {
  // Any card hover/touch cancels the first-land timer and arms the
  // one-shot post-touch timer. No-ops once the attractor is disabled,
  // already active, or past the first-land window.
  if (attractorState.disabled) return;
  if (attractorState.active) return;
  if (attractorState.firstLandTimer === null) return;
  clearTimeout(attractorState.firstLandTimer);
  attractorState.firstLandTimer = null;
  if (attractorState.postTouchTimer !== null) return; // one-shot
  attractorState.postTouchTimer = setTimeout(function() {
    attractorState.postTouchTimer = null;
    startAttractor();
  }, ATTRACTOR_TOUCH_MS);
}

function cancelAttractorTimers() {
  if (attractorState.firstLandTimer !== null) {
    clearTimeout(attractorState.firstLandTimer);
    attractorState.firstLandTimer = null;
  }
  if (attractorState.postTouchTimer !== null) {
    clearTimeout(attractorState.postTouchTimer);
    attractorState.postTouchTimer = null;
  }
}

function armFirstLandTimer() {
  if (attractorState.disabled) return;
  if (attractorState.active) return;
  if (attractorState.firstLandTimer !== null) return;
  if (attractorState.postTouchTimer !== null) return;
  if (isPlaneActive()) return;
  attractorState.firstLandTimer = setTimeout(function() {
    attractorState.firstLandTimer = null;
    startAttractor();
  }, ATTRACTOR_FIRST_MS);
}

function getAttractorTargetCardId() {
  // Center-most visible card in the fan.
  if (!cardOrder.length) return -1;
  return cardOrder[Math.floor(cardOrder.length / 2)];
}

function startAttractor() {
  if (attractorState.disabled) return;
  if (attractorState.active) return;
  if (isPlaneActive()) return;
  if (animState !== 'IDLE') return;

  var cardId = getAttractorTargetCardId();
  if (cardId === -1) return;
  var el = handContainer.querySelector('.card[data-card-id="' + cardId + '"]');
  if (!el) return;

  var slot = cardOrder.indexOf(cardId);
  var total = cardOrder.length;
  var pos = getRestPosition(slot, total);

  attractorState.active = true;
  attractorState.cardId = cardId;

  // Build label as a child of the card so it follows the bounce tween.
  // Positioned above the card's own top edge; counter-rotated so the text
  // reads upright even if the target card has a non-zero fan angle.
  var label = document.createElement('div');
  label.className = 'attractor-label';
  label.textContent = 'drag me!';
  label.style.left = '50%';
  label.style.top  = (-ATTRACTOR_LABEL_OFFSET) + 'px';
  label.style.transform = 'translateX(-50%) rotate(' + (-pos.angle) + 'deg)';
  el.appendChild(label);
  attractorState.labelEl = label;

  // Bounce the card. Take GSAP ownership of the transform by setting the
  // current x/y/rotation first, then run the timeline. layoutCards() will
  // skip this card while active so it doesn't fight the tween.
  //
  // If the card is already lifted (hover or tap-lift), start from its lifted
  // y and skip the up phase — drop straight into the bounce.out descent, then
  // enter the normal infinite loop.
  el.style.transition = 'none';
  el.style.transformOrigin = 'center bottom';
  el.style.zIndex = 25;

  var isLifted = el.classList.contains('hover-active');
  var startY = isLifted ? (pos.py - HOVER_LIFT) : pos.py;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  gsap.set(el, { x: pos.px, y: startY, rotation: pos.angle });
  if (!reduced) {
    var buildLoop = function() {
      return gsap.timeline({ repeat: -1, repeatDelay: 0.8 })
        .to(el, { y: pos.py + ATTRACTOR_BOUNCE_Y, duration: 0.14, ease: 'power1.out' })
        .to(el, { y: pos.py,                       duration: 0.9,  ease: 'bounce.out' }, '-=0.04');
    };
    if (isLifted) {
      // Intro descent from lifted y, then hand off to the infinite loop.
      attractorState.tween = gsap.timeline({
        onComplete: function() {
          if (!attractorState.active) return;
          attractorState.tween = buildLoop();
        },
      }).to(el, { y: pos.py, duration: 0.9, ease: 'bounce.out' }, 0)
        .to({}, { duration: 0.8 }); // pause to match loop repeatDelay
    } else {
      attractorState.tween = buildLoop();
    }
  }
}

function stopAttractor() {
  if (!attractorState.active) return;
  attractorState.active = false;
  if (attractorState.tween) {
    attractorState.tween.kill();
    attractorState.tween = null;
  }
  if (attractorState.labelEl && attractorState.labelEl.parentNode) {
    attractorState.labelEl.parentNode.removeChild(attractorState.labelEl);
  }
  attractorState.labelEl = null;
  var prevCardId = attractorState.cardId;
  attractorState.cardId = -1;
  var el = handContainer.querySelector('.card[data-card-id="' + prevCardId + '"]');
  if (el) {
    el.style.zIndex = '';
  }
  layoutCards();
}

function disableAttractorPermanently() {
  if (attractorState.disabled) return;
  attractorState.disabled = true;
  cancelAttractorTimers();
  stopAttractor();
  try { localStorage.setItem(ATTRACTOR_LS_KEY, '1'); } catch (e) {}
  if (attractorState.planeObserver) {
    attractorState.planeObserver.disconnect();
    attractorState.planeObserver = null;
  }
}

function initAttractor() {
  try {
    if (localStorage.getItem(ATTRACTOR_LS_KEY) === '1') {
      attractorState.disabled = true;
      return;
    }
  } catch (e) {}

  // Watch the plane-active class on <html>. Plane on => suppress; plane off
  // => re-arm the first-land timer (if still not disabled and no timer/attractor
  // is already in flight).
  attractorState.planeObserver = new MutationObserver(function() {
    if (attractorState.disabled) return;
    if (isPlaneActive()) {
      cancelAttractorTimers();
      stopAttractor();
    } else {
      armFirstLandTimer();
    }
  });
  attractorState.planeObserver.observe(document.documentElement, {
    attributes: true, attributeFilter: ['class'],
  });

  armFirstLandTimer();
}

/* ═══════════════════════════════════════════════
   EVENT LISTENERS
   ═══════════════════════════════════════════════ */
document.body.addEventListener('pointerdown', onPointerDown, { passive: false });
document.body.addEventListener('pointermove', onPointerMove, { passive: false });
document.body.addEventListener('pointerup', onPointerUp);
document.body.addEventListener('pointerleave', function(e) {
  if (animState === 'DRAGGING') onPointerUp(e);
});
document.body.addEventListener('pointercancel', function(e) {
  if (dragState && dragState.el) {
    var img = dragState.el.querySelector('.card-art-img');
    if (img && img.dataset.gif) { freezeGif(img); }
    resetProximityFeedback(dragState.el);
    dragState.el.classList.remove('dragging');
    dragState.el.style.transition = '';
    dragState.el.style.transformOrigin = 'center bottom';
    dragState.el.style.zIndex = '';
  }
  dragState = null;
  _activePointerId = null;
  document.documentElement.classList.remove('card-dragging');
  if (animState === 'DRAGGING') {
    animState = 'IDLE';
    layoutCards();
  }
});
document.body.addEventListener('dragstart', function(e) { e.preventDefault(); });

// Dismiss lifted card on page scroll
window.addEventListener('scroll', function() {
  if (_liftedCardId !== -1) dismissLift();
}, { passive: true });

/* ═══════════════════════════════════════════════
   THEME CHANGE CALLBACK
   ═══════════════════════════════════════════════ */
window._cardHandOnThemeChange = function() {
  // Cards use CSS custom properties that update automatically.
  // Reset any inline border-color set during drag feedback.
  handContainer.querySelectorAll('.card-inner').forEach(function(inner) {
    inner.style.borderColor = '';
    inner.style.boxShadow = '';
  });
};

/* ═══════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════ */
buildCards();
initAttractor();

// Pop-up entrance animation: cards start below viewport and slide up with stagger
(function() {
  var cardEls = handContainer.querySelectorAll('.card');
  var total = cardOrder.length;
  cardOrder.forEach(function(cid, slot) {
    var el = null;
    cardEls.forEach(function(e) { if (parseInt(e.dataset.cardId) === cid) el = e; });
    if (!el) return;
    var pos = getRestPosition(slot, total);
    el.style.transition = 'none';
    el.style.transformOrigin = 'center bottom';
    gsap.set(el, { x: pos.px, y: pos.py + 300, rotation: pos.angle, opacity: 0 });
  });
  requestAnimationFrame(function() {
    cardOrder.forEach(function(cid, slot) {
      var el = null;
      cardEls.forEach(function(e) { if (parseInt(e.dataset.cardId) === cid) el = e; });
      if (!el) return;
      var pos = getRestPosition(slot, total);
      gsap.to(el, {
        x: pos.px, y: pos.py, rotation: pos.angle, opacity: 1,
        duration: 0.55, delay: slot * 0.12, ease: 'power2.out',
        onComplete: function() { el.style.transition = ''; }
      });
    });
  });
})();
