// scripts/qa-live-card-nav.js - navigate to Football > Live tab, capture stat rows
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const OUT = path.join(__dirname, '..', '.context', 'visual-audit-2026-08-20');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 }, locale: 'fr-FR' });
  await page.goto('https://pariscore.fr', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(6000);

  // click Football tab
  for (const label of ['Football', 'Football']) {
    const tab = page.getByRole('tab', { name: new RegExp('^' + label, 'i') }).first();
    try { await tab.click({ timeout: 3000 }); console.log('clicked tab:', label); break; } catch { console.log('tab not found:', label); }
  }
  await page.waitForTimeout(4000);
  // click Live sub-tab
  const liveTab = page.getByRole('tab', { name: /live/i }).first();
  try { await liveTab.click({ timeout: 3000 }); console.log('clicked Live sub-tab'); } catch (e) { console.log('live tab err', e.message.slice(0, 80)); }
  await page.waitForTimeout(6000);

  const statInfo = await page.evaluate(() => {
    const out = [];
    const els = [...document.querySelectorAll('div')].filter((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return /^(\d+)\s*(Poss\.|Tirs|Cadrés|Corners|EN DIRECT)/.test(t) && t.length < 60;
    });
    for (const el of els.slice(0, 10)) {
      const cs = getComputedStyle(el);
      const spans = [...el.querySelectorAll('span')].map((s) => {
        const c = getComputedStyle(s);
        return { t: s.textContent.trim(), size: c.fontSize, weight: c.fontWeight, font: c.fontFamily.split(',')[0].replace(/"/g, ''), color: c.color };
      });
      out.push({ row: el.textContent.trim().slice(0, 40), parentFont: cs.fontFamily.split(',')[0].replace(/"/g, ''), spans: spans.slice(0, 6) });
    }
    return out;
  });
  console.log('=== STAT ROWS (Football > Live) ===');
  if (!statInfo.length) console.log('NONE FOUND — maybe page structure differs');
  statInfo.forEach((r) => {
    console.log('ROW:', r.row);
    r.spans.forEach((s) => console.log('   span[' + s.t + '] font=' + s.font + ' size=' + s.size + ' w=' + s.weight + ' color=' + s.color));
  });

  await page.screenshot({ path: path.join(OUT, 'live-tab-full.png') });
  await browser.close();
})();