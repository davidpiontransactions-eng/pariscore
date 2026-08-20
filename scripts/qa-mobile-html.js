// scripts/qa-mobile-html.js - inspect served HTML for injected redirect scripts + response headers
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'fr-FR', isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const res = await page.goto('https://pariscore.fr/?v=html-' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 });
  console.log('status:', res.status());
  console.log('headers:', JSON.stringify({
    'cache-control': res.headers()['cache-control'],
    'x-powered-by': res.headers()['x-powered-by'],
    'server': res.headers()['server'],
    'cf-ray': res.headers()['cf-ray'] || 'none',
  }));
  const html = await page.content();
  const scripts = (html.match(/<script[^>]*>/g) || []).map(s => s.slice(0, 110));
  console.log('inline scripts:', scripts.filter(s => !s.includes('src=')).length);
  console.log('external scripts:', scripts.filter(s => s.includes('src=')).length);
  const redir = html.match(/(location\.(replace|href|reload)|meta[^>]*refresh|window\.location)/gi) || [];
  console.log('redirect patterns in HTML:', redir.map(x => x.slice(0, 50)));
  await browser.close();
})();