// scripts/qa-mobile-diagnose.js - why does 375px viewport time out on networkidle?
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  const navs = [];
  let requests = 0;
  page.on('framenavigated', (f) => navs.push({ url: f.url().slice(0, 80), t: Date.now() }));
  page.on('request', (r) => { requests++; });
  const t0 = Date.now();
  await page.goto('https://pariscore.fr/?v=d-ms-' + Date.now(), {
    waitUntil: 'domcontentloaded', timeout: 45000,
  }).catch(e => console.log('goto ERR:', e.message.slice(0, 90)));
  console.log('domcontentloaded in', Date.now() - t0, 'ms');
  await page.waitForTimeout(15000);
  console.log('navigations:', navs.length);
  navs.forEach(n => console.log('  nav', n.t - t0, 'ms ->', n.url));
  console.log('total requests:', requests);
  const state = await page.evaluate(() => ({
    readyState: document.readyState,
    controller: !!navigator.serviceWorker?.controller,
    hasSw: !!navigator.serviceWorker,
    bodyChildren: document.body ? document.body.children.length : -1,
    scripts: (document.scripts || []).length,
    isReloading: typeof window.__reloadCount !== 'undefined' ? window.__reloadCount : null,
  })).catch(e => ({ evalErr: e.message.slice(0, 60) }));
  console.log('page state:', JSON.stringify(state));
  await browser.close();
})();