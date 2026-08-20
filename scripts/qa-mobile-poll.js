// scripts/qa-mobile-poll.js - dump ALL fetch/websocket for 25s to find the networkidle blocker
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 }, locale: 'fr-FR', isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  page.on('request', (r) => {
    const u = r.url().replace(/v=iso-[0-9]+/, 'v=X');
    const rt = r.resourceType();
    if (rt === 'fetch' || rt === 'xhr' || rt === 'websocket' || rt === 'document')
      console.log('REQ ' + (Date.now() - t0) + 'ms [' + rt + '] ' + u.slice(0, 100));
  });
  page.on('framenavigated', (f) =>
    console.log('NAV ' + (Date.now() - t0) + 'ms -> ' + f.url().replace(/v=iso-[0-9]+/, 'v=X').slice(0, 80)));
  await page.goto('https://pariscore.fr/?v=iso-' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 })
    .catch(e => console.log('GOTO ERR ' + e.message.slice(0, 60)));
  await page.waitForTimeout(25000);
  await browser.close();
  console.log('--- end of 25s window ---');
})();