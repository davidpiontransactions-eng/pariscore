// scripts/qa-mobile-fulltrace.js - complete console + request dump to find reload caller
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  page.on('request', (r) => {
    const u = r.url().replace(/v=iso-[0-9]+/, 'v=X');
    if (r.resourceType() === 'document' || /_rsc|flight/.test(u))
      console.log('REQ ' + (Date.now() - t0) + 'ms [' + r.resourceType() + '] ' + u.slice(0, 90));
  });
  page.on('framenavigated', (f) =>
    console.log('NAV ' + (Date.now() - t0) + 'ms -> ' + f.url().replace(/v=iso-[0-9]+/, 'v=X').slice(0, 80)));
  page.on('console', (m) => {
    const t = m.text().slice(0, 130).replace(/\n/g, ' ');
    console.log('CONSOLE ' + (Date.now() - t0) + 'ms [' + m.type() + '] ' + t);
  });
  await page.goto('https://pariscore.fr/?v=iso-' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 })
    .catch(e => console.log('GOTO ERR ' + e.message.slice(0, 60)));
  await page.waitForTimeout(12000);
  await browser.close();
})();