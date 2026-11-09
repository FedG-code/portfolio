/* js/onset.js: "On Set", the project pages' stage (direction C, approved 2026-11-09).
   The guide tells the case in its speech bubble, one paragraph per beat, while the screen behind it shows that
   part's capture. A beat strip under the stage (the gallery's shot list look) jumps between parts.
   - HTML first: the page's own markup is the plain case (no WebGL, ?flat, Three.js failing) and the source the
     beats are read from. When the set is built, that markup moves into a <details> under the strip.
   - Hand-over: the gallery's Open pushes into the screen and sets sessionStorage 'dolly-return' = section id.
     Here we start inside the screen and pull back out to the low shot while the guide walks in from off screen
     onto its stand. A direct link skips the zoom (the guide still walks in). "All projects" pushes back into the
     screen and loads index.html#<id> with the key set, so the gallery pulls back out.
   - One WebGL renderer (js/greybox.js). Reduced motion: cuts, no walk, no hop, clips paused with controls. */
(function(){
'use strict';
var GB = window.Greybox, root = document.documentElement, body = document.body;
var RM = GB.RM, FLAT = /[?&]flat\b/.test(location.search), PHONE = 640, RET = 'dolly-return';
var clamp = GB.clamp, lerp = GB.lerp, eio = GB.eio, el = GB.el;
var D = body.dataset, SEC = D.section;

/* ------------------------------ arrival ------------------------------ */
var fromGallery = false;
try { fromGallery = sessionStorage.getItem(RET) === SEC; if (fromGallery) sessionStorage.removeItem(RET); } catch(e){}
var hashEl = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));

/* ------------------------------ beats from the page's HTML ------------------------------ */
function capOf(n){
  if (n.matches('video[data-src]')) return {img:n.getAttribute('poster'), clip:n.getAttribute('data-src'), alt:n.getAttribute('aria-label') || ''};
  if (n.matches('img')) return {img:n.getAttribute('src'), alt:n.getAttribute('alt') || ''};
  return null;
}
function linkOf(a){ return {href:a.getAttribute('href'), t:a.textContent.replace(/[→↗]/g, '').trim(), ext:a.target === '_blank'}; }
function parse(){
  var beats = [], groups = [], pageLinks = [];
  var secs = [].slice.call(document.querySelectorAll('.project-section'));
  var mode = secs.filter(function(s){ return s.querySelector('.section-heading'); }).length > 1 ? 'h2' : 'h4';
  var first = {img:D.onsetImg, clip:D.onsetClip || null, px:'onsetPx' in D, alt:''};
  if (first.img && first.img.indexOf('ph:') === 0) first.img = GB.phURL(first.img.slice(3));
  var desc = document.querySelector('.project-hero-desc');
  groups.push({t:'Overview', start:0, id:null});
  beats.push({g:0, h:'Overview', html:desc ? desc.innerHTML.trim() : '', caps:[first], stats:null, links:[], yt:null});
  secs.forEach(function(sec){
    var h2 = sec.querySelector('.section-heading'), t2 = h2 ? h2.textContent.trim() : '', mine = [], links = [];
    var caps = null, h4 = '';
    sec.querySelectorAll('.project-link').forEach(function(a){ links.push(linkOf(a)); });
    var emb = sec.querySelector('.video-embed iframe');
    var yt = emb ? {src:emb.getAttribute('src'), t:emb.getAttribute('title') || 'Trailer'} : null;
    sec.querySelectorAll('.project-content').forEach(function(blk){
      var found = [];
      blk.querySelectorAll('video[data-src], img.work-image').forEach(function(n){ if (!n.closest('.project-text')){ var c = capOf(n); if (c) found.push(c); } });
      if (blk.querySelector('.work-capture-tbc')) found.push({img:GB.phURL(t2), alt:''});
      if (found.length) caps = found.slice(0, 2);
      var txt = blk.querySelector('div.project-text'), last = null;
      if (!txt) return;
      [].slice.call(txt.children).forEach(function(n){
        if (n.tagName === 'H4'){ h4 = n.textContent.trim(); return; }
        if (n.tagName === 'P' && n.textContent.trim()){
          var gk = mode === 'h2' ? t2 : (h4 || t2);
          if (!groups.length || groups[groups.length - 1].t !== gk) groups.push({t:gk, start:beats.length, id:sec.id || null});
          last = {g:groups.length - 1, h:mode === 'h2' ? (h4 || t2) : gk, h2:t2, html:n.innerHTML.trim(), caps:caps, stats:null, links:links, yt:null};
          beats.push(last); mine.push(last);
        }
        if (n.classList.contains('work-stats') && last){
          last.stats = [].slice.call(n.querySelectorAll('.work-stat')).map(function(s){ return [s.querySelector('.work-stat-num').textContent.trim(), s.querySelector('.work-stat-label').textContent.trim()]; });
        }
      });
    });
    if (!mine.length){ pageLinks = pageLinks.concat(links); if (yt) beats[beats.length - 1].yt = yt; }
    else if (yt) mine[0].yt = yt;
  });
  /* a capture carries on until the next one; links in a section with no text belong to every beat */
  beats.forEach(function(b, i){ if (!b.caps) b.caps = beats[i - 1].caps; if (pageLinks.length) b.links = b.links.concat(pageLinks); });
  groups.forEach(function(g, i){ g.end = (i + 1 < groups.length ? groups[i + 1].start : beats.length) - 1; });
  return {beats:beats, groups:groups};
}

/* ------------------------------ the set ------------------------------ */
var B = null, cur = 0, built = false, api = null, wantFocus = fromGallery || !!hashEl;
var ui = {};

function buildDOM(){
  var main = el('div', 'os pg', '');
  var nav = document.querySelector('.project-nav');
  var back = nav.querySelector('.back-link');
  var badge = document.querySelector('.project-hero-badge'), h1 = document.querySelector('.project-hero-title');
  var chips = [].slice.call(document.querySelectorAll('.project-hero .tidbit')).map(function(t){ return '<span>' + t.querySelector('.tidbit-label').textContent + ' ' + t.querySelector('.tidbit-value').innerHTML + '</span>'; }).join('');
  /* the plain case goes into a <details> under the set */
  var det = el('details', 'os-text pg', '<summary>The whole case as text</summary>');
  var n = nav.nextElementSibling, move = [];
  while (n && n.tagName !== 'SCRIPT'){ move.push(n); n = n.nextElementSibling; }
  move.forEach(function(m){ det.appendChild(m); });
  main.innerHTML =
    '<div class="os-st" aria-label="Set">' +
      '<div class="pin os-tp"><small>' + (badge ? badge.textContent : '') + '</small><div class="os-h1"></div><div class="chips">' + chips + '</div></div>' +
      '<div class="pin os-tags"></div>' +
      '<button type="button" class="pin os-play" hidden><span aria-hidden="true">&#9654;</span> Play trailer</button>' +
    '</div>' +
    '<div class="os-mb"></div>' +
    '<div class="keys os-keys" role="group" aria-label="Parts"><span class="track" aria-hidden="true"><i></i></span>' +
      B.groups.map(function(g, i){ var c = g.end - g.start + 1; return '<button type="button" class="key" data-g="' + i + '" tabindex="-1"><span class="rt">' + g.t + '</span><span class="rs">' + (i ? c + (c > 1 ? ' parts' : ' part') : 'Intro') + '</span></button>'; }).join('') +
    '</div>' +
    '<p class="sr os-live" aria-live="polite"></p>';
  nav.parentNode.insertBefore(main, nav.nextSibling);
  main.parentNode.insertBefore(det, main.nextSibling);
  main.querySelector('.os-h1').appendChild(h1); h1.classList.remove('reveal'); h1.classList.add('visible');
  var bub = el('div', 'bub os-bub', '<p class="h"><span class="bh"></span><span class="bp"></span></p><div class="t" tabindex="-1"></div><dl class="os-stats" hidden></dl>' +
    '<div class="nav"><button type="button" data-step="-1"><span aria-hidden="true">&larr;</span> Back</button><span class="dots" aria-hidden="true"></span><button type="button" data-step="1">Next <span aria-hidden="true">&rarr;</span></button></div>');
  bub.id = 'os-bubble';
  ui = {main:main, host:main.querySelector('.os-st'), mb:main.querySelector('.os-mb'), bub:bub, keys:[].slice.call(main.querySelectorAll('.key')),
    trk:main.querySelector('.track i'), live:main.querySelector('.os-live'), tp:main.querySelector('.os-tp'), tags:main.querySelector('.os-tags'),
    play:main.querySelector('.os-play'), back:back, h1:h1};
  /* bubble nav, strip, keyboard */
  bub.querySelectorAll('[data-step]').forEach(function(b){ b.addEventListener('click', function(){ go(cur + +b.getAttribute('data-step'), true); }); });
  ui.keys.forEach(function(k, i){
    k.addEventListener('click', function(){ go(B.groups[i].start, true); });
    k.addEventListener('keydown', function(e){
      var j = null, n = ui.keys.length;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % n;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + n) % n;
      else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = n - 1;
      if (j !== null){ e.preventDefault(); ui.keys[j].focus({preventScroll:true}); go(B.groups[j].start, true); }
    });
  });
  ui.host.addEventListener('keydown', function(e){
    if (e.target.closest('.os-tags, .os-play')) return;
    if (e.key === 'ArrowRight'){ e.preventDefault(); go(cur + 1, true); } else if (e.key === 'ArrowLeft'){ e.preventDefault(); go(cur - 1, true); }
  });
  ui.play.addEventListener('click', function(){ if (api) api.trailer(); });
  back.addEventListener('click', function(e){
    if (!api || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault(); api.leave(back.getAttribute('href'));
  });
}

/* ------------------------------ beats: bubble, strip, tags ------------------------------ */
function fill(i){
  var b = B.beats[i], g = B.groups[b.g], bub = ui.bub, n = g.end - g.start + 1;
  bub.querySelector('.bh').textContent = b.h;
  bub.querySelector('.bp').textContent = n > 1 ? (i - g.start + 1) + ' / ' + n : '';
  bub.querySelector('.t').innerHTML = '<p>' + b.html + '</p>';
  bub.querySelector('.t').scrollTop = 0;
  var st = bub.querySelector('.os-stats');
  st.hidden = !b.stats; st.innerHTML = b.stats ? b.stats.map(function(s){ return '<div><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>'; }).join('') : '';
  bub.querySelector('.dots').innerHTML = n > 1 ? Array.apply(null, Array(n)).map(function(_, k){ return '<i' + (g.start + k === i ? ' class="on"' : '') + '></i>'; }).join('') : '';
  bub.querySelector('[data-step="-1"]').disabled = i === 0;
  bub.querySelector('[data-step="1"]').disabled = i === B.beats.length - 1;
  ui.tags.innerHTML = b.links.map(function(l){ return '<a class="mk-chip" href="' + l.href + '"' + (l.ext ? ' target="_blank" rel="noopener"' : '') + '>' + l.t + ' <span aria-hidden="true">' + (l.ext ? '&#8599;' : '&rarr;') + '</span></a>'; }).join('');
  ui.tags.hidden = !b.links.length;
  ui.keys.forEach(function(k, j){
    var on = j === b.g; k.tabIndex = on ? 0 : -1; k.classList.toggle('on', on);
    if (on){ k.setAttribute('aria-current', 'true'); k.setAttribute('aria-describedby', 'os-bubble'); } else { k.removeAttribute('aria-current'); k.removeAttribute('aria-describedby'); }
  });
  var kk = ui.keys[b.g]; ui.trk.style.left = (kk.offsetLeft + kk.offsetWidth/2) + 'px';
  if (kk.parentNode.scrollWidth > kk.parentNode.clientWidth) kk.parentNode.scrollLeft = kk.offsetLeft - (kk.parentNode.clientWidth - kk.offsetWidth)/2;
}
function go(i, user){
  if (!B || i < 0 || i >= B.beats.length || (api && api.busy())) return;
  var same = i === cur; cur = i; fill(i);
  if (user && !same){ var b = B.beats[i], g = B.groups[b.g]; ui.live.textContent = 'Part ' + (i + 1) + ' of ' + B.beats.length + ': ' + b.h + (b.h !== g.t ? ', ' + g.t : ''); }
  if (api) api.beat(i, user && !same);
}

/* ------------------------------ 3D ------------------------------ */
function shotOf(m){ return m ? {p:[-.25, .85, 5.9], l:[-.1, 1.5, 0], fov:50} : {p:[-.45, .78, 5.6], l:[-.1, 1.6, 0], fov:40}; }
function build(start){
  var host = ui.host, m = host.clientWidth < PHONE, w = host.clientWidth;
  var h = m ? 330 : Math.round(clamp(w * .47, 440, 600));
  host.style.height = h + 'px';
  var sh = shotOf(m), st = GB.Stage(host, w, h, {fov:sh.fov, k:1, sun:[-4, 9, 7], sb:9, fs:40});
  if (!st) return null;
  var T = st.T, M = st.M, S = st.S, clock = new GB.Clock(), busy = false, pushedIn = false;
  var V = function(a){ return new T.Vector3(a[0], a[1], a[2]); };
  st.box(16, 5.2, .3, M.wall, 0, 2.6, -.3);
  st.box(.3, 4.2, 2.0, M.wall, -5.2, 2.1, 1.0);
  st.box(.3, 4.2, 2.0, M.wall, 5.4, 2.1, 1.0);
  /* screens: the main one, plus a smaller one beside it when a beat has two captures */
  var FX = m ? .5 : 1.35, FY = m ? 1.85 : 1.72, SW = m ? 2.7 : 3.4;
  var L1 = [{x:FX, y:FY, w:SW}], L2 = m ? [{x:-.2, y:FY + .15, w:2.0}, {x:1.85, y:FY - .05, w:1.4}] : [{x:.35, y:FY + .05, w:2.6}, {x:2.75, y:FY - .2, w:1.75}];
  function mkScreen(){
    var g = new T.Group(); S.add(g);
    var frame = st.box(1, 1, .1, M.dark, 0, 0, -.06, g);
    var mat = new T.MeshBasicMaterial({color:0x2A2E31}), pl = new T.Mesh(new T.PlaneGeometry(1, 1), mat); pl.position.z = .002; g.add(pl);
    var sel = new T.Group(); sel.position.z = -.06; g.add(sel);
    return {g:g, frame:frame, pl:pl, mat:mat, sel:sel, w:1, ar:16/9, src:'', lay:null};
  }
  var scr = [mkScreen(), mkScreen()];
  function selLines(s){
    while (s.sel.children.length){ var o = s.sel.children.pop(); o.geometry.dispose(); }
    var sh2 = s.w/(16/9);
    s.sel.add(new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(s.w + .3, sh2 + .3, .16)), new T.LineBasicMaterial({color:0x2BD957})));
    s.sel.add(new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(s.w + .36, sh2 + .36, .16)), new T.LineBasicMaterial({color:0x15181B})));
  }
  function place(s, l){
    s.lay = l; s.w = l.w; s.g.position.set(l.x, l.y, 0);
    var sh2 = l.w/(16/9); s.frame.scale.set(l.w + .16, sh2 + .16, 1);
    var iw = s.ar >= 16/9 ? l.w : sh2*s.ar, ih = s.ar >= 16/9 ? l.w/s.ar : sh2; s.pl.scale.set(iw, ih, 1); s.iw = iw; s.ih = ih;
    selLines(s);
  }
  function setImg(s, c){
    if (!c || !c.img){ s.mat.map = null; s.mat.color.set(0x2A2E31); s.mat.needsUpdate = true; s.src = ''; return; }
    if (s.src === c.img + (c.px ? '#px' : '')) return;
    s.src = c.img + (c.px ? '#px' : '');
    var t = st.tex(c.img, c.px), key = s.src;
    function ready(){ if (s.src !== key || !t.image) return; s.ar = t.image.width/t.image.height; s.mat.map = t; s.mat.color.set(0xffffff); s.mat.needsUpdate = true; if (s.lay) place(s, s.lay); st.render(); }
    if (t.image && t.image.width) ready(); else t.__wait.push(ready);
  }
  /* the stand and the guide, left of the screen (the gallery's bays put the stand in the same place) */
  var GX = m ? -1.05 : -2.15, GZ = m ? 1.6 : 1.35, GS = m ? 1.1 : 1.15, H = GB.STAND_H, ZOUT = 2.45;
  GB.stand(T, S, GX, GZ);
  st.box(SW*.62, .32, .9, M.prop, FX, .16, .6);
  var plr = GB.capsule(T, M.white, GS), bd = plr.userData.body; S.add(plr);
  function onStand(){ plr.position.set(GX, H, GZ); plr.rotation.y = .35; bd.position.y = 0; bd.rotation.x = 0; }
  /* pinned HTML: placard, bubble (desktop), link tags, trailer button, clip overlays */
  var bub = ui.bub, tp = ui.tp, tags = ui.tags, play = ui.play;
  if (m) ui.mb.appendChild(bub); else host.appendChild(bub);
  bub.classList.toggle('pin', !m); bub.style.transform = ''; bub.style.width = '';
  var ovs = [0, 1].map(function(k){ var o = el('div', 'pin vov', ''); o.setAttribute('aria-hidden', 'true'); o.hidden = true; host.insertBefore(o, tp); return o; });
  var yt = el('div', 'pin os-yt', ''); yt.hidden = true; host.insertBefore(yt, tp);
  var cn = [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()];
  function rectOf(s, proj){
    var p = s.g.position, a0 = p.x - s.iw/2, a1 = p.x + s.iw/2, y0 = p.y - s.ih/2, y1 = p.y + s.ih/2;
    cn[0].set(a0, y0, .01); cn[1].set(a1, y0, .01); cn[2].set(a0, y1, .01); cn[3].set(a1, y1, .01);
    var ps = cn.map(proj), xs = ps.map(function(q){ return q[0]; }), ys = ps.map(function(q){ return q[1]; });
    return {x:Math.min.apply(null, xs), y:Math.min.apply(null, ys), w:Math.max.apply(null, xs) - Math.min.apply(null, xs), h:Math.max.apply(null, ys) - Math.min.apply(null, ys)};
  }
  function fit(e, r){ e.style.transform = 'translate(' + r.x.toFixed(1) + 'px,' + r.y.toFixed(1) + 'px)'; e.style.width = r.w.toFixed(1) + 'px'; e.style.height = r.h.toFixed(1) + 'px'; }
  var bubOn = false, head = new T.Vector3();
  st.pin(tp, null, 0, 0, {rect:function(proj){
    var s = scr[0], p = s.g.position, two = scr[1].g.visible, rx = two ? scr[1].g.position.x + scr[1].w/2 : p.x + s.w/2;
    var q = proj(new T.Vector3(rx + .08, p.y + s.w/(16/9)/2 + .12, 0)), tw = tp.offsetWidth, th = tp.offsetHeight;
    tp.style.transform = 'translate(' + clamp(q[0] - tw, 8, w - tw - 8).toFixed(1) + 'px,' + Math.max(8, q[1] - th).toFixed(1) + 'px)';
  }});
  st.pin(tags, null, 0, 0, {rect:function(proj){
    var s = scr[0], p = s.g.position, q = proj(new T.Vector3(p.x - s.w/2 - .08, p.y - s.w/(16/9)/2 - .1, 0));
    tags.style.transform = 'translate(' + Math.max(8, q[0]).toFixed(1) + 'px,' + Math.min(h - tags.offsetHeight - 6, q[1] + 4).toFixed(1) + 'px)';
  }});
  st.pin(play, null, 0, 0, {rect:function(proj){ var r = rectOf(scr[0], proj); play.style.transform = 'translate(' + (r.x + r.w/2 - play.offsetWidth/2).toFixed(1) + 'px,' + (r.y + r.h/2 - play.offsetHeight/2).toFixed(1) + 'px)'; }});
  st.pin(yt, null, 0, 0, {rect:function(proj){ fit(yt, rectOf(scr[0], proj)); }});
  ovs.forEach(function(o, k){ st.pin(o, null, 0, 0, {rect:function(proj){ if (scr[k].g.visible) fit(o, rectOf(scr[k], proj)); }}); });
  if (!m) st.pin(bub, null, 0, 0, {rect:function(proj){
    var hd = proj(head.set(plr.position.x, plr.position.y + GS*1.02, plr.position.z)), s = scr[0];
    var fl = proj(new T.Vector3(s.g.position.x - s.w/2 - .15, s.g.position.y, 0));
    var x0 = Math.max(10, hd[0] - 150);
    bub.style.width = Math.max(300, Math.min(500, fl[0] - x0)) + 'px';
    var t = bub.querySelector('.t'); t.style.maxHeight = Math.max(120, hd[1] - 18 - 10 - (bub.offsetHeight - t.offsetHeight)) + 'px';
    var bw = bub.offsetWidth, bh = bub.offsetHeight;
    bub.style.transform = 'translate(' + clamp(x0, 10, w - bw - 10).toFixed(1) + 'px,' + Math.max(10, hd[1] - bh - 18).toFixed(1) + 'px)';
    bub.style.setProperty('--tail', clamp(hd[0] - clamp(x0, 10, w - bw - 10) - 7, 14, bw - 30) + 'px');
  }});
  function placeTail(){ if (!m) return; var hd = st.proj(head.set(plr.position.x + .1, plr.position.y + GS*1.02, plr.position.z)); bub.style.setProperty('--tail', clamp(hd[0] - 12, 16, w - 40) + 'px'); }
  /* clips: an HTML video over the still, only for the shown beat */
  function showClips(b){
    b.caps.forEach(function(c, k){
      var o = ovs[k]; if (!c.clip){ o.hidden = true; o.innerHTML = ''; return; }
      if (o.getAttribute('data-src') !== c.clip){
        o.setAttribute('data-src', c.clip); o.classList.toggle('px', !!c.px);
        o.innerHTML = '<video src="' + c.clip + '" poster="' + c.img + '" muted loop playsinline preload="' + (RM ? 'none' : 'auto') + '"' + (RM ? ' controls' : ' autoplay') + ' disablepictureinpicture></video>';
        if (RM) o.removeAttribute('aria-hidden');
      }
      o.hidden = false; var v = o.querySelector('video'); if (v && !RM){ v.muted = true; var pr = v.play(); if (pr && pr.catch) pr.catch(function(){}); }
    });
    for (var k = b.caps.length; k < 2; k++){ ovs[k].hidden = true; ovs[k].innerHTML = ''; ovs[k].removeAttribute('data-src'); }
  }
  function hideClips(){ ovs.forEach(function(o){ o.hidden = true; var v = o.querySelector('video'); if (v) v.pause(); }); }
  function stopTrailer(){ yt.hidden = true; yt.innerHTML = ''; }
  function setBeat(i){
    var b = B.beats[i], two = b.caps.length > 1;
    scr[1].g.visible = two;
    place(scr[0], two ? L2[0] : L1[0]); if (two) place(scr[1], L2[1]);
    setImg(scr[0], b.caps[0]); setImg(scr[1], two ? b.caps[1] : null);
    stopTrailer(); play.hidden = !b.yt;
  }
  /* camera */
  var shot = {p:V(sh.p), l:V(sh.l)}, tpv = new T.Vector3(), tl = new T.Vector3();
  function inside(){
    var s = scr[0], half = Math.tan(sh.fov*Math.PI/360), asp = w/h, sh2 = s.w/(16/9), p = s.g.position;
    var d = Math.max((sh2/2 + .12)/half, (s.w/2 + .12)/(half*asp));
    return {p:new T.Vector3(p.x, p.y, d + .03), l:new T.Vector3(p.x, p.y, 0)};
  }
  function tweenCam(a, b, dur, done){ return clock.add(dur, function(q){ var e = eio(q); tpv.copy(a.p).lerp(b.p, e); tl.copy(a.l).lerp(b.l, e); st.setCam(tpv, tl); st.render(); }, done); }
  /* the guide walks in from off screen (left), in front of the divider, and steps up onto the stand */
  function walkIn(delay, done){
    var a = {x:GX - (m ? 3.4 : 5.2), z:m ? GZ : ZOUT}, pts = m ? [a, {x:GX, z:GZ}] : [a, {x:GX, z:ZOUT}, {x:GX, z:GZ}], segs = [], tot = 0;
    for (var k = 1; k < pts.length; k++){ var d = Math.hypot(pts[k].x - pts[k-1].x, pts[k].z - pts[k-1].z); segs.push({a:pts[k-1], b:pts[k], d:d, s:tot}); tot += d; }
    plr.position.set(a.x, .02, a.z); bd.position.y = 0;
    var dur = 1.5 + delay;
    return clock.add(dur, function(q){
      var t = clamp((q*dur - delay)/1.5, 0, 1), wq = clamp(t/.84, 0, 1), up = clamp((t - .8)/.2, 0, 1), dist = eio(wq)*tot, sg = segs[segs.length - 1];
      for (var k = 0; k < segs.length; k++){ if (dist <= segs[k].s + segs[k].d){ sg = segs[k]; break; } }
      var f = clamp((dist - sg.s)/sg.d, 0, 1), ry = Math.atan2(sg.b.x - sg.a.x, sg.b.z - sg.a.z);
      plr.position.set(lerp(sg.a.x, sg.b.x, f), .02 + (H - .02)*up, lerp(sg.a.z, sg.b.z, f));
      plr.rotation.y = up > 0 ? lerp(ry, .35, up) : ry;
      bd.position.y = t < .8 ? Math.abs(Math.sin(dist*1.6))*.07 : Math.sin(up*Math.PI)*.1; bd.rotation.x = t > 0 && t < .8 ? .15 : 0;
      st.render(); placeTail();
    }, function(){ onStand(); st.render(); if (done) done(); });
  }
  function showBubble(){ bubOn = true; bub.hidden = false; if (!RM) GB.restart(bub); showClips(B.beats[cur]); st.render(); placeTail(); }
  function hideBubble(){ bubOn = false; if (!m) bub.hidden = true; }
  /* arrive: from the gallery (start inside the screen and pull out), from a direct link (walk in), or cut */
  function arrive(mode, done){
    setBeat(cur);
    if (RM || mode === 'cut'){ st.setCam(shot.p, shot.l); onStand(); showBubble(); if (done) done(); return; }
    busy = true; hideBubble(); hideClips(); host.classList.add('os-busy');
    var fin = function(){ busy = false; host.classList.remove('os-busy'); showBubble(); if (done) done(); };
    if (mode === 'gallery'){ var ins = inside(); st.setCam(ins.p, ins.l); st.render(); tweenCam(ins, shot, 1.1); walkIn(.45, fin); }
    else { st.setCam(shot.p, shot.l); walkIn(0, fin); }
  }
  /* All projects: push into the screen, then load the gallery (it pulls back out) */
  function leave(href){
    clock.killAll();   /* leaving mid walk-in is fine: the push starts from wherever the camera is */
    try { sessionStorage.setItem(RET, SEC); } catch(e){}
    if (RM){ location.href = href; return; }
    busy = true; hideBubble(); hideClips(); stopTrailer(); host.classList.add('os-busy');
    pushedIn = true;
    tweenCam({p:st.cam.position.clone(), l:st.look.clone()}, inside(), .6, function(){ location.href = href; });
  }
  function pageshow(){ if (!pushedIn) return; pushedIn = false; busy = true; var ins = inside(); tweenCam(ins, shot, .6, function(){ busy = false; host.classList.remove('os-busy'); showBubble(); }); }
  function beat(i, hop){
    setBeat(i); if (bubOn) showClips(B.beats[i]);
    if (hop && !RM){ if (bubOn) GB.restart(bub); clock.add(.32, function(q){ bd.position.y = Math.sin(q*Math.PI)*.12; st.render(); }); }
    st.render();
  }
  function trailer(){
    var b = B.beats[cur]; if (!b.yt) return;
    play.hidden = true; ovs[0].hidden = true;
    yt.innerHTML = '<iframe src="' + b.yt.src + (b.yt.src.indexOf('?') < 0 ? '?' : '&') + 'autoplay=1" title="' + b.yt.t + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    yt.hidden = false; st.render(); var f = yt.querySelector('iframe'); if (f) f.focus();
  }
  st.setCam(shot.p, shot.l); onStand(); setBeat(cur); st.render();
  return {m:m, w:host.clientWidth, arrive:arrive, leave:leave, pageshow:pageshow, beat:beat, trailer:trailer, busy:function(){ return busy; },
    dispose:function(){ clock.killAll(); hideClips(); stopTrailer(); ovs.forEach(function(o){ o.remove(); }); yt.remove(); st.dispose(); }};
}

/* ------------------------------ boot ------------------------------ */
function unwait(){ if (!root.classList.contains('os-wait')) return; root.classList.remove('os-wait'); if (!built && window.planFocus) window.planFocus(); }
function startBeat(){
  if (!hashEl) return 0;
  for (var g = 0; g < B.groups.length; g++) if (B.groups[g].id === hashEl.id) return B.groups[g].start;
  return 0;
}
function upgrade(){
  if (built || FLAT || !window.THREE || GB.glOK() === false || !SEC) return false;
  if (!GB.renderer()) return false;   /* no WebGL: the plain page stays */
  try {
    B = parse(); cur = startBeat();
    buildDOM(); root.classList.remove('os-wait'); fill(cur);   /* visible first: the stage is measured */
    api = build();
    if (!api){ throw new Error('no WebGL'); }
  } catch(e){
    if (window.console) console.error(e);
    try { sessionStorage.setItem('os-failed', '1'); } catch(_){}
    location.reload(); return false;   /* the DOM was rearranged: reload once as the plain page */
  }
  built = true; root.classList.add('os-on'); root.classList.remove('os-wait');
  window.scrollTo(0, 0);
  root.setAttribute('data-os-arrive', RM ? 'cut' : fromGallery ? 'gallery' : 'walk');   /* read by tests */
  api.arrive(fromGallery ? 'gallery' : 'walk');
  if (wantFocus){
    var t = hashEl && cur > 0 ? ui.keys[B.beats[cur].g] : ui.h1;
    ui.h1.tabIndex = -1;
    var f = function(){ setTimeout(function(){ t.focus({preventScroll:true}); window.scrollTo(0, 0); }, 0); };
    if (document.readyState === 'complete') f(); else window.addEventListener('load', f, {once:true});
  }
  /* the phone shot is a breakpoint: rebuild on width changes (not height) */
  var rt = 0;
  window.addEventListener('resize', function(){
    clearTimeout(rt); rt = setTimeout(function(){
      if (!api || ui.host.clientWidth === api.w || api.busy()) return;
      api.dispose(); api = build(); if (api) api.arrive('cut'); fill(cur);
    }, 150);
  });
  window.addEventListener('pageshow', function(e){ if (e.persisted && api) api.pageshow(); });
  return true;
}
function boot(){
  if (!SEC) return;
  var failed = null; try { failed = sessionStorage.getItem('os-failed'); sessionStorage.removeItem('os-failed'); } catch(e){}
  if (failed){ unwait(); return; }
  /* no WebGL possible, or ?flat: the plain page, at once */
  if (FLAT || !window.WebGLRenderingContext){ unwait(); return; }
  if (!upgrade()){
    document.addEventListener('three-ready', function(){ if (!upgrade()) unwait(); });
    document.addEventListener('three-failed', unwait);
    setTimeout(unwait, 4000);
  }
}
boot();
})();
