// scripts/qa-live-search.js - find live match cards on pariscore.fr
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  await page.goto('https://pariscore.fr', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(8000);
  const info = await page.evaluate(() => {
    const now = new Date().toLocaleTimeString('fr-FR');
    const liveBadges = [...document.querySelectorAll('*')].filter((el) => {
      const t = (el.textContent || '').trim();
      return /^\d{1,2}'\s*(1re|2e|Mi-temps|HT|BT)?/i.test(t) && t.length < 10;
    }).length;
    const cards = [...document.querySelectorAll('div')].filter((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return /live/i.test(t) && t.length > 40 && t.length < 400;
    }).slice(0, 5).map((el) => el.textContent.trim().slice(0, 150));
    return { now, liveBadges, cards };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();