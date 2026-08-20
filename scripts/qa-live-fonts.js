// scripts/qa-live-fonts.js - extract real font stacks/sizes/colors used for data on match pages
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const OUT = path.join(__dirname, '..', '.context', 'design-compare', 'live-stats');

const EXTRACT_FONTS = () => {
  const sizes = new Map();
  const fonts = new Map();
  const colors = new Map();
  const weights = new Map();
  const all = [...document.querySelectorAll('*')];
  for (const el of all) {
    const t = (el.textContent || '').trim();
    if (!t || el.children.length > 3) continue;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    if (!(size > 0)) continue;
    const keyS = Math.round(size * 2) / 2;
    sizes.set(keyS, (sizes.get(keyS) || 0) + 1);
    const f = cs.fontFamily.split(',')[0].replace(/"/g, '');
    fonts.set(f, (fonts.get(f) || 0) + 1);
    colors.set(cs.color, (colors.get(cs.color) || 0) + 1);
    weights.set(cs.fontWeight, (weights.get(cs.fontWeight) || 0) + 1);
  }
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return {
    title: document.title,
    url: location.href.slice(0, 80),
    fonts: top(fonts).map(([k, v]) => k + ' x' + v),
    sizes: top(sizes).map(([k, v]) => k + 'px x' + v),
    colors: top(colors).map(([k, v]) => k + ' x' + v),
    weights: top(weights).map(([k, v]) => k + ' x' + v),
  };
};

async function run(name, buildUrl, opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', ...opts });
  const page = await ctx.newPage();
  try {
    const url = await buildUrl(page);
    if (url) {
      console.log('=== ' + name + ' ===');
      await page.waitForTimeout(4000);
      const data = await page.evaluate(EXTRACT_FONTS);
      console.log(JSON.stringify(data, null, 1));
      fs.writeFileSync(path.join(OUT, name + '-fonts.json'), JSON.stringify(data, null, 1));
    }
  } catch (e) {
    console.log(name + ' ERR: ' + e.message.slice(0, 120));
  }
  await browser.close();
}

(async () => {
  await run('sofascore', async (page) => {
    await page.goto('https://www.sofascore.com/football/live', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    const links = await page.$$('a[href*="/match/"]');
    if (!links.length) return null;
    const href = await links[0].getAttribute('href');
    await page.goto('https://www.sofascore.com' + href, { waitUntil: 'domcontentloaded', timeout: 45000 });
    return href;
  });

  await run('fotmob', async (page) => {
    await page.goto('https://www.fotmob.com/matches', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    const links = await page.$$('a[href*="/matches/"]');
    if (!links.length) return null;
    const href = await links[0].getAttribute('href');
    await page.goto('https://www.fotmob.com' + href, { waitUntil: 'domcontentloaded', timeout: 45000 });
    return href;
  });

  await run('flashscore', async (page) => {
    await page.goto('https://www.flashscore.fr/football/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    const live = await page.$$('.event__match--live');
    if (!live.length) return null;
    await live[0].click();
    return 'clicked live match';
  }, { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' });

  await run('whoscored', async (page) => {
    await page.goto('https://www.whoscored.com/livefeed', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000);
    return 'livefeed';
  });
})();