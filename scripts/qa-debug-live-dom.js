// scripts/qa-debug-live-dom.js - deep DOM inspection of live section
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  await page.goto('https://pariscore.fr', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(6000);
  try { await page.getByRole('tab', { name: /^football/i }).first().click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(4000);
  try { await page.getByRole('tab', { name: /en direct/i }).first().click({ timeout: 2000 }); } catch {}
  await page.waitForTimeout(5000);

  const info = await page.evaluate(() => {
    const out = {};
    // find the live section heading
    const heading = [...document.querySelectorAll('h1,h2,h3')].find((h) => /EN DIRECT/i.test(h.textContent));
    out.heading = heading ? heading.textContent.trim().slice(0, 60) : null;
    // climb from heading to section container
    let section = heading;
    let containers = [];
    for (let i = 0; i < 6 && section; i++) {
      section = section.parentElement;
      if (section) {
        containers.push(section.tagName + '.' + section.className.toString().slice(0, 80) + ' children=' + section.children.length);
      }
    }
    out.containers = containers;
    // count match cards by common patterns
    const allDivs = [...document.querySelectorAll('div')];
    out.liveCards = allDivs.filter((d) => {
      const t = (d.textContent || '');
      return t.includes('Poss.') && t.includes('Tirs');
    }).length;
    out.badgesLive = [...document.querySelectorAll('span')].filter((s) => /^\d{1,2}'$|^\d{1,2}'/.test(s.textContent.trim())).length;
    // league filter chips
    out.filterChips = [...document.querySelectorAll('button, [role="tab"]')].filter((b) => {
      const t = b.textContent.trim();
      return /^Tous$|^Toutes$|Ligue|Premier|Serie A|Bundesliga|La Liga|Ligue 1|MLS/i.test(t);
    }).map((b) => b.textContent.trim().slice(0, 30));
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();