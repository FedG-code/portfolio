/**
 * Case test: a project's case told in the gallery's scene (js/case.js)
 *
 *   - 4 viewports x 5 cases (index.html#<id>/case): case bar shown, section bar hidden, one canvas, bubble shown,
 *     one bar key per part (+ All projects), no horizontal overflow, no page errors
 *   - parts: Next / Back, bar click, arrow keys (focus follows), live region; link tags; stat chips
 *   - media: Casino's two-clip part plays both clips; Eve's trailer zooms the camera into the frame, Esc zooms back out
 *   - University: a part of another game swaps that game's screen to the big one; the URL names the game
 *   - project files: with WebGL they redirect into the scene; ?flat and no WebGL keep the plain page;
 *     index.html?flat#<id>/case sends the visitor to the plain page
 *   - reduced motion: the case cuts in
 *
 * Usage: node tests/case-test.js   (server on BASE, default http://localhost:8080)
 */
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://localhost:8080').replace(/\/$/, '') + '/';
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const CASES = [['over-the-hill', 4], ['eve-of-destruction', 4], ['casino-games', 6], ['university-projects', 3], ['other-games', 4]];

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
      await p.close();
    }
    await ctx.close();
  }

  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));

  // 2. parts
  await p.goto(BASE + 'index.html#over-the-hill/case'); await ready(p);
  await p.click('#case-bubble [data-step="1"]'); await p.waitForTimeout(400); let s = await st(p);
  check('Next: the Launch week part, live region names it', s.key === 'Launch week' && /^Part 2 of \d+: Launch week/.test(s.live), s);
  await p.click('#case-bubble [data-step="-1"]'); await p.waitForTimeout(400); s = await st(p);
  check('Back: overview again', s.key === 'Overview' && s.head === 'Overview', s.key);
  await p.click('.ckeys .key[data-g="2"]'); await p.waitForTimeout(400); s = await st(p);
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
  await p.click('.ckeys .key[data-g="2"]'); await p.waitForTimeout(700); s = await st(p);
  check('Casino: a two-clip part plays both clips', s.clips.length === 2 && /hitfor6/.test(s.clips[0]) && /hopit/.test(s.clips[1]), s.clips);
  // both clips share the one screen, side by side (no second screen), and the bubble doesn't cover them
  const sp = await p.evaluate(() => { const o = [...document.querySelectorAll('.vov.half:not([hidden])')].map(e => e.getBoundingClientRect()), bb = document.querySelector('#case-bubble').getBoundingClientRect();
    return o.length === 2 ? { n: 2, sameRow: Math.abs(o[0].top - o[1].top) < 2 && Math.abs(o[0].height - o[1].height) < 2, touching: Math.abs(o[0].right - o[1].left) < 2, bubbleClear: bb.right <= o[0].left + 2 } : { n: o.length }; });
  check('Casino: the two clips split one screen, side by side, clear of the bubble', sp.n === 2 && sp.sameRow && sp.touching && sp.bubbleClear, sp);
  await p.click('.ckeys .key[data-g="1"]'); await p.click('#case-bubble [data-step="1"]'); await p.waitForTimeout(400);
  const stats = await p.evaluate(() => [...document.querySelectorAll('.cstats dt')].map(d => d.textContent));
  check('Casino: stat chips in the bubble', stats.join() === '300k,#1', stats);
  await p.goto('about:blank'); await p.goto(BASE + 'index.html#eve-of-destruction/case'); await ready(p);
  check('Eve: the overview plays the gallery clip', (await st(p)).clips[0] === 'assets/knightboss.mp4', (await st(p)).clips);
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
  const rs = await p.evaluate(() => { const v = document.querySelector('.cyt:not([hidden]) video'), r = v && v.getBoundingClientRect(), sr = document.querySelector('.st').getBoundingClientRect(); return { src: v ? v.getAttribute('src') : '', muted: v ? v.muted : null, controls: v ? v.controls : null, fill: r ? r.width / sr.width : 0, bubble: !document.querySelector('#case-bubble').hidden, close: document.activeElement.textContent.trim() }; });
  check('Rally: Play zooms in and plays the clip with sound', rs.src === 'assets/rally.mp4' && rs.muted === false && rs.controls && rs.fill > .75 && !rs.bubble && /^Close video/.test(rs.close), rs);
  await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
  check('Rally: Esc closes the clip and zooms back out', await p.evaluate(() => !document.querySelector('.cyt video') && !document.querySelector('#case-bubble').hidden));
  await p.evaluate(() => window.__caseMode.tap({ s: 4, k: 2 })); await p.waitForTimeout(800); s = await st(p);
  check('clicking the small Fishing screen makes it the big one (Fishing part, URL names it)', s.key === 'Fishing Game' && s.hash === '#university-projects/case/fishing', s);
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
  const before = await pp.evaluate(() => document.querySelector('#case-bubble .bh').textContent);
  await pp.evaluate(() => { const e = document.querySelector('#case-bubble'), r = e.getBoundingClientRect(), y = r.top + 60;
    const t = x => new Touch({ identifier: 1, target: e, clientX: x, clientY: y });
    e.dispatchEvent(new TouchEvent('touchstart', { touches: [t(300)], changedTouches: [t(300)], bubbles: true }));
    e.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(150)], bubbles: true })); });
  await pp.waitForTimeout(600);
  const after = await pp.evaluate(() => document.querySelector('#case-bubble .bh').textContent);
  check('phone: swiping the bubble left goes to the next part', before === 'Overview' && after !== before, { before, after });
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
