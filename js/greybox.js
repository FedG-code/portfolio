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
    var list = self.tw.slice();
    for (var i = 0; i < list.length; i++){ var t = list[i]; if (t.dead) continue; t.e += dt; var p = Math.min(1, t.e / t.dur); t.fn(p); if (p >= 1){ t.dead = true; if (t.done) t.done(); } }
    self.tw = self.tw.filter(function(t){ return !t.dead; });
    if (self.tw.length) self.raf = requestAnimationFrame(loop);
  }
  self.raf = requestAnimationFrame(loop);
};
function eio(p){ return p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2; }
function lerp(a, b, t){ return a + (b - a) * t; }
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
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
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  var sc = sun.shadow.camera, b = o.sb; sc.left = -b; sc.right = b; sc.top = b; sc.bottom = -b; sc.near = .5; sc.far = 60; sun.shadow.bias = -.0008;
  S.add(sun);
  var fs = o.fs, ft = gridTex(T, '#9AA09B', 'rgba(40,46,42,.18)', 'rgba(40,46,42,.32)'); ft.repeat.set(fs, fs);
  var floor = new T.Mesh(new T.PlaneGeometry(fs, fs), new T.MeshLambertMaterial({map:ft}));
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; S.add(floor);
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
  function render(){ if (dead) return; if (q){ cancelAnimationFrame(q); q = 0; } R.render(S, cam); placePins(); }
  function later(){ if (q || dead) return; q = requestAnimationFrame(function(){ q = 0; if (!dead){ R.render(S, cam); placePins(); } }); }
  function box(sx, sy, sz, mat, x, y, z, parent){ var mm = new T.Mesh(new T.BoxGeometry(sx, sy, sz), mat); mm.position.set(x, y, z); mm.castShadow = true; mm.receiveShadow = true; (parent || S).add(mm); return mm; }
  function tex(src, px){
    var key = src + (px ? '#px' : '');
    if (texC[key]){ if (!texC[key].image) texC[key].__wait.push(later); return texC[key]; }
    var t = new T.TextureLoader().load(src, function(){ t.__wait.forEach(function(f){ f(); }); t.__wait = []; });
    t.__wait = [later]; t.minFilter = T.LinearFilter; t.generateMipmaps = false; if (px) t.magFilter = T.NearestFilter;
    texC[key] = t; return t;
  }
  /* capture on a dark frame, kept at its own ratio inside a 16:9 box */
  function screen(p, sw, parent){
    var sh = sw / (16/9), g = new T.Group(); (parent || S).add(g);
    box(sw + .16, sh + .16, .1, M.dark, 0, 0, -.06, g);
    var iw = p.ar >= 16/9 ? sw : sh * p.ar, ih = p.ar >= 16/9 ? sw / p.ar : sh;
    var pl = new T.Mesh(new T.PlaneGeometry(iw, ih), new T.MeshBasicMaterial({map:tex(p.img, p.px)})); pl.position.z = .002; g.add(pl);
    /* selection: a bright green line with a dark line just outside it, so it holds on the grey stage */
    var sel = new T.Group(); sel.position.z = -.06; sel.visible = false; g.add(sel);
    sel.add(new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(sw + .34, sh + .34, .16)), new T.LineBasicMaterial({color:0x2BD957})));
    sel.add(new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(sw + .40, sh + .40, .16)), new T.LineBasicMaterial({color:0x15181B})));
    g.userData = {w:sw, h:sh, iw:iw, ih:ih, iw0:iw, ih0:ih, pl:pl, src:p.img, px:!!p.px, sel:sel}; return g;
  }
  function pin(elm, v, ax, ay, extra){ var p = {el:elm, v:v, ax:ax || 0, ay:ay || 0}; if (extra) for (var k in extra) p[k] = extra[k]; pins.push(p); return p; }
  /* which tagged object (userData.hit) is under a client point */
  var ray = new T.Raycaster(), nd = new T.Vector2();
  function pick(cx, cy, objs){
    var r = R.domElement.getBoundingClientRect(); nd.set((cx - r.left)/r.width*2 - 1, -(cy - r.top)/r.height*2 + 1);
    ray.setFromCamera(nd, cam);
    var h = ray.intersectObjects(objs, true)[0], o = h && h.object;
    while (o && !o.userData.hit) o = o.parent;
    return o ? o.userData.hit : null;
  }
  /* drop this scene's GPU objects (textures are shared across rebuilds and kept) */
  function dispose(){
    dead = true; if (q) cancelAnimationFrame(q);
    S.traverse(function(o){ if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.map) o.material.dispose(); });
    ft.dispose();
  }
  return {T:T, S:S, cam:cam, M:M, look:look, setCam:setCam, proj:proj, render:render, later:later, box:box, tex:tex, screen:screen, pin:pin, pick:pick, dispose:dispose};
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

window.Greybox = {RM:RM, Clock:Clock, eio:eio, lerp:lerp, clamp:clamp, el:el, restart:restart, phURL:phURL,
  renderer:renderer, glOK:function(){ return glOK; }, gridTex:gridTex, Stage:Stage, capsule:capsule, stand:stand, STAND_H:STAND_H, dragX:dragX};
})();
