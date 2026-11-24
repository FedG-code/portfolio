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
  renderer = GB.renderer, Stage = GB.Stage, capsule = GB.capsule, dragX = GB.dragX, steer = GB.steer, lerpA = GB.lerpA;

/* ------------------------------ content ------------------------------ */
var H = {
  city:'London, UK',
  lead:"I'm a technical designer with 3 years programming experience across multiple engines and languages.",
  about:'Currently building tools for Funselektor. Before that I designed combat and enemies for Eve of Destruction at Lost Satellite Studios, and spent three years on casino web games at Logifuture.'
};
/* blurb: the guide's summary in the gallery bubble. Over the Hill, Eve and Casino: the project page's .project-hero-desc,
   verbatim (tests/case-test.js fails if they drift: edit both). cap: the plain list's preview caption.
   logs + spec[2] (Stack): the wall monitor beside the screen (desktop gallery). In a case the monitor shows the section sheet:
   spec rows (all but Result; sheet: only these) + head (two headline figures, no bet figures) + a Now row for the part */
var P = [
  { id:'over-the-hill', t:'Over the Hill', sub:'Tool programmer & designer at Funselektor Labs, 2026', subM:'Tool designer & programmer at Funselektor Labs, 2026',
    img:'assets/oth.jpg', ar:16/9, alt:'Over the Hill', marks:[{chip:'Funselektor'}], href:'over_the_hill.html',
    blurb:"A week before Over the Hill's launch, Funselektor Labs asked me for a tool to turn over the upcoming thousands of Discord messages into grouped bugs and feedback the team could triage. I built Feedbot and had a testable version within two days.",
    cap:"I built Feedbot, which sorts the game's player feedback from six feedback streams into bugs and requests. The first version went live two days after the brief.",
    spec:[['Studio','Funselektor Labs'],['Role','Tool Designer'],['Stack','Python, Claude API, Streamlit'],['Year','2026'],['Result','45k player messages handled in launch week']],
    logs:['45k player messages handled in launch week','First version live two days after the brief','60+ bug reports and sentiment write-ups'],
    head:[['45k','messages in launch week'],['2 days','to the first version']] },
  { id:'eve-of-destruction', t:'Eve of Destruction', sub:'Technical designer at Lost Satellite Studios, 2024', subM:'Technical designer at Lost Satellite, 2024',
    img:'assets/ult+bossfightgif-poster.jpg', clip:'assets/ult+bossfightgif.mp4', px:true, ar:16/9, alt:'Eve of Destruction: ultimate ability and boss fight gameplay', marks:[{chip:'Combat'}],   /* the Combat part's clip (user, 2026-11-23: punchier); knightboss.mp4 stays in assets for a later content pass */
    href:'eve_of_destruction.html', cap:'Combat: the ultimate ability in a boss fight.',
    blurb:'A 2D action-platformer built around combo combat, unlockable abilities, and branching progression. As Technical Designer on a small team, I designed and implemented the player\'s combat and movement systems along with mob and boss enemy logic, all in GDScript. <a href="https://store.steampowered.com/app/2839460/Eve_of_Destruction/" target="_blank" rel="noopener">Steam demo available</a>.',
    spec:[['Studio','Lost Satellite Studios'],['Role','Technical Designer'],['Stack','Godot, GDScript'],['Year','2024']],
    logs:['Combat: each attack is an FSM state, with input buffering','Crystal Eaters: ten-state FSM, three detection ranges','Steam demo out'] },
  { id:'casino-games', t:'Casino Games', sub:'Game developer at Logifuture, 2023 to 2026', subM:'Game developer at Logifuture, 2023 to 2026',
    img:'assets/spin+img.png', clip:'assets/spin+.mp4', ar:16/9, alt:'Spin and Win free spins round', marks:[{x:26,y:1,w:40,h:97,l:'Spin and Win wheel'}],
    href:'casino_games.html', cap:'Three years at Logifuture shipping live casino games in PixiJS and Unity WebGL.',
    blurb:'At Logifuture I worked on 8+ game releases from start to finish, working on both the individual games, engine code and tools. I also maintained a back catalogue of 40+ games, making patches based on business needs. I also redesigned, pitched and implemented a mini version of their flagship game to drive cross product user engagement. After a strong initial performance I rebuilt 2 more games for the initiative, reaching a peak of 700k+ users across all 3 games.',
    spec:[['Studio','Logifuture'],['Role','Game Developer'],['Stack','PixiJS, Unity WebGL'],['Year','2023 to 2026']],
    logs:['8+ game releases, start to finish','700k+ peak users across 3 games'],
    head:[['8+','releases'],['700k+','peak users']] },
  /* Climbing Game is the main item (big screen). Each item: poster (img) + muted loop (clip); Rally's clip has sound (the case plays it behind a Play button) */
  { id:'university-projects', t:'University Projects', sub:'Climbing, rally and fishing prototypes in Unity', subM:'Three prototypes in Unity',
    rs:'Three Unity prototypes', href:'university_projects.html',
    img:null, ar:960/464, alt:'Climbing Game: the climber on a wall of ledges', marks:[{chip:'Climbing Game'}],
    blurb:"These are the main projects I've worked on in or during university, where I tried to reach beyond my assignment brief and show off my best skills as a technical designer.", cap:'',
    spec:[['Studio','University'],['Role','Solo developer'],['Stack','Unity 6, C#'],['Year','2026']],
    items:[{t:'Climbing Game', href:'university_projects.html#climbing', img:'assets/climbing-poster.jpg', clip:'assets/climbing.mp4', start:15, ar:960/464},
           {t:'Rally Game', href:'university_projects.html#rally', img:'assets/rally-poster.jpg', clip:'assets/rally.mp4', start:18, ar:960/542},
           {t:'Fishing Game', href:'university_projects.html#fishing', img:'assets/fishing-poster.jpg', clip:'assets/fishing.mp4', start:1, ar:960/474}],
    logs:[], sheet:['Stack'] },   /* module / year / solo not confirmed yet: the case sheet shows only the stack */
  /* same three frames as University: Stealth Game is the main item (its case plays each part's own clip in the big frame) */
  { id:'other-games', t:'Other Games', sub:'A stealth game in Unity, plus jam games, since 2025', subM:'Stealth game in Unity, plus jam games',
    img:null, ar:640/364, alt:'Top-down stealth game with the guard vision cone drawn on the floor', marks:[{x:43.5,y:9,w:10.5,h:43,l:'Vision cone: HLSL shader'}],
    href:'my_games.html',
    blurb:"My remaining projects, a stealth game using Darkwood's fog of war system that I spent 9 months on and two smaller game jam games.",
    cap:'A top-down stealth game in Unity. The guard vision cone is a shader I wrote in HLSL. Jam games sit under the same heading.',
    spec:[['Studio','Independent'],['Role','Solo developer'],['Stack','Unity 6, HLSL'],['Year','2025 onwards']],
    items:[{t:'Stealth Game', href:'my_games.html#stealth', img:'assets/visionsystem-poster.jpg', clip:'assets/visionsystem.mp4', ar:640/364},
           {t:'Tetrarcana', href:'my_games.html#tetrarcana', img:'assets/tetrarcana-poster.jpg', clip:'assets/tetrarcana.mp4', ar:640/372},
           {t:'Calm Before the Storm', href:'my_games.html#calm', img:'assets/calm-poster.jpg', clip:'assets/calm.mp4', ar:640/358}],
    logs:['Guard vision cone: a shader I wrote in HLSL','Built in Unity 6'] }
];
P.forEach(function(p){ if (p.items){ p.items.forEach(function(it){ if (!it.img){ it.img = phURL(it.t); it.ar = 16/9; } if (it.start) GB.START[it.clip] = it.start; }); p.img = p.items[0].img; p.clip = p.items[0].clip; } });
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
  var cap = root.querySelector('.pv-cap'); cap.textContent = p.cap || ''; cap.hidden = !p.cap;
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
  /* the section's summary (its text scrolls inside when the stage is short) + Learn more (an items bay: the game in the big frame) */
  return '<p class="sum">' + p.blurb + '</p>' + (p.href ? openLink(p, 'openb') : '');
}
/* the wall monitor beside the screen. Gallery: the section's facts + its stack (University has no facts: just the stack).
   Case (sheetHTML): the section sheet, the same for the whole case, + a Now row for the part (case.js) */
function wlHd(p){ return '<p class="wl-hd"><span aria-hidden="true">&#9679;</span> ' + p.id + '</p>'; }
function wlHTML(i){
  var p = P[i]; if (!p) return '';
  return wlHd(p) + (p.logs.length ? '<ul>' + p.logs.map(function(l){ return '<li>' + l + '</li>'; }).join('') + '</ul>' : '') + '<p class="wl-st"><span>Stack</span>' + p.spec[2][1] + '</p>';
}
function sheetHTML(i){
  var p = P[i]; if (!p) return '';
  var rows = p.spec.filter(function(r){ return r[0] !== 'Result' && r[0] !== 'Stack' && (!p.sheet || p.sheet.indexOf(r[0]) >= 0); }).concat(!p.sheet || p.sheet.indexOf('Stack') >= 0 ? [p.spec[2]] : []);
  return wlHd(p) + '<dl class="wl-sh">' + rows.map(function(r){ return '<div><dt>' + (r[0] === 'Year' && / to |onwards/.test(r[1]) ? 'Years' : r[0]) + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' +
    (p.head ? '<div class="wl-hf">' + p.head.map(function(h){ return '<p><b>' + h[0] + '</b><span>' + h[1] + '</span></p>'; }).join('') + '</div>' : '');
}
/* camera set-up per shot, tuned for the prototype's stage sizes; the camera distance is scaled so other widths see the same stretch of wall */
function shot(m, w, avail){
  var b = m ? {w:358, h:500, fov:50, y:1.7, z:11.2, ly:.75, off:.4} : {w:1192, h:470, fov:34, y:2.15, z:8.6, ly:1.8, off:.7};
  /* desktop: the stage fills the window height (name strip above, bar below), within limits */
  /* phone: 400 tall (was 500: the bubble and the first section buttons now show without scrolling, user 2026-11-09) */
  var h = m ? 400 : Math.round(clamp(avail || w * .394, 420, 900));
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
  var st = Stage(host, c.w, c.h, {fov:c.fov, k:c.k, sun:[-7, 13, 10], sb:24, fs:110, sm:m ? 1024 : 2048});
  if (!st){ home.classList.remove('g3d'); flatList(); return false; }
  document.documentElement.classList.remove('g3d-wait');  /* visible before anything takes focus */
  G.mode = m ? 'm' : 'd'; G.w = home.clientWidth; G.h = window.innerHeight;
  var keyEls = [].slice.call(home.querySelectorAll('.key')), live = home.querySelector('.live'), busy = false, pushed = null, clock = new Clock();
  var T = st.T, M = st.M;
  /* desktop sizes (2026-11-23): one picture height for every single bay (PH, the bezel takes the clip's shape), frame bays a
     2.2 tall big frame (FH, width from its clip, capped at FW) + two 1.0 tall small ones stacked to its right (FS, gap FG).
     A desktop bay = SL (the monitor's gap, the stand in front of it) + the picture(s) + ZONE (the guide and its bubble in
     the gallery, the monitor in a case). Frame bays are sized for the widest big + small pair (any game can be big).
     The About bay stays 5.25, so the first shot still frames the About sign and the whole lead screen. Phone keeps its sizes */
  var PH = 2.55, FH = 2.2, FW = 4.5, FS = 1.0, FG = .4, ZONE = 2.9, SL = m ? .5 : 2.75;
  function bigW(ar){ return Math.min(FH*ar, FW); }
  function span(p){
    if (!p.items) return PH*p.ar;
    return Math.max.apply(null, p.items.map(function(it){ return bigW(it.ar); })) + FG + Math.max.apply(null, p.items.map(function(it){ return FS*it.ar; }));
  }
  var BW = [m ? 6.4 : 5.25].concat(P.map(function(p, i){ return m ? (i === 0 || p.items ? 8.0 : 6.6) : SL + span(p) + ZONE; })), x0 = -BW[0]/2, x1 = x0 + BW.reduce(function(a, b){ return a + b; }, 0);
  st.box(x1 - x0 + .3, 6.4, .3, M.wall, (x0 + x1)/2, 3.2, -.15); st.sunSpan(x0, x1);
  /* bay dividers: the visible wall only receives shadows. r128 draws back faces into the shadow map, so the divider's own
     shadow-side face sat within a texel of the back wall and floor and a lit band leaked along the joins; an invisible
     caster (front faces only) inset .1 on the lit sides (sun at -x, +y, +z) and running .3 into the wall and floor casts instead */
  var SHM = new T.MeshBasicMaterial({colorWrite:false, depthWrite:false}); SHM.shadowSide = T.FrontSide;
  function divider(x){
    st.box(.3, 3.3, 2.0, M.wall, x, 1.65, 1.0).castShadow = false;
    st.box(.2, 3.5, 2.2, SHM, x + .05, 1.45, .8).receiveShadow = false;
  }
  var x = x0, hits = [], signs = []; divider(x);
  /* the sign's face: title in Archivo 800, the sub line in Plex Mono caps, a short green rule (colours from the page's tokens) */
  var css = getComputedStyle(document.documentElement), tok = function(n){ return css.getPropertyValue(n).trim(); };
  function signDraw(t, sub){
    return function(x, W, H){
      x.fillStyle = tok('--p2'); x.fillRect(0, 0, W, H);
      var ts = Math.round(H*.38); x.font = '800 ' + ts + 'px Archivo'; var tw = x.measureText(t).width;
      if (tw > W*.88){ ts = Math.floor(ts*W*.88/tw); x.font = '800 ' + ts + 'px Archivo'; }
      x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = tok('--ink'); x.fillText(t, W/2, H*.47);
      var ss = Math.round(H*.155); x.font = '500 ' + ss + 'px "IBM Plex Mono"'; var u = sub.toUpperCase(), uw = x.measureText(u).width;
      if (uw > W*.92){ ss = Math.floor(ss*W*.92/uw); x.font = '500 ' + ss + 'px "IBM Plex Mono"'; }
      x.fillStyle = tok('--mut'); x.fillText(u, W/2, H*.72);
      x.fillStyle = tok('--sig'); x.fillRect(W/2 - H*.3, H*.84, H*.6, Math.max(4, H*.03));
    };
  }
  /* the About sign's face: a mono "ABOUT" label, the lead line in Archivo 800, a short green rule, the body (desktop) in Archivo, wrapped.
     draw(null, W) = the height the text needs as a share of W (the sign is sized from it); painting fits the type to the card
     (the fonts that loaded since run shorter or longer) */
  function aboutDraw(ph){
    function wrap(x, t, mw){ var ws = t.split(' '), ls = [], ln = ''; ws.forEach(function(w){ var tt = ln ? ln + ' ' + w : w; if (ln && x.measureText(tt).width > mw){ ls.push(ln); ln = w; } else ln = tt; }); if (ln) ls.push(ln); return ls; }
    function lay(x, W, f){
      var pd = W*.055, mw = W - 2*pd, y = pd + W*.012, out = [], ls = W*.034*f, lz = W*(ph ? .07 : .06)*f, bz = W*.04*f;
      x.font = '500 ' + ls + 'px "IBM Plex Mono"'; y += ls; out.push({f:x.font, c:'--mut', t:'ABOUT', y:y}); y += ls*.75;
      x.font = '800 ' + lz + 'px Archivo'; wrap(x, H.lead, mw).forEach(function(t){ y += lz*1.2; out.push({f:x.font, c:'--ink', t:t, y:y - lz*.22}); });
      y += lz*.3; out.push({rule:true, y:y}); y += Math.max(4, W*.006);
      if (!ph){ y += bz*.6; x.font = '400 ' + bz + 'px Archivo'; wrap(x, H.about, mw).forEach(function(t){ y += bz*1.5; out.push({f:x.font, c:'--ink', t:t, y:y - bz*.4}); }); }
      return {out:out, h:y + pd, pd:pd};
    }
    return function(x, W, Hh){
      if (!x) x = document.createElement('canvas').getContext('2d');
      var f = 1, L = lay(x, W, f);
      if (!Hh) return L.h/W;
      /* the largest type that fits the card (it was sized with whatever font was in), up to 30% bigger; what is left over
         is split above and below */
      var lo = .5, hi = 1.3;
      if (L.h > Hh || lay(x, W, hi).h > Hh){ for (var n = 0; n < 12; n++){ var md = (lo + hi)/2; if (lay(x, W, md).h <= Hh) lo = md; else hi = md; } f = lo; } else f = hi;
      L = lay(x, W, f); var dy = Math.max(0, (Hh - L.h)/2);
      x.fillStyle = tok('--p2'); x.fillRect(0, 0, W, Hh); x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      L.out.forEach(function(o){
        if (o.rule){ x.fillStyle = tok('--sig'); x.fillRect(L.pd, o.y + dy, W*.12, Math.max(4, W*.006)); return; }
        x.font = o.f; x.fillStyle = tok(o.c); x.fillText(o.t, L.pd, o.y + dy);
      });
    };
  }
  /* every bay has a stand (the player-start pad). On desktop it sits left of the screen, where the guide stands on the
     project page's low shot, so the two line up; the guide talks from its spot on the right. It steps onto the stand
     only when it walks in from off screen (coming back from a project page), then walks over to its spot */
  function standAt(z, l, s){ var q = m ? {x:z.x + .45, z:z.z - .8} : {x:s ? l + SL - 1.0 : l + .8, z:z.z}; GB.stand(T, st.S, q.x, q.z); return q; }
  var secs = BW.map(function(bw, s){
    var l = x, cx = x + bw/2; x += bw; divider(x);
    var zone = {x:s ? l + bw - ZONE/2 + .3 : l + bw - .5, z:1.6};   /* where the guide stands on desktop: the zone's centre + .3 (About: clear of the sign) */
    if (m) zone = {x:s ? cx - 1.35 : cx - .95, z:s ? 3.6 : 4.9}; /* phone: front left, in from the edge */
    if (s === 0){
      /* the About sign is a 3D sign too (2026-11-24; was an HTML card): its text stays in the page for screen readers */
      host.appendChild(el('section', 'sr', '<h2>About</h2><p>' + H.lead + '</p>' + (m ? '' : '<p>' + H.about + '</p>')));
      var aw = m ? 5.0 : 3.3, ad = aboutDraw(m), ah = aw*ad(null, 1000, 0);
      var asg = st.sign(aw, ah, ad); asg.position.set(m ? cx : l + .28 + aw/2, (m ? 3.7 : 3.3) - ah/2, .05);
      asg.userData.hit = {s:0, sign:true}; hits.push(asg); signs.push(asg);
      return {cx:cx, l:l, bw:bw, zone:zone, pad:standAt(zone, l, 0), sign:asg};
    }
    var i = s - 1, p = P[i], scr3 = [], sc, sw, sy, scx;
    if (p.items){
      /* one main screen + two small, stacked to its right. Slots = {left edge, centre y, height}: each frame keeps its clip's
         shape, so a frame in a slot has a uniform scale (slot height / its own height) and its centre x follows its width */
      sy = m ? 2.4 : 2.05;
      var place = (function(items, sy){
        /* phone: 16:9 frames, as before. Desktop: the stacked small pair (1.0 + .2 + 1.0) matches the big frame */
        var mw = 2.7, smw = 1.2, gap = .3, dy = m ? smw/(16/9)/2 + .1 : FS/2 + .1, gl = m ? cx - (mw + gap + smw)/2 : l + SL;
        return function(k, j, big){
          var w = m ? (j ? smw : mw) : (j ? FS*items[k].ar : bigW(items[k].ar)), le = !j ? gl : gl + (m ? mw + gap : bigW(items[big].ar) + FG);
          return {x:le + w/2, y:j ? sy + (j === 1 ? dy : -dy) : sy, w:w};
        };
      })(p.items, sy);
      p.items.forEach(function(it, k){
        var q = place(k, k, 0), w = q.w, px = q.x, py = q.y;
        var g = st.screen({img:it.img, ar:it.ar}, w, null, !m); g.position.set(px, py, .03);
        var lab = el('span', 'pin tl', it.t), lv = new T.Vector3(); lab.setAttribute('aria-hidden', 'true'); host.appendChild(lab);
        /* follows its screen (the case view swaps the University screens round) */
        st.pin(lab, null, 0, 0, {clamp:false, get:function(){ var sc = g.scale.x; return lv.set(g.position.x - (w*sc)/2 - .08, g.position.y - (g.userData.h*sc)/2 - .1, .05); }});
        scr3.push({sc:g, scx:px, sy:py, sw:w, lab:lab});
      });
      sc = scr3[0].sc; scx = scr3[0].scx; sw = scr3[0].sw;
    } else {
      sw = m ? (i ? 3.7 : 4.7) : PH*p.ar; sy = m ? 2.35 : 2.05;
      scx = m ? cx : l + SL + sw/2; sc = st.screen(p, sw, null, !m); sc.position.set(scx, sy, .03);
      scr3.push({sc:sc, scx:scx, sy:sy, sw:sw});
    }
    st.box(sw*.6, .3, .5, i ? M.prop : M.lead, scx, .15, 1.0);
    /* the title: a lit 3D sign centred .24 above the main screen / big frame (2026-11-23; was an HTML plate). A click on it
       selects the section, or opens it if it is already selected (act) */
    var lead = !i, gw = lead ? Math.min(sw*.86, 3.9) : Math.min(sw*.8, 3.6), gh = lead ? .84 : .74;
    var sg = st.sign(gw, gh, signDraw(p.t, m ? p.subM : p.sub)); sg.position.set(scx, sy + sc.userData.h/2 + .08 + .24 + gh/2, .05);
    sg.userData.hit = {s:s, sign:true}; hits.push(sg); signs.push(sg);
    scr3.forEach(function(o, k){ o.sc.userData.hit = {s:s, k:k}; hits.push(o.sc); });
    return {cx:cx, l:l, bw:bw, zone:zone, pad:standAt(zone, l, s), sc:sc, sw:sw, sy:sy, scx:scx, sign:sg, i:i, scr:scr3, place:place};
  });
  /* the signs were painted with whatever fonts were in: repaint once Archivo and Plex Mono have loaded */
  if (document.fonts && document.fonts.load) Promise.all(['800 40px Archivo', '500 20px "IBM Plex Mono"'].map(function(f){ return document.fonts.load(f); }))
    .then(function(){ signs.forEach(function(g){ g.userData.paint(); }); }, function(){});
  /* the guide: capsule + speech bubble */
  var plr = capsule(T, M.white, 1.1), body = plr.userData.body; plr.position.set(secs[0].zone.x, .02, secs[0].zone.z); st.S.add(plr);
  var bub = el('div', 'pin bub' + (m ? ' side' : ''), ''); bub.id = 'guide-bubble'; host.appendChild(bub);
  /* motion on the wall: the selected screen's clip plays in an HTML layer pinned over the still texture */
  var ov = el('div', 'pin vov', ''); ov.setAttribute('aria-hidden', 'true'); ov.hidden = true; host.insertBefore(ov, host.querySelector('.pin'));
  var ovS = -1, ovK = 0, cn = [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()];
  st.pin(ov, null, 0, 0, {rect:function(proj){
    var o = secs[ovS]; if (!o) return; var tg = o.scr[ovK], u = tg.sc.userData, k = tg.sc.scale.x, a0 = tg.scx - u.iw*k/2, a1 = tg.scx + u.iw*k/2, y0 = tg.sy - u.ih*k/2, y1 = tg.sy + u.ih*k/2;
    cn[0].set(a0, y0, .035); cn[1].set(a1, y0, .035); cn[2].set(a0, y1, .035); cn[3].set(a1, y1, .035);
    var ps = cn.map(proj); GB.quad(ov, [ps[2], ps[3], ps[1], ps[0]]);
  }});
  /* section s's clip and the frame it plays in (an items bay: the game that is big; the case may have swapped them) */
  function clipOf(s){
    var p = s > 0 ? P[s - 1] : null, k = p && p.items && secs[s].order ? secs[s].order.indexOf(0) : 0, c = p && p.items ? p.items[k] : p;
    return c && c.clip ? {c:c, k:k} : null;
  }
  /* the selected section's clip; its <video> comes from the clip cache (GB.clip), so a section you come back to resumes at once.
     The overlay stays invisible (.wait) until the video has a frame, so the still shows instead of a black box */
  function showOv(s){
    var q = RM ? null : clipOf(s); if (!q){ hideOv(); return; }
    var c = q.c, v = ov.querySelector('video'), fresh = ov.hidden || !v || v.getAttribute('src') !== c.clip;
    if (!v || v.getAttribute('src') !== c.clip){ v = GB.clip(c.clip, c.img); GB.clipPut(ov, v); ov.classList.toggle('px', !!c.px); }
    if (fresh) GB.clipGate(ov, v);
    ovS = s; ovK = q.k; ov.hidden = false;
    v.muted = true; var pr = v.play(); if (pr && pr.catch) pr.catch(function(){});
    /* once it plays, pre-warm the neighbours' clips (paused, preloading), so arriving there shows motion straight away */
    function warm(){ if (ovS !== s) return; [s - 1, s + 1].forEach(function(j){ var w = j > 0 && j < secs.length && clipOf(j); if (w) GB.clip(w.c.clip, w.c.img); }); }
    if (!v.paused && v.readyState >= 3) warm(); else v.addEventListener('playing', warm, {once:true});
  }
  function hideOv(){ ov.hidden = true; ovS = -1; var v = ov.querySelector('video'); if (v) v.pause(); }
  var head = new T.Vector3();
  /* the bubble (2026-11-23). Desktop, a section: in the zone right of the screen, its left edge .35 right of the bezel, as wide
     as the zone allows (280 px at most), its tail over the guide (--tail), its bottom just above the guide's head. Desktop About:
     centred over the guide, or opening right (.abr). Phone: beside the guide, never over the picture */
  var bubS = 0, bv = new T.Vector3();
  function zoneL(s){ var o = secs[s]; return o.l + SL + span(P[s - 1]) + .08 + .35; }
  function picBottom(proj, s){ var o = secs[s], g = o.sc; return proj(bv.set(g.position.x, g.position.y - g.userData.h*g.scale.x/2 - .08, .05))[1]; }
  var bubPin = st.pin(bub, null, m ? 0 : .5, m ? .05 : 1, {rect:function(proj){
    var k = c.k, hd = proj(head.set(plr.position.x + (m ? .38 : 0), m ? .7 : 1.42, plr.position.z)), ew, eh = bub.offsetHeight*k, x, y;
    if (!m && bubS > 0){
      var o = secs[bubS], zl = proj(bv.set(zoneL(bubS), 1.42, .05))[0], zr = proj(bv.set(o.l + o.bw - .2, 1.42, .05))[0];
      ew = Math.max(120*k, Math.min(280*k, zr - zl)); var wc = (ew/k).toFixed(1) + 'px';
      if (bub.style.width !== wc){ bub.style.width = wc; eh = bub.offsetHeight*k; }
      x = zl; y = hd[1] - eh - 6;
      bub.style.setProperty('--tail', (clamp(hd[0] - x, 16*k, ew - 16*k)/k).toFixed(1) + 'px');
    } else {
      if (bub.style.width) bub.style.width = '';
      ew = bub.offsetWidth*k; x = hd[0] - bubPin.ax*ew + (m ? 8 : 0); y = hd[1] - bubPin.ay*eh + (m ? 0 : -6);
      bub.style.removeProperty('--tail');
      if (m && bubS > 0) y = Math.max(y, picBottom(proj, bubS) + 10);
    }
    x = clamp(x, 6, c.w - ew - 6); y = clamp(y, 6, c.h - eh - 6);
    bub.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)' + (k < 1 ? ' scale(' + k.toFixed(3) + ')' : '');
  }});
  /* an items bay opens the game in its big frame (the case may have swapped them round) */
  function bigK(s){ return secs[s] && secs[s].order ? secs[s].order.indexOf(0) : 0; }
  function say(s, announce){
    bub.innerHTML = bubHTML(s - 1, m); bub.classList.toggle('sm', s > 0); bubS = s;
    /* desktop About: the (narrower) bay puts the guide near the sign, so its bubble opens to the right, over the next bay's empty wall */
    bub.classList.toggle('abr', !m && !s); bubPin.ax = !m && !s ? .1 : m ? 0 : .5;
    var ob = bub.querySelector('.openb'), p = P[s - 1];
    if (ob){ if (p.items) ob.href = p.items[bigK(s)].href; ob.addEventListener('click', function(e){ e.preventDefault(); open(s, bigK(s)); }); }
    bub.hidden = false; fitSum(); if (!RM) restart(bub);
    if (announce) live.textContent = s ? P[s - 1].t : 'About';
  }
  /* the summary scrolls inside when the bubble would not fit above the guide (desktop), or past ~60% of the stage (phone: the screen
     stays in view): Learn more always shows */
  function fitSum(){
    var sm = bub.querySelector('.sum'); if (!sm) return;
    sm.style.maxHeight = ''; sm.scrollTop = 0;
    /* desktop: from the guide's head up to the sign's top; phone: from under the picture to the stage's bottom */
    bubPin.rect(st.proj);
    var o = secs[bubS], room;
    if (m) room = bubS > 0 ? c.h - picBottom(st.proj, bubS) - 10 - 6 : Math.round(c.h*.62);
    else {
      var hy = st.proj(head.set(plr.position.x, 1.42, plr.position.z))[1] - 6, top = bubS > 0 && o.sign ? objRect(o.sign).y : 10;
      room = (hy - top)/c.k;
    }
    var over = bub.offsetHeight - room;
    if (over > 0) sm.style.maxHeight = Math.max(54, sm.offsetHeight - over) + 'px';
  }

  /* the wall monitor (desktop only, 2026-11-23; was a paper label): a small monitor hung on two lines, its HTML face
     (#wall-label) fitted to the projected face. In the gallery it hangs left of the selected screen (right edge .4 from the
     picture, top level with it) with the section's facts and stack; in a case (js/case.js) .3 right of the rightmost frame,
     with the section sheet + the part's Now row. W.t: 0 = gallery side (left), 1 = case side (right) */
  var wl = null, mon = null, W = {s:-1, t:0, tok:0, html:'', v:0}, wv = new T.Vector3(), mcn = [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()];
  /* where the monitor hangs for section s on side t (its centre) */
  function monAt(s, t){
    var o = secs[s]; if (!o || !o.scr) return null;
    /* fixed per bay, so it stays put while a case swaps its frames round: the top of the big picture, the frames' widest extent */
    var p = P[s - 1], u = mon.userData, top = o.sy + (p.items ? FH : PH)/2 + .08, right = o.l + SL + span(p);
    return {x:t ? right + .08 + .3 + u.W/2 : o.l + SL - .4 - u.W/2, y:top - u.H/2, z:.09};
  }
  if (!m){
    mon = st.monitor(2.0, 1.6); mon.visible = false;
    wl = el('aside', 'pin wl', '<div class="wl-in"></div>'); wl.id = 'wall-label'; wl.setAttribute('aria-label', 'Notes'); wl.hidden = true;
    host.appendChild(wl);
    var wfit = {key:'', s:1};
    st.pin(wl, null, 0, 0, {rect:function(proj){
      if (!mon.visible) return;
      var u = mon.userData, x = mon.position.x, y = mon.position.y, z = mon.position.z + .072, hw = u.w/2, hh = u.h/2;
      mcn[0].set(x - hw, y - hh, z); mcn[1].set(x + hw, y - hh, z); mcn[2].set(x - hw, y + hh, z); mcn[3].set(x + hw, y + hh, z);
      var ps = mcn.map(function(v){ return proj(v); }), r = GB.quad(wl, [ps[2], ps[3], ps[1], ps[0]], true), fw = r.w, fh = r.h;
      /* the text scales by k (as the other pins), and further down only if it would not fit the face */
      var inn = wl.firstChild, key = W.v + '|' + Math.round(fw) + '|' + Math.round(fh);
      if (wfit.key !== key){
        var sc = c.k;
        for (var n = 0; n < 5; n++){ inn.style.width = (fw/sc) + 'px'; inn.style.transform = 'scale(' + sc.toFixed(3) + ')'; var hh2 = inn.offsetHeight*sc; if (hh2 <= fh + .5) break; sc *= Math.max(.7, Math.sqrt(fh/hh2)); }
        wfit.key = key; wfit.s = sc;
      }
    }});
  }
  /* the monitor's moves (option A, "fly in", 2026-11-23): any change of place flies it up out of shot (.7 s, ease-in),
     it travels unseen and swaps its content there, drops in at the new place (.8 s, ease-out, a small settle) and switches
     on (a CRT line opening: .wl.boot). Its own tween handle (F.tw), which only this code cancels: select() and the drag kill
     the dolly's tweens, not this one; a new move while flying retargets the drop. Reduced motion, rebuilds, direct
     #id/case links: placed at once. wl.dataset.at = '<s>:<gallery|case>' only once it has landed and switched on */
  var F = {tw:null, g:null, tok:0}, built = false, tcam = new T.PerspectiveCamera(c.fov, c.w/c.h, .1, 400), tv = new T.Vector3();
  function landKey(g){ return g.s + ':' + (g.t ? 'case' : 'gallery'); }
  /* the centre y at which the whole monitor is above the top of cam's view at x (+ a margin): from the camera, not a fixed number */
  function clearY(x, cam){
    var u = mon.userData, lo = 0, hi = 80;
    for (var n = 0; n < 22; n++){
      var mid = (lo + hi)/2, ok = [-1, 1].every(function(sd){ tv.set(x + sd*u.W/2, mid - u.H/2 - .15, .2).project(cam); return tv.y > 1.02 || tv.z > 1; });
      if (ok) hi = mid; else lo = mid;
    }
    return hi + .3;
  }
  function outY(x, sh){
    var y = clearY(x, st.cam);
    if (sh){ tcam.aspect = c.w/c.h; tcam.updateProjectionMatrix(); tcam.position.copy(sh.p); tcam.lookAt(sh.l); tcam.updateMatrixWorld(); y = Math.max(y, clearY(x, tcam)); }
    return y;
  }
  function setFace(html){ W.tok++; W.html = html; wl.firstChild.innerHTML = html; W.v++; wl.classList.remove('fade'); }
  function kill(){ if (F.tw){ clock.kill(F.tw); F.tw = null; } F.tok++; }
  /* to section s, side t (0 gallery, 1 case) with html; o.cut: no flight; o.sh: the shot the camera is heading for */
  function monTo(s, t, html, o){
    if (!wl) return; o = o || {};
    var q = s > 0 && html ? monAt(s, t) : null;
    if (!q){ monOut(o); return; }
    var same = F.g && F.g.s === s && F.g.t === t;
    F.g = {s:s, t:t, html:html, sh:o.sh}; W.s = s; W.t = t;
    if (same && !o.cut && (F.tw || wl.dataset.at || wl.classList.contains('boot'))){ wlSet(html); return; }   /* there, or on its way: only the content */
    if (RM || o.cut){
      kill(); mon.position.set(q.x, q.y, q.z); setFace(html); mon.visible = true; wl.hidden = false;
      wl.classList.remove('dark', 'boot'); wl.dataset.at = landKey(F.g); st.render(); return;
    }
    fly();
  }
  /* out of shot, and stay there (About, a drag, leaving a case until the camera is back) */
  function monOut(o){
    if (!wl) return; o = o || {}; F.g = null;
    if (RM || o.cut || !mon.visible){ kill(); mon.visible = false; wl.hidden = true; wl.classList.remove('boot'); delete wl.dataset.at; st.render(); return; }
    if (!F.tw || F.down) fly();
  }
  function fly(){
    kill(); delete wl.dataset.at; wl.classList.remove('boot'); wl.classList.add('dark');
    if (!mon.visible){ drop(); return; }
    var y0 = mon.position.y, top = outY(mon.position.x, F.g && F.g.sh), dur = .7*clamp((top - y0)/3, .3, 1);
    F.down = false;
    F.tw = clock.add(dur, function(q){ mon.position.y = lerp(y0, top, q*q); st.render(); }, function(){ F.tw = null; mon.visible = false; wl.hidden = true; st.render(); drop(); });
  }
  function drop(){
    var g = F.g; if (!g) return;
    var q = monAt(g.s, g.t), top = outY(q.x, g.sh), tok = F.tok;
    setFace(g.html); wl.classList.add('dark'); mon.position.set(q.x, top, q.z); mon.visible = true; wl.hidden = false;
    F.down = true;
    F.tw = clock.add(.8, function(p){
      var e = 1 - Math.pow(1 - p, 3);
      mon.position.y = q.y + (top - q.y)*(1 - e) - .05*Math.sin(Math.PI*clamp((p - .7)/.3, 0, 1)); st.render();
    }, function(){
      F.tw = null; F.down = false; mon.position.y = q.y; wl.classList.remove('dark'); void wl.offsetWidth; wl.classList.add('boot'); st.render();
      setTimeout(function(){ if (tok === F.tok && F.g === g){ wl.classList.remove('boot'); wl.dataset.at = landKey(g); } }, 420);
    });
  }
  /* new content: cross-fades once it has landed; while it flies, the drop takes it */
  function wlSet(html){
    if (!wl) return;
    if (F.g) F.g.html = html;
    if (F.tw || !mon.visible){ if (F.down) setFace(html); return; }
    if (html === W.html) return;
    W.html = html; var tok = ++W.tok;
    function put(){ if (tok !== W.tok) return; wl.firstChild.innerHTML = html; W.v++; st.render(); void wl.offsetWidth; wl.classList.remove('fade'); }
    if (RM){ put(); return; }
    wl.classList.add('fade'); setTimeout(put, 160);
  }
  function galShot(s){ return {p:new T.Vector3(sx[s] + c.off, c.y, c.z), l:new T.Vector3(sx[s], c.ly, 0)}; }
  /* the gallery: the selected section's facts, on its left (About: none) */
  function wlShow(s){ if (wl) monTo(s, 0, s > 0 ? wlHTML(s - 1) : '', {cut:!built, sh:galShot(s)}); }
  /* projected rects of the monitor's bezel and face (tests) */
  G.mon = function(){ return mon && mon.visible ? {bezel:objRect(mon.children[0]), face:objRect(mon.userData.face)} : null; };
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
  function rest(){ return m ? .35 : -.45; }
  function face(){ plr.rotation.y = rest(); }
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
  /* soft (after a walk): the guide eases round to face the viewer and settles its bob, instead of snapping */
  function arrive(s, announce, soft){
    if (soft && !RM){
      var y0 = body.position.y, x0 = body.rotation.x, left = Math.abs(lerpA(plr.rotation.y, rest(), 1) - plr.rotation.y);
      walk = clock.add(clamp(left/5 + .2, .3, .85), function(q){
        if (inCase()) return; var e = 1 - Math.pow(1 - q, 3);
        if (q < 1) steer(plr, rest(), 12); else face();
        body.position.y = y0*(1 - e); body.rotation.x = x0*(1 - e); st.render();
      });
    } else { body.position.y = 0; body.rotation.x = 0; face(); }
    at = s; say(s, announce); wlShow(s); showOv(s); st.render();
  }
  function select(s, anim, announce, soft){
    G.sel = s; setRove(keyEls, s);
    keyEls.forEach(function(kk, j){ if (j === s) kk.setAttribute('aria-describedby', bub.id + (wl && s ? ' ' + wl.id : '')); else kk.removeAttribute('aria-describedby'); });
    secs.forEach(function(o, j){ if (o.sc) o.sc.userData.sel.visible = j === s; });
    clock.kill(tw); clock.kill(walk);
    var from = camX, to = sx[s], a = {x:plr.position.x, z:plr.position.z}, b = secs[s].zone;
    if (!anim || RM){ put(to); plr.position.set(b.x, .02, b.z); arrive(s, announce, soft); return; }
    var dur = clamp(Math.abs(to - from)/9, .4, .9);
    bub.hidden = true; monOut(); hideOv();
    tw = clock.add(dur, function(p){ put(lerp(from, to, eio(p))); st.render(); });
    var rt = route(a, b);
    if (rt.tot < .01){ plr.position.set(b.x, .02, b.z); walk = clock.add(dur, function(){}, function(){ arrive(s, announce); }); return; }
    /* the guide starts a beat later and arrives a beat after the camera, so it reads as following; the detour round the wall adds a little */
    var wd = dur + (rt.segs.length > 1 ? .3 : 0);
    walk = clock.add(wd + .18, function(p){
      var q = clamp((p*(wd + .18) - .08)/wd, 0, 1), dist = eio(q)*rt.tot, o = along(rt, dist);
      /* heading turns smoothly into each leg, and back towards the viewer over the last steps */
      plr.position.set(o.x, .02, o.z); steer(plr, q > .82 ? rest() : o.ry);
      body.position.y = Math.abs(Math.sin(dist*1.6))*.07; body.rotation.x = .2*Math.sin(Math.PI*q);
      st.render();
    }, function(){ arrive(s, announce, true); });
  }
  function act(s){ if (busy) return; if (G.sel === s && at === s && Math.abs(camX - sx[s]) < .05){ if (s > 0) open(s, bigK(s)); } else select(s, true, true); }
  function pushTarget(s, k){
    var tg = secs[s].scr[k || 0], half = Math.tan(c.fov*Math.PI/360), asp = c.w/c.h, sh = tg.sc.userData.h*tg.sc.scale.x;
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
        plr.position.set(lerp(pd.x, zn.x, e), GB.STAND_H - (GB.STAND_H - .02)*dn, lerp(pd.z, zn.z, e)); steer(plr, q > .75 ? rest() : Math.atan2(zn.x - pd.x, zn.z - pd.z));
        body.position.y = Math.abs(Math.sin(e*dz*1.6))*.07; body.rotation.x = .2*Math.sin(Math.PI*q);
        st.render();
      }, function(){ busy = false; select(s, false, false, true); if (done) done(); });
    });
  }
  /* back from the case study: start inside the screen and pull out to the section shot */
  /* ...while the guide walks in from off screen (left), steps up onto the section's stand, then walks over to its spot */
  function pullBack(s){
    var pp = pushed || pushTarget(s, 0), pd = secs[s].pad; pushed = null;
    if (RM){ busy = false; select(s, false); return; }
    busy = true; clock.kill(tw); clock.kill(walk); bub.hidden = true; monOut({cut:true}); hideOv();
    var to = sx[s], p2 = new T.Vector3(to + c.off, c.y, c.z), l2 = new T.Vector3(to, c.ly, 0), tpv = new T.Vector3(), tl = new T.Vector3();
    var zw = m ? pd.z : ZOUT, a = {x:to - (m ? 3.2 : 6.5), z:zw}, rt = {segs:[], tot:0};
    [a, {x:pd.x, z:zw}, pd].reduce(function(u, v){ var d = Math.hypot(v.x - u.x, v.z - u.z); if (d > 1e-4){ rt.segs.push({a:u, b:v, d:d, s:rt.tot}); rt.tot += d; } return v; });
    G.sel = s; setRove(keyEls, s); plr.position.set(a.x, .02, a.z);
    st.setCam(pp.p, pp.l); camX = to; st.render();
    clock.add(.6, function(q){ var e = eio(q); tpv.copy(pp.p).lerp(p2, e); tl.copy(pp.l).lerp(l2, e); st.setCam(tpv, tl); st.render(); });
    function toSpot(){ standToSpot(s, .35); }
    walk = clock.add(1.4, function(q){
      var w = clamp(q/.86, 0, 1), up = clamp((q - .82)/.18, 0, 1), dist = eio(w)*rt.tot, o = along(rt, dist);
      plr.position.set(o.x, .02 + (GB.STAND_H - .02)*up, o.z); steer(plr, up > 0 ? rest() : o.ry, up > 0 ? 14 : 9);
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
    function(){ drag = !inCase(); if (!drag) return; clock.kill(tw); clock.kill(walk); bub.hidden = true; monOut(); hideOv(); dx0 = camX; },
    function(dx){ if (!drag) return; put(clamp(dx0 - dx/ppu, sx[0] - 1, sx[N - 1] + 1)); st.render(); },
    function(){ if (drag) snap(); },
    /* clicking a capture opens its page, the same way as Learn more */
    function(e){ var h = st.pick(e.clientX, e.clientY, hits); if (G.cs && G.cs.on()){ G.cs.tap(h); return; } if (h && h.sign){ act(h.s); return; } if (h && P[h.s - 1].href) open(h.s, h.k); },
    function(e){ var h = st.pick(e.clientX, e.clientY, hits); host.classList.toggle('over', G.cs && G.cs.on() ? G.cs.canTap(h) : !!(h && (h.sign || P[h.s - 1].href))); });
  var wt = 0;
  host.addEventListener('wheel', function(e){
    var dd = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0); if (!dd || busy || (G.cs && G.cs.on())) return;
    e.preventDefault(); clock.kill(tw); clock.kill(walk); bub.hidden = true; monOut(); hideOv(); put(clamp(camX + dd/ppu, sx[0] - 1, sx[N - 1] + 1)); st.render(); clearTimeout(wt); wt = setTimeout(snap, 180);
  }, {passive:false});
  keyEls.forEach(function(kk, s){ kk.addEventListener('click', function(){ act(s); }); });
  rove(keyEls, function(j){ select(j, true, true); });

  G.cs = window.CaseMode ? window.CaseMode({st:st, T:T, M:M, clock:clock, host:host, home:home, m:m, c:c, P:P, secs:secs, sx:sx, plr:plr, body:body,
    live:live, gbub:bub, keys:home.querySelector('.keys:not(.ckeys)'), ckeys:home.querySelector('.ckeys'), cmb:home.querySelector('.cmb'), keyEls:keyEls,
    ZOUT:ZOUT, RM:RM, hideOv:hideOv,
    wl:{on:!!wl, set:wlSet, fly:monTo, out:monOut, gallery:function(s){ return wlHTML(s - 1); }, sheet:function(s){ return sheetHTML(s - 1); }, face:function(v){ if (wl) wl.style.visibility = v ? '' : 'hidden'; }, right:function(s){ var q = monAt(s, 1); return q ? q.x + mon.userData.W/2 : 0; }}, pushTarget:pushTarget, standToSpot:standToSpot,
    setBusy:function(v){ busy = v; }, busy:function(){ return busy; },
    galleryShot:function(s){ return {p:new T.Vector3(sx[s] + c.off, c.y, c.z), l:new T.Vector3(sx[s], c.ly, 0)}; },
    atGallery:function(s){ camX = sx[s]; put(sx[s]); },
    /* phone case view: a shorter stage; galleryH puts it back */
    galleryH:c.h, setStageH:function(h){ if (c.h === h) return; c.h = h; host.style.height = h + 'px'; st.resize(c.w, h); }}) : null;
  /* where to start: a returning visitor pulls back out of the screen they opened; a #section link starts on that section;
     #<id>/case opens that case (from a project file, or a shared link): inside its screen, pulling out low */
  var s0 = start && start.sel >= 0 ? start.sel : 0;
  if (start && start.cs && G.cs){ G.sel = s0; setRove(keyEls, s0); put(sx[s0]); G.cs.enter(s0, start.cs.k, {inside:!start.cs.cut, cut:!!start.cs.cut, direct:true, part:start.cs.part, focus:start.focus || hadFocus}); }
  else {
    if (start && start.pull) pullBack(s0); else select(s0, false);
    if (start && start.focus) keyEls[s0].focus({preventScroll:true});
    else if (hadFocus) keyEls[s0].focus({preventScroll:true});
  }
  built = true;   /* from here on the wall monitor flies between places */

  /* test hook: projected stage-px rects of the meshes the tests can't measure from the DOM (no side effects) */
  var rv = new T.Vector3();
  function prj(pts){
    var ps = pts.map(function(q){ return st.proj(rv.set(q[0], q[1], q[2])); }), xs = ps.map(function(q){ return q[0]; }), ys = ps.map(function(q){ return q[1]; });
    var x = Math.min.apply(null, xs), y = Math.min.apply(null, ys);
    return {x:x, y:y, w:Math.max.apply(null, xs) - x, h:Math.max.apply(null, ys) - y};
  }
  function picRect(g){ var u = g.userData, k = g.scale.x, x = g.position.x, y = g.position.y, z = g.position.z, w = u.w*k/2, h = u.h*k/2; return prj([[x - w, y - h, z], [x + w, y - h, z], [x - w, y + h, z], [x + w, y + h, z]]); }
  function objRect(o){ if (!o || !o.visible) return null; o.updateMatrixWorld(true); var b = new T.Box3().setFromObject(o), a = b.min, z = b.max; return prj([[a.x, a.y, z.z], [z.x, a.y, z.z], [a.x, z.y, z.z], [z.x, z.y, z.z], [a.x, a.y, a.z], [z.x, z.y, a.z]]); }
  window.__dolly = {rects:function(){
    var hd = st.proj(rv.set(plr.position.x, plr.position.y + 1.42, plr.position.z));
    return {stage:{w:c.w, h:c.h}, head:{x:hd[0], y:hd[1]}, mon:G.mon ? G.mon() : null,
      bays:secs.map(function(o, s){ if (!o.scr) return {s:s, sign:o.sign ? objRect(o.sign) : null}; var bk = bigK(s);
        return {s:s, sel:o.sc.userData.sel.visible, main:picRect(o.scr[bk].sc), pics:o.scr.map(function(q){ return picRect(q.sc); }), sign:o.sign ? objRect(o.sign) : null}; })};
  }, objRect:objRect};

  G.api = {
    dispose:function(){ if (G.cs) G.cs.dispose(); clock.killAll(); hideOv(); GB.clipPut(ov, null); st.dispose(); },
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
