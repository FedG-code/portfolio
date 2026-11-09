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
  await p.waitForURL('**/eve_of_destruction.html', { timeout: 5000 }); await p.waitForTimeout(400);
  const pg = await p.evaluate(() => ({ focus: document.activeElement.tagName, loaded: [...document.querySelectorAll('.os-text video')].filter(v => v.getAttribute('src')).length }));
  check('project page: focus on the case title', pg.focus === 'H1', pg);
  check('project page: clips in the folded text not loaded', pg.loaded === 0, pg);
  await p.evaluate(() => { document.querySelector('.os-text').open = true; document.querySelector('.os-text video').scrollIntoView(); });
  await p.waitForFunction(() => !!document.querySelector('.os-text video').getAttribute('src'), null, { timeout: 4000 }).catch(() => {});
  check('project page: text clip loads near the viewport', await p.evaluate(() => !!document.querySelector('.os-text video').getAttribute('src')));
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click('.back-link');
  // the project page pushes into its screen first (0.6s), then the gallery loads
  await p.waitForURL('**/index.html#eve-of-destruction', { timeout: 5000 });
  const seen = [];
  for (let i = 0; i < 10; i++) { seen.push(await p.evaluate(() => { const b = document.querySelector('#gallery .bub'); return b ? (b.hidden ? 'H' : 'V') : '-'; }).catch(() => '-')); await p.waitForTimeout(100); }
  // the guide walks in onto the stand, then over to its spot: the bubble opens when it gets there
  await p.waitForFunction(() => { const b = document.querySelector('.bub'); return b && !b.hidden; }, null, { timeout: 6000 }).catch(() => {});
  s = await state(p);
  check('return pulls back out of the screen (bubble hidden, then shown)', seen.join('').indexOf('H') >= 0 && s.bubble, seen.join(''));
  check('return: URL hash + focus on the section button', /#eve-of-destruction$/.test(p.url()) && s.active.indexOf('Eve of Destruction') === 0, s.active);

  // University Projects: three items, each opens its own section of university_projects.html
  await p.click('.key[data-i="4"]'); await p.waitForTimeout(1800);
  await p.waitForSelector('.bub .its .itb', { timeout: 4000 }).catch(() => {});
  check('University Projects bubble lists three items with Open', await p.evaluate(() => [...document.querySelectorAll('.bub .its .itb')].map(a => a.getAttribute('href')).join() === 'university_projects.html#climbing,university_projects.html#rally,university_projects.html#fishing'));
  await p.click('.bub .itb[data-k="1"]');
  await p.waitForURL('**/university_projects.html#rally', { timeout: 5000 }); await p.waitForTimeout(400);
  // On Set: the Rally part of the strip is current and has focus; the screen shows Rally's capture
  await p.waitForTimeout(2200);
  const ry = await p.evaluate(() => ({ active: document.activeElement.textContent.trim(), key: (document.querySelector('.os-keys .key.on .rt') || {}).textContent, head: (document.querySelector('.os-bub .bh') || {}).textContent }));
  check('University item opens its part of the set, focus on its strip button', ry.active.indexOf('Rally Game') === 0 && ry.key === 'Rally Game', ry);
  await p.click('.back-link'); await p.waitForTimeout(1000);
  await p.waitForFunction(() => { const b = document.querySelector('.bub'); return b && !b.hidden; }, null, { timeout: 6000 }).catch(() => {});
  check('back from University Projects focuses its button', (await state(p)).active.indexOf('University Projects') === 0);

  // Over the Hill opens its page
  await p.click('.key[data-i="1"]'); await p.waitForTimeout(1800);
  await p.click('.bub .openb');
  await p.waitForURL('**/over_the_hill.html', { timeout: 5000 });
  check('Over the Hill opens its page', true);

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
  const ov = await p.locator('.vov').boundingBox();
  await p.mouse.click(ov.x + ov.width / 2, ov.y + ov.height / 2);
  await p.waitForURL('**/my_games.html', { timeout: 5000 });
  check('clicking the screen opens its page', true);

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
  await p.click('.bub .openb'); await p.waitForURL('**/casino_games.html', { timeout: 3000 });
  const rv = await p.evaluate(() => [...document.querySelectorAll('video')].every(v => v.controls && v.paused && v.preload === 'none'));
  check('reduced motion: project clips have controls and stay paused', rv);
  await b.close();

  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
