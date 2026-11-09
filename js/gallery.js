/* js/gallery.js: the Dolly Gallery homepage.
   Ported from the round 4 prototype (design/blockout/dolly-r4.html): buildDolly, bubHTML, Stage, flatList, P.
   - HTML first: index.html ships About + a plain section list. When Three.js (r128, cdnjs, async) arrives,
     the list is rebuilt as the 3D gallery, keeping the selected section and focus. Without WebGL (or with ?flat)
     the list stays.
   - One WebGL renderer for the page; the phone shot is a breakpoint (stage < 640px), not a second canvas.
   - Renders on demand only. prefers-reduced-motion: the camera cuts, the guide appears in place, no bubble pop,
     no motion overlay.
   - Open pushes the camera into the screen, then loads the project page. The page's back link returns to
     index.html#<section id>; sessionStorage 'dolly-return' tells us to start inside the screen and pull back out. */
(function(){
'use strict';
var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
var FLAT = /[?&]flat\b/.test(location.search);
var RET_KEY = 'dolly-return';
var PHONE = 640;
/* shared greybox stage: js/greybox.js (loaded first) */
var GB = window.Greybox, Clock = GB.Clock, eio = GB.eio, lerp = GB.lerp, clamp = GB.clamp, el = GB.el, restart = GB.restart, phURL = GB.phURL,
  renderer = GB.renderer, Stage = GB.Stage, capsule = GB.capsule, dragX = GB.dragX;

/* ------------------------------ content ------------------------------ */
var H = {
  city:'London, UK',
  lead:"I'm a technical designer who writes the tools and gameplay code behind the design.",
  about:'At Funselektor I built Feedbot for Over the Hill. Before that I designed combat and enemies for Eve of Destruction at Lost Satellite Studios, and spent three years on casino web games at Logifuture.'
};
var P = [
  { id:'over-the-hill', t:'Over the Hill', sub:'Tool designer at Funselektor Labs, 2026', subM:'Tool designer at Funselektor Labs, 2026',
    img:'assets/oth.jpg', ar:16/9, alt:'Over the Hill key art', marks:[{chip:'Funselektor key art'}], href:'over_the_hill.html',
    blurb:"Key art from Funselektor's game. I built Feedbot, which sorts the game's player feedback from six feedback streams into bugs and requests. The first version went live two days after the brief.",
    spec:[['Studio','Funselektor Labs'],['Role','Tool Designer'],['Stack','Python, Claude API, Streamlit'],['Year','2026'],['Result','45k player messages handled in launch week']],
    logs:['45k player messages handled in launch week','First version live two days after the brief','60+ bug reports and sentiment write-ups'] },
  { id:'eve-of-destruction', t:'Eve of Destruction', sub:'Technical designer at Lost Satellite Studios, 2024', subM:'Technical designer at Lost Satellite, 2024',
    img:'assets/knightboss-poster.jpg', clip:'assets/knightboss.mp4', px:true, ar:800/494, alt:'Eve of Destruction knight boss attacking, with hitboxes visible', marks:[{chip:'Hitbox debug view on'}],
    href:'eve_of_destruction.html', blurb:'The knight boss with my hitbox debug view on.',
    spec:[['Studio','Lost Satellite Studios'],['Role','Technical Designer'],['Stack','Godot, GDScript'],['Year','2024']],
    logs:['Combat: each attack is an FSM state, with input buffering','Crystal Eaters: ten-state FSM, three detection ranges','Steam demo out'] },
  { id:'casino-games', t:'Casino Games', sub:'Game developer at Logifuture, 2023 to 2026', subM:'Game developer at Logifuture, 2023 to 2026',
    img:'assets/spin+img.png', clip:'assets/spin+.mp4', ar:16/9, alt:'Spin and Win free spins round', marks:[{x:26,y:1,w:40,h:97,l:'Spin and Win wheel'}],
    href:'casino_games.html', blurb:'Three years at Logifuture shipping live web games in PixiJS and Unity WebGL.',
    spec:[['Studio','Logifuture'],['Role','Game Developer'],['Stack','PixiJS, Unity WebGL'],['Year','2023 to 2026']],
    logs:['8+ game releases, start to finish','PixiJS and Unity WebGL'] },
  /* Climbing Game is the main item (big screen). Each item: poster (img) + muted loop (clip); Rally's clip has sound (the case plays it behind a Play button) */
  { id:'university-projects', t:'University Projects', sub:'Climbing, rally and fishing prototypes in Unity', subM:'Three prototypes in Unity',
    rs:'Three Unity prototypes', href:'university_projects.html',
    img:null, ar:960/464, alt:'Climbing Game: the climber on a wall of ledges', marks:[{chip:'Climbing Game'}],
    blurb:'Three university prototypes, each built around one action: climbing hand over hand, returning a ball off a wall, and casting a line.',
    spec:[['Studio','University'],['Role','Solo developer'],['Stack','Unity 6, C#'],['Year','2026']],
    items:[{t:'Climbing Game', href:'university_projects.html#climbing', img:'assets/climbing-poster.jpg', clip:'assets/climbing.mp4', ar:960/464},
           {t:'Rally Game', href:'university_projects.html#rally', img:'assets/rally-poster.jpg', clip:'assets/rally.mp4', ar:960/542},
           {t:'Fishing Game', href:'university_projects.html#fishing', img:'assets/fishing-poster.jpg', clip:'assets/fishing.mp4', ar:960/474}],
    logs:[] },
  { id:'other-games', t:'Other Games', sub:'A stealth game in Unity, plus jam games, since 2025', subM:'Stealth game in Unity, plus jam games',
    img:'assets/visionsystemimg.png', clip:'assets/visionsystem.mp4', ar:800/456, alt:'Top-down stealth game with the guard vision cone drawn on the floor', marks:[{x:43.5,y:9,w:10.5,h:43,l:'Vision cone: HLSL shader'}],
    href:'my_games.html', blurb:'A top-down stealth game in Unity. The guard vision cone is a shader I wrote in HLSL. Jam games sit under the same heading.',
    spec:[['Studio','Independent'],['Role','Solo developer'],['Stack','Unity 6, HLSL'],['Year','2025 onwards']],
    logs:['Guard vision cone: a shader I wrote in HLSL','Built in Unity 6'] }
];
P.forEach(function(p){ if (p.items){ p.items.forEach(function(it){ if (!it.img){ it.img = phURL(it.t); it.ar = 16/9; } }); p.img = p.items[0].img; p.clip = p.items[0].clip; } });
function idxOf(id){ for (var i = 0; i < P.length; i++) if (P[i].id === id) return i; return -1; }


/* ------------------------------ shared markup ------------------------------ */
function specHTML(spec){ return spec.map(function(s){ return '<div' + (s[0] === 'Result' ? ' class="res"' : '') + '><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>'; }).join(''); }
function marksHTML(ms){ return (ms || []).map(function(m){ return m.chip ? '<span class="mk-chip">' + m.chip + '</span>' : '<span class="mk" style="left:' + m.x + '%;top:' + m.y + '%;width:' + m.w + '%;height:' + m.h + '%"><b>' + m.l + '</b></span>'; }).join(''); }
function inWidth(ar){ return ar < 16/9 - .01 ? (ar / (16/9) * 100) + '%' : '100%'; }
function roleYear(p){ return p.rs || p.spec[1][1] + ' · ' + p.spec[3][1]; }
function abHTML(){ return '<section class="ab" aria-label="About"><p class="ab-lead">' + H.lead + '</p><p class="ab-txt">' + H.about + '</p></section>'; }
function openLink(p, cls){ return '<a class="' + cls + '" href="' + p.href + '">Learn more <span aria-hidden="true">&rarr;</span></a>'; }
function rove(items, onSel){
  items.forEach(function(b, i){
    b.addEventListener('keydown', function(e){
      var j = null, n = items.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % n;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + n) % n;
      else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = n - 1;
      if (j !== null){ e.preventDefault(); items[j].focus({preventScroll:true}); onSel(j); }
    });
  });
}
function setRove(items, i){ items.forEach(function(r, j){ r.tabIndex = j === i ? 0 : -1; if (j === i) r.setAttribute('aria-current', 'true'); else r.removeAttribute('aria-current'); r.classList.toggle('on', j === i); }); }
function remember(p){ try { sessionStorage.setItem(RET_KEY, p.id); } catch(e){} }
function takeReturn(){ var v = null; try { v = sessionStorage.getItem(RET_KEY); sessionStorage.removeItem(RET_KEY); } catch(e){} return v; }
/* #<id> selects a section; #<id>/case opens its case in the scene (#university-projects/case/rally: that game) */
function hashParts(){ return decodeURIComponent((location.hash || '').slice(1)).split('/'); }
function hashIdx(){ return idxOf(hashParts()[0]); }
function hashCase(){ var h = hashParts(), i = idxOf(h[0]); if (i < 0 || h[1] !== 'case') return null; var k = null; if (P[i].items && h[2]) P[i].items.forEach(function(it, j){ if (it.href.split('#')[1] === h[2]) k = j; }); return {s:i + 1, k:k}; }
/* the plain list's links open the project files as plain pages (they'd otherwise send the visitor back into the scene) */
function flatHref(h){ return h.replace(/(#|$)/, '?flat$1'); }

/* ------------------------------ state ------------------------------ */
var home = document.getElementById('gallery');
var G = {mode:'', sel:0, picked:false, w:0, api:null};  /* sel: section index, About = 0 */
var retId = takeReturn();

/* ------------------------------ plain list (before Three.js, and without WebGL) ------------------------------ */
function setPV(root, p){
  var im = root.querySelector('.pv img'), pin = root.querySelector('.pv .pv-in'), mkl = root.querySelector('.pv .pv-mk');
  im.src = p.img; im.alt = p.alt; im.classList.toggle('px', !!p.px);
  pin.style.setProperty('--ar', p.ar); pin.style.width = inWidth(p.ar);
  mkl.innerHTML = marksHTML(p.marks); if (!RM) restart(mkl);
  root.querySelector('.pv-cap').textContent = p.blurb;
  root.querySelector('.pv-spec').innerHTML = specHTML(p.spec);
  var ol = root.querySelector('.pv-open'); if (ol) ol.remove();
  if (p.href) root.querySelector('.pv').insertAdjacentHTML('beforeend', openLink({href:flatHref(p.href)}, 'pv-open'));
  root.querySelector('.pv-view').classList.toggle('go', !!p.href);
}
function flatList(){
  var m = home.clientWidth < PHONE;
  G.mode = 'flat'; G.api = null; home.classList.remove('g3d');
  home.innerHTML = abHTML() + '<div class="st no3d"><div class="mn"><div class="menu" role="group" aria-label="Sections">' +
    P.map(function(p, i){ return '<a class="row' + (i ? '' : ' lead') + '" href="' + (p.href ? flatHref(p.href) : '#' + p.id) + '" data-i="' + i + '"><span class="rt">' + p.t + '</span><span class="rs">' + (m ? p.subM : p.sub) + '</span></a>'; }).join('') +
    '</div><figure class="pv"><div class="pv-view"><div class="pv-in"><img alt=""><div class="pv-mk"></div></div></div><figcaption class="pv-cap"></figcaption><dl class="pv-spec"></dl></figure></div></div>';
  var host = home.querySelector('.st'), rows = [].slice.call(host.querySelectorAll('.row'));
  function sel(i){ G.sel = i + 1; setRove(rows, i); setPV(host, P[i]); }
  rows.forEach(function(r, i){ r.addEventListener('click', function(e){
    var p = P[i];
    if (!p.href || (G.sel !== i && !m)){ e.preventDefault(); G.picked = G.moved = true; sel(i); return; }
    remember(p);
  }); });
  rove(rows, function(j){ G.picked = G.moved = true; sel(j); });
  /* clicking the preview capture opens the selected section's page */
  host.querySelector('.pv-view').addEventListener('click', function(){ var p = P[G.sel - 1]; if (p && p.href){ remember(p); location.href = flatHref(p.href); } });
  var h = hashIdx(); if (h >= 0) G.picked = true; sel(h >= 0 ? h : Math.max(0, G.sel - 1));
  if (h >= 0){ rows[h].focus({preventScroll:true}); G.wantFocus = true; }  /* the row may be hidden (g3d-wait); the gallery takes the focus over */
}


/* ================================ the gallery ================================ */
/* The About sign comes first, then the projects. The capsule guide walks with the camera and talks. */
var GUIDE = 'Walk with me: drag, scroll sideways or pick a section below.';
/* About: on desktop the sign carries the About text and the guide gives directions; on phone the sign only fits the lead line, so the guide says the About text (user, 2026-11-09: not in a box under the stage) */
function bubHTML(i, m){
  if (i < 0) return m ? '<p class="bt ab-say">' + H.about + '</p><p class="bs">' + GUIDE + '</p>' : '<p class="bt">' + GUIDE + '</p>';
  var p = P[i];
  if (p.items) return '<ul class="its">' + p.items.map(function(it, k){ return '<li><a class="itb" href="' + it.href + '" data-k="' + k + '"><span class="it-t">' + it.t + '</span><span class="it-o">Learn more <span aria-hidden="true">&rarr;</span></span></a></li>'; }).join('') + '</ul>';
  return '<ul>' + p.logs.map(function(l){ return '<li>' + l + '</li>'; }).join('') + '</ul><p class="bs"><span>Stack</span> ' + p.spec[2][1] + '</p>' + (p.href ? openLink(p, 'openb') : '');
}
/* camera set-up per shot, tuned for the prototype's stage sizes; the camera distance is scaled so other widths see the same stretch of wall */
function shot(m, w, avail){
  var b = m ? {w:358, h:500, fov:50, y:1.5, z:11.2, ly:.35, off:.4} : {w:1192, h:470, fov:34, y:2.15, z:8.6, ly:1.8, off:.7};
  /* desktop: the stage fills the window height (name strip above, bar below), within limits */
  var h = m ? 500 : Math.round(clamp(avail || w * .394, 420, 900));
  /* narrower desktops: pull back only part of the way (so the wall isn't tiny) and shrink the pinned HTML to match */
  /* taller than the prototype's stage (window-height desktops): pull back all the way, so the same stretch of wall shows and the extra height is floor and wall */
  var f = (b.w/b.h) / (w/h), z = m || f > 1 ? b.z * f : b.z * Math.sqrt(f), k = m ? 1 : clamp((w/b.w) * (b.z/z) * f, .72, 1);
  return {w:w, h:h, fov:b.fov, y:b.y, ly:b.ly, off:b.off, z:z, k:k};
}

function buildDolly(start){
  var m = home.clientWidth < PHONE;
  var hadFocus = home.contains(document.activeElement);
  /* layout first so the stage width is known */
  home.classList.add('g3d');
  var keys = '<div class="keys" role="group" aria-label="Sections"><span class="track" aria-hidden="true"><i></i></span>' +
    '<button type="button" class="key abk" data-i="0" tabindex="0"><span class="rt">About</span><span class="rs">' + H.city + '</span></button>' +
    P.map(function(p, i){ return '<button type="button" class="key' + (i ? '' : ' lead') + '" data-i="' + (i + 1) + '" tabindex="-1"><span class="rt">' + p.t + '</span><span class="rs">' + roleYear(p) + '</span></button>'; }).join('') + '</div>';
  home.innerHTML = '<div class="st" aria-label="Gallery"></div>' + keys +
    '<div class="cmb" hidden></div><div class="keys ckeys" role="group" aria-label="Parts" hidden></div><p class="sr live" aria-live="polite"></p>';
  var host = home.querySelector('.st'), kb = home.querySelector('.keys');
  /* the bar's height before first layout can read far too tall (fonts, empty stage): cap it at its usual size */
  var avail = window.innerHeight - (host.getBoundingClientRect().top + window.scrollY) - Math.min(kb.offsetHeight, 84) - 16 - 20;
  var c = shot(m, host.clientWidth, avail);
  host.style.height = c.h + 'px';
  var st = Stage(host, c.w, c.h, {fov:c.fov, k:c.k, sun:[-7, 13, 10], sb:24, fs:110});
  if (!st){ home.classList.remove('g3d'); flatList(); return false; }
  document.documentElement.classList.remove('g3d-wait');  /* visible before anything takes focus */
  G.mode = m ? 'm' : 'd'; G.w = home.clientWidth; G.h = window.innerHeight;
  var keyEls = [].slice.call(home.querySelectorAll('.key')), live = home.querySelector('.live'), busy = false, pushed = null, clock = new Clock();
  var T = st.T, M = st.M;
  /* section widths: About, then the projects (the lead bay and the three-screen bay are widest) */
  var BW = [6.4].concat(P.map(function(p, i){ return m ? (i === 0 || p.items ? 8.0 : 6.6) : (i === 0 || p.items ? 9.0 : 7.6); })), x0 = -BW[0]/2, x1 = x0 + BW.reduce(function(a, b){ return a + b; }, 0);
  var SL = m ? .5 : 1.6;   /* screen's left edge from the bay's left divider (desktop: the stand sits in front of that gap) */
  st.box(x1 - x0 + .3, 6.4, .3, M.wall, (x0 + x1)/2, 3.2, -.15);
  var x = x0, hits = []; st.box(.3, 3.3, 2.0, M.wall, x, 1.65, 1.0);
  /* every bay has a stand (the player-start pad). On desktop it sits left of the screen, where the guide stands on the
     project page's low shot, so the two line up; the guide talks from its spot on the right. It steps onto the stand
     only when it walks in from off screen (coming back from a project page), then walks over to its spot */
  function standAt(z, l){ var q = m ? {x:z.x + .45, z:z.z - .8} : {x:l + .8, z:z.z}; GB.stand(T, st.S, q.x, q.z); return q; }
  var secs = BW.map(function(bw, s){
    var l = x, cx = x + bw/2; x += bw; st.box(.3, 3.3, 2.0, M.wall, x, 1.65, 1.0);
    var zone = {x:l + bw - (s ? 1.35 : .62), z:1.6};            /* where the guide stands on desktop (About: clear of the sign) */
    if (m) zone = {x:s ? cx - 1.35 : cx - .95, z:s ? 3.6 : 4.9}; /* phone: front left, in from the edge */
    if (s === 0){
      var sign = el('div', 'pin sign', '<span class="k">About</span><p class="ab-lead">' + H.lead + '</p>' + (m ? '' : '<p class="ab-txt">' + H.about + '</p>')); host.appendChild(sign);
      st.pin(sign, new T.Vector3(m ? cx : l + .28, m ? 3.5 : 3.3, .05), m ? .5 : 0, 0, {clamp:false});
      return {cx:cx, l:l, bw:bw, zone:zone, pad:standAt(zone, l)};
    }
    var i = s - 1, p = P[i], scr3 = [], sc, sw, sy, scx;
    if (p.items){
      /* one main screen + two small, stacked to its right */
      var mw = m ? 2.7 : 3.3, smw = m ? 1.2 : 1.55, gap = m ? .3 : .4;
      sy = m ? 2.4 : 2.05; sw = mw;
      var gl = m ? cx - (mw + gap + smw)/2 : l + SL;
      scx = gl + mw/2;
      var sx2 = gl + mw + gap + smw/2, sh2 = smw/(16/9), dy2 = sh2/2 + .1;
      p.items.forEach(function(it, k){
        var w = k ? smw : mw, px = k ? sx2 : scx, py = k ? sy + (k === 1 ? dy2 : -dy2) : sy;
        var g = st.screen({img:it.img, ar:it.ar}, w); g.position.set(px, py, .03);
        var lab = el('span', 'pin tl', it.t), lv = new T.Vector3(); lab.setAttribute('aria-hidden', 'true'); host.appendChild(lab);
        /* follows its screen (the case view swaps the University screens round) */
        st.pin(lab, null, 0, 0, {clamp:false, get:function(){ var sc = g.scale.x; return lv.set(g.position.x - (w*sc)/2 - .08, g.position.y - (g.userData.h*sc)/2 - .1, .05); }});
        scr3.push({sc:g, scx:px, sy:py, sw:w});
      });
      sc = scr3[0].sc;
    } else {
      sw = i ? 3.7 : 4.7; sy = m ? 2.35 : i ? 1.95 : 2.05;
      scx = m ? cx : l + SL + sw/2; sc = st.screen(p, sw); sc.position.set(scx, sy, .03);
      scr3.push({sc:sc, scx:scx, sy:sy, sw:sw});
    }
    st.box(sw*.6, .3, .5, i ? M.prop : M.lead, scx, .15, 1.0);
    var tp = el('button', 'pin tp' + (i ? '' : ' lead'), '<span class="rt">' + p.t + '</span><span class="rs">' + (m ? p.subM : p.sub) + '</span>');
    tp.tabIndex = -1; tp.setAttribute('aria-hidden', 'true'); host.appendChild(tp);
    st.pin(tp, new T.Vector3(scx - sw/2 - .08, sy + sc.userData.h/2 + .2, .05), 0, 1, {clamp:false});
    tp.addEventListener('click', function(){ act(s); });
    scr3.forEach(function(o, k){ o.sc.userData.hit = {s:s, k:k}; hits.push(o.sc); });
    return {cx:cx, l:l, bw:bw, zone:zone, pad:standAt(zone, l), sc:sc, sw:sw, sy:sy, scx:scx, tp:tp, i:i, scr:scr3};
  });
  /* the guide: capsule + speech bubble */
  var plr = capsule(T, M.white, 1.1), body = plr.userData.body; plr.position.set(secs[0].zone.x, .02, secs[0].zone.z); st.S.add(plr);
  var bub = el('div', 'pin bub' + (m ? ' side' : ''), ''); bub.id = 'guide-bubble'; host.appendChild(bub);
  /* motion on the wall: the selected screen's clip plays in an HTML layer pinned over the still texture */
  var ov = el('div', 'pin vov', ''); ov.setAttribute('aria-hidden', 'true'); ov.hidden = true; host.insertBefore(ov, host.querySelector('.pin'));
  var ovS = -1, ovK = 0, ovSrc = '', cn = [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()];
  st.pin(ov, null, 0, 0, {rect:function(proj){
    var o = secs[ovS]; if (!o) return; var tg = o.scr[ovK], u = tg.sc.userData, k = tg.sc.scale.x, a0 = tg.scx - u.iw*k/2, a1 = tg.scx + u.iw*k/2, y0 = tg.sy - u.ih*k/2, y1 = tg.sy + u.ih*k/2;
    cn[0].set(a0, y0, .035); cn[1].set(a1, y0, .035); cn[2].set(a0, y1, .035); cn[3].set(a1, y1, .035);
    var ps = cn.map(proj), lx = Math.min.apply(null, ps.map(function(q){ return q[0]; })), rx = Math.max.apply(null, ps.map(function(q){ return q[0]; })), ty = Math.min.apply(null, ps.map(function(q){ return q[1]; })), by = Math.max.apply(null, ps.map(function(q){ return q[1]; }));
    ov.style.transform = 'translate(' + lx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px)'; ov.style.width = (rx - lx).toFixed(1) + 'px'; ov.style.height = (by - ty).toFixed(1) + 'px';
  }});
  /* clips load only when their section is selected; University: the clip of the game that is big (the case may have swapped them) */
  function showOv(s){
    var p = s > 0 ? P[s - 1] : null, k = p && p.items && secs[s].order ? secs[s].order.indexOf(0) : 0, c = p && p.items ? p.items[k] : p, src = c && !RM ? c.clip : '';
    if (!src){ hideOv(); return; }
    if (src !== ovSrc){ ovSrc = src; ov.classList.toggle('px', !!c.px); ov.innerHTML = '<video src="' + src + '" poster="' + c.img + '" muted loop playsinline autoplay preload="auto" disablepictureinpicture></video>'; }
    ovS = s; ovK = k; ov.hidden = false;
    var v = ov.querySelector('video'); if (v){ v.muted = true; var pr = v.play(); if (pr && pr.catch) pr.catch(function(){}); }
  }
  function hideOv(){ ov.hidden = true; ovS = -1; var v = ov.querySelector('video'); if (v) v.pause(); }
  var head = new T.Vector3();
  st.pin(bub, null, m ? 0 : .5, m ? .05 : 1, {get:function(){ head.set(plr.position.x + (m ? .38 : 0), m ? .7 : 1.42, plr.position.z); return head; }, dy:m ? 0 : -6, dx:m ? 8 : 0});
  function say(s, announce){
    bub.innerHTML = bubHTML(s - 1, m);
    var ob = bub.querySelector('.openb'); if (ob) ob.addEventListener('click', function(e){ e.preventDefault(); open(s, 0); });
    bub.querySelectorAll('.itb').forEach(function(b){ b.addEventListener('click', function(e){ e.preventDefault(); open(s, +b.getAttribute('data-k')); }); });
    bub.hidden = false; if (!RM) restart(bub);
    if (announce) live.textContent = s ? P[s - 1].t : 'About';
  }
  /* camera stops: section centres, except the first shot on desktop, which frames the About sign and the whole lead screen */
  var sx = secs.map(function(o){ return o.cx; }), N = sx.length;
  if (!m) sx[0] = ((secs[0].l + .2) + (secs[1].scx + secs[1].sw/2 + .3))/2;
  var camX = sx[0], tw = null, walk = null, trk = home.querySelector('.track i'), at = 0;
  function put(xx){
    camX = xx; st.setCam(new T.Vector3(xx + c.off, c.y, c.z), new T.Vector3(xx, c.ly, 0));
    if (m) return;
    var j = 0; while (j < N - 2 && xx > sx[j + 1]) j++; var f = clamp((xx - sx[j]) / (sx[j + 1] - sx[j]), -.4, 1.4);
    var ce = function(k){ var e = keyEls[k]; return e.offsetLeft + e.offsetWidth/2; }, f0 = Math.max(0, Math.min(1, f));
    trk.style.left = (f < 0 ? ce(0) + f*(ce(1) - ce(0)) : f > 1 ? ce(N - 1) + (f - 1)*(ce(N - 1) - ce(N - 2)) : lerp(ce(j), ce(j + 1), f0)) + 'px';
  }
  /* face the viewer, turned a little towards what the guide presents: on desktop the sign/screen is to its left, on phone to its right */
  function face(){ plr.rotation.y = m ? .35 : -.45; }
  /* on desktop the guide stands between the bay dividers (z 0 to 2.0), so it steps out past their ends, walks, and steps back in */
  var ZOUT = 2.45;
  function route(a, b){
    var pts = [a];
    if (!m && Math.abs(b.x - a.x) > .01){ pts.push({x:a.x, z:ZOUT}); pts.push({x:b.x, z:ZOUT}); }
    pts.push(b);
    var segs = [], tot = 0;
    for (var k = 1; k < pts.length; k++){ var d = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z); if (d > 1e-4){ segs.push({a:pts[k - 1], b:pts[k], d:d, s:tot}); tot += d; } }
    return {segs:segs, tot:tot};
  }
  function along(rt, dist){
    var sg = rt.segs[rt.segs.length - 1];
    for (var k = 0; k < rt.segs.length; k++){ if (dist <= rt.segs[k].s + rt.segs[k].d){ sg = rt.segs[k]; break; } }
    var t = clamp((dist - sg.s)/sg.d, 0, 1);
    return {x:lerp(sg.a.x, sg.b.x, t), z:lerp(sg.a.z, sg.b.z, t), ry:Math.atan2(sg.b.x - sg.a.x, sg.b.z - sg.a.z)};
  }
  function arrive(s, announce){ body.position.y = 0; body.rotation.x = 0; face(); at = s; say(s, announce); showOv(s); st.render(); }
  function select(s, anim, announce){
    G.sel = s; setRove(keyEls, s);
    keyEls.forEach(function(kk, j){ if (j === s) kk.setAttribute('aria-describedby', bub.id); else kk.removeAttribute('aria-describedby'); });
    secs.forEach(function(o, j){ if (o.tp){ o.tp.classList.toggle('on', j === s); o.sc.userData.sel.visible = j === s; } });
    clock.kill(tw); clock.kill(walk);
    var from = camX, to = sx[s], a = {x:plr.position.x, z:plr.position.z}, b = secs[s].zone;
    if (!anim || RM){ put(to); plr.position.set(b.x, .02, b.z); arrive(s, announce); return; }
    var dur = clamp(Math.abs(to - from)/9, .4, .9);
    bub.hidden = true; hideOv();
    tw = clock.add(dur, function(p){ put(lerp(from, to, eio(p))); st.render(); });
    var rt = route(a, b);
    if (rt.tot < .01){ plr.position.set(b.x, .02, b.z); walk = clock.add(dur, function(){}, function(){ arrive(s, announce); }); return; }
    /* the guide starts a beat later and arrives a beat after the camera, so it reads as following; the detour round the wall adds a little */
    var wd = dur + (rt.segs.length > 1 ? .3 : 0);
    walk = clock.add(wd + .18, function(p){
      var q = clamp((p*(wd + .18) - .08)/wd, 0, 1), dist = eio(q)*rt.tot, o = along(rt, dist);
      plr.position.set(o.x, .02, o.z); plr.rotation.y = o.ry;
      body.position.y = Math.abs(Math.sin(dist*1.6))*.07; body.rotation.x = .2*Math.sin(Math.PI*q);
      st.render();
    }, function(){ arrive(s, announce); });
  }
  function act(s){ if (busy) return; if (G.sel === s && at === s && Math.abs(camX - sx[s]) < .05){ if (s > 0) open(s, 0); } else select(s, true, true); }
  function pushTarget(s, k){
    var tg = secs[s].scr[k || 0], half = Math.tan(c.fov*Math.PI/360), asp = c.w/c.h, sh = tg.sw/(16/9);
    var d = Math.max((sh/2 + .12)/half, (tg.sw/2 + .12)/(half*asp));
    return {s:s, p:new T.Vector3(tg.scx, tg.sy, d + .03), l:new T.Vector3(tg.scx, tg.sy, 0)};
  }
  /* push into the screen, then load the project page */
  function open(s, k){
    var p = P[s - 1]; if (busy || s < 1 || !p || !p.href) return;
    var href = p.items && k != null ? p.items[k].href : p.href;
    var CS = G.cs;
    if (!CS){ remember(p); location.href = href; return; }   /* js/case.js missing: the project file as a page */
    if (window.gtag) gtag('event', 'case_open', {destination:href});
    if (RM){ G.sel = s; setRove(keyEls, s); CS.enter(s, k, {cut:true, user:true}); return; }
    busy = true; clock.kill(tw); clock.kill(walk); bub.hidden = true; hideOv();
    var tpv = new T.Vector3(), tl = new T.Vector3();
    G.sel = s; setRove(keyEls, s);
    /* University: a small frame first rotates to the big spot, then the camera pushes into it */
    var rot = p.items && k != null && CS.rotateBay ? CS.rotateBay(s, k, .45) : 0;
    clock.add(rot, function(){}, function(){
      var p0 = st.cam.position.clone(), l0 = st.look.clone(), pt = pushTarget(s, k);
      clock.add(.6, function(q){ var e = eio(q); tpv.copy(p0).lerp(pt.p, e); tl.copy(l0).lerp(pt.l, e); st.setCam(tpv, tl); st.render(); }, function(){ busy = false; CS.enter(s, k, {inside:true, user:true}); });
    });
  }
  /* from the stand, step off and walk to the guide's spot on the right, then talk (bubble, clip) */
  function standToSpot(s, pause, done){
    var pd = secs[s].pad, zn = secs[s].zone, dz = Math.hypot(zn.x - pd.x, zn.z - pd.z);
    busy = true;
    walk = clock.add(pause, function(){}, function(){
      walk = clock.add(clamp(dz/5, .5, 1.1), function(q){
        var dn = clamp(q/.2, 0, 1), e = eio(q);
        plr.position.set(lerp(pd.x, zn.x, e), GB.STAND_H - (GB.STAND_H - .02)*dn, lerp(pd.z, zn.z, e)); plr.rotation.y = Math.atan2(zn.x - pd.x, zn.z - pd.z);
        body.position.y = Math.abs(Math.sin(e*dz*1.6))*.07; body.rotation.x = .2*Math.sin(Math.PI*q);
        st.render();
      }, function(){ busy = false; select(s, false); if (done) done(); });
    });
  }
  /* back from the case study: start inside the screen and pull out to the section shot */
  /* ...while the guide walks in from off screen (left), steps up onto the section's stand, then walks over to its spot */
  function pullBack(s){
    var pp = pushed || pushTarget(s, 0), pd = secs[s].pad; pushed = null;
    if (RM){ busy = false; select(s, false); return; }
    busy = true; clock.kill(tw); clock.kill(walk); bub.hidden = true; hideOv();
    var to = sx[s], p2 = new T.Vector3(to + c.off, c.y, c.z), l2 = new T.Vector3(to, c.ly, 0), tpv = new T.Vector3(), tl = new T.Vector3();
    var zw = m ? pd.z : ZOUT, a = {x:to - (m ? 3.2 : 6.5), z:zw}, rt = {segs:[], tot:0};
    [a, {x:pd.x, z:zw}, pd].reduce(function(u, v){ var d = Math.hypot(v.x - u.x, v.z - u.z); if (d > 1e-4){ rt.segs.push({a:u, b:v, d:d, s:rt.tot}); rt.tot += d; } return v; });
    G.sel = s; setRove(keyEls, s); plr.position.set(a.x, .02, a.z);
    st.setCam(pp.p, pp.l); camX = to; st.render();
    clock.add(.6, function(q){ var e = eio(q); tpv.copy(pp.p).lerp(p2, e); tl.copy(pp.l).lerp(l2, e); st.setCam(tpv, tl); st.render(); });
    function toSpot(){ standToSpot(s, .35); }
    walk = clock.add(1.4, function(q){
      var w = clamp(q/.86, 0, 1), up = clamp((q - .82)/.18, 0, 1), dist = eio(w)*rt.tot, o = along(rt, dist);
      plr.position.set(o.x, .02 + (GB.STAND_H - .02)*up, o.z); plr.rotation.y = up > 0 ? lerp(o.ry, m ? .35 : -.45, up) : o.ry;
      body.position.y = q < .82 ? Math.abs(Math.sin(dist*1.6))*.07 : Math.sin(up*Math.PI)*.1; body.rotation.x = q < .82 ? .15 : 0;
      st.render();
    }, toSpot);
  }
  var ppu = c.w / (2*c.z*Math.tan(c.fov*Math.PI/360)*(c.w/c.h)), dx0 = 0;
  function snap(){ var best = 0; sx.forEach(function(v, j){ if (Math.abs(v - camX) < Math.abs(sx[best] - camX)) best = j; }); select(best, true, true); }
  /* scrubbing: the bubble hides as soon as the camera leaves, so stale facts never slide off with it; the guide walks after the snap */
  /* with a case open the stage doesn't scrub, but clicks still reach it (a small University screen becomes the big one) */
  var inCase = function(){ return !!(G.cs && G.cs.on()); }, drag = false;
  dragX(host, function(){ return busy; },
    function(){ drag = !inCase(); if (!drag) return; clock.kill(tw); clock.kill(walk); bub.hidden = true; hideOv(); dx0 = camX; },
    function(dx){ if (!drag) return; put(clamp(dx0 - dx/ppu, sx[0] - 1, sx[N - 1] + 1)); st.render(); },
    function(){ if (drag) snap(); },
    /* clicking a capture opens its page, the same way as Learn more */
    function(e){ var h = st.pick(e.clientX, e.clientY, hits); if (G.cs && G.cs.on()){ G.cs.tap(h); return; } if (h && P[h.s - 1].href) open(h.s, h.k); },
    function(e){ var h = st.pick(e.clientX, e.clientY, hits); host.classList.toggle('over', G.cs && G.cs.on() ? G.cs.canTap(h) : !!(h && P[h.s - 1].href)); });
  var wt = 0;
  host.addEventListener('wheel', function(e){
    var dd = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0); if (!dd || busy || (G.cs && G.cs.on())) return;
    e.preventDefault(); clock.kill(tw); clock.kill(walk); bub.hidden = true; hideOv(); put(clamp(camX + dd/ppu, sx[0] - 1, sx[N - 1] + 1)); st.render(); clearTimeout(wt); wt = setTimeout(snap, 180);
  }, {passive:false});
  keyEls.forEach(function(kk, s){ kk.addEventListener('click', function(){ act(s); }); });
  rove(keyEls, function(j){ select(j, true, true); });

  G.cs = window.CaseMode ? window.CaseMode({st:st, T:T, M:M, clock:clock, host:host, home:home, m:m, c:c, P:P, secs:secs, sx:sx, plr:plr, body:body,
    live:live, gbub:bub, keys:home.querySelector('.keys:not(.ckeys)'), ckeys:home.querySelector('.ckeys'), cmb:home.querySelector('.cmb'), keyEls:keyEls,
    ZOUT:ZOUT, RM:RM, hideOv:hideOv, pushTarget:pushTarget, standToSpot:standToSpot,
    setBusy:function(v){ busy = v; }, busy:function(){ return busy; },
    galleryShot:function(s){ return {p:new T.Vector3(sx[s] + c.off, c.y, c.z), l:new T.Vector3(sx[s], c.ly, 0)}; },
    atGallery:function(s){ camX = sx[s]; put(sx[s]); }}) : null;
  /* where to start: a returning visitor pulls back out of the screen they opened; a #section link starts on that section;
     #<id>/case opens that case (from a project file, or a shared link): inside its screen, pulling out low */
  var s0 = start && start.sel >= 0 ? start.sel : 0;
  if (start && start.cs && G.cs){ G.sel = s0; setRove(keyEls, s0); put(sx[s0]); G.cs.enter(s0, start.cs.k, {inside:!start.cs.cut, cut:!!start.cs.cut, part:start.cs.part, focus:start.focus || hadFocus}); }
  else {
    if (start && start.pull) pullBack(s0); else select(s0, false);
    if (start && start.focus) keyEls[s0].focus({preventScroll:true});
    else if (hadFocus) keyEls[s0].focus({preventScroll:true});
  }

  G.api = {
    dispose:function(){ if (G.cs) G.cs.dispose(); clock.killAll(); hideOv(); ov.innerHTML = ''; st.dispose(); },
    caseState:function(){ return G.cs && G.cs.on() ? G.cs.state() : null; },
    /* bfcache: coming back with the camera still pushed into a screen */
    pageshow:function(){ if (pushed){ var s = pushed.s; busy = false; pullBack(s); keyEls[s].focus({preventScroll:true}); } }
  };
  return true;
}

/* ------------------------------ boot ------------------------------ */
function canUpgrade(){ return !FLAT && !!window.THREE && GB.glOK() !== false; }
function canUpgradeSoon(){ return !FLAT && GB.glOK() !== false && !!window.WebGLRenderingContext; }
function upgrade(start){
  if (!canUpgrade()) return false;
  if (G.api){ G.api.dispose(); G.api = null; }
  try { return buildDolly(start); } catch(e){ if (window.console) console.error(e); home.classList.remove('g3d'); flatList(); return false; }
}
function boot(){
  if (!home) return;
  var h = hashIdx();
  var hc = hashCase();
  var start = {sel:h >= 0 ? h + 1 : 0, focus:h >= 0, pull:!hc && h >= 0 && retId === P[h].id, cs:hc ? {k:hc.k} : null};
  /* if Three.js isn't here yet, the pull back out of the screen waits for it (unless the visitor moves first) */
  if (!upgrade(start)){ flatList(); G.pull = start.pull; }
  /* the plain list stays hidden behind a placeholder (html.g3d-wait) while Three.js loads; show it if the
     gallery can't be built (no WebGL, script error) or Three.js takes longer than 4s */
  function unwait(){
    /* a case link (#<id>/case) the scene can't open: the project file as a plain page */
    var hc = hashCase(); if (hc && G.mode === 'flat'){ var it = P[hc.s - 1]; location.replace(flatHref(it.items && hc.k != null ? it.items[hc.k].href : it.href)); return; }
    var root = document.documentElement; if (!root.classList.contains('g3d-wait')) return;
    root.classList.remove('g3d-wait');
    var r = home.querySelector('.row[aria-current]');
    if (G.mode === 'flat' && G.wantFocus && !G.moved && r) r.focus({preventScroll:true});
  }
  if (G.mode !== 'flat' || !canUpgradeSoon()) unwait();
  document.addEventListener('three-failed', unwait);
  setTimeout(unwait, 4000);
  /* HTML first: when Three.js arrives, the list becomes the gallery and keeps the visitor's place */
  document.addEventListener('three-ready', function(){
    if (G.mode !== 'flat') return;
    var had = home.contains(document.activeElement), pull = G.pull && !G.moved; G.pull = false;
    var hc = !G.moved && hashCase();
    if (!upgrade({sel:G.picked || had ? G.sel : 0, focus:had || (G.wantFocus && !G.moved), pull:pull, cs:hc ? {k:hc.k} : null})) unwait();
  });
  /* the phone shot is a breakpoint: rebuild on width changes (not height: phone URL bars resize the viewport) */
  var rt = 0;
  window.addEventListener('resize', function(){
    clearTimeout(rt); rt = setTimeout(function(){
      if (G.mode === 'flat' || (home.clientWidth === G.w && (G.mode === 'm' || Math.abs(window.innerHeight - G.h) < 40))) return;
      var cs = G.api && G.api.caseState();
      upgrade({sel:G.sel, focus:false, pull:false, cs:cs ? {k:cs.k, part:cs.part, cut:true} : null});
    }, 150);
  });
  window.addEventListener('pageshow', function(e){ if (e.persisted && G.api) G.api.pageshow(); });
}
boot();
})();
