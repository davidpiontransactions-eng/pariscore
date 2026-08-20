// scripts/qa-mobile-sequence.js - replicate audit test sequence exactly (desktop first, then mobile ctx)
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const BASE = 'https://pariscore.fr';
  const BUST = '/?v=audit-' + Date.now();

  // Step 1: desktop context like the audit test
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.goto(BASE + BUST, { waitUntil: 'domcontentloaded', timeout: 45000 });
  console.log('desktop loaded OK, waiting 8s...');
  await page.waitForTimeout(8000);

  // Step 2: mobile context exactly like audit test
  const t0 = Date.now();
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'fr-FR', isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  mp.on('pageerror', (e) => console.log('mobile pageerror: ' + e.message.slice(0, 100)));
  try {
    await mp.goto(BASE + BUST, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('MOBILE GOTO OK at ' + (Date.now() - t0) + 'ms');
  } catch (e) {
    console.log('MOBILE GOTO TIMEOUT after ' + (Date.now() - t0) + 'ms: ' + e.message.slice(0, 120));
  }
  await mctx.close();
  await ctx.close();
  await browser.close();
})();