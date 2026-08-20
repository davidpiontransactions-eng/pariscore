// scripts/qa-mobile-trace.js - trace exactly WHO calls reload() with stack (sessionStorage-persistent)
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  page.addInitScript(() => {
    const store = () => {
      try { return JSON.parse(sessionStorage.getItem('__stacks') || '[]'); } catch { return []; }
    };
    const push = (s) => {
      try {
        const a = store(); a.push(s); sessionStorage.setItem('__stacks', JSON.stringify(a));
      } catch (e) { console.log('store err', e.message); }
    };
    const orig = window.location.reload.bind(window.location);
    try {
      Object.defineProperty(window.location, 'reload', {
        configurable: true,
        value: function () {
          push({ t: Date.now(), kind: 'reload', stack: new Error('RELOAD').stack });
          return orig();
        },
      });
    } catch (e) { console.log('reload patch err', e.message); }
    const orig2 = window.history.replaceState.bind(window.history);
    window.history.replaceState = function () {
      push({ t: Date.now(), kind: 'replaceState', url: String(arguments[2] || '') });
      return orig2.apply(window.history, arguments);
    };
    push({ t: Date.now(), kind: 'init', url: window.location.href.slice(0, 70) });
  });
  const navs = [];
  page.on('framenavigated', (f) => navs.push({ url: f.url().slice(0, 70), t: Date.now() }));
  await page.goto('https://pariscore.fr/?v=t-ms-' + Date.now(), {
    waitUntil: 'domcontentloaded', timeout: 45000,
  }).catch(e => console.log('goto ERR:', e.message.slice(0, 80)));
  await page.waitForTimeout(15000);
  const stacks = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__stacks') || '[]'));
  console.log('navigations:', navs.length);
  navs.forEach(n => console.log('  nav @', n.t - navs[0].t, 'ms ->', n.url));
  console.log('--- events (' + stacks.length + ') ---');
  const t0 = navs[0].t;
  stacks.forEach((s, i) => {
    const rel = s.t - t0;
    if (s.kind === 'reload') {
      console.log('#' + i + ' reload @' + rel + 'ms stack:\n' + s.stack.split('\n').slice(1, 7).join('\n'));
    } else {
      console.log('#' + i + ' ' + s.kind + ' @' + rel + 'ms ' + (s.url || ''));
    }
  });
  await browser.close();
})();