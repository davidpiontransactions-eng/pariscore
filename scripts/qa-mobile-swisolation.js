// scripts/qa-mobile-swisolation.js - compare nav count with SW blocked vs enabled
const { chromium } = require('@playwright/test');

async function run(label, opts) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, ...opts });
  const page = await ctx.newPage();
  const navs = [];
  const reqs = [];
  page.on('framenavigated', (f) => navs.push(f.url().split('?')[0] + '?' + (f.url().includes('?v=') ? 'v=' : 'plain')));
  page.on('request', (r) => { if (r.resourceType() === 'document') reqs.push(r.url().split('?')[0]); });
  await page.goto('https://pariscore.fr/?v=iso-' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 })
    .catch(e => console.log(label, 'goto ERR', e.message.slice(0, 60)));
  await page.waitForTimeout(12000);
  console.log(label, '| navigations:', navs.length, '|', navs.join('  ->  '));
  console.log(label, '| document requests:', reqs.length, '|', reqs.join('  ->  '));
  await browser.close();
}

(async () => {
  await run('SW-ENABLED ', {});
  await run('SW-BLOCKED ', { serviceWorkers: 'block' });
})();