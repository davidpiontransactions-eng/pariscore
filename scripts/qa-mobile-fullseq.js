// scripts/qa-mobile-fullseq.js - replicate ENTIRE audit sequence before mobile goto
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const BASE = 'https://pariscore.fr';
  const BUST = '/?v=audit-' + Date.now();

  // Desktop
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + BUST, { waitUntil: 'domcontentloaded', timeout: 45000 });
  console.log('desktop loaded, evaluating...');
  await page.evaluate(() => ({
    bodyBg: getComputedStyle(document.body).backgroundColor,
    h1: document.querySelector('h1')?.textContent?.slice(0, 40),
  }));
  await page.screenshot({ path: '.context/visual-audit-2026-08-20/tmp-home.png' }).catch(() => {});
  console.log('screenshot done, football page...');
  await page.goto(BASE + '/football' + BUST.replace('/?v', '?v'), { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => console.log('football ERR', e.message.slice(0, 50)));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '.context/visual-audit-2026-08-20/tmp-football.png' }).catch(() => {});
  console.log('football done');

  // Mobile — exact replica
  const t0 = Date.now();
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'fr-FR', isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  try {
    await mp.goto(BASE + BUST, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('MOBILE GOTO OK at ' + (Date.now() - t0) + 'ms');
  } catch (e) {
    console.log('MOBILE GOTO FAILED at ' + (Date.now() - t0) + 'ms: ' + e.message.slice(0, 140));
    const st = await mp.evaluate(() => document.readyState).catch(() => 'n/a');
    console.log('mobile readyState:', st);
  }
  await mctx.close(); await ctx.close(); await browser.close();
})();