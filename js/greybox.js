/* js/greybox.js: the greybox stage used by the Dolly Gallery (gallery.js) and the cases told in its scene (case.js).
   One WebGLRenderer per page (renderer()), the Stage (scene, lights, grid floor, screens, pinned HTML, render on demand),
   the capsule guide, the stand (player-start pad), on-demand tweens (Clock) and the drag helper.
   Plain script, no modules: exposes window.Greybox. Touches THREE only when called, so Three.js can load async. */
(function(){
'use strict';
var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
/* grey placeholder capture as a data URL, so the plain list and the 3D texture share it */
var phC = {};
function phURL(label){
  if (phC[label]) return phC[label];
  var cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; var g = cv.getContext('2d');
  g.fillStyle = '#5A605C'; g.fillRect(0, 0, 640, 360);
  g.strokeStyle = 'rgba(243,244,240,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(640, 360); g.moveTo(640, 0); g.lineTo(0, 360); g.stroke();
  g.fillStyle = '#5A605C'; g.fillRect(150, 140, 340, 80);
  g.fillStyle = '#F3F4F0'; g.textAlign = 'center'; g.font = '600 30px Archivo, sans-serif'; g.fillText(label, 320, 178);
  g.font = '500 18px "IBM Plex Mono", monospace'; g.fillStyle = 'rgba(243,244,240,.75)'; g.fillText('capture to come', 320, 206);
  return (phC[label] = cv.toDataURL('image/png'));
}

/* ------------------------------ clock: on-demand tweens ------------------------------ */
function Clock(){ this.tw = []; this.raf = 0; this.last = 0; }
/* while a Clock tick runs its tweens, Stage.render() places the pins at once but leaves the WebGL draw to the end of the
   tick: several tweens at once (camera, guide, wall label) used to draw the whole scene once each, every frame */
var ticking = 0, pendDraw = [];
Clock.prototype.add = function(dur, fn, done){
  if (RM || dur <= 0){ fn(1); if (done) done(); return null; }
  var t = {e:0, dur:dur, fn:fn, done:done, dead:false}; this.tw.push(t); this.run(); return t;
};
Clock.prototype.kill = function(t){ if (t) t.dead = true; };
Clock.prototype.killAll = function(){ this.tw.forEach(function(t){ t.dead = true; }); this.tw = []; };
Clock.prototype.run = function(){
  var self = this; if (self.raf) return; self.last = performance.now();
  function loop(now){
    var dt = Math.min(0.05, (now - self.last) / 1000); self.last = now; self.raf = 0;
    var list = self.tw.slice(); ticking++;
    try { for (var i = 0; i < list.length; i++){ var t = list[i]; if (t.dead) continue; t.e += dt; var p = Math.min(1, t.e / t.dur); t.fn(p); if (p >= 1){ t.dead = true; if (t.done) t.done(); } } }
    finally { ticking--; if (!ticking){ var pd = pendDraw; pendDraw = []; pd.forEach(function(f){ f(); }); } }
    self.tw = self.tw.filter(function(t){ return !t.dead; });
    /* one chain only: a tween added during the tick (a done() starting the next move) has already asked for a frame
       via run(); scheduling another here used to start a second loop, and every extra loop drew the scene again */
    if (self.tw.length && !self.raf) self.raf = requestAnimationFrame(loop);
  }
  self.raf = requestAnimationFrame(loop);
};
function eio(p){ return p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2; }
function lerp(a, b, t){ return a + (b - a) * t; }
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
/* HTML onto a projected rectangle (2026-11-24): e is laid out at the corners' bounding box and warped onto them with a
   matrix3d (a homography), so a clip or the monitor's face follows the screen's perspective instead of spilling past its
   bezel. q = the four projected corners [top left, top right, bottom right, bottom left] (stage px); e needs
   transform-origin 0 0 (.pin). Returns the bounding box */
function quad(e, q){
  var xs = q.map(function(p){ return p[0]; }), ys = q.map(function(p){ return p[1]; });
  var lx = Math.min.apply(null, xs), ty = Math.min.apply(null, ys), W = Math.max.apply(null, xs) - lx, H = Math.max.apply(null, ys) - ty;
  if (W < 1 || H < 1) return {x:lx, y:ty, w:W, h:H};
  var x0 = q[0][0], y0 = q[0][1], x1 = q[1][0], y1 = q[1][1], x2 = q[2][0], y2 = q[2][1], x3 = q[3][0], y3 = q[3][1];   /* absolute: a translation added after the divide would be wrong */
  var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3, g = 0, h = 0, dn = dx1*dy2 - dx2*dy1;
  if (Math.abs(dx3) + Math.abs(dy3) > 1e-6 && Math.abs(dn) > 1e-9){ g = (dx3*dy2 - dx2*dy3)/dn; h = (dx1*dy3 - dx3*dy1)/dn; }
  var a = x1 - x0 + g*x1, b = x3 - x0 + h*x3, d = y1 - y0 + g*y1, f = y3 - y0 + h*y3;
  var m = [a/W, d/W, 0, g/W, b/H, f/H, 0, h/H, 0, 0, 1, 0, x0, y0, 0, 1];
  e.style.width = W.toFixed(1) + 'px'; e.style.height = H.toFixed(1) + 'px';
  e.style.transform = 'matrix3d(' + m.map(function(v){ return +v.toFixed(6); }).join(',') + ')';
  return {x:lx, y:ty, w:W, h:H};
}
/* headings: the short way round, so the guide never spins the long way or snaps 180 */
function wrapA(a){ return Math.atan2(Math.sin(a), Math.cos(a)); }
function lerpA(a, b, t){ return a + wrapA(b - a) * t; }
/* turn o towards heading ry by real time: damped (rate per second) and capped at TURN rad/s, so a 180 reads as a turn, not a snap; call once per frame from a tween */
var TURN = 8;
function steer(o, ry, rate){
  var now = performance.now(), u = o.userData, gap = u.stT ? (now - u.stT) / 1000 : 0, dt = gap > .1 ? 1/60 : gap; u.stT = now;
  var d = wrapA(ry - o.rotation.y), mv = d * (1 - Math.exp(-(rate || 9) * dt)), cap = TURN * dt;
  o.rotation.y += Math.max(-cap, Math.min(cap, mv));
}
function el(tag, cls, html){ var e = document.createElement(tag); e.className = cls; if (html != null) e.innerHTML = html; if (tag === 'button') e.type = 'button'; return e; }
function restart(e){ e.classList.remove('anim'); void e.offsetWidth; e.classList.add('anim'); }

/* ================================ 3D stage (one renderer for the page) ================================ */
var R = null, glOK = null, texC = {};
function renderer(){
  if (glOK === false) return null;
  if (R) return R;
  var T = window.THREE;
  try { R = new T.WebGLRenderer({antialias:true}); } catch(e){ R = null; }
  if (!R || !R.getContext()){ glOK = false; R = null; return null; }
  glOK = true;
  R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.setClearColor(0x8F9591);
  R.domElement.className = 'st-cv'; R.domElement.setAttribute('aria-hidden', 'true');
  return R;
}
function gridTex(T, base, line, major){
  var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = line; g.lineWidth = 1; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
  g.strokeStyle = major; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128);
  var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
}
function Stage(host, w, h, o){
  var T = window.THREE, R = renderer(); if (!R) return null;
  R.setSize(w, h); host.insertBefore(R.domElement, host.firstChild);
  var S = new T.Scene(), cam = new T.PerspectiveCamera(o.fov, w/h, .1, 400);
  S.add(new T.HemisphereLight(0xffffff, 0x7d837f, .75));
  var sun = new T.DirectionalLight(0xffffff, .62); sun.position.set(o.sun[0], o.sun[1], o.sun[2]);
  sun.castShadow = true; sun.shadow.mapSize.set(o.sm || 1024, o.sm || 1024);
  var sc = sun.shadow.camera; sc.near = .5; sc.far = 60; sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  S.add(sun); S.add(sun.target);
  /* the sun's shadow box covers the wall from a to b (with 3 to spare), so the far bays get shadows too; the floor is
     centred on the wall too (on a whole metre, an even width: the grid lines stay on whole metres) and widened to run 40 past both ends: centred
     on x = 0 it stopped short of the last bay once the wall grew past 55 m */
  function sunSpan(a, b){
    var cx = (a + b)/2, r = (b - a)/2 + 3;
    sun.position.set(cx + o.sun[0], o.sun[1], o.sun[2]); sun.target.position.set(cx, 0, 0); sun.target.updateMatrixWorld();
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.updateProjectionMatrix(); shK = NaN;
    if (floor){ var fw = Math.max(fs, 2*Math.ceil((b - a)/2) + 80); floor.position.x = Math.round(cx); floor.scale.x = fw/fs; ft.repeat.x = fw; }
  }
  var fs = o.fs, ft = gridTex(T, '#9AA09B', 'rgba(40,46,42,.18)', 'rgba(40,46,42,.32)'); ft.repeat.set(fs, fs);
  var floor = new T.Mesh(new T.PlaneGeometry(fs, fs), new T.MeshLambertMaterial({map:ft}));
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; S.add(floor);
  sunSpan(-o.sb + 3, o.sb - 3);   /* until the caller knows its wall: ±sb round x = 0 */
  var M = {
    wall:new T.MeshLambertMaterial({color:0xB9BEB9}), prop:new T.MeshLambertMaterial({color:0xDCDFDA}), lead:new T.MeshLambertMaterial({color:0xE4E6E1}),
    white:new T.MeshLambertMaterial({color:0xF3F4F0}), dark:new T.MeshLambertMaterial({color:0x2A2E31})
  };
  var look = new T.Vector3(), pins = [], q = 0, dead = false, k = o.k || 1;
  function setCam(p, l){ cam.position.copy(p); look.copy(l); cam.lookAt(look); cam.updateMatrixWorld(); }
  function proj(v){ var s = v.clone().project(cam); return [(s.x + 1)/2*w, (1 - s.y)/2*h, s.z]; }
  function placePins(){
    pins.forEach(function(p){
      if (p.el.hidden) return;
      if (p.rect){ p.rect(proj); return; }
      var wp = p.get ? p.get() : p.v, s = proj(wp), ew = p.el.offsetWidth*k, eh = p.el.offsetHeight*k;
      var x = s[0] - p.ax*ew + (p.dx || 0), y = s[1] - p.ay*eh + (p.dy || 0);
      if (p.clamp !== false){ x = clamp(x, 6, w - ew - 6); y = clamp(y, 6, h - eh - 6); }
      p.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)' + (k < 1 ? ' scale(' + k.toFixed(3) + ')' : '');
    });
  }
  /* a new stage size on the same renderer (phone case view: a shorter stage) */
  function resize(nw, nh){ w = nw; h = nh; R.setSize(nw, nh); cam.aspect = nw/nh; cam.updateProjectionMatrix(); render(); }
  /* the shadow map is drawn only when a caster has moved (the guide walking, frames rotating), not for camera moves or
     clips: a key over the casters' world matrices decides. It keeps the 2048 map cheap where rendering is slow */
  R.shadowMap.autoUpdate = false;
  var shK = NaN;
  function draw(){
    placeSofts(); S.updateMatrixWorld(); var k = 0, n = 0;
    S.traverseVisible(function(o){ if (!o.castShadow) return; var e = o.matrixWorld.elements; n++; k += n*(e[0] + 2*e[1] + 3*e[2] + 5*e[5] + 7*e[10]) + e[12]*1.31 + e[13]*1.73 + e[14]*2.07; });
    if (k !== shK){ shK = k; R.shadowMap.needsUpdate = true; }
    R.render(S, cam);
  }
  var pend = false;
  function flush(){ pend = false; if (!dead){ draw(); placePins(); } }
  function render(){
    if (dead) return; if (q){ cancelAnimationFrame(q); q = 0; }
    if (ticking){ placePins(); if (!pend){ pend = true; pendDraw.push(flush); } return; }
    draw(); placePins();
  }
  function later(){ if (q || dead) return; q = requestAnimationFrame(function(){ q = 0; if (!dead){ draw(); placePins(); } }); }
  function box(sx, sy, sz, mat, x, y, z, parent){ var mm = new T.Mesh(new T.BoxGeometry(sx, sy, sz), mat); mm.position.set(x, y, z); mm.castShadow = true; mm.receiveShadow = true; (parent || S).add(mm); return mm; }
  function tex(src, px){
    var key = src + (px ? '#px' : '');
    if (texC[key]){ if (!texC[key].image) texC[key].__wait.push(later); return texC[key]; }
    var t = new T.TextureLoader().load(src, function(){ t.__wait.forEach(function(f){ f(); }); t.__wait = []; });
    t.__wait = [later]; t.minFilter = T.LinearFilter; t.generateMipmaps = false; if (px) t.magFilter = T.NearestFilter;
    texC[key] = t; return t;
  }
  /* a soft shadow on the wall for a flat thing hung on it (2026-11-24): screens, signs and the monitor stand only 2-16 cm off
     the wall, so their real shadow was a strip one or two texels of the wall-wide shadow map tall and drew as dashed lines.
     They don't cast any more; this plane (a blurred rectangle, its own small canvas) lies on the wall behind g, offset along
     the sun by how far g's front stands off the wall. draw() keeps it on the wall as g moves or scales (softs) */
  var softs = [], SB = .14;
  function soft(g, w, h, front){
    var pm = 72, cw = Math.round((w + 2*SB)*pm), ch = Math.round((h + 2*SB)*pm), cv = document.createElement('canvas');
    cv.width = Math.min(1024, cw); cv.height = Math.min(1024, ch);
    var x = cv.getContext('2d'), sx = cv.width/cw, sy = cv.height/ch;
    x.fillStyle = '#000'; x.fillRect(0, 0, cv.width, cv.height);   /* alphaMap reads green: white = shadow */
    x.shadowColor = '#fff'; x.shadowBlur = SB*pm*.55*Math.min(sx, sy); x.shadowOffsetX = 4000; x.fillStyle = '#fff';
    x.fillRect(SB*pm*sx - 4000, SB*pm*sy, w*pm*sx, h*pm*sy);
    var t = new T.CanvasTexture(cv), mt = new T.MeshBasicMaterial({color:0x000000, alphaMap:t, transparent:true, opacity:.3, depthWrite:false});
    own.push(t, mt);
    var pl = new T.Mesh(new T.PlaneGeometry(w + 2*SB, h + 2*SB), mt); pl.renderOrder = -1; g.add(pl);
    softs.push({g:g, pl:pl, f:front, sx:o.sun[0]/o.sun[2], sy:o.sun[1]/o.sun[2]});
  }
  function placeSofts(){
    softs.forEach(function(o){
      var g = o.g, k = g.scale.x || 1, d = Math.max(0, g.position.z + o.f*k);
      o.pl.position.set(-d*o.sx/k, -d*o.sy/k, (.004 - g.position.z)/k);
    });
  }
  /* capture on a dark frame: shaped like the clip when fit (desktop, 2026-11-23), else a 16:9 box it sits inside at its own ratio */
  function screen(p, sw, parent, fit){
    var sh = sw / (fit ? p.ar : 16/9), ba = sw/sh, g = new T.Group(); (parent || S).add(g);
    box(sw + .16, sh + .16, .1, M.dark, 0, 0, -.06, g).castShadow = false; soft(g, sw + .16, sh + .16, -.01);
    var iw = p.ar >= ba ? sw : sh * p.ar, ih = p.ar >= ba ? sw / p.ar : sh;
    var pl = new T.Mesh(new T.PlaneGeometry(iw, ih), new T.MeshBasicMaterial({map:tex(p.img, p.px)})); pl.position.z = .002; g.add(pl);
    /* selection: a bright green line with a dark line just outside it, so it holds on the grey stage */
    var sel = new T.Group(); sel.position.z = -.06; sel.visible = false; g.add(sel);
    sel.add(new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(sw + .34, sh + .34, .16)), new T.LineBasicMaterial({color:0x2BD957})));
    sel.add(new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(sw + .40, sh + .40, .16)), new T.LineBasicMaterial({color:0x15181B})));
    g.userData = {w:sw, h:sh, iw:iw, ih:ih, iw0:iw, ih0:ih, pl:pl, src:p.img, px:!!p.px, sel:sel}; return g;
  }
  /* a small monitor (the wall label, 2026-11-23): dark bezel (a soft wall shadow like the screens), a face plane the HTML sits on, a chin
     with a green LED, and two thin lines up out of shot (fixed children, 12 m, no shadow: thinner than a shadow texel) */
  function monitor(w, h){
    var g = new T.Group(); S.add(g);
    box(w + .14, h + .14, .14, M.dark, 0, 0, 0, g).castShadow = false; soft(g, w + .14, h + .14, .07);
    var face = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({color:0x101315})); face.position.z = .071; g.add(face);
    box(.34, .06, .03, M.dark, 0, -h/2 - .1, .02, g).castShadow = false;
    var led = new T.Mesh(new T.BoxGeometry(.05, .03, .01), new T.MeshBasicMaterial({color:0x2BD957})); led.position.set(.1, -h/2 - .1, .04); g.add(led);
    [-1, 1].forEach(function(sd){ var ln = box(.012, 12, .012, M.dark, sd*(w/2 - .25), h/2 + .07 + 6, 0, g); ln.castShadow = false; ln.receiveShadow = false; });
    g.userData = {w:w, h:h, W:w + .14, H:h + .14, face:face}; return g;
  }
  /* a lit sign (the section title, 2026-11-23): a thin card whose front is a canvas (draw(ctx, W, H) paints it; at least 1400
     px wide), sides like the props, two small dark bolts; receives shadows, and a soft() shadow on the wall. Its texture and material are disposed
     with the stage (dispose() keeps mapped materials, which are the shared capture textures) */
  var own = [];
  function sign(w, h, draw){
    var g = new T.Group(); S.add(g);
    var cv = document.createElement('canvas'); cv.width = Math.max(1400, Math.round(w*480)); cv.height = Math.round(cv.width*h/w);
    var t = new T.CanvasTexture(cv); t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true;   /* seen small: mipmaps keep the sub line clean */ t.anisotropy = R.capabilities.getMaxAnisotropy ? Math.min(8, R.capabilities.getMaxAnisotropy()) : 1;
    var front = new T.MeshLambertMaterial({map:t}); own.push(t, front);
    var card = new T.Mesh(new T.BoxGeometry(w, h, .05), [M.prop, M.prop, M.prop, M.prop, front, M.prop]); card.receiveShadow = true; g.add(card); soft(g, w, h, .025);
    [-1, 1].forEach(function(sd){ var bt = new T.Mesh(new T.CylinderGeometry(.03, .03, .03, 12), M.dark); bt.rotation.x = Math.PI/2; bt.position.set(sd*(w/2 - .1), h/2 - .1, .035); g.add(bt); });
    function paint(){ if (dead) return; var x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); draw(x, cv.width, cv.height); t.needsUpdate = true; later(); }
    paint();
    g.userData = {w:w, h:h, paint:paint, card:card}; return g;
  }
  function pin(elm, v, ax, ay, extra){ var p = {el:elm, v:v, ax:ax || 0, ay:ay || 0}; if (extra) for (var k in extra) p[k] = extra[k]; pins.push(p); return p; }
  /* which tagged object (userData.hit) is under a client point */
  var ray = new T.Raycaster(), nd = new T.Vector2();
  function pick(cx, cy, objs){
    var r = R.domElement.getBoundingClientRect(); nd.set((cx - r.left)/r.width*2 - 1, -(cy - r.top)/r.height*2 + 1);
    ray.setFromCamera(nd, cam);
    /* surfaces only: r128's raycaster also returns hidden objects, and outline lines count as hit up to a unit away,
       so a hidden selection outline of one screen would steal clicks meant for its neighbour */
    var h = ray.intersectObjects(objs, true).filter(function(x){ for (var q = x.object; q; q = q.parent) if (!q.visible) return false; return x.object.isMesh; })[0], o = h && h.object;
    while (o && !o.userData.hit) o = o.parent;
    return o ? o.userData.hit : null;
  }
  /* drop this scene's GPU objects (textures are shared across rebuilds and kept) */
  function dispose(){
    dead = true; if (q) cancelAnimationFrame(q);
    S.traverse(function(o){ if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(function(q){ if (!q.map) q.dispose(); }); });
    own.forEach(function(o){ o.dispose(); }); own = [];
    ft.dispose(); if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  return {T:T, S:S, cam:cam, M:M, look:look, setCam:setCam, proj:proj, resize:resize, render:render, later:later, box:box, tex:tex, screen:screen, monitor:monitor, sign:sign, pin:pin, pick:pick, sunSpan:sunSpan, dispose:dispose};
}
function capsule(T, mat, s){
  var g = new T.Group(), b = new T.Group(); g.add(b); var r = .24*s;
  var cyl = new T.Mesh(new T.CylinderGeometry(r, r, .5*s, 20), mat); cyl.position.y = .48*s;
  var s1 = new T.Mesh(new T.SphereGeometry(r, 20, 12), mat); s1.position.y = .24*s;
  var s2 = s1.clone(); s2.position.y = .73*s;
  var vz = new T.Mesh(new T.BoxGeometry(.26*s, .09*s, .12*s), new T.MeshLambertMaterial({color:0x15181B})); vz.position.set(0, .74*s, .2*s);
  [cyl, s1, s2, vz].forEach(function(o){ o.castShadow = true; b.add(o); });
  g.userData.body = b; return g;
}
/* drag on the stage: a press only becomes a drag after 6px, so a plain click/tap reaches tap(e) instead */
function dragX(host, isBusy, start, move, end, tap, hover){
  var d = null;
  host.addEventListener('pointerdown', function(e){ if (isBusy() || e.target.closest('button,a')) return; d = {x:e.clientX, y:e.clientY, on:false, id:e.pointerId}; });
  host.addEventListener('pointermove', function(e){
    if (!d){ if (hover && e.pointerType === 'mouse') hover(e); return; }
    if (!d.on){
      if (Math.abs(e.clientX - d.x) < 6 && Math.abs(e.clientY - d.y) < 6) return;
      d.on = true; try { host.setPointerCapture(d.id); } catch(_){} start();
    }
    move(e.clientX - d.x);
  });
  host.addEventListener('pointerup', function(e){ if (!d) return; var was = d; d = null; if (was.on) end(); else if (tap && !isBusy()) tap(e); });
  host.addEventListener('pointercancel', function(){ if (!d) return; var was = d; d = null; if (was.on) end(); });
}

/* the stand: the player-start pad, raised a little, with a thin green ring on the floor round it */
var STAND_H = .06;
function stand(T, S, x, z){
  var g = new T.Group(); g.position.set(x, 0, z); S.add(g);
  var pad = new T.Mesh(new T.CylinderGeometry(.5, .5, STAND_H, 28), new T.MeshLambertMaterial({color:0xE4E6E1}));
  pad.position.y = STAND_H/2; pad.receiveShadow = true; pad.castShadow = true; g.add(pad);
  var ring = new T.Mesh(new T.RingGeometry(.5, .53, 40), new T.MeshBasicMaterial({color:0x2BD957})); ring.rotation.x = -Math.PI/2; ring.position.y = .004; g.add(ring);
  return g;
}

/* ---- clips on the wall (gallery overlay, case overlays): the <video>s are kept alive by src and moved between overlays
   instead of rebuilt, so a clip coming back resumes at once and a pre-warmed one has its frame ready. Up to CMAX;
   a spare one waits, paused, in a 1px holder (still in the document, so it keeps its frame and keeps loading).
   Eviction (least recently used, never one showing) drops the src and load()s, which frees the decoder.
   START[src]: a clip that starts at its poster's moment (University: the poster is a frame from the middle). ---- */
var CMAX = 5, clipC = [], START = {}, holder = null, tick = 0, gateN = 0;
function hold(){
  if (!holder || !holder.isConnected){
    holder = el('div', 'vhold', ''); holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    document.body.appendChild(holder);
  }
  return holder;
}
function showing(v){ var o = v.parentNode; return !!o && o !== holder && !o.hidden; }
/* the cached <video> for src (made paused in the holder if new: preload=auto, or with controls and preload=none for reduced motion) */
function clip(src, poster, rm){
  var e = null; clipC.forEach(function(q){ if (q.src === src) e = q; });
  if (!e){
    var v = document.createElement('video'), s = START[src] || 0;
    ['muted', 'loop', 'playsinline', 'disablepictureinpicture'].forEach(function(a){ v.setAttribute(a, ''); });
    v.muted = true; v.preload = rm ? 'none' : 'auto'; if (rm) v.controls = true;
    v.setAttribute('poster', poster); v.setAttribute('src', src);
    if (s){ v.currentTime = s; v.addEventListener('loadedmetadata', function(){ if (!v.__at && v.currentTime < s - .05) v.currentTime = s; }, {once:true}); }
    e = {src:src, v:v}; clipC.push(e); hold().appendChild(v);
  }
  e.t = ++tick;
  while (clipC.length > CMAX){
    var old = null; clipC.forEach(function(q){ if (q !== e && !showing(q.v) && (!old || q.t < old.t)) old = q; });
    if (!old) break;
    clipC.splice(clipC.indexOf(old), 1); old.v.pause(); old.v.removeAttribute('src'); old.v.load(); old.v.remove();
  }
  return e.v;
}
/* overlay o shows v (or nothing): its other cached videos go back to the holder, paused; anything else is removed */
function clipPut(o, v){
  [].slice.call(o.childNodes).forEach(function(n){
    if (n === v) return;
    if (n.tagName === 'VIDEO' && clipC.some(function(q){ return q.v === n; })){ n.pause(); hold().appendChild(n); } else o.removeChild(n);
  });
  if (v && v.parentNode !== o) o.appendChild(v);
}
/* o stays invisible (.wait: opacity 0, so no black box) until v has a frame to show (readyState >= 2, not seeking), and
   on the first play one at its START; a video that already has one shows at once. Checked on the video's events and on
   requestVideoFrameCallback, whichever comes first (rVFC alone waits on the compositor, which may skip an invisible layer) */
function clipGate(o, v){
  var n = o.__g = ++gateN, s = START[v.getAttribute('src')] || 0, evs = ['loadeddata', 'seeked', 'playing', 'timeupdate'];
  function ready(){ return v.readyState >= 2 && !v.seeking && (v.__at || !s || v.currentTime >= s - .25); }
  function off(){ evs.forEach(function(e){ v.removeEventListener(e, ok); }); }
  function ok(){
    if (o.__g !== n || v.parentNode !== o){ off(); return; }
    if (!ready()) return;
    off(); v.__at = true; o.classList.remove('wait');
  }
  if (ready()){ v.__at = true; o.classList.remove('wait'); return; }
  o.classList.add('wait'); evs.forEach(function(e){ v.addEventListener(e, ok); });
  if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(ok);
}

window.Greybox = {RM:RM, Clock:Clock, eio:eio, lerp:lerp, clamp:clamp, lerpA:lerpA, steer:steer, el:el, restart:restart, phURL:phURL,
  renderer:renderer, glOK:function(){ return glOK; }, gridTex:gridTex, Stage:Stage, capsule:capsule, stand:stand, STAND_H:STAND_H, dragX:dragX,
  START:START, quad:quad, clip:clip, clipPut:clipPut, clipGate:clipGate};
})();
