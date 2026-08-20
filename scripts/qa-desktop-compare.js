// scripts/qa-desktop-compare.js - same trace on desktop to isolate mobile-specific behavior
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  page.on('framenavigated', (f) =>
    console.log('NAV ' + (Date.now() - t0) + 'ms -> ' + f.url().replace(/v=iso-[0-9]+/, 'v=X').slice(0, 60)));
  page.on('request', (r) => {
    if (r.resourceType() === 'fetch' || r.resourceType() === 'xhr')
      console.log('REQ ' + (Date.now() - t0) + 'ms ' + r.url().replace(/v=iso-[0-9]+/, 'v=X').slice(0, 80));
  });
  await page.goto('https://pariscore.fr/?v=iso-' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 })
    .catch(e => console.log('GOTO ERR', e.message.slice(0, 60)));
  await page.waitForTimeout(20000);
  await browser.close();
})();