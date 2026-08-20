// scripts/qa-live-card-capture.js - capture live stat rows on pariscore.fr prod
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const OUT = path.join(__dirname, '..', '.context', 'visual-audit-2026-08-20');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  await page.goto('https://pariscore.fr', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(8000);

  // find stat rows text
  const statInfo = await page.evaluate(() => {
    const out = [];
    const els = [...document.querySelectorAll('div')].filter((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return /^(\d+)\s*(Poss\.|Tirs|Cadrés|Corners)\s*(\d+)$/.test(t) || /^\d+(\.\d+)?\s*xG\s*\d+(\.\d+)?$/.test(t);
    });
    for (const el of els.slice(0, 8)) {
      const cs = getComputedStyle(el);
      const spans = [...el.querySelectorAll('span')].map((s) => {
        const c = getComputedStyle(s);
        return { t: s.textContent.trim(), size: c.fontSize, weight: c.fontWeight, font: c.fontFamily.split(',')[0], color: c.color };
      });
      out.push({ row: el.textContent.trim(), spans });
    }
    return out;
  });
  console.log('=== STAT ROWS FOUND ON PROD ===');
  statInfo.forEach((r) => {
    console.log('ROW:', r.row);
    r.spans.forEach((s) => console.log('  span[' + s.t + '] font=' + s.font + ' size=' + s.size + ' w=' + s.weight + ' color=' + s.color));
  });

  // crop the stat zone: find a live card and clip around it
  const clip = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('div')].filter((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return /Poss\.|Cadrés/.test(t) && t.length < 120;
    });
    if (!rows.length) return null;
    const el = rows[0];
    while (el.parentElement && el.parentElement.offsetHeight < 600) { /* climb to card */ }
    const r = el.getBoundingClientRect();
    return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 40), width: Math.min(r.width + 16, 600), height: Math.min(r.height + 120, 400) };
  });
  if (clip) {
    await page.screenshot({ path: path.join(OUT, 'live-stats-zone.png'), clip });
    console.log('SAVED live-stats-zone.png', JSON.stringify(clip));
  } else {
    await page.screenshot({ path: path.join(OUT, 'live-stats-none.png') });
    console.log('NO STAT ROW VISIBLE — full page saved');
  }
  await browser.close();
})();