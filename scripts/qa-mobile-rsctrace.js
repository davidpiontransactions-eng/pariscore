// scripts/qa-mobile-rsctrace.js - log ALL requests (esp. RSC) + console before each soft navigation
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const log = [];
  page.on('request', (r) => {
    const u = r.url().replace(/v=iso-[0-9]+/, 'v=X');
    if (r.resourceType() === 'document' || u.includes('_next') || u.includes('RSC') || u.includes('flight') || u.includes('rsc'))
      log.push('REQ ' + (Date.now() - t0) + 'ms [' + r.resourceType() + '] ' + u.slice(0, 100) + ' ' + (r.headers()['rsc'] || ''));
  });
  page.on('framenavigated', (f) => log.push('NAV ' + (Date.now() - t0) + 'ms -> ' + f.url().replace(/v=[a-z0-9-]+/, 'v=X').slice(0, 80)));
  page.on('console', (m) => {
    const t = m.text();
    if (/reload|refresh|navigat|replace|SW|service|router/i.test(t))
      log.push('CONSOLE ' + (Date.now() - t0) + 'ms [' + m.type() + '] ' + t.slice(0, 120));
  });
  await page.goto('https://pariscore.fr/?v=iso-' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 })
    .catch(e => log.push('GOTO ERR ' + e.message.slice(0, 60)));
  await page.waitForTimeout(12000);
  console.log(log.join('\n'));
  await browser.close();
})();