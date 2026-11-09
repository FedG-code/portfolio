/**
 * Dolly Gallery test
 *
 * Checks the homepage gallery (js/gallery.js) and the project pages it links to:
 *   - 3D upgrade, one WebGL canvas, no horizontal overflow at 4 viewports
 *   - keyboard route on the shot list, live region, aria-describedby, motion overlay
 *   - Open: push into the screen, project page loads with focus on its title
 *   - Back link: index.html#section, pull back out, focus on the section button
 *   - plain-list fallback with ?flat and without WebGL
 *   - prefers-reduced-motion: instant cut, no overlay clip; project clips get controls
 *   - project pages: clips load only near the viewport
 *
 * Usage: node tests/gallery-test.js   (server on BASE, default http://localhost:8080)
 * Exits non-zero on any failure.
 */
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://localhost:8080').replace(/\/$/, '') + '/';
// SwiftShader so headless Chromium has WebGL
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : ''));
  if (!ok) failed++;
}
const state = p => p.evaluate(() => ({
  g3d: document.querySelector('#gallery').classList.contains('g3d'),
  canvases: document.querySelectorAll('canvas').length,
  rows: document.querySelectorAll('.row').length,
  key: (document.querySelector('.key.on .rt') || {}).textContent || null,
  active: document.activeElement ? document.activeElement.textContent.trim().slice(0, 40) : null,
  live: (document.querySelector('.live') || {}).textContent || '',
  describedBy: (document.querySelector('.key[aria-describedby]') || {}).id || (document.querySelector('.key[aria-describedby]') ? document.querySelector('.key[aria-describedby]').getAttribute('aria-describedby') : null),
  bubble: document.querySelector('.bub') ? !document.querySelector('.bub').hidden : null,
  clip: (document.querySelector('.vov:not([hidden]) video') || {}).src || null,
}));

(async () => {
  let b = await chromium.launch({ args: GL });

  // 1. viewports
  for (const [w, h] of [[1920, 1080], [1024, 768], [390, 844], [812, 375]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 900 });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.goto(BASE + 'index.html'); await p.waitForTimeout(1500);
    const s = await state(p);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${w}x${h} gallery built, one canvas, About first`, s.g3d && s.canvases === 1 && s.key === 'About' && s.bubble, s);
    check(`${w}x${h} no horizontal overflow, no errors`, sw <= 0 && !errs.length, { overflow: sw, errs });
    await ctx.close();
  }

  // 2-4. keyboard route, open, return
  let p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(1200);
  await p.focus('.key[data-i="0"]');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1700);
  let s = await state(p);
  check('arrow keys select Eve of Destruction', s.key === 'Eve of Destruction' && s.active.indexOf('Eve of Destruction') === 0, s);
  check('live region says only the section name', s.live === 'Eve of Destruction', s.live);
  check('bubble describes the active button', s.describedBy === 'guide-bubble', s.describedBy);
  check('clip plays over the selected screen', /knightboss\.mp4$/.test(s.clip || ''), s.clip);
  await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  check('bubble hides during the push', (await state(p)).bubble === false);
  // the case opens in the same scene: no page load, the bar swaps to the case's parts
  await p.waitForFunction(() => location.hash === '#eve-of-destruction/case', null, { timeout: 5000 }).catch(() => {});
  await p.waitForFunction(() => { const b = document.querySelector('#case-bubble'); return b && !b.hidden && !document.querySelector('.ckeys').hidden; }, null, { timeout: 8000 }).catch(() => {});
  let cs = await p.evaluate(() => ({ url: location.pathname + location.hash, canvases: document.querySelectorAll('canvas').length, bar: !document.querySelector('.ckeys').hidden, sections: !document.querySelector('.keys:not(.ckeys)').hidden, active: document.activeElement.textContent.trim().slice(0, 30), head: document.querySelector('#case-bubble .bh').textContent }));
  check('Open: the case opens in the scene (same page, one canvas)', /index\.html#eve-of-destruction\/case$/.test(cs.url) && cs.canvases === 1 && cs.bar && !cs.sections, cs);
  check('Open: focus on the Overview part, bubble on the overview', cs.active.indexOf('Overview') === 0 && cs.head === 'Overview', cs);
  await p.click('.ckeys .cback');
  const seen = [];
  for (let i = 0; i < 10; i++) { seen.push(await p.evaluate(() => { const b = document.querySelector('#guide-bubble'); return b ? (b.hidden ? 'H' : 'V') : '-'; }).catch(() => '-')); await p.waitForTimeout(100); }
  // in, back out to the gallery shot, then the guide steps off the stand and walks to its spot: the bubble opens there
  await p.waitForFunction(() => { const b = document.querySelector('#guide-bubble'); return b && !b.hidden; }, null, { timeout: 6000 }).catch(() => {});
  s = await state(p);
  check('All projects: back out of the screen (bubble hidden, then shown)', seen.join('').indexOf('H') >= 0 && s.bubble, seen.join(''));
  check('All projects: section bar back, focus on the Eve button, no case in the URL', s.active.indexOf('Eve of Destruction') === 0 && !/\/case/.test(p.url()) && await p.evaluate(() => document.querySelector('.ckeys').hidden), { active: s.active, url: p.url() });

  // University Projects: three items, each opens its game in the scene
  await p.click('.key[data-i="4"]'); await p.waitForTimeout(1800);
  await p.waitForSelector('.bub .its .itb', { timeout: 4000 }).catch(() => {});
  check('University Projects bubble lists three items with Open', await p.evaluate(() => [...document.querySelectorAll('.bub .its .itb')].map(a => a.getAttribute('href')).join() === 'university_projects.html#climbing,university_projects.html#rally,university_projects.html#fishing'));
  await p.click('.bub .itb[data-k="1"]');
  await p.waitForFunction(() => { const b = document.querySelector('#case-bubble'); return b && !b.hidden; }, null, { timeout: 8000 }).catch(() => {});
  const ry = await p.evaluate(() => ({ url: location.hash, active: document.activeElement.textContent.trim(), key: (document.querySelector('.ckeys .key.on .rt') || {}).textContent }));
  check('University item opens its game in the scene, focus on its part', ry.url === '#university-projects/case/rally' && ry.active.indexOf('Rally Game') === 0 && ry.key === 'Rally Game', ry);
  await p.goBack();
  await p.waitForFunction(() => { const b = document.querySelector('#guide-bubble'); return b && !b.hidden; }, null, { timeout: 6000 }).catch(() => {});
  check('browser Back closes the case, focus on the University button', (await state(p)).active.indexOf('University Projects') === 0 && await p.evaluate(() => document.querySelector('.ckeys').hidden));

  // Over the Hill opens its case
  await p.click('.key[data-i="1"]'); await p.waitForTimeout(1800);
  await p.click('.bub .openb');
  await p.waitForFunction(() => location.hash === '#over-the-hill/case', null, { timeout: 5000 }).catch(() => {});
  check('Over the Hill opens its case', /#over-the-hill\/case$/.test(p.url()), p.url());

  // Clicking a capture opens its page like Learn more; a drag still scrubs
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(1200);
  await p.click('.key[data-i="5"]'); await p.waitForTimeout(1800);
  check('bubble button reads Learn more', (await p.textContent('.bub .openb')).trim().indexOf('Learn more') === 0);
  check('no dolly track label', !(await p.$('.dbg')));
  const bx = await p.locator('.st').boundingBox();
  await p.mouse.move(bx.x + bx.width * .3, bx.y + bx.height * .9); await p.mouse.down();
  await p.mouse.move(bx.x + bx.width * .8, bx.y + bx.height * .9, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(1800);
  check('dragging the stage still scrubs and snaps', (await state(p)).key !== 'Other Games' && p.url().indexOf('index.html') > 0, (await state(p)).key);
  await p.click('.key[data-i="5"]'); await p.waitForTimeout(1800);
  await p.waitForSelector('.vov:not([hidden])', { timeout: 4000 }).catch(() => {});
  const ov = await p.locator('.vov:not([hidden])').first().boundingBox();
  await p.mouse.click(ov.x + ov.width / 2, ov.y + ov.height / 2);
  await p.waitForFunction(() => location.hash === '#other-games/case', null, { timeout: 5000 }).catch(() => {});
  check('clicking the screen opens its case', /#other-games\/case$/.test(p.url()), p.url());

  // No flash of the plain list while Three.js loads (it's slowed to 1.5s here)
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route(/three\.min\.js/, async r => { await new Promise(x => setTimeout(x, 1500)); r.continue(); });
    const q = await ctx.newPage(); q.goto(BASE + 'index.html');
    let shown = false;
    for (let i = 0; i < 25; i++) {
      await q.waitForTimeout(100);
      shown = shown || await q.evaluate(() => { const m = document.querySelector('.menu'); return !!m && getComputedStyle(m).visibility === 'visible'; }).catch(() => false);
    }
    check('no flash of the plain list while Three.js loads', !shown && (await q.evaluate(() => document.querySelectorAll('canvas').length)) === 1);
    await ctx.close();
  }

  // 5. ?flat
  await p.goto(BASE + 'index.html?flat'); await p.waitForTimeout(800);
  s = await state(p);
  check('?flat keeps the plain list', !s.g3d && s.canvases === 0 && s.rows === 5, s);
  await b.close();

  // 6. no WebGL
  b = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] });
  p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(1500);
  s = await state(p);
  check('no WebGL: plain list', !s.g3d && s.canvases === 0 && s.rows === 5, s);
  await b.close();

  // 7. reduced motion
  b = await chromium.launch({ args: GL });
  p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage();
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(1200);
  await p.click('.key[data-i="3"]'); await p.waitForTimeout(30);
  s = await state(p);
  check('reduced motion: instant cut, no clip', s.key === 'Casino Games' && s.bubble && !s.clip, s);
  await p.click('.bub .openb'); await p.waitForTimeout(800);
  const rc = await p.evaluate(() => { const v = document.querySelector('.vov:not([hidden]) video'); return { hash: location.hash, bubble: !document.querySelector('#case-bubble').hidden, v: v ? { controls: v.controls, paused: v.paused } : null }; });
  check('reduced motion: the case cuts in, its clip paused with controls', rc.hash === '#casino-games/case' && rc.bubble && rc.v && rc.v.controls && rc.v.paused, rc);
  await p.goto(BASE + 'casino_games.html?flat'); await p.waitForTimeout(600);
  const rv = await p.evaluate(() => [...document.querySelectorAll('video')].every(v => v.controls && v.paused && v.preload === 'none'));
  check('reduced motion: plain project page clips have controls and stay paused', rv);
  await b.close();

  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
