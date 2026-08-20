// scripts/qa-mobile-networkidle.js - replicate audit test exactly, count requests per second
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'fr-FR', isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const perSec = new Map();
  page.on('request', (r) => {
    const s = Math.floor((Date.now() - t0) / 1000);
    perSec.set(s, (perSec.get(s) || 0) + 1);
  });
  page.on('framenavigated', (f) =>
    console.log('NAV ' + (Date.now() - t0) + 'ms -> ' + f.url().replace(/v=iso-[0-9]+/, 'v=X').slice(0, 60)));
  try {
    await page.goto('https://pariscore.fr/?v=iso-' + Date.now(), { waitUntil: 'networkidle', timeout: 60000 });
    console.log('NETWORKIDLE REACHED at ' + (Date.now() - t0) + 'ms');
  } catch (e) {
    console.log('GOTO TIMEOUT after 60s');
  }
  const sorted = [...perSec.entries()].sort((a, b) => a[0] - b[0]);
  console.log('requests/sec: ' + sorted.map(([s, n]) => s + 's:' + n).join('  '));
  await browser.close();
})();