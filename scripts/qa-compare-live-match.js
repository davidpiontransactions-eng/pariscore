// scripts/qa-compare-live-match.js - open a live match on each competitor, extract stat-section styles
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const OUT = path.join(__dirname, '..', '.context', 'design-compare', 'live-stats');
fs.mkdirSync(OUT, { recursive: true });

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

const EXTRACT = () => {
  const els = [...document.querySelectorAll('*')].filter((el) => {
    const t = (el.textContent || '').trim();
    if (!t || t.length > 80 || el.children.length > 4) return false;
    return /possession|tirs|cadrés|corners|shots|on target|corner|ball possession/i.test(t);
  }).slice(0, 20);
  const seen = new Set();
  const out = [];
  for (const el of els) {
    if (seen.has(el.textContent.trim())) continue;
    seen.add(el.textContent.trim());
    const cs = getComputedStyle(el);
    let p = el.parentElement;
    let bg = 'rgba(0, 0, 0, 0)';
    for (let i = 0; i < 6 && p; i++) {
      const c = getComputedStyle(p).backgroundColor;
      if (c !== 'rgba(0, 0, 0, 0)') { bg = c; break; }
      p = p.parentElement;
    }
    out.push({
      text: el.textContent.trim().slice(0, 45),
      font: cs.fontFamily.split(',')[0].replace(/"/g, ''),
      size: cs.fontSize, weight: cs.fontWeight,
      fg: cs.color, bg,
      contrast: (() => { try { return CONTRAST(cs.color, bg); } catch { return 'n/a'; } })(),
    });
  }
  return out.slice(0, 12);
};

async function crawlSofascore(browser) {
  const page = await browser.newPage();
  await page.goto('https://www.sofascore.com/football/live', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const links = await page.$$('a[href*="/match/"]');
  console.log('sofascore match links:', links.length);
  if (links.length === 0) return [];
  await links[0].click().catch(async () => { await page.evaluate((u) => window.location.href = u, await links[0].getAttribute('href')); });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT, 'sofascore-match.png') });
  const rows = await page.evaluate(EXTRACT);
  console.log('=== SOFASCORE match ===');
  rows.forEach((r) => console.log('  [' + r.font + ' ' + r.size + ' w' + r.weight + '] ' + r.text + ' | fg=' + r.fg + ' bg=' + r.bg + ' c=' + r.contrast));
  await page.close();
  return rows;
}

async function crawlFotmob(browser) {
  const page = await browser.newPage();
  await page.goto('https://www.fotmob.com/matches', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const links = await page.$$('a[href*="/matches/"]');
  console.log('fotmob match links:', links.length);
  if (links.length === 0) return [];
  const href = await links[0].getAttribute('href');
  await page.goto('https://www.fotmob.com' + href, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT, 'fotmob-match.png') });
  const rows = await page.evaluate(EXTRACT);
  console.log('=== FOTMOB match ===');
  rows.forEach((r) => console.log('  [' + r.font + ' ' + r.size + ' w' + r.weight + '] ' + r.text + ' | fg=' + r.fg + ' bg=' + r.bg + ' c=' + r.contrast));
  await page.close();
  return rows;
}

async function crawlFlashscore(browser) {
  const page = await browser.newPage();
  await page.goto('https://www.flashscore.fr/football/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const rows = await page.$$('.event__match--live');
  console.log('flashscore live matches:', rows.length);
  if (rows.length === 0) return [];
  await rows[0].click().catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(OUT, 'flashscore-match.png') });
  const stats = await page.evaluate(EXTRACT);
  console.log('=== FLASHSCORE match ===');
  stats.forEach((r) => console.log('  [' + r.font + ' ' + r.size + ' w' + r.weight + '] ' + r.text + ' | fg=' + r.fg + ' bg=' + r.bg + ' c=' + r.contrast));
  await page.close();
  return stats;
}

async function crawlWhoScored(browser) {
  const page = await browser.newPage();
  await page.goto('https://www.whoscored.com/livefeed', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT, 'whoscored-live.png') });
  const rows = await page.evaluate(EXTRACT);
  console.log('=== WHOSCORED livefeed ===');
  rows.forEach((r) => console.log('  [' + r.font + ' ' + r.size + ' w' + r.weight + '] ' + r.text + ' | fg=' + r.fg + ' bg=' + r.bg + ' c=' + r.contrast));
  await page.close();
  return rows;
}

(async () => {
  const browser = await chromium.launch();
  const results = {};
  results.sofascore = await crawlSofascore(browser);
  results.fotmob = await crawlFotmob(browser);
  results.flashscore = await crawlFlashscore(browser);
  results.whoscored = await crawlWhoScored(browser);
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 1));
  await browser.close();
})();