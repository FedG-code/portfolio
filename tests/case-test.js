/**
 * Case test: a project's case told in the gallery's scene (js/case.js)
 *
 *   - 4 viewports x 5 cases (index.html#<id>/case): case bar shown, section bar hidden, one canvas, bubble shown,
 *     one bar key per part (+ All projects), no horizontal overflow, no page errors
 *   - parts: Next / Back, bar click, arrow keys (focus follows), live region; link tags; stat chips
 *   - media: Casino's two-clip part plays both clips; Eve's trailer zooms the camera into the frame, Esc zooms back out
 *   - University: a part of another game swaps that game's screen to the big one; the URL names the game
 *   - Other Games: the same three frames (Stealth Game big); each Stealth Game part plays its own clip in the big frame
 *   - project files: with WebGL they redirect into the scene; ?flat and no WebGL keep the plain page;
 *     index.html?flat#<id>/case sends the visitor to the plain page
 *   - reduced motion: the case cuts in
 *
 * Usage: node tests/case-test.js   (server on BASE, default http://localhost:8080)
 */
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://localhost:8080').replace(/\/$/, '') + '/';
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const CASES = [['over-the-hill', 3], ['eve-of-destruction', 3], ['casino-games', 5], ['university-projects', 3], ['other-games', 3]];
// the wall label (desktop): visible, inside the stage, clear of the bubble, link tags, Play button, title plates, frame labels and screens
// waits until the monitor has landed and switched on (wl.dataset.at; a flight takes ~2 s)
const label = async p => { await p.waitForFunction(() => { const w = document.querySelector('#wall-label'); return !w || w.dataset.at; }, null, { timeout: 8000 }).catch(() => {}); return p.evaluate(() => {
  const w = document.querySelector('#wall-label'); if (!w) return { exists: false };
  const r = w.getBoundingClientRect(), sr = document.querySelector('.st').getBoundingClientRect();
  const hit = q => r.left < q.right - 1 && r.right > q.left + 1 && r.top < q.bottom - 1 && r.bottom > q.top + 1;
  const vis = e => !e.hidden && e.offsetWidth > 0 && getComputedStyle(e).opacity !== '0';
  const others = [...document.querySelectorAll('#case-bubble, #guide-bubble, .ctags, .cplay, .pin.tl, .vov')].filter(vis);
  const screens = [...document.querySelectorAll('.vov:not([hidden])')].map(e => e.getBoundingClientRect());
  return { exists: true, at: w.dataset.at, shown: vis(w), left: r.left, right: r.right, top: r.top, bottom: r.bottom, inStage: r.left >= sr.left && r.right <= sr.right && r.top >= sr.top && r.bottom <= sr.bottom,
    hits: others.filter(e => hit(e.getBoundingClientRect())).map(e => e.id || e.className),
    screenL: Math.min(...screens.map(q => q.left)), screenR: Math.max(...screens.map(q => q.right)), screenT: Math.min(...screens.map(q => q.top)),
    chips: [...w.querySelectorAll('.wl-ch dt')].map(d => d.textContent), text: w.textContent, now: (w.querySelector('.wl-now .wl-k') || {}).textContent || '',
    // the HTML face sits inside the monitor's projected bezel (±2 px)
    inBezel: (() => { const m = window.__dolly && window.__dolly.rects().mon; if (!m) return false; const b = m.bezel, x = r.left - sr.left, y = r.top - sr.top;
      return x >= b.x - 2 && y >= b.y - 2 && x + r.width <= b.x + b.w + 2 && y + r.height <= b.y + b.h + 2; })() };
}); };

let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : ''));
  if (!ok) failed++;
}
const ready = p => p.waitForFunction(() => { const b = document.querySelector('#case-bubble'); return b && !b.hidden && b.offsetWidth > 0 && !document.querySelector('.ckeys').hidden; }, null, { timeout: 9000 }).catch(() => {});
const st = p => p.evaluate(() => ({
  hash: location.hash,
  canvases: document.querySelectorAll('canvas').length,
  bar: !!document.querySelector('.ckeys') && !document.querySelector('.ckeys').hidden,
  sections: !!document.querySelector('.keys:not(.ckeys)') && !document.querySelector('.keys:not(.ckeys)').hidden,
  parts: document.querySelectorAll('.ckeys .key:not(.cback)').length,
  key: (document.querySelector('.ckeys .key.on .rt') || {}).textContent || null,
  head: (document.querySelector('#case-bubble .bh') || {}).textContent || null,
  part: (document.querySelector('#case-bubble .bp') || {}).textContent || null,
  bubble: !!document.querySelector('#case-bubble') && !document.querySelector('#case-bubble').hidden,
  live: (document.querySelector('.live') || {}).textContent || '',
  active: document.activeElement ? document.activeElement.textContent.trim().slice(0, 40) : null,
  overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  clips: [...document.querySelectorAll('.vov:not([hidden]) video')].map(v => v.getAttribute('src')),
}));

(async () => {
  let b = await chromium.launch({ args: GL });

  // 1. viewports x cases
  for (const [w, h] of [[1920, 1080], [1024, 768], [390, 844], [812, 375]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 900 });
    for (const [id, parts] of CASES) {
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.goto(BASE + 'index.html#' + id + '/case'); await ready(p);
      const s = await st(p);
      const ok = s.bar && !s.sections && s.canvases === 1 && s.parts === parts && s.bubble && !s.overflow && !errs.length;
      check(`${w}x${h} ${id}: case in the scene`, ok, ok ? undefined : { ...s, errs });
      // a part with stat chips: on desktop they are on the wall label, right of the picture, clear of everything; on phone in the bubble
      const chipPart = id === 'casino-games' ? 1 : id === 'other-games' ? 'tetrarcana' : null;
      if (chipPart !== null) {
        // (phone shows the bubble before the walk-in ends, when Next is still ignored: retry until it moves)
        if (chipPart === 1) for (let n = 0; n < 12 && await p.evaluate(() => document.querySelector('#case-bubble .bp').textContent) !== '2 / 2'; n++) { await p.click('#case-bubble [data-step="1"]'); await p.waitForTimeout(300); }
        else { await p.goto('about:blank'); await p.goto(BASE + 'index.html#other-games/case/tetrarcana'); await ready(p); }
        await p.waitForTimeout(700);
        const L = await label(p), inBub = await p.evaluate(() => [...document.querySelectorAll('#case-bubble .cstats:not([hidden]) dt')].map(d => d.textContent));
        const want = id === 'casino-games' ? '300k,#1' : '2 Week,1v1';
        if (w < 640) check(`${w}x${h} ${id}: phone, no wall label, the chips end the bubble`, !L.exists && inBub.join() === want, { L, inBub });
        else check(`${w}x${h} ${id}: the chips are on the wall label, right of the picture, clear of everything, none in the bubble`,
          L.shown && L.chips.join() === want && L.left >= L.screenR - 1 && L.inStage && !L.hits.length && !inBub.length, { L, inBub });
      }
      await p.close();
    }
    await ctx.close();
  }

  // the wall monitor is on in every part of every case (desktop), face inside its bezel, the sheet + a Now row
  {
    const q = await b.newPage({ viewport: { width: 1440, height: 900 } }); const bad = [];
    for (const [id] of CASES) {
      await q.goto('about:blank'); await q.goto(BASE + 'index.html#' + id + '/case'); await ready(q); await q.waitForTimeout(600);
      for (let k = 0; k < 12; k++) {
        const L = await label(q);
        if (!(L.shown && L.inBezel && /^Now \d+\/\d+/.test(L.now) && !/case/i.test(L.text.replace(id, '')))) bad.push({ id, k, shown: L.shown, inBezel: L.inBezel, now: L.now });
        const next = await q.evaluate(() => { const b = document.querySelector('#case-bubble [data-step="1"]'); if (b.disabled) return false; b.click(); return true; });
        if (!next) break; await q.waitForTimeout(450);
      }
    }
    check('the wall monitor shows on every part of every case, face inside its bezel, sheet + Now row', !bad.length, bad.slice(0, 4));
    await q.close();
  }

  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));

  // 2. parts
  await p.goto(BASE + 'index.html#over-the-hill/case'); await ready(p);
  await p.click('#case-bubble [data-step="1"]'); await p.waitForTimeout(400); let s = await st(p);
  check('Next: the Launch week part, live region names it', s.key === 'Launch week' && /^Part 2 of \d+: Launch week/.test(s.live), s);
  await p.click('#case-bubble [data-step="-1"]'); await p.waitForTimeout(400); s = await st(p);
  check('Back: the first part again (no Overview part)', s.key === 'Launch week' && s.head === 'Launch week' && s.part === '1 / 2', s);
  await p.click('.ckeys .key[data-g="1"]'); await p.waitForTimeout(400); s = await st(p);
  check('bar click jumps to that part', s.key === 'How it works', s.key);
  const lis = await p.evaluate(() => document.querySelectorAll('#case-bubble .t ul li').length);
  check('bullets reach the bubble (How it works: 1)', lis === 1, lis);
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400); s = await st(p);
  check('arrow key on the bar moves to the next part, focus follows', s.key === 'After 1.0' && s.active.indexOf('After 1.0') === 0, s);
  const tag = await p.evaluate(() => [...document.querySelectorAll('.ctags a')].map(a => a.getAttribute('href')));
  check('link tag under the screen (feedbot.co.uk)', tag.indexOf('https://www.feedbot.co.uk') >= 0, tag);

  // 3. media
  // another case's link while one is open: this one closes, that one opens (same page)
  await p.goto(BASE + 'index.html#casino-games/case'); await p.waitForTimeout(500); await ready(p);
  await p.waitForFunction(() => document.querySelector('.ckeys .key.on .rt') && document.querySelector('.ckeys .key[data-g="0"] .rs').textContent === 'Casino Games', null, { timeout: 9000 }).catch(() => {});
  await ready(p);
  check('another case link while one is open switches cases', (await st(p)).hash === '#casino-games/case' && await p.evaluate(() => document.querySelector('.ckeys .key[data-g="0"] .rs').textContent) === 'Casino Games');
  const LS = await label(p);
  check('switching cases: the monitor flies to the new case side with its sheet', LS.at === '3:case' && /Logifuture/.test(LS.text) && LS.inBezel, { at: LS.at, inBezel: LS.inBezel });
  await p.click('.ckeys .key[data-g="1"]'); await p.waitForTimeout(700); s = await st(p);
  check('Casino: a two-clip part plays both clips', s.clips.length === 2 && /hitfor6/.test(s.clips[0]) && /hopit/.test(s.clips[1]), s.clips);
  // both clips share the one screen, side by side (no second screen), and the bubble doesn't cover them
  const sp = await p.evaluate(() => { const o = [...document.querySelectorAll('.vov.half:not([hidden])')].map(e => e.getBoundingClientRect()), bb = document.querySelector('#case-bubble').getBoundingClientRect();
    return o.length === 2 ? { n: 2, sameRow: Math.abs(o[0].top - o[1].top) < 2 && Math.abs(o[0].height - o[1].height) < 2, touching: Math.abs(o[0].right - o[1].left) < 2, bubbleClear: bb.right <= o[0].left + 2 } : { n: o.length }; });
  check('Casino: the two clips split one screen, side by side, clear of the bubble', sp.n === 2 && sp.sameRow && sp.touching && sp.bubbleClear, sp);
  await p.click('.ckeys .key[data-g="0"]'); await p.waitForTimeout(500); const L0 = await label(p);
  await p.click('#case-bubble [data-step="1"]'); await p.waitForTimeout(700); const L1 = await label(p);
  check('Casino: a part without chips keeps the monitor (sheet + Now row, no chips); the next part shows its chips on it (300k, #1)',
    L0.shown && !L0.chips.length && /^Now 1\/5/.test(L0.now) && /Logifuture/.test(L0.text) && L1.shown && L1.chips.join() === '300k,#1', { L0: [L0.shown, L0.now], L1: L1.chips });
  await p.goto('about:blank'); await p.goto(BASE + 'index.html#eve-of-destruction/case'); await ready(p);
  s = await st(p);
  check('Eve: no Overview, the case opens on Combat with its own clip and the trailer button', s.key === 'Combat' && s.clips[0] === 'assets/ult+bossfightgif.mp4' && await p.evaluate(() => !document.querySelector('.cplay').hidden), s);
  await p.click('.cplay'); await p.waitForTimeout(1200);
  const tr = await p.evaluate(() => { const f = document.querySelector('.cyt:not([hidden]) iframe'), r = f && f.getBoundingClientRect(), sr = document.querySelector('.st').getBoundingClientRect(); return { src: f ? f.src : '', fill: r ? r.width / sr.width : 0, bubble: !document.querySelector('#case-bubble').hidden }; });
  check('Eve: Play trailer zooms into the frame, the embed fills the stage', /youtube-nocookie\.com\/embed\/.*autoplay=1/.test(tr.src) && tr.fill > .75 && !tr.bubble, tr);
  await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
  check('Eve: Esc closes the trailer and zooms back out', await p.evaluate(() => !document.querySelector('.cyt iframe') && !document.querySelector('#case-bubble').hidden));

  // 4. University
  await p.goto('about:blank'); await p.goto(BASE + 'index.html#university-projects/case/rally'); await ready(p); s = await st(p);
  check('#university-projects/case/rally opens on Rally', s.key === 'Rally Game', s.key);
  check('Rally: the big frame plays its loop', s.clips.join() === 'assets/rally.mp4', s.clips);
  check('Rally: Play button reads Play with sound', await p.evaluate(() => { const b = document.querySelector('.cplay'); return !b.hidden && /Play with sound/.test(b.textContent); }));
  await p.click('.cplay'); await p.waitForTimeout(1200);
  const rs = await p.evaluate(() => { const v = document.querySelector('.cyt:not([hidden]) video'), r = v && v.getBoundingClientRect(), sr = document.querySelector('.st').getBoundingClientRect(); return { src: v ? v.getAttribute('src') : '', muted: v ? v.muted : null, controls: v ? v.controls : null, fill: r ? r.width / sr.width : 0, bubble: !document.querySelector('#case-bubble').hidden, close: document.activeElement.textContent.trim(), t: v ? v.currentTime : -1 }; });
  check('Rally: Play zooms in and plays the clip with sound', rs.src === 'assets/rally.mp4' && rs.muted === false && rs.controls && rs.fill > .75 && !rs.bubble && /^Close video/.test(rs.close), rs);
  check("Rally: the clip with sound starts where the loop does (the poster's moment, 18 s)", rs.t >= 17.9 && rs.t < 20, rs.t);
  await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
  check('Rally: Esc closes the clip and zooms back out', await p.evaluate(() => !document.querySelector('.cyt video') && !document.querySelector('#case-bubble').hidden));
  await p.evaluate(() => window.__caseMode.tap({ s: 4, k: 2 })); await p.waitForTimeout(800); s = await st(p);
  check('clicking the small Fishing screen makes it the big one (Fishing part, URL names it)', s.key === 'Fishing Game' && s.hash === '#university-projects/case/fishing', s);
  // the University clips start at their poster's moment (Climbing 15 s, Rally 18 s, Fishing 1 s: the still doesn't jump
  // when the clip takes over), and a clip overlay is never visible before its video has a frame
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }), q = await ctx.newPage();
    await q.addInitScript(() => {
      window.__ovBad = []; window.__ovFirst = {};
      const loop = () => {
        document.querySelectorAll('.vov').forEach(o => {
          if (o.hidden || +getComputedStyle(o).opacity === 0) return;
          const v = o.querySelector('video'); if (!v) return;
          if (v.readyState < 2) window.__ovBad.push(v.getAttribute('src') + ' rs=' + v.readyState);
          else if (!(v.getAttribute('src') in window.__ovFirst)) window.__ovFirst[v.getAttribute('src')] = v.currentTime;
        });
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    await q.goto(BASE + 'index.html#university-projects/case/climbing'); await ready(q); await q.waitForTimeout(1500);
    for (const k of [1, 2]) { await q.evaluate(k => window.__caseMode.tap({ s: 4, k }), k); await q.waitForTimeout(1800); }
    const u = await q.evaluate(() => ({ first: window.__ovFirst, bad: window.__ovBad.slice(0, 5), n: window.__ovBad.length }));
    const near = (src, t) => u.first[src] >= t - .1 && u.first[src] < t + 1;
    check("University clips start at their poster's moment (Climbing 15 s, Rally 18 s, Fishing 1 s)", near('assets/climbing.mp4', 15) && near('assets/rally.mp4', 18) && near('assets/fishing.mp4', 1), u.first);
    check('case: a clip overlay is never visible before its video has a frame', !u.n, u);
    await ctx.close();
  }
  // a div.part is one bubble (Fishing: three paragraphs), the next <p> its own; Over the Hill's bullets reach the bubble
  const bt = () => p.evaluate(() => { const t = document.querySelector('#case-bubble .t'); return { part: document.querySelector('#case-bubble .bp').textContent, p: t.querySelectorAll('p').length, li: t.querySelectorAll('ul li').length }; });
  const b1 = await bt(); await p.click('#case-bubble [data-step="1"]'); await p.waitForTimeout(500); const b2 = await bt();
  check('a div.part is one bubble (Fishing: 3 paragraphs, then 1)', b1.part === '1 / 2' && b1.p === 3 && b2.part === '2 / 2' && b2.p === 1, { b1, b2 });
  await p.click('#case-bubble [data-step="-1"]'); await p.waitForTimeout(500);
  // a real click on a small frame (just above its label) inside the case: it rotates to the big spot, no zoom
  const clickFrame = async (pg, name) => { const r = await pg.evaluate(n => { const l = [...document.querySelectorAll('.pin.tl')].find(e => e.textContent === n); const b = l.getBoundingClientRect(); return { x: b.left + 40, y: b.top - 25 }; }, name); await pg.mouse.click(r.x, r.y); };
  await clickFrame(p, 'Climbing Game'); await p.waitForTimeout(900); s = await st(p);
  check('clicking a small frame in the case rotates it to the big spot (Climbing part)', s.key === 'Climbing Game' && s.hash === '#university-projects/case/climbing' && s.bubble, s);
  // any small frame, in any order (hidden selection outlines used to steal clicks: Climbing never came back)
  const seq = [];
  for (const n of ['Fishing Game', 'Rally Game', 'Climbing Game', 'Fishing Game', 'Climbing Game']) { await clickFrame(p, n); await p.waitForTimeout(900); seq.push([n, (await st(p)).key]); }
  check('each small frame clicked becomes the big one', seq.every(([n, k]) => n === k), seq);
  // from the homepage: clicking the small Rally frame rotates first, then pushes in and opens Rally
  await p.goto('about:blank'); await p.goto(BASE + 'index.html'); await p.waitForTimeout(1500);
  await p.click('.key[data-i="4"]'); await p.waitForTimeout(2200);
  const gov = await p.evaluate(() => { const v = document.querySelector('#gallery .vov:not([hidden]) video'); return v ? v.getAttribute('src') : null; });
  check('homepage: the University bay plays the big frame\'s clip (Climbing)', gov === 'assets/climbing.mp4', gov);
  await clickFrame(p, 'Rally Game'); await p.waitForTimeout(250);
  const mid = await p.evaluate(() => location.hash);
  await ready(p); s = await st(p);
  check('homepage: a small frame rotates first (no case yet), then the case opens on it', mid === '' && s.key === 'Rally Game' && s.hash === '#university-projects/case/rally', { mid, key: s.key, hash: s.hash });
  await p.click('.cback'); await p.waitForTimeout(3500);
  const gov2 = await p.evaluate(() => { const v = document.querySelector('#gallery .vov:not([hidden]) video'); return v ? v.getAttribute('src') : null; });
  check('back in the gallery, Rally stays big and its clip plays', gov2 === 'assets/rally.mp4', gov2);

  // 5. Other Games: three frames like University, Stealth Game big; its parts each play their own clip in the big frame
  await p.goto('about:blank'); await p.goto(BASE + 'index.html#other-games/case'); await ready(p); s = await st(p);
  const ogBar = await p.evaluate(() => [...document.querySelectorAll('.ckeys .key:not(.cback) .rt')].map(e => e.textContent));
  check('Other Games: the bar is the three games (no Overview)', ogBar.join() === 'Stealth Game,Tetrarcana,Calm Before the Storm', ogBar);
  const ogFrames = await p.evaluate(() => [...document.querySelectorAll('.pin.tl')].map(e => e.textContent).filter(t => /Stealth|Tetrarcana|Calm/.test(t)));
  check('Other Games: three frames', ogFrames.length === 3, ogFrames);
  // Next through the Stealth Game parts (V&V has two paragraphs) to the first Tetrarcana part
  const OGC = { 'Vision & Visibility': 'assets/visionsystem.mp4', 'Readable Danger': 'assets/soundring.mp4', 'Enemy and Shadows': 'assets/enemy-ai.mp4' };
  const og = [{ key: s.key, head: s.head, clips: s.clips.join(), hash: s.hash }];
  for (let n = 0; n < 8 && og[og.length - 1].key === 'Stealth Game'; n++) { await p.click('#case-bubble [data-step="1"]'); await p.waitForTimeout(700); s = await st(p); og.push({ key: s.key, head: s.head, clips: s.clips.join(), hash: s.hash }); }
  const ogS = og.filter(o => o.key === 'Stealth Game'), ogT = og[og.length - 1];
  check('Stealth Game: each part plays its own clip in the big frame', ogS.length >= 3 && Object.keys(OGC).every(h => ogS.some(o => o.head === h)) && ogS.every(o => OGC[o.head] === o.clips && /\/case(\/stealth)?$/.test(o.hash)), og);
  check('Next from the last Stealth part: Tetrarcana big, its clip, the URL names it', ogT.key === 'Tetrarcana' && ogT.clips === 'assets/tetrarcana.mp4' && ogT.hash === '#other-games/case/tetrarcana', ogT);
  const ogBig = await p.evaluate(() => { const v = document.querySelector('.vov:not([hidden])'), l = [...document.querySelectorAll('.pin.tl')].find(e => e.textContent === 'Tetrarcana'); if (!v || !l) return null; const a = v.getBoundingClientRect(), b = l.getBoundingClientRect(); return a.width > 200 && b.top > a.bottom - 2 && b.left < a.left + 20; });
  check('Tetrarcana\'s frame is the big one (the clip fills it, its label under it)', ogBig === true, ogBig);
  await clickFrame(p, 'Calm Before the Storm'); await p.waitForTimeout(900); s = await st(p);
  check('clicking the small Calm frame rotates it big (URL names it, its clip plays)', s.key === 'Calm Before the Storm' && s.hash === '#other-games/case/calm' && s.clips.join() === 'assets/calm.mp4', s);
  await clickFrame(p, 'Stealth Game'); await p.waitForTimeout(900); s = await st(p);
  check('clicking the small Stealth frame: its first part, the Vision clip', s.key === 'Stealth Game' && s.head === 'Vision & Visibility' && s.clips.join() === 'assets/visionsystem.mp4', s);
  await p.goto('about:blank'); await p.goto(BASE + 'index.html#other-games/case/tetrarcana'); await ready(p); s = await st(p);
  check('#other-games/case/tetrarcana opens on Tetrarcana', s.key === 'Tetrarcana' && s.clips.join() === 'assets/tetrarcana.mp4', s);
  // leaving on a later Stealth part: the gallery's big frame plays the game's own clip again
  await p.goto('about:blank'); await p.goto(BASE + 'index.html'); await p.waitForTimeout(1500);
  await p.click('.key[data-i="5"]'); await p.waitForTimeout(2200);
  const og1 = await p.evaluate(() => { const v = document.querySelector('#gallery .vov:not([hidden]) video'); return v ? v.getAttribute('src') : null; });
  check('homepage: the Other Games bay plays the big frame\'s clip (Stealth Game)', og1 === 'assets/visionsystem.mp4', og1);
  const G0 = await label(p);
  check('gallery: the wall label hangs left of the big frame with the facts and the stack', G0.shown && G0.at === '5:gallery' && G0.right <= G0.screenL + 1 && /Guard vision cone/.test(G0.text) && /Stack/.test(G0.text) && G0.inStage && !G0.hits.length, G0);
  await clickFrame(p, 'Tetrarcana'); await p.waitForTimeout(250);
  const ogMid = await p.evaluate(() => location.hash);
  await ready(p); s = await st(p); await p.waitForTimeout(400);
  check('homepage: the small Tetrarcana frame rotates first, then its case opens', ogMid === '' && s.key === 'Tetrarcana' && s.hash === '#other-games/case/tetrarcana', { ogMid, key: s.key, hash: s.hash });
  const G1 = await label(p);
  check('case: the wall label hangs right of the frames, with Tetrarcana\'s chips',
    G1.shown && G1.at === '5:case' && G1.left >= G1.screenR - 1 && G1.chips.join() === '2 Week,1v1' && !G1.hits.length, G1);
  await p.click('.ckeys .key[data-g="0"]'); await p.waitForTimeout(900);
  for (let n = 0; n < 4 && (await st(p)).head !== 'Readable Danger'; n++) { await p.click('#case-bubble [data-step="1"]'); await p.waitForTimeout(600); }
  const ogp = (await st(p)).clips.join();
  await p.click('.cback'); await p.waitForTimeout(3500);
  const G2 = await label(p);
  check('All projects: the wall label is back on the left with the facts', G2.shown && G2.at === '5:gallery' && G2.right <= G2.screenL + 1 && /Guard vision cone/.test(G2.text) && !G2.chips.length, G2);
  const og2 = await p.evaluate(() => { const v = document.querySelector('#gallery .vov:not([hidden]) video'); return v ? v.getAttribute('src') : null; });
  check('leaving on Readable Danger: the gallery\'s big frame plays the Stealth Game clip again', ogp === 'assets/soundring.mp4' && og2 === 'assets/visionsystem.mp4', { ogp, og2 });
  check('no page errors', !errs.length, errs);
  await p.close();

  // phone: Learn more opens the case as one screen: the stage at the top, the bubble (Back / Next showing) and the parts bar inside the window
  const pc = await b.newContext({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const pp = await pc.newPage();
  await pp.goto(BASE + 'index.html'); await pp.waitForTimeout(1500);
  await pp.tap('.key[data-i="3"]'); await pp.waitForTimeout(2500);
  await pp.tap('#guide-bubble .openb'); await pp.waitForTimeout(3500);
  const pv = await pp.evaluate(() => { const r = e => document.querySelector(e).getBoundingClientRect();
    return { hash: location.hash, st: Math.round(r('.st').top), nav: Math.round(r('#case-bubble .nav').bottom), keys: Math.round(r('.ckeys').bottom), ih: innerHeight, bubble: !document.querySelector('#case-bubble').hidden }; });
  check('phone: the case fits one screen (stage at the top, Back / Next and the parts bar in view)', pv.hash === '#casino-games/case' && Math.abs(pv.st) <= 8 && pv.nav < pv.keys && pv.keys <= pv.ih + 1 && pv.bubble, pv);
  // a sideways swipe on the bubble goes to the next part
  const before = await pp.evaluate(() => document.querySelector('#case-bubble .bp').textContent);
  await pp.evaluate(() => { const e = document.querySelector('#case-bubble'), r = e.getBoundingClientRect(), y = r.top + 60;
    const t = x => new Touch({ identifier: 1, target: e, clientX: x, clientY: y });
    e.dispatchEvent(new TouchEvent('touchstart', { touches: [t(300)], changedTouches: [t(300)], bubbles: true }));
    e.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(150)], bubbles: true })); });
  await pp.waitForTimeout(600);
  const after = await pp.evaluate(() => document.querySelector('#case-bubble .bp').textContent);
  check('phone: swiping the bubble left goes to the next part', before === '1 / 2' && after === '2 / 2', { before, after });
  const pch = await pp.evaluate(() => ({ chips: [...document.querySelectorAll('#case-bubble .cstats:not([hidden]) dt')].map(d => d.textContent), label: !!document.querySelector('#wall-label') }));
  check('phone: no wall label, the stat chips end the bubble (300k, #1)', !pch.label && pch.chips.join() === '300k,#1', pch);
  // All projects: the gallery stage is back to its phone height
  await pp.tap('.cback'); await pp.waitForTimeout(3000);
  const gh = await pp.evaluate(() => Math.round(document.querySelector('.st').getBoundingClientRect().height));
  check('phone: back in the gallery the stage is its gallery height again', Math.abs(gh - 400) <= 4, gh);
  await pc.close();

  // 5. project files
  const pr = await b.newPage();
  await pr.goto(BASE + 'my_games.html'); await pr.waitForTimeout(500);
  check('a project file redirects into the scene', /index\.html#other-games\/case$/.test(pr.url()), pr.url());
  await pr.goto(BASE + 'university_projects.html#fishing'); await pr.waitForTimeout(500);
  check('an item anchor redirects to that game', /index\.html#university-projects\/case\/fishing$/.test(pr.url()), pr.url());
  await pr.goto(BASE + 'my_games.html#calm'); await pr.waitForTimeout(500);
  check('an Other Games anchor redirects to that game (#calm)', /index\.html#other-games\/case\/calm$/.test(pr.url()), pr.url());
  await pr.goto(BASE + 'over_the_hill.html?flat'); await pr.waitForTimeout(500);
  check('?flat keeps the plain project page', /over_the_hill\.html\?flat$/.test(pr.url()) && await pr.evaluate(() => !!document.querySelector('.project-section')), pr.url());
  await pr.goto(BASE + 'index.html?flat#casino-games/case'); await pr.waitForTimeout(800);
  check('index.html?flat#<id>/case sends the visitor to the plain page', /casino_games\.html\?flat$/.test(pr.url()), pr.url());
  await pr.close(); await b.close();
  b = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] });
  const pn = await b.newPage();
  await pn.goto(BASE + 'eve_of_destruction.html'); await pn.waitForTimeout(5500);
  check('no WebGL: a project file ends up as the plain page', /eve_of_destruction\.html\?flat$|eve_of_destruction\.html$/.test(pn.url()) && await pn.evaluate(() => !!document.querySelector('.project-section')), pn.url());
  await pn.close(); await b.close();

  // 6. reduced motion
  b = await chromium.launch({ args: GL });
  const rm = await b.newContext({ reducedMotion: 'reduce' });
  const q = await rm.newPage();
  await q.goto(BASE + 'index.html#casino-games/case'); await q.waitForTimeout(2500);
  s = await st(q);
  const rv = await q.evaluate(() => { const v = document.querySelector('.vov:not([hidden]) video'); return v ? { controls: v.controls, paused: v.paused } : null; });
  check('reduced motion: the case cuts in, clip paused with controls', s.bubble && s.bar && rv && rv.controls && rv.paused, { s, rv });
  await rm.close(); await b.close();

  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
