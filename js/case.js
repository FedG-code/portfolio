/* js/case.js: a project's case, told in the gallery's own scene ("On Set", direction C; one page, user 2026-11-09).
   Learn more pushes the camera into the bay's screen; the case opens there and the camera pulls back out to a low
   shot of the same bay while the guide walks in from off screen onto the bay's stand. The guide then tells the case in
   its bubble, one paragraph per part (Back / Next, dots), and the screen shows that part's capture. The section bar
   becomes the case bar ("← All projects" + the parts). "All projects" pushes back into the screen, pulls out to the
   gallery shot, and the guide steps off the stand and walks to its spot.
   - The text comes from the project's own HTML file (fetched and parsed; scripts in it don't run). Those files stay
     the plain pages for no WebGL / ?flat and redirect to index.html#<id>/case otherwise.
   - URL: index.html#<id>/case (University: #university-projects/case/<game>). Browser Back closes the case.
   - Gallery hands over its scene through X (see G.cs in gallery.js). */
(function(){
'use strict';
var GB = window.Greybox, clamp = GB.clamp, lerp = GB.lerp, eio = GB.eio, el = GB.el;

/* ------------------------------ the case's text, from the project file ------------------------------ */
var cache = {};
function load(p){
  var file = p.href.split('#')[0];
  if (!cache[file]) cache[file] = fetch(file).then(function(r){ if (!r.ok) throw new Error(file + ' ' + r.status); return r.text(); })
    .then(function(t){ return parse(new DOMParser().parseFromString(t, 'text/html'), p); });
  cache[file].catch(function(){ delete cache[file]; });
  return cache[file];
}
function capOf(n){
  if (n.matches('video[data-src]')) return {img:n.getAttribute('poster'), clip:n.getAttribute('data-src'), sound:n.hasAttribute('data-sound'), t:n.getAttribute('aria-label') || ''};
  if (n.matches('img')) return {img:n.getAttribute('src')};
  return null;
}
function parse(doc, p){
  var beats = [], groups = [], pageLinks = [];
  var secs = [].slice.call(doc.querySelectorAll('.project-section'));
  var mode = secs.filter(function(s){ return s.querySelector('.section-heading'); }).length > 1 ? 'h2' : 'h4';
  var itemOf = function(id){ var k = null; (p.items || []).forEach(function(it, j){ if (it.href.split('#')[1] === id) k = j; }); return k; };
  var desc = doc.querySelector('.project-hero-desc');
  groups.push({t:'Overview', start:0, item:null});
  /* the overview shows what the gallery screen showed, so the push in and the pull out are one shot */
  beats.push({g:0, h:'Overview', html:desc ? desc.innerHTML.trim() : '', caps:[{img:p.img, clip:p.clip, px:p.px}], stats:null, links:[], yt:null, item:null});
  secs.forEach(function(sec){
    var h2 = sec.querySelector('.section-heading'), t2 = h2 ? h2.textContent.trim() : '', mine = [], links = [], caps = null, h4 = '', item = itemOf(sec.id);
    sec.querySelectorAll('.project-link').forEach(function(a){ links.push({href:a.getAttribute('href'), t:a.textContent.replace(/[→↗]/g, '').trim(), ext:a.target === '_blank'}); });
    var emb = sec.querySelector('.video-embed iframe');
    var yt = emb ? {src:emb.getAttribute('src'), t:emb.getAttribute('title') || 'Trailer'} : null;
    sec.querySelectorAll('.project-content').forEach(function(blk){
      var found = [];
      blk.querySelectorAll('video[data-src], img.work-image').forEach(function(n){ if (!n.closest('.project-text')){ var c = capOf(n); if (c) found.push(c); } });
      if (found.length) caps = found.slice(0, 2);
      var txt = blk.querySelector('div.project-text'), last = null;
      if (!txt) return;
      [].slice.call(txt.children).forEach(function(n){
        if (n.tagName === 'H4'){ h4 = n.textContent.trim(); return; }
        if (n.tagName === 'P' && n.textContent.trim()){
          var gk = mode === 'h2' ? t2 : (h4 || t2);
          if (groups[groups.length - 1].t !== gk) groups.push({t:gk, start:beats.length, item:item});
          last = {g:groups.length - 1, h:mode === 'h2' ? (h4 || t2) : gk, html:n.innerHTML.trim(), caps:caps, stats:null, links:links, yt:null, item:item};
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
  beats.forEach(function(b, i){ if (!b.caps) b.caps = beats[i - 1].caps; if (pageLinks.length) b.links = b.links.concat(pageLinks); });
  groups.forEach(function(g, i){ g.end = (i + 1 < groups.length ? groups[i + 1].start : beats.length) - 1; });
  return {beats:beats, groups:groups};
}

/* ------------------------------ the case mode ------------------------------ */
window.CaseMode = function(X){
  var st = X.st, T = X.T, clock = X.clock, host = X.host, m = X.m, plr = X.plr, bd = X.body, RM = X.RM, H = GB.STAND_H;
  var on = false, S = -1, p = null, sec = null, D = null, cur = 0, busy = false, dead = false, pushedState = false, trailerOn = false, tw = null;
  var order = null, slots = null, split = false, mainScr = null, look = new T.Vector3();

  /* UI: bubble, link tags, trailer button + player + close, two clip overlays */
  var bub = el('div', 'bub cbub', '<p class="h"><span class="bh"></span><span class="bp"></span></p><div class="t"></div><dl class="cstats" hidden></dl>' +
    '<div class="nav"><button type="button" data-step="-1"><span aria-hidden="true">&larr;</span> Back</button><span class="dots" aria-hidden="true"></span><button type="button" data-step="1">Next <span aria-hidden="true">&rarr;</span></button></div>');
  bub.id = 'case-bubble'; bub.hidden = true;
  var tags = el('div', 'pin ctags', ''), play = el('button', 'pin cplay', '<span aria-hidden="true">&#9654;</span> Play trailer');
  var yt = el('div', 'pin cyt', ''), close = el('button', 'pin cclose', 'Close trailer <span aria-hidden="true">&times;</span>');
  var ovs = [el('div', 'pin vov', ''), el('div', 'pin vov', '')];
  [tags, play, yt, close].concat(ovs).forEach(function(e){ e.hidden = true; host.appendChild(e); });
  ovs.forEach(function(o){ o.setAttribute('aria-hidden', 'true'); });
  if (m) X.cmb.appendChild(bub); else { bub.classList.add('pin'); host.appendChild(bub); }
  bub.querySelectorAll('[data-step]').forEach(function(b){ b.addEventListener('click', function(){ go(cur + +b.getAttribute('data-step'), true); }); });
  play.addEventListener('click', trailer);
  close.addEventListener('click', closeTrailer);
  function onKey(e){ if (e.key === 'Escape' && trailerOn){ e.preventDefault(); closeTrailer(); } }
  document.addEventListener('keydown', onKey);

  /* the bay's screen shows the part's capture; a two-clip part splits it in two, side by side (Casino: Unity games, sportsbook minis) */
  function setImg(g, src, px){
    var u = g.userData, key = src + (px ? '#px' : '');
    if (u.cur === key) return; u.cur = key;
    var t = st.tex(src, px);
    function ready(){
      if (u.cur !== key || !t.image) return;
      var ar = t.image.width/t.image.height, iw = ar >= 16/9 ? u.w : u.h*ar, ih = ar >= 16/9 ? u.w/ar : u.h;
      u.pl.scale.set(iw/u.iw0, ih/u.ih0, 1); u.iw = iw; u.ih = ih; u.pl.material.map = t; u.pl.material.needsUpdate = true; st.render();
    }
    if (t.image && t.image.width) ready(); else t.__wait.push(ready);
  }
  var cn = [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()];
  function rectOf(g, proj, full){
    var u = g.userData, k = g.scale.x, x = g.position.x, y = g.position.y, iw = (full ? u.w : u.iw)*k, ih = (full ? u.h : u.ih)*k;
    cn[0].set(x - iw/2, y - ih/2, .04); cn[1].set(x + iw/2, y - ih/2, .04); cn[2].set(x - iw/2, y + ih/2, .04); cn[3].set(x + iw/2, y + ih/2, .04);
    var ps = cn.map(proj), xs = ps.map(function(q){ return q[0]; }), ys = ps.map(function(q){ return q[1]; });
    return {x:Math.min.apply(null, xs), y:Math.min.apply(null, ys), w:Math.max.apply(null, xs) - Math.min.apply(null, xs), h:Math.max.apply(null, ys) - Math.min.apply(null, ys)};
  }
  function fit(e, r){ e.style.transform = 'translate(' + r.x.toFixed(1) + 'px,' + r.y.toFixed(1) + 'px)'; e.style.width = r.w.toFixed(1) + 'px'; e.style.height = r.h.toFixed(1) + 'px'; }
  ovs.forEach(function(o, k){ st.pin(o, null, 0, 0, {rect:function(proj){
    if (!mainScr) return;
    if (!split){ if (!k) fit(o, rectOf(mainScr, proj)); return; }
    var r = rectOf(mainScr, proj, true), hw = r.w/2; fit(o, {x:r.x + k*hw, y:r.y, w:hw, h:r.h});
  }}); });
  st.pin(yt, null, 0, 0, {rect:function(proj){ if (mainScr) fit(yt, rectOf(mainScr, proj)); }});
  st.pin(play, null, 0, 0, {rect:function(proj){ if (!mainScr) return; var r = rectOf(mainScr, proj); play.style.transform = 'translate(' + (r.x + r.w/2 - play.offsetWidth/2).toFixed(1) + 'px,' + (r.y + r.h/2 - play.offsetHeight/2).toFixed(1) + 'px)'; }});
  st.pin(close, null, 0, 0, {rect:function(){ close.style.transform = 'translate(' + (X.c.w - close.offsetWidth - 10) + 'px,10px)'; }});
  st.pin(tags, null, 0, 0, {rect:function(proj){
    if (!mainScr) return; var r = rectOf(mainScr, proj, split);
    tags.style.transform = 'translate(' + Math.max(8, r.x).toFixed(1) + 'px,' + Math.min(X.c.h - tags.offsetHeight - 6, r.y + r.h + 10).toFixed(1) + 'px)';
  }});
  /* desktop bubble: left of the screen, above the guide's head, its tail pointing down at it */
  var head = new T.Vector3();
  if (!m) st.pin(bub, null, 0, 0, {rect:function(proj){
    if (!mainScr) return;
    var hd = proj(head.set(plr.position.x, plr.position.y + 1.15, plr.position.z)), r = rectOf(mainScr, proj, split);
    var right = Math.max(r.x - 14, hd[0] + 60), w = clamp(right - 12, 300, 500), x = clamp(right - w, 10, X.c.w - w - 10);
    bub.style.width = w + 'px';
    var t = bub.querySelector('.t'); t.style.maxHeight = Math.max(120, hd[1] - 30 - (bub.offsetHeight - t.offsetHeight)) + 'px';
    bub.style.transform = 'translate(' + x.toFixed(1) + 'px,' + Math.max(10, hd[1] - bub.offsetHeight - 18).toFixed(1) + 'px)';
    bub.style.setProperty('--tail', clamp(hd[0] - x - 7, 14, w - 30) + 'px');
  }});
  function phoneTail(){ if (!m) return; var hd = st.proj(head.set(plr.position.x + .1, plr.position.y + 1.15, plr.position.z)); bub.style.setProperty('--tail', clamp(hd[0] - 12, 16, X.c.w - 40) + 'px'); }

  /* University: three screens; the current game's is big. Clicking a small one swaps it with the big one */
  function setupSlots(){
    if (!p.items){ order = null; slots = null; mainScr = sec.scr[0].sc; return; }
    slots = sec.scr.map(function(o){ return {x:o.scx, y:o.sy, w:o.sw}; });
    if (!sec.base) sec.base = sec.scr.map(function(o){ return o.sw; });
    if (!sec.order) sec.order = sec.scr.map(function(o, k){ return k; });   /* item k sits in slot order[k] (slot 0 = big) */
    order = sec.order;
    slots = [0, 1, 2].map(function(j){ var k = order.indexOf(j), o = sec.scr[k]; return {x:o.scx, y:o.sy, w:o.sw}; });
    mainScr = sec.scr[order.indexOf(0)].sc;
  }
  function rotateTo(k, dur){
    if (!order || order[k] === 0) return;
    var j = order.indexOf(0), a = order[k]; order[k] = 0; order[j] = a;
    [k, j].forEach(function(n){
      var o = sec.scr[n], g = o.sc, to = slots[order[n]], fx = g.position.x, fy = g.position.y, fs = g.scale.x, ts = to.w/sec.base[n];
      o.scx = to.x; o.sy = to.y; o.sw = to.w;
      clock.add(dur, function(q){
        var e = eio(q); g.position.x = lerp(fx, to.x, e); g.position.y = lerp(fy, to.y, e); var sc = lerp(fs, ts, e); g.scale.set(sc, sc, 1);
        /* the selection outline keeps its world-size margin round a grown screen */
        var bw = sec.base[n], bh = bw/(16/9); g.userData.sel.scale.set((bw*sc + .34)/((bw + .34)*sc), (bh*sc + .34)/((bh + .34)*sc), 1);
        st.render();
      });
    });
    sec.scr.forEach(function(o, n){ o.sc.userData.sel.visible = order[n] === 0; });
    mainScr = sec.scr[k].sc; sec.sc = mainScr; sec.scx = slots[0].x; sec.sw = slots[0].w;
  }

  /* camera: the low shot frames the bay from just left of its left divider (room for the bubble) to its right end */
  function lowShot(){
    var left = m ? sec.pad.x - 1.1 : sec.l - 2.2, right = m ? sec.scx + sec.sw/2 + .3 : sec.l + sec.bw - .2;
    var fov = X.c.fov, asp = X.c.w/X.c.h, half = (right - left)/2, d = half/(Math.tan(fov*Math.PI/360)*asp);
    var cx = (left + right)/2;
    /* phone: the guide stands well in front of the wall, so the camera frames it at its own depth */
    if (m) d += sec.pad.z;
    return {p:new T.Vector3(cx + (m ? .1 : .25), m ? 1.3 : .85, d), l:new T.Vector3(cx, m ? 1.7 : 1.6, 0)};
  }
  function inside(){ var k = order ? order.indexOf(0) : 0; return X.pushTarget(S, k); }
  function tweenCam(to, dur, done){
    var fp = st.cam.position.clone(), fl = st.look.clone(), P1 = new T.Vector3(), L1 = new T.Vector3();
    return clock.add(dur, function(q){ var e = eio(q); P1.copy(fp).lerp(to.p, e); L1.copy(fl).lerp(to.l, e); st.setCam(P1, L1); st.render(); }, done);
  }

  /* the guide walks in from off screen (left), in front of the dividers, and steps up onto the stand */
  function walkIn(delay, done){
    var pd = sec.pad, z0 = m ? pd.z : X.ZOUT, a = {x:pd.x - (m ? 3.6 : 5.5), z:z0}, pts = m ? [a, pd] : [a, {x:pd.x, z:z0}, pd], segs = [], tot = 0;
    for (var k = 1; k < pts.length; k++){ var d = Math.hypot(pts[k].x - pts[k-1].x, pts[k].z - pts[k-1].z); segs.push({a:pts[k-1], b:pts[k], d:d, s:tot}); tot += d; }
    plr.position.set(a.x, .02, a.z); bd.position.y = 0;
    var dur = 1.5 + delay;
    return clock.add(dur, function(q){
      var t = clamp((q*dur - delay)/1.5, 0, 1), w = clamp(t/.84, 0, 1), up = clamp((t - .8)/.2, 0, 1), dist = eio(w)*tot, sg = segs[segs.length - 1];
      for (var j = 0; j < segs.length; j++){ if (dist <= segs[j].s + segs[j].d){ sg = segs[j]; break; } }
      var f = clamp((dist - sg.s)/sg.d, 0, 1), ry = Math.atan2(sg.b.x - sg.a.x, sg.b.z - sg.a.z);
      plr.position.set(lerp(sg.a.x, sg.b.x, f), .02 + (H - .02)*up, lerp(sg.a.z, sg.b.z, f));
      plr.rotation.y = up > 0 ? lerp(ry, .35, up) : ry;
      bd.position.y = t < .8 ? Math.abs(Math.sin(dist*1.6))*.07 : Math.sin(up*Math.PI)*.1; bd.rotation.x = t > 0 && t < .8 ? .15 : 0;
      st.render(); phoneTail();
    }, function(){ onStand(); if (done) done(); });
  }
  function onStand(){ plr.position.set(sec.pad.x, H, sec.pad.z); plr.rotation.y = .35; bd.position.y = 0; bd.rotation.x = 0; st.render(); }

  /* ------------------------------ the case bar ------------------------------ */
  var keys = [];
  function buildBar(){
    X.ckeys.innerHTML = '<button type="button" class="key cback"><span class="rt"><span aria-hidden="true">&larr;</span> All projects</span><span class="rs">Back to the gallery</span></button>' +
      D.groups.map(function(g, i){ var c = g.end - g.start + 1; return '<button type="button" class="key" data-g="' + i + '" tabindex="-1"><span class="rt">' + g.t + '</span><span class="rs">' + (i ? c + (c > 1 ? ' parts' : ' part') : p.t) + '</span></button>'; }).join('');
    var all = [].slice.call(X.ckeys.querySelectorAll('.key'));
    keys = all.slice(1);
    all[0].addEventListener('click', function(){ leave(); });
    keys.forEach(function(k, i){ k.addEventListener('click', function(){ go(D.groups[i].start, true); }); });
    all.forEach(function(k, i){
      k.addEventListener('keydown', function(e){
        var j = null, n = all.length;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = Math.min(n - 1, i + 1);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = Math.max(0, i - 1);
        else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = n - 1;
        if (j === null) return;
        e.preventDefault(); all[j].focus({preventScroll:true});
        if (j > 0) go(D.groups[j - 1].start, true); else all.forEach(function(a, q){ a.tabIndex = q ? -1 : 0; });
      });
    });
  }
  function fill(i){
    var b = D.beats[i], g = D.groups[b.g], n = g.end - g.start + 1;
    bub.querySelector('.bh').textContent = b.h;
    bub.querySelector('.bp').textContent = n > 1 ? (i - g.start + 1) + ' / ' + n : '';
    var t = bub.querySelector('.t'); t.innerHTML = '<p>' + b.html + '</p>'; t.scrollTop = 0;
    var sd = bub.querySelector('.cstats'); sd.hidden = !b.stats;
    sd.innerHTML = b.stats ? b.stats.map(function(s){ return '<div><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>'; }).join('') : '';
    bub.querySelector('.dots').innerHTML = n > 1 ? Array.apply(null, Array(n)).map(function(_, k){ return '<i' + (g.start + k === i ? ' class="on"' : '') + '></i>'; }).join('') : '';
    bub.querySelector('[data-step="-1"]').disabled = i === 0;
    bub.querySelector('[data-step="1"]').disabled = i === D.beats.length - 1;
    tags.innerHTML = b.links.map(function(l){ return '<a class="mk-chip" href="' + l.href + '"' + (l.ext ? ' target="_blank" rel="noopener"' : '') + '>' + l.t + ' <span aria-hidden="true">' + (l.ext ? '&#8599;' : '&rarr;') + '</span></a>'; }).join('');
    keys.forEach(function(k, j){
      var o = j === b.g; k.tabIndex = o ? 0 : -1; k.classList.toggle('on', o);
      if (o){ k.setAttribute('aria-current', 'true'); k.setAttribute('aria-describedby', 'case-bubble'); } else { k.removeAttribute('aria-current'); k.removeAttribute('aria-describedby'); }
    });
    X.ckeys.querySelector('.cback').tabIndex = -1;
    var kk = keys[b.g]; if (kk && X.ckeys.scrollWidth > X.ckeys.clientWidth) X.ckeys.scrollLeft = kk.offsetLeft - (X.ckeys.clientWidth - kk.offsetWidth)/2;
  }
  /* the screens and overlays for part i (no camera move) */
  function show(i, talk){
    var b = D.beats[i];
    if (order && b.item != null) rotateTo(b.item, RM ? 0 : .45);
    if (!order){
      var c0 = b.caps[0];
      setSplit(talk && b.caps.length > 1);
      if (c0) setImg(mainScr, c0.img, c0.px);
    }
    tags.hidden = !talk || !b.links.length;
    var sv = !b.yt && snd(b);
    play.hidden = !talk || !(b.yt || sv);
    if (!play.hidden){ play.lastChild.textContent = b.yt ? ' Play trailer' : ' Play with sound'; close.firstChild.textContent = b.yt ? 'Close trailer ' : 'Close video '; }
    clips(talk ? b : null);
    st.render();
  }
  /* split: the still is hidden and the two halves (overlays, clip or still each) fill the screen's frame */
  function setSplit(on2){
    split = !!on2; if (mainScr) mainScr.userData.pl.visible = !split;
    ovs.forEach(function(o){ o.classList.toggle('half', split); });
  }
  /* the part's clip with sound (Rally): Play shows it zoomed in, with sound */
  function snd(b){ var c = null; (b.caps || []).forEach(function(q){ if (q.sound && !c) c = q; }); return c; }
  function clips(b){
    ovs.forEach(function(o, k){
      var c = !b ? null : !order ? b.caps[k] : k ? null : p.items[order.indexOf(0)];
      if (c && !c.clip && split){ if (o.getAttribute('data-src') !== c.img){ o.setAttribute('data-src', c.img); o.innerHTML = '<img src="' + c.img + '" alt="">'; } o.hidden = false; return; }
      if (!c || !c.clip){ o.hidden = true; var v0 = o.querySelector('video'); if (v0) v0.pause(); return; }
      if (o.getAttribute('data-src') !== c.clip){
        o.setAttribute('data-src', c.clip); o.classList.toggle('px', !!c.px);
        o.innerHTML = '<video src="' + c.clip + '" poster="' + c.img + '" muted loop playsinline preload="' + (RM ? 'none' : 'auto') + '"' + (RM ? ' controls' : ' autoplay') + ' disablepictureinpicture></video>';
      }
      o.hidden = false; o.classList.toggle('ctl', RM);
      var v = o.querySelector('video'); if (v && !RM){ v.muted = true; var pr = v.play(); if (pr && pr.catch) pr.catch(function(){}); }
    });
  }
  function talk(){ var was = !bub.hidden; bub.hidden = false; if (!RM && !was) GB.restart(bub); show(cur, true); phoneTail(); }
  function quiet(){ if (!m) bub.hidden = true; tags.hidden = true; play.hidden = true; clips(null); setSplit(false); }

  function go(i, user){
    if (!on || busy || trailerOn || i < 0 || i >= D.beats.length) return;
    var same = i === cur, gi = D.beats[i].g; cur = i; fill(i); show(i, true);
    if (user && !same){
      var b = D.beats[i], g = D.groups[gi];
      X.live.textContent = 'Part ' + (i + 1) + ' of ' + D.beats.length + ': ' + b.h + (b.h !== g.t ? ', ' + g.t : '');
      if (!RM){ GB.restart(bub); clock.add(.32, function(q){ bd.position.y = Math.sin(q*Math.PI)*.12; st.render(); }); }
      if (p.items){ var it = D.groups[gi].item; try { history.replaceState(history.state, '', '#' + p.id + '/case' + (it != null ? '/' + p.items[it].href.split('#')[1] : '')); } catch(e){} }
    }
  }

  /* ------------------------------ open / close ------------------------------ */
  function enter(s, k, o){
    o = o || {};
    if (on || dead) return;
    on = true; busy = true; X.setBusy(true); S = s; p = X.P[s - 1]; sec = X.secs[s];
    X.hideOv(); X.gbub.hidden = true;
    var ae = document.activeElement, focusIn = o.focus || o.user || X.home.contains(ae) || ae === document.body;
    load(p).then(function(d){
      if (dead || !on) return;
      D = d; setupSlots();
      if (order && k != null) rotateTo(k, 0);
      cur = o.part != null ? o.part : 0;
      if (o.part == null && p.items && k != null) D.groups.forEach(function(g){ if (g.item === k && !cur) cur = g.start; });
      buildBar(); fill(cur);
      var y0 = window.scrollY;
      X.keys.hidden = true; X.ckeys.hidden = false; X.home.classList.add('incase');
      /* phone: the bubble shows with the case bar, so the page under the stage changes once and doesn't shrink */
      if (m){ X.cmb.hidden = false; bub.hidden = false; }
      if (window.scrollY !== y0) window.scrollTo(0, y0);
      if (o.user){ try { history.pushState({cs:1}, '', '#' + p.id + '/case' + (p.items && k != null ? '/' + p.items[k].href.split('#')[1] : '')); pushedState = true; } catch(e){} }
      if (focusIn){ var fk = keys[D.beats[cur].g]; if (fk) fk.focus({preventScroll:true}); }
      X.live.textContent = p.t + ': ' + D.groups[D.beats[cur].g].t;
      show(cur, false);
      var low = lowShot();
      if (RM || o.cut){ st.setCam(low.p, low.l); onStand(); busy = false; X.setBusy(false); talk(); return; }
      var done = function(){ busy = false; X.setBusy(false); talk(); };
      if (o.push){ tweenCam(inside(), .6, function(){ tweenCam(low, 1.1); walkIn(.45, done); }); return; }
      var ins = inside(); st.setCam(ins.p, ins.l); st.render();
      tweenCam(low, 1.1); walkIn(.45, done);
    }, function(){
      /* the project file didn't load: open it as a plain page */
      on = false; busy = false; X.setBusy(false); location.href = p.href.replace(/(#|$)/, '?flat$1');
    });
  }
  function leave(){
    if (!on || busy) return;
    if (pushedState){ pushedState = false; history.back(); return; }   /* popstate closes it */
    try { history.replaceState(null, '', '#' + p.id); } catch(e){}
    exit();
  }
  function exit(done){
    if (!on) return;
    if (trailerOn) stopTrailer();
    busy = true; X.setBusy(true); quiet(); bub.hidden = true;
    var s = S, ae = document.activeElement, refocus = X.home.contains(ae) || !ae || ae === document.body;
    function back(){
      if (!order) setImg(mainScr, sec.scr[0].sc.userData.src, sec.scr[0].sc.userData.px);
      var y0 = window.scrollY;
      X.keys.hidden = false; X.ckeys.hidden = true; X.cmb.hidden = true; X.home.classList.remove('incase');
      if (window.scrollY !== y0) window.scrollTo(0, y0);
      on = false; busy = false;
      if (refocus) X.keyEls[s].focus({preventScroll:true});
    }
    if (RM){ back(); X.atGallery(s); X.standToSpot(s, 0, done); return; }
    /* straight back out to the gallery shot: no push into the screen first (user, 2026-11-09) */
    back(); X.setBusy(true);
    tweenCam(X.galleryShot(s), .9, function(){ X.atGallery(s); X.standToSpot(s, .15, done); });
  }

  /* ------------------------------ trailer: zoom into the frame ------------------------------ */
  function trailer(){
    var b = D && D.beats[cur], sv = b && !b.yt && snd(b); if (!on || busy || !b || !(b.yt || sv)) return;
    trailerOn = true; busy = true; quiet(); bub.hidden = true;
    tweenCam(inside(), RM ? 0 : .6, function(){
      busy = false;
      if (b.yt) yt.innerHTML = '<iframe src="' + b.yt.src + (b.yt.src.indexOf('?') < 0 ? '?' : '&') + 'autoplay=1" title="' + b.yt.t + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
      else {
        yt.innerHTML = '<video src="' + sv.clip + '" poster="' + sv.img + '" playsinline controls disablepictureinpicture></video>';
        var v = yt.firstChild; v.setAttribute('aria-label', sv.t);
        /* the click on Play allows sound; if a browser still refuses, play muted (the controls can unmute) */
        var pr = v.play(); if (pr && pr.catch) pr.catch(function(){ v.muted = true; var p2 = v.play(); if (p2 && p2.catch) p2.catch(function(){}); });
      }
      yt.hidden = false; close.hidden = false; st.render();
      close.focus({preventScroll:true});   /* not the player: a cross-origin frame keeps the Esc key */
    });
  }
  function stopTrailer(){ trailerOn = false; var v = yt.querySelector('video'); if (v) v.pause(); yt.hidden = true; yt.innerHTML = ''; close.hidden = true; }
  function closeTrailer(){
    if (!trailerOn) return;
    stopTrailer(); busy = true;
    tweenCam(lowShot(), RM ? 0 : .6, function(){ busy = false; talk(); play.focus({preventScroll:true}); });
  }

  /* clicking a screen while a case is open: a small University screen becomes the big one */
  function canTap(h){ return !!(on && order && h && h.s === S && order[h.k] !== 0); }
  function tap(h){
    if (!canTap(h) || busy) return;
    D.groups.forEach(function(g){ if (g.item === h.k) go(g.start, true); });
  }

  var api = {
    on:function(){ return on; }, enter:enter, exit:exit, leave:leave, tap:tap, canTap:canTap,
    /* browser Forward into a case: push into the screen first */
    enterId:function(id, game){
      var s = -1, k = null; X.P.forEach(function(q, i){ if (q.id === id) s = i + 1; });
      if (s < 0 || busy || X.busy()) return;
      if (X.P[s - 1].items && game) X.P[s - 1].items.forEach(function(it, j){ if (it.href.split('#')[1] === game) k = j; });
      enter(s, k, {push:true});
    },
    state:function(){ return {s:S, k:order ? order.indexOf(0) : null, part:cur}; },
    id:function(){ return on && p ? p.id : null; },
    /* from the gallery: rotate the bay's frames so item k is big (before the push in); returns how long it takes */
    rotateBay:function(s, k, dur){
      if (on || busy) return 0;
      S = s; p = X.P[s - 1]; sec = X.secs[s]; setupSlots();
      if (!order || order[k] === 0) return 0;
      rotateTo(k, RM ? 0 : dur); return RM ? 0 : dur + .05;
    },
    dispose:function(){ dead = true; stopTrailer(); clips(null); document.removeEventListener('keydown', onKey); [bub, tags, play, yt, close].concat(ovs).forEach(function(e){ e.remove(); }); }
  };
  window.__caseMode = api;
  return api;
};

/* browser Back / Forward: open or close the case to match the URL */
window.addEventListener('popstate', function(){
  var cm = window.__caseMode; if (!cm) return;
  var h = decodeURIComponent((location.hash || '').slice(1)).split('/');
  if (h[1] === 'case'){
    if (!cm.on()) cm.enterId(h[0], h[2]);
    else if (cm.id() !== h[0]) cm.exit(function(){ cm.enterId(h[0], h[2]); });   /* another case's link while one is open */
    return;
  }
  if (cm.on()) cm.exit();
});
})();
