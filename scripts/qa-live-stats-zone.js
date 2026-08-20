// scripts/qa-live-stats-zone.js - capture the actual stats section DOM (metric rows) on FotMob + Sofascore
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const OUT = path.join(__dirname, '..', '.context', 'design-compare', 'live-stats');

const CONTRAST = (fg, bg) => {
  const lum = (c) => {
    const ch = c.match(/\d+(\.\d+)?/g).map(Number);
    const [r, g, b] = ch.slice(0, 3).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const l1 = lum(fg), l2 = lum(bg);
  return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
};

const METRIC_ROWS = () => {
  const out = [];
  const labelRe = /possession|ball possession|tirs|shots|on target|cadr|corner|yellow|sauvegarde|saves|passe|passes|fouls|faute/i;
  const els = [...document.querySelectorAll('div,tr,span,p')].filter((el) => {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 80 || t.length < 3) return false;
    if (!labelRe.test(t)) return false;
    if (el.children.length > 5) return false;
    return true;
  });
  const seen = new Set();
  for (const el of els) {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (seen.has(t)) continue;
    seen.add(t);
    const cs = getComputedStyle(el);
    let p = el.parentElement;
    let bg = 'rgba(0,0,0,0)';
    for (let i = 0; i < 6 && p; i++) {
      const c = getComputedStyle(p).backgroundColor;
      if (c !== 'rgba(0, 0, 0, 0)') { bg = c; break; }
      p = p.parentElement;
    }
    const nums = t.match(/\d+(\.\d+)?%?/g);
    out.push({
      text: t.slice(0, 55), nums: nums ? nums.slice(0, 4) : [],
      font: cs.fontFamily.split(',')[0].replace(/"/g, ''),
      size: cs.fontSize, weight: cs.fontWeight,
      fg: cs.color, bg,
      contrast: (() => { try { return CONTRAST(cs.color, bg); } catch { return 'n/a'; } })(),
    });
  }
  return out.slice(0, 20);
};

(async () => {
  const browser = await chromium.launch();

  // FotMob: we already have match page; find and click "Stats" then extract
  const fm = await browser.newPage();
  await fm.goto('https://www.fotmob.com/matches', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await fm.waitForTimeout(4000);
  const links = await fm.$$('a[href*="/matches/"]');
  if (links.length) {
    const href = await links[0].getAttribute('href');
    await fm.goto('https://www.fotmob.com' + href, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await fm.waitForTimeout(6000);
    console.log('FOTMOB page:', (await fm.title()).slice(0, 70));
    // try clicking various stat triggers
    for (const sel of ['text=Match Stats', 'text=Stats', 'text=Statistiques', 'text=Match Statistics']) {
      try { const l = fm.locator(sel).first(); if (await l.count()) { await l.click({ timeout: 2000 }); console.log('  clicked:', sel); break; } } catch {}
    }
    await fm.waitForTimeout(2500);
    await fm.screenshot({ path: path.join(OUT, 'fotmob-statszone.png') });
    const rows = await fm.evaluate(METRIC_ROWS);
    console.log('--- FOTMOB METRIC ROWS ---');
    rows.forEach((r) => console.log('  [' + r.font + ' ' + r.size + ' w' + r.weight + '] "' + r.text + '" nums=' + JSON.stringify(r.nums) + ' fg=' + r.fg + ' bg=' + r.bg + ' c=' + r.contrast));
  }
  await fm.close();

  // Sofascore: retry with fresh navigation to match page then Stats tab
  const ss = await browser.newPage();
  await ss.goto('https://www.sofascore.com/football/live', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await ss.waitForTimeout(4000);
  const sl = await ss.$$('a[href*="/match/"]');
  if (sl.length) {
    const href = await sl[0].getAttribute('href');
    await ss.goto('https://www.sofascore.com' + href, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await ss.waitForTimeout(6000);
    console.log('SOFASCORE page:', (await ss.title()).slice(0, 70));
    for (const sel of ['text=Stats', 'text=Statistiques', 'text=Statistics', 'text=Live']) {
      try { const l = ss.locator(sel).first(); if (await l.count()) { await l.click({ timeout: 2000 }); console.log('  clicked:', sel); break; } } catch {}
    }
    await ss.waitForTimeout(2500);
    await ss.screenshot({ path: path.join(OUT, 'sofascore-statszone.png') });
    const rows = await ss.evaluate(METRIC_ROWS);
    console.log('--- SOFASCORE METRIC ROWS ---');
    rows.forEach((r) => console.log('  [' + r.font + ' ' + r.size + ' w' + r.weight + '] "' + r.text + '" nums=' + JSON.stringify(r.nums) + ' fg=' + r.fg + ' bg=' + r.bg + ' c=' + r.contrast));
  }
  await ss.close();

  await browser.close();
})();