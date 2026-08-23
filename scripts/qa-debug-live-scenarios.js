// scripts/qa-debug-live-scenarios.js - test live filter scenarios on prod
const { chromium } = require('@playwright/test');

async function scenario(page, label, url) {
  await page.goto('https://pariscore.fr' + url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(7000);
  try { await page.getByRole('tab', { name: /^football/i }).first().click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(4000);
  const state = await page.evaluate(() => {
    const body = document.body.textContent.replace(/\s+/g, ' ').trim();
    const liveH = [...document.querySelectorAll('h2,h3')].find((h) => /EN DIRECT/i.test(h.textContent));
    const liveDivs = [...document.querySelectorAll('div')].filter((d) => (d.textContent || '').includes('Poss.') && (d.textContent || '').includes('Tirs'));
    const empty = [...document.querySelectorAll('*')].find((e) => /Aucun match en direct|Aucun match/i.test(e.textContent) && e.textContent.trim().length < 80);
    const url = location.search;
    return {
      url, liveHeader: liveH ? liveH.textContent.trim().slice(0, 40) : null,
      liveStatRows: liveDivs.length, emptyState: empty ? empty.textContent.trim().slice(0, 60) : null,
    };
  });
  console.log('[' + label + '] ' + JSON.stringify(state));
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });

  await scenario(page, 'default', '/');
  await scenario(page, 'time=6h', '/?time=6h');
  await scenario(page, 'time=today', '/?time=today');
  await scenario(page, 'time=all', '/?time=all');

  // Try a league filter if URL scheme supports it
  const supported = await page.evaluate(() => {
    const sb = document.querySelector('[class*="sidebar"], aside, [class*="drawer"]');
    return sb ? sb.textContent.slice(0, 200) : 'no sidebar';
  });
  console.log('SIDEBAR SNIPPET:', JSON.stringify(supported.slice(0, 150)));

  await browser.close();
})();