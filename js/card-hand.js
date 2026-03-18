/* ═══════════════════════════════════════════════
   CARD DATA
   ═══════════════════════════════════════════════ */
var CARDS = [
  {
    id: 0, accent: 'red',
    title: 'Logifuture',
    typeLeft: 'Casino Games', typeRight: 'Game Developer',
    icon: '\u2666',
    text: 'Developed casino game features across web and mobile platforms, shipping live products to players worldwide.',
    accentColor: '#c83830', accentMuted: '#8a5a5a',
    pageUrl: 'logifuture.html',
  },
  {
    id: 1, accent: 'purple',
    title: 'Coffin-Likker',
    typeLeft: 'Project', typeRight: 'Solo Developer',
    icon: '\u2620',
    text: 'Stealth-horror project focused on visibility, AI behavior, and environmental tension. Set in the bayou.',
    accentColor: '#6a4cba', accentMuted: '#6a5a8a',
    pageUrl: 'coffin-likker.html',
  },
  {
    id: 2, accent: 'green',
    title: 'Lost Satellite',
    typeLeft: 'EoD', typeRight: 'Tech Designer',
    icon: '\u263E',
    text: 'Combat, enemies and movement for a narrative-driven metroidvania in Godot.',
    accentColor: '#28885a', accentMuted: '#5a8a6a',
    pageUrl: 'lost-satellite.html',
  },
  {
    id: 3, accent: 'gold',
    title: 'Home',
    typeLeft: 'Index', typeRight: 'Portfolio',
    icon: '\u2302',
    text: 'Return to the main page. Overview of all projects and contact information.',
    accentColor: '#e8a44a', accentMuted: '#8a7a5a',
    pageUrl: null,
  },
];

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */
var HOLD_RADIUS     = 1400;
var FAN_SPREAD      = 20;
var OVERLAP_SPACING = 155;
var SINK_BELOW      = 190;
var HOVER_LIFT      = 50;
var CARD_W          = 220;
var CARD_H          = 320;
var HAND_W          = 700;
var HAND_H          = 400;

var PLAY_ZONE_HALF_W    = 385;
var PLAY_ZONE_HALF_H    = 289;
var MAX_BLUR            = 8;
var MAX_OVERLAY_OPACITY = 0.3;
var MAX_GLOW_SIZE       = 30;

/* ═══════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════ */
var activePageCardId = 3; // Start with Home active (gold card absent from hand)
var cardOrder = [0, 1, 2]; // IDs of cards currently in hand
var dragState = null;
var animState = 'IDLE'; // IDLE | DRAGGING | RETURNING | PLAYING | TRANSITIONING

var handContainer = document.getElementById('handContainer');
var dragBlurOverlay = document.getElementById('dragBlurOverlay');
var perspectiveContainer = document.getElementById('perspectiveContainer');
var flyOverlay = document.getElementById('flyOverlay');

/* ═══════════════════════════════════════════════
   CARD HTML + BUILD
   ═══════════════════════════════════════════════ */
function createCardHTML(c) {
  return '<div class="card-inner">' +
    '<div class="card-title"><h3>' + c.title + '</h3></div>' +
    '<div class="card-art"><div class="card-art-inner"><span class="card-art-icon">' + c.icon + '</span></div></div>' +
    '<div class="type-bar">' + c.typeLeft + ' \u00B7 ' + c.typeRight + '</div>' +
    '<div class="card-textbox"><p>' + c.text + '</p></div>' +
    '<div class="accent-strip"></div>' +
  '</div>';
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
function calcProximity(cardEl) {
  var cc = getCardCenter(cardEl);
  var vc = getViewportCenter();
  var dx = cc.x - vc.x;
  var dy = cc.y - vc.y;
  var dist = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, Math.min(1, 1 - dist / getMaxDistance()));
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
  var glowSize = proximity * MAX_GLOW_SIZE;
  inner.style.boxShadow = '0 0 ' + glowSize + 'px ' + cardData.accentColor;
  var muted = hexToRGB(cardData.accentMuted);
  var vivid = hexToRGB(cardData.accentColor);
  var r = Math.round(muted.r + (vivid.r - muted.r) * proximity);
  var g = Math.round(muted.g + (vivid.g - muted.g) * proximity);
  var b = Math.round(muted.b + (vivid.b - muted.b) * proximity);
  inner.style.borderColor = 'rgb(' + r + ',' + g + ',' + b + ')';
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
   DRAG HANDLERS
   ═══════════════════════════════════════════════ */
function onPointerDown(e) {
  if (animState !== 'IDLE') return;
  var cardEl = e.target.closest('.card');
  if (!cardEl) return;
  e.preventDefault();
  cardEl.setPointerCapture(e.pointerId);
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
  };
  animState = 'DRAGGING';
  cardEl.classList.add('dragging');
  cardEl.classList.remove('hover-active');
  cardEl.style.zIndex = 100;
  cardEl.style.transition = 'none';
  cardEl.style.transformOrigin = 'center center';

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
  dragState.hasMoved = true;
  var handRect = handContainer.getBoundingClientRect();
  var cardLeftInHand = e.clientX - dragState.grabX - handRect.left;
  var cardTopInHand = e.clientY - dragState.grabY - handRect.top;
  var dragAngle = Math.max(-12, Math.min(12, dx * 0.03));
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
  if (!wasMoved) {
    el.classList.remove('dragging');
    el.style.transition = '';
    el.style.transformOrigin = 'center bottom';
    el.style.zIndex = '';
    dragState = null;
    animState = 'IDLE';
    layoutCards();
    return;
  }
  if (isInPlayZone(el)) {
    animState = 'PLAYING';
    el.classList.remove('dragging');
    el.classList.add('playing');
    dragState = null;
    playCard(el, cardId);
  } else {
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
  if (animState !== 'IDLE') return;
  var cardEl = e.target.closest('.card');
  handContainer.querySelectorAll('.card').forEach(function(c) {
    if (c !== cardEl) c.classList.remove('hover-active');
  });
  if (cardEl && !cardEl.classList.contains('dragging')) {
    cardEl.classList.add('hover-active');
    layoutCards();
  }
}, true);

document.body.addEventListener('pointerout', function(e) {
  if (animState !== 'IDLE') return;
  var cardEl = e.target.closest('.card');
  if (cardEl) {
    cardEl.classList.remove('hover-active');
    layoutCards();
  }
}, true);

/* ═══════════════════════════════════════════════
   EVENT LISTENERS
   ═══════════════════════════════════════════════ */
document.body.addEventListener('pointerdown', onPointerDown);
document.body.addEventListener('pointermove', onPointerMove);
document.body.addEventListener('pointerup', onPointerUp);
document.body.addEventListener('pointerleave', function(e) {
  if (animState === 'DRAGGING') onPointerUp(e);
});
document.body.addEventListener('dragstart', function(e) { e.preventDefault(); });

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
layoutCards();
