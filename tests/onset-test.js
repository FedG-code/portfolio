/**
 * On Set test: the project pages' stage (js/onset.js)
 *
 *   - 4 viewports x 5 pages: set built, one WebGL canvas, title in the placard, guide on its stand with the bubble,
 *     strip = one key per part, no horizontal overflow, no page errors
 *   - arrival: from the gallery (sessionStorage 'dolly-return' = section) starts inside the screen and consumes the
 *     key; a direct link walks in; reduced motion cuts
 *   - Next / Back, strip click, arrow keys on the strip; live region names the part
 *   - #rally / #fishing land on that game's part with focus on its strip button
 *   - media: Casino's two-clip beat shows two screens, Eve's trailer button opens the embed, link tags, stat chips
 *   - fallbacks: ?flat and no WebGL keep the plain page; no flash of the plain page while Three.js loads
 *
 * Usage: node tests/onset-test.js   (server on BASE, default http://localhost:8080)
 */
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://localhost:8080').replace(/\/$/, '') + '/';
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const PAGES = [['over_the_hill', 'over-the-hill', 6], ['eve_of_destruction', 'eve-of-destruction', 4], ['casino_games', 'casino-games', 6], ['university_projects', 'university-projects', 4], ['my_games', 'other-games', 4]];

let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : ''));
  if (!ok) failed++;
}
const settle = p => p.waitForFunction(() => { const b = document.querySelector('.os-bub'); return document.documentElement.classList.contains('os-on') && b && !b.hidden && b.offsetWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
const st = p => p.evaluate(() => ({
  on: document.documentElement.classList.contains('os-on'),
  wait: document.documentElement.classList.contains('os-wait'),
  arrive: document.documentElement.getAttribute('data-os-arrive'),
  canvases: document.querySelectorAll('canvas').length,
  keys: document.querySelectorAll('.os-keys .key').length,
  key: (document.querySelector('.os-keys .key.on .rt') || {}).textContent || null,
  head: (document.querySelector('.os-bub .bh') || {}).textContent || null,
  part: (document.querySelector('.os-bub .bp') || {}).textContent || null,
  h1InPlacard: !!document.querySelector('.os-tp h1.project-hero-title'),
  bubble: !!document.querySelector('.os-bub') && !document.querySelector('.os-bub').hidden,
  live: (document.querySelector('.os-live') || {}).textContent || '',
  active: document.activeElement ? document.activeElement.textContent.trim().slice(0, 40) : null,
  overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  clips: [...document.querySelectorAll('.os .vov:not([hidden]) video')].map(v => v.getAttribute('src')),
}));

(async () => {
  let b = await chromium.launch({ args: GL });

  // 1. viewports x pages
  for (const [w, h] of [[1920, 1080], [1024, 768], [390, 844], [812, 375]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 900 });
    for (const [pg, , groups] of PAGES) {
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.goto(BASE + pg + '.html'); await settle(p);
      const s = await st(p);
      const ok = s.on && !s.wait && s.canvases === 1 && s.keys === groups && s.h1InPlacard && s.bubble && !s.overflow && !errs.length;
      check(`${w}x${h} ${pg}: set built`, ok, ok ? undefined : { ...s, errs });
      await p.close();
    }
    await ctx.close();
  }

  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));

  // 2. arrival
  await p.goto(BASE + 'index.html'); await p.evaluate(() => sessionStorage.setItem('dolly-return', 'over-the-hill'));
  await p.goto(BASE + 'over_the_hill.html'); await p.waitForTimeout(300);
  let s = await st(p);
  const consumed = await p.evaluate(() => sessionStorage.getItem('dolly-return'));
  check('from the gallery: starts inside the screen, key consumed, bubble waits', s.arrive === 'gallery' && consumed === null && !s.bubble, { arrive: s.arrive, consumed, bubble: s.bubble });
  await settle(p); s = await st(p);
  check('from the gallery: bubble opens on the overview, focus on the title', s.bubble && s.head === 'Overview' && s.active === 'Over the Hill', s);
  await p.goto(BASE + 'casino_games.html'); s = await st(p);
  check('direct link: walks in (no zoom), no focus move', s.arrive === 'walk' && s.active !== 'Casino Games', { arrive: s.arrive, active: s.active });
  await p.evaluate(() => sessionStorage.setItem('dolly-return', 'over-the-hill'));
  await p.goto(BASE + 'casino_games.html'); s = await st(p);
  check('a key for another section is ignored', s.arrive === 'walk', s.arrive);

  // 3. navigation
  await p.goto(BASE + 'over_the_hill.html'); await settle(p);
  await p.click('.os-bub [data-step="1"]'); await p.waitForTimeout(400); s = await st(p);
  check('Next: first part of The brief, live region names it', s.key === 'The brief' && s.part === '1 / 2' && /^Part 2 of \d+: The brief/.test(s.live), s);
  await p.click('.os-bub [data-step="-1"]'); await p.waitForTimeout(400); s = await st(p);
  check('Back: overview again', s.key === 'Overview' && s.head === 'Overview', s.key);
  await p.click('.os-keys .key[data-g="3"]'); await p.waitForTimeout(400); s = await st(p);
  check('strip click jumps to that part', s.key === 'Sorting bugs from requests', s.key);
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400); s = await st(p);
  check('arrow key on the strip moves to the next part, focus follows', s.key === 'How the team used it' && s.active.indexOf('How the team used it') === 0, s);
  const tag = await p.evaluate(() => [...document.querySelectorAll('.os-tags a')].map(a => a.getAttribute('href')));
  check('link tag under the screen (feedbot.co.uk)', tag.indexOf('https://www.feedbot.co.uk') >= 0, tag);
  check('one canvas after navigating', (await st(p)).canvases === 1);

  // 4. anchors
  for (const [hash, name] of [['rally', 'Rally Game'], ['fishing', 'Fishing Game']]) {
    await p.goto(BASE + 'index.html'); await p.evaluate(() => sessionStorage.setItem('dolly-return', 'university-projects'));
    await p.goto(BASE + 'university_projects.html#' + hash); await settle(p); await p.waitForTimeout(300); s = await st(p);
    check(`#${hash} lands on ${name}, focus on its strip button`, s.key === name && s.active.indexOf(name) === 0, s);
  }

  // 5. media
  await p.goto(BASE + 'casino_games.html'); await settle(p);
  await p.click('.os-keys .key[data-g="2"]'); await p.waitForTimeout(600); s = await st(p);
  check('Casino: a two-clip part plays both clips', s.clips.length === 2 && /hitfor6/.test(s.clips[0]) && /hopit/.test(s.clips[1]), s.clips);
  await p.click('.os-keys .key[data-g="1"]'); await p.click('.os-bub [data-step="1"]'); await p.waitForTimeout(400);
  const stats = await p.evaluate(() => [...document.querySelectorAll('.os-stats dt')].map(d => d.textContent));
  check('Casino: stat chips in the bubble', stats.join() === '300k,#1', stats);
  await p.goto(BASE + 'eve_of_destruction.html'); await settle(p);
  check('Eve: overview plays the gallery clip', (await st(p)).clips[0] === 'assets/knightboss.mp4', (await st(p)).clips);
  const playOn = await p.evaluate(() => !document.querySelector('.os-play').hidden);
  await p.click('.os-play'); await p.waitForTimeout(300);
  const yt = await p.evaluate(() => (document.querySelector('.os-yt:not([hidden]) iframe') || {}).src || '');
  check('Eve: Play trailer opens the embed over the screen', playOn && /youtube-nocookie\.com\/embed\/.*autoplay=1/.test(yt), yt);
  await p.click('.os-bub [data-step="1"]'); await p.waitForTimeout(300);
  check('Eve: the embed closes on the next part', await p.evaluate(() => !document.querySelector('.os-yt iframe')));
  await p.goto(BASE + 'my_games.html'); await settle(p);
  await p.click('.os-keys .key[data-g="2"]'); await p.waitForTimeout(300);
  const tags = await p.evaluate(() => [...document.querySelectorAll('.os-tags a')].map(a => a.textContent.trim()));
  check('Other Games: Tetrarcana has its link tags', tags.length === 2 && /itch\.io/.test(tags[0]), tags);

  // 6. back link pushes in, then loads the gallery with the key set
  await p.goto(BASE + 'eve_of_destruction.html'); await settle(p);
  await p.click('.back-link'); await p.waitForTimeout(250);
  const mid = await p.evaluate(() => ({ url: location.pathname, bub: !document.querySelector('.os-bub') || document.querySelector('.os-bub').hidden }));
  await p.waitForURL('**/index.html#eve-of-destruction', { timeout: 5000 });
  check('All projects: push into the screen first, then the gallery', /eve_of_destruction/.test(mid.url) && mid.bub, mid);
  check('no page errors', !errs.length, errs);
  await p.close();

  // 7. fallbacks
  const pf = await b.newPage();
  await pf.goto(BASE + 'over_the_hill.html?flat'); await pf.waitForTimeout(800);
  s = await st(pf);
  check('?flat: plain page', !s.on && !s.wait && s.canvases === 0 && await pf.evaluate(() => !document.querySelector('.os') && getComputedStyle(document.querySelector('.project-section')).display !== 'none'), s);
  await pf.close(); await b.close();
  b = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] });
  const pn = await b.newPage();
  await pn.goto(BASE + 'university_projects.html#rally'); await pn.waitForTimeout(2500);
  s = await st(pn);
  check('no WebGL: plain page', !s.on && !s.wait && s.canvases === 0 && await pn.evaluate(() => getComputedStyle(document.querySelector('.project-section')).display !== 'none'), s);
  await pn.close(); await b.close();

  b = await chromium.launch({ args: GL });
  const ctx = await b.newContext();
  await ctx.route(/three\.min\.js/, async r => { await new Promise(x => setTimeout(x, 1500)); r.continue(); });
  const ps = await ctx.newPage(); let flash = false;
  await ps.goto(BASE + 'casino_games.html', { waitUntil: 'commit' });
  for (let i = 0; i < 30; i++) {
    const v = await ps.evaluate(() => { const s = document.querySelector('.project-section'); return !!s && !document.querySelector('.os') && getComputedStyle(s).display !== 'none'; }).catch(() => false);
    if (v) flash = true; await ps.waitForTimeout(100);
  }
  check('no flash of the plain page while Three.js loads', !flash && (await st(ps)).on);
  await ctx.close();

  // 8. reduced motion
  const rm = await b.newContext({ reducedMotion: 'reduce' });
  const pr = await rm.newPage();
  await pr.goto(BASE + 'casino_games.html'); await pr.waitForFunction(() => document.documentElement.classList.contains('os-on'), null, { timeout: 8000 }).catch(() => {});
  s = await st(pr);
  const rv = await pr.evaluate(() => { const v = document.querySelector('.os .vov video'); return v ? { controls: v.controls, paused: v.paused } : null; });
  check('reduced motion: cut, bubble at once, clip paused with controls', s.arrive === 'cut' && s.bubble && rv && rv.controls && rv.paused, { arrive: s.arrive, rv });
  await rm.close(); await b.close();

  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
