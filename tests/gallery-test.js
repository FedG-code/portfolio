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
const norm = t => (t || '').replace(/\s+/g, ' ').trim();
// select section i (shot list button) and wait for the guide's bubble
const pick = async (p, i) => { await p.waitForFunction(() => !document.querySelector('.keys:not(.ckeys)').hidden, null, { timeout: 8000 }).catch(() => {}); await p.click(`.key[data-i="${i}"]`); await p.waitForTimeout(1800); await p.waitForFunction(() => { const b = document.querySelector('#guide-bubble'); return b && !b.hidden; }, null, { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(250); };
const bubble = p => p.evaluate(() => { const b = document.querySelector('#guide-bubble'), o = b.querySelector('.openb'), sm = b.querySelector('.sum'), sr = document.querySelector('.st').getBoundingClientRect(), r = o && o.getBoundingClientRect();
  return { sum: sm ? sm.textContent : '', opens: b.querySelectorAll('.openb').length, href: o ? o.getAttribute('href') : null, items: b.querySelectorAll('.itb, ul').length,
    openIn: !!r && r.top >= sr.top && r.bottom <= sr.bottom + 1 && r.left >= sr.left && r.right <= sr.right + 1 }; });
// the wall monitor: waits until it has landed and switched on (wl.dataset.at), its flight takes ~2 s
const wallLabel = async p => { await p.waitForFunction(() => { const w = document.querySelector('#wall-label'); return !w || w.dataset.at; }, null, { timeout: 8000 }).catch(() => {}); return p.evaluate(() => { const w = document.querySelector('#wall-label'); if (!w) return { exists: false }; const r = w.getBoundingClientRect(), v = document.querySelector('#gallery .vov:not([hidden])'), vr = v && v.getBoundingClientRect();
  return { exists: true, at: w.dataset.at, shown: !w.hidden && w.offsetWidth > 0, text: w.textContent, items: [...w.querySelectorAll('li')].map(l => l.textContent), leftOfScreen: !!vr && r.right <= vr.left + 1 }; }); };
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
    await pick(p, 3);
    const cb = await bubble(p), cl = await wallLabel(p), phone = await p.evaluate(() => document.querySelector('#gallery').clientWidth < 640);
    check(`${w}x${h} Casino: the bubble is the summary + Learn more, Learn more inside the stage`, /^At Logifuture I worked on 8\+ game releases/.test(cb.sum) && cb.opens === 1 && cb.openIn && !cb.items, cb);
    // the bubble stays clear of the screen and the 3D sign (phone: of the picture)
    const bc = await p.evaluate(phone => { const d = window.__dolly.rects().bays[3], sr = document.querySelector('.st').getBoundingClientRect(), r = document.querySelector('#guide-bubble').getBoundingClientRect();
      const b = { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height }, hit = q => !!q && b.x < q.x + q.w - 1 && b.x + b.w > q.x + 1 && b.y < q.y + q.h - 1 && b.y + b.h > q.y + 1;
      return { screen: hit(d.main), sign: phone ? false : hit(d.sign), b, main: d.main, sign0: d.sign }; }, phone);
    check(`${w}x${h} Casino: the bubble is clear of the screen${phone ? '' : ' and the sign'}`, !bc.screen && !bc.sign, bc);
    if (phone) check(`${w}x${h} phone: no wall label in the gallery`, !cl.exists, cl);
    else check(`${w}x${h} Casino: the wall monitor hangs left of the screen (facts incl. 700k+, stack; no repeated stack bullet)`, cl.shown && cl.at === '3:gallery' && cl.leftOfScreen && cl.items.join('|') === '8+ game releases, start to finish|700k+ peak users across 3 games' && /Stack/.test(cl.text), cl);
    if (w === 1920) {
      // one picture height: each bay measured at its own gallery shot (__dolly.rects, projected px)
      const hs = [];
      for (const i of [1, 2, 3, 4, 5]) { await pick(p, i); hs[i] = await p.evaluate(i => window.__dolly.rects().bays[i].main.h, i); }
      const one = [1, 2, 3].map(i => hs[i]), mx = Math.max(...one), mn = Math.min(...one), ref = (hs[1] + hs[2] + hs[3]) / 3;
      check('1920x1080 the three single-screen bays show one picture height (within 2%)', (mx - mn) / mx <= .02, hs.map(Math.round));
      check('1920x1080 each frame bay\'s big frame is 2.2/2.55 of that (±2%)', [4, 5].every(i => Math.abs(hs[i] / ref - 2.2 / 2.55) <= .02), [hs[4] / ref, hs[5] / ref, 2.2 / 2.55]);
    }
    await ctx.close();
  }

  // 2-4. keyboard route, open, return
  let p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(1200);
  await p.focus('.key[data-i="0"]');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  await p.waitForFunction(() => { const b = document.querySelector('#guide-bubble'); return b && !b.hidden && document.querySelector('.live').textContent; }, null, { timeout: 6000 }).catch(() => {}); await p.waitForTimeout(200);
  let s = await state(p);
  check('arrow keys select Eve of Destruction', s.key === 'Eve of Destruction' && s.active.indexOf('Eve of Destruction') === 0, s);
  check('live region says only the section name', s.live === 'Eve of Destruction', s.live);
  check('bubble and wall label describe the active button', s.describedBy === 'guide-bubble wall-label', s.describedBy);
  check('clip plays over the selected screen', /ult\+bossfightgif\.mp4$/.test(s.clip || ''), s.clip);
  await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  check('bubble hides during the push', (await state(p)).bubble === false);
  // the case opens in the same scene: no page load, the bar swaps to the case's parts
  await p.waitForFunction(() => location.hash === '#eve-of-destruction/case', null, { timeout: 5000 }).catch(() => {});
  await p.waitForFunction(() => { const b = document.querySelector('#case-bubble'); return b && !b.hidden && !document.querySelector('.ckeys').hidden; }, null, { timeout: 8000 }).catch(() => {});
  let cs = await p.evaluate(() => ({ url: location.pathname + location.hash, canvases: document.querySelectorAll('canvas').length, bar: !document.querySelector('.ckeys').hidden, sections: !document.querySelector('.keys:not(.ckeys)').hidden, active: document.activeElement.textContent.trim().slice(0, 30), head: document.querySelector('#case-bubble .bh').textContent }));
  check('Open: the case opens in the scene (same page, one canvas)', /index\.html#eve-of-destruction\/case$/.test(cs.url) && cs.canvases === 1 && cs.bar && !cs.sections, cs);
  check('Open: no Overview part, focus and bubble on the first part (Combat)', cs.active.indexOf('Combat') === 0 && cs.head === 'Combat', cs);
  await p.click('.ckeys .cback');
  const seen = [];
  for (let i = 0; i < 10; i++) { seen.push(await p.evaluate(() => { const b = document.querySelector('#guide-bubble'); return b ? (b.hidden ? 'H' : 'V') : '-'; }).catch(() => '-')); await p.waitForTimeout(100); }
  // in, back out to the gallery shot, then the guide steps off the stand and walks to its spot: the bubble opens there
  await p.waitForFunction(() => { const b = document.querySelector('#guide-bubble'); return b && !b.hidden; }, null, { timeout: 6000 }).catch(() => {});
  s = await state(p);
  check('All projects: back out of the screen (bubble hidden, then shown)', seen.join('').indexOf('H') >= 0 && s.bubble, seen.join(''));
  check('All projects: section bar back, focus on the Eve button, no case in the URL', s.active.indexOf('Eve of Destruction') === 0 && !/\/case/.test(p.url()) && await p.evaluate(() => document.querySelector('.ckeys').hidden), { active: s.active, url: p.url() });

  // University Projects: the summary + one Learn more, which opens the game in the big frame
  await pick(p, 4);
  let ub = await bubble(p);
  check('University Projects bubble: the summary and one Learn more (the big frame: Climbing)', ub.sum === "These are the main projects I've worked on in or during university, where I tried to reach beyond my assignment brief and show off my best skills as a technical designer." && ub.opens === 1 && ub.href === 'university_projects.html#climbing' && !ub.items, ub);
  const ul0 = await wallLabel(p);
  check('University: the wall label carries just the stack (no facts)', ul0.shown && !ul0.items.length && /Unity 6, C#/.test(ul0.text), ul0);
  await p.click('#guide-bubble .openb');
  await p.waitForFunction(() => { const b = document.querySelector('#case-bubble'); return b && !b.hidden; }, null, { timeout: 8000 }).catch(() => {});
  let ry = await p.evaluate(() => ({ url: location.hash, active: document.activeElement.textContent.trim(), key: (document.querySelector('.ckeys .key.on .rt') || {}).textContent }));
  check('University Learn more opens the big frame\'s game (Climbing), focus on its part', ry.url === '#university-projects/case/climbing' && ry.active.indexOf('Climbing Game') === 0 && ry.key === 'Climbing Game', ry);
  // make Rally big in the case, go back: Learn more now opens Rally
  await p.click('.ckeys .key[data-g="1"]'); await p.waitForTimeout(900);
  await p.goBack();
  await p.waitForFunction(() => { const b = document.querySelector('#guide-bubble'); return b && !b.hidden; }, null, { timeout: 6000 }).catch(() => {});
  check('browser Back closes the case, focus on the University button', (await state(p)).active.indexOf('University Projects') === 0 && await p.evaluate(() => document.querySelector('.ckeys').hidden));
  ub = await bubble(p);
  check('University: with Rally big, Learn more points at Rally', ub.href === 'university_projects.html#rally', ub);
  await p.click('#guide-bubble .openb');
  await p.waitForFunction(() => { const b = document.querySelector('#case-bubble'); return b && !b.hidden; }, null, { timeout: 8000 }).catch(() => {});
  ry = await p.evaluate(() => ({ url: location.hash, key: (document.querySelector('.ckeys .key.on .rt') || {}).textContent }));
  check('University: Learn more opens Rally, the game in the big frame', ry.url === '#university-projects/case/rally' && ry.key === 'Rally Game', ry);
  await p.click('.ckeys .cback'); await p.waitForFunction(() => { const b = document.querySelector('#guide-bubble'); return b && !b.hidden && document.querySelector('.ckeys').hidden; }, null, { timeout: 8000 }).catch(() => {});

  // the summaries of Over the Hill, Eve and Casino are their project page's intro, word for word (edit the page: the test fails until P matches)
  for (const [i, file] of [[1, 'over_the_hill.html'], [2, 'eve_of_destruction.html'], [3, 'casino_games.html']]) {
    await pick(p, i);
    const hero = await p.evaluate(async f => { const t = await (await fetch(f)).text(); return new DOMParser().parseFromString(t, 'text/html').querySelector('.project-hero-desc').textContent; }, file);
    const sb = await bubble(p);
    check(`${file}: the bubble's summary is the page's intro, verbatim`, norm(sb.sum) === norm(hero) && sb.opens === 1, norm(sb.sum) === norm(hero) ? undefined : { bubble: norm(sb.sum), page: norm(hero) });
  }
  await pick(p, 2);
  const sl = await p.evaluate(() => { const a = document.querySelector('#guide-bubble .sum a'); return a ? { href: a.href, target: a.target, rel: a.rel, style: a.getAttribute('style'), color: getComputedStyle(a).color } : null; });
  check('Eve: the Steam demo link works (new tab, noopener) in the gallery\'s link style', sl && /store\.steampowered\.com\/app\/2839460/.test(sl.href) && sl.target === '_blank' && /noopener/.test(sl.rel) && !sl.style && sl.color === 'rgb(11, 122, 46)', sl);

  // Over the Hill opens its case
  await p.click('.key[data-i="1"]'); await p.waitForTimeout(1800); await p.waitForFunction(() => { const b = document.querySelector('#guide-bubble'); return b && !b.hidden; }, null, { timeout: 5000 }).catch(() => {});
  check('bubble button reads Learn more', (await p.textContent('.bub .openb')).trim().indexOf('Learn more') === 0);
  await p.click('.bub .openb');
  await p.waitForFunction(() => location.hash === '#over-the-hill/case', null, { timeout: 5000 }).catch(() => {});
  check('Over the Hill opens its case', /#over-the-hill\/case$/.test(p.url()), { url: p.url(), st: await state(p), on: await p.evaluate(() => window.__caseMode && window.__caseMode.on()) });

  // Clicking a capture opens its page like Learn more; a drag still scrubs
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(1200);
  await p.click('.key[data-i="5"]'); await p.waitForTimeout(1800); await p.waitForFunction(() => { const b = document.querySelector('#guide-bubble'); return b && !b.hidden; }, null, { timeout: 5000 }).catch(() => {});
  const ogb = await bubble(p);
  check('Other Games bubble: the summary and one Learn more (the big frame: Stealth Game)', ogb.sum === "My remaining projects, a stealth game using Darkwood's fog of war system that I spent 9 months on and two smaller game jam games." && ogb.opens === 1 && ogb.href === 'my_games.html#stealth' && !ogb.items, ogb);
  check('no dolly track label', !(await p.$('.dbg')));
  const bx = await p.locator('.st').boundingBox();
  await p.mouse.move(bx.x + bx.width * .3, bx.y + bx.height * .9); await p.mouse.down();
  await p.mouse.move(bx.x + bx.width * .8, bx.y + bx.height * .9, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(1800); await p.waitForFunction(() => { const b = document.querySelector('#guide-bubble'); return b && !b.hidden; }, null, { timeout: 5000 }).catch(() => {});
  check('dragging the stage still scrubs and snaps', (await state(p)).key !== 'Other Games' && p.url().indexOf('index.html') > 0, (await state(p)).key);
  await p.click('.key[data-i="5"]'); await p.waitForTimeout(1800); await p.waitForFunction(() => { const b = document.querySelector('#guide-bubble'); return b && !b.hidden; }, null, { timeout: 5000 }).catch(() => {});
  await p.waitForSelector('.vov:not([hidden])', { timeout: 4000 }).catch(() => {});
  const ov = await p.locator('.vov:not([hidden])').first().boundingBox();
  await p.mouse.click(ov.x + ov.width / 2, ov.y + ov.height / 2);
  await p.waitForFunction(() => location.hash === '#other-games/case/stealth', null, { timeout: 5000 }).catch(() => {});
  check('clicking the big frame opens its game\'s case (Stealth Game)', /#other-games\/case\/stealth$/.test(p.url()), p.url());

  // The titles are 3D signs (no HTML plates): a click on one selects its section, a second click opens it; the outline marks the selected screen
  await p.goto('about:blank'); await p.goto(BASE + 'index.html'); await p.waitForTimeout(1500);
  const signAt = async i => { const r = await p.evaluate(i => window.__dolly.rects().bays[i].sign, i), sb = await p.locator('.st').boundingBox(); return { x: sb.x + r.x + r.w / 2, y: sb.y + r.y + r.h / 2 }; };
  check('no HTML title plates on the stage', !(await p.$('.st .tp')));
  const ab = await p.evaluate(() => ({ html: !!document.querySelector('.st .pin.sign'), sr: (document.querySelector('.st .sr') || {}).textContent || '', sign: window.__dolly.rects().bays[0].sign }));
  check('About is a 3D sign too (no HTML card; its text stays in the page for screen readers)', !ab.html && /technical designer/.test(ab.sr) && ab.sign && ab.sign.w > 100, ab);
  let sp = await signAt(1); await p.mouse.click(sp.x, sp.y); await p.waitForTimeout(1800);
  await p.waitForFunction(() => { const b = document.querySelector('#guide-bubble'); return b && !b.hidden; }, null, { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(300);
  const sel1 = await p.evaluate(() => window.__dolly.rects().bays.map(b => !!b.sel));
  check('clicking Over the Hill\'s sign selects it; the outline shows on its screen only', (await state(p)).key === 'Over the Hill' && sel1.join() === 'false,true,false,false,false,false', { key: (await state(p)).key, sel1 });
  sp = await signAt(1); await p.mouse.click(sp.x, sp.y);
  await p.waitForFunction(() => location.hash === '#over-the-hill/case', null, { timeout: 5000 }).catch(() => {});
  check('a second click on the sign opens its case', /#over-the-hill\/case$/.test(p.url()), p.url());

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

  // Clip overlays: never visible before their video has a frame (it used to show a black box), on a slow network too;
  // the neighbours' clips are pre-warmed; University's Climbing clip starts at its poster's moment (15 s)
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const q = await ctx.newPage();
    await q.addInitScript(() => {
      window.__ovBad = []; window.__ovFirst = {};
      const loop = () => {
        document.querySelectorAll('.vov').forEach(o => {
          if (o.hidden || +getComputedStyle(o).opacity === 0) return;
          const v = o.querySelector('video'); if (!v) return;
          const src = v.getAttribute('src');
          if (v.readyState < 2) window.__ovBad.push(src + ' rs=' + v.readyState);
          else if (!(src in window.__ovFirst)) window.__ovFirst[src] = v.currentTime;
        });
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    const cdp = await ctx.newCDPSession(q);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 6e6 / 8, uploadThroughput: 1e6 / 8 });
    await q.goto(BASE + 'index.html'); await q.waitForFunction(() => document.querySelector('#gallery.g3d'), null, { timeout: 20000 }); await q.waitForTimeout(1500);
    const warm = () => q.evaluate(() => [...document.querySelectorAll('.vhold video')].map(v => ({ src: v.getAttribute('src'), paused: v.paused, preload: v.preload })));
    await pick(q, 2); await q.waitForTimeout(3000);
    const w2 = await warm();
    check('Eve selected: its neighbour\'s clip (Casino) is pre-warmed, paused', w2.some(v => v.src === 'assets/spin+.mp4' && v.paused && v.preload === 'auto'), w2);
    for (const i of [3, 4]) { await pick(q, i); await q.waitForTimeout(3000); }
    const w4 = await warm();
    check('University selected: Casino and Other Games are pre-warmed', ['assets/spin+.mp4', 'assets/visionsystem.mp4'].every(s => w4.some(v => v.src === s && v.paused)), w4);
    for (const i of [5, 2, 4]) { await pick(q, i); await q.waitForTimeout(2000); }
    const ov = await q.evaluate(() => ({ bad: window.__ovBad.slice(0, 5), n: window.__ovBad.length, first: window.__ovFirst }));
    check('a clip overlay is never visible before its video has a frame (slow network)', !ov.n && Object.keys(ov.first).length >= 4, ov);
    const tc = ov.first['assets/climbing.mp4'];
    check('University: Climbing\'s clip starts at its poster\'s moment (15 s)', tc >= 14.9 && tc < 16, ov.first);
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
  const rmw = await p.evaluate(() => { const w = document.querySelector('#wall-label'); return { at: w.dataset.at, shown: !w.hidden, boot: w.classList.contains('boot') || w.classList.contains('dark') }; });
  check('reduced motion: the wall monitor is placed at once (no flight)', rmw.at === '3:gallery' && rmw.shown && !rmw.boot, rmw);
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
