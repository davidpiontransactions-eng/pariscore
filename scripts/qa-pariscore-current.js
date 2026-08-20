// scripts/qa-pariscore-current.js - capture current PariScore home design state (screenshots + DOM)
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const OUT = path.join(__dirname, '..', '.context', 'design-compare', 'pariscore-current');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('https://pariscore.fr/?v=cur-' + Date.now(), { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(OUT, 'home.png') });

  const report = await page.evaluate(() => {
    const cs = (el) => el ? getComputedStyle(el) : null;
    const body = cs(document.body);
    const header = document.querySelector('header');
    const hcs = header ? cs(header) : null;
    const firstCard = document.querySelector('[class*="card"]');
    const fccs = firstCard ? cs(firstCard) : null;
    const sizes = new Map();
    document.querySelectorAll('body *').forEach(el => {
      const fs = parseFloat(cs(el).fontSize);
      if (fs > 0 && fs < 60) { const k = Math.round(fs * 2) / 2; sizes.set(k, (sizes.get(k) || 0) + 1); }
    });
    const accents = new Map();
    document.querySelectorAll('a, button, [class*="badge"], [class*="score"], [class*="live"]').forEach(el => {
      const c = cs(el).color.replace(/\s/g, '');
      accents.set(c, (accents.get(c) || 0) + 1);
    });
    return {
      bodyBg: body.backgroundColor, bodyColor: body.color,
      bodyFont: body.fontFamily.split(',')[0],
      headerBg: hcs?.backgroundColor, headerPos: hcs?.position, headerH: header?.offsetHeight,
      headerSticky: hcs?.position === 'sticky' || hcs?.position === 'fixed',
      cardBg: fccs?.backgroundColor, cardRadius: fccs?.borderRadius, cardShadow: fccs?.boxShadow,
      typeScale: [...sizes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, n]) => s + 'px x' + n),
      accents: [...accents.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      tabs: document.querySelectorAll('[role="tab"], [class*="tab"]').length,
      tables: document.querySelectorAll('table').length,
      cards: document.querySelectorAll('[class*="card"]').length,
      buttons: document.querySelectorAll('button').length,
      scoreEls: document.querySelectorAll('[class*="score"]').length,
      images: document.querySelectorAll('img').length,
    };
  });
  fs.writeFileSync(path.join(OUT, 'tokens.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();