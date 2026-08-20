// scripts/qa-compare-live-match2.js - open live match, click Stats tab, extract metric rows incl adjacent values
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

// Look for stat rows: containers whose text is 2 numbers flanking a label
const EXTRACT = () => {
  const out = [];
  const labelRe = /possession|tirs|cadr|corners|shots|on target|off target|ball possession|yellow card|sauvetage|passes/i;
  const els = [...document.querySelectorAll('div, tr, li, span')].filter((el) => {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 90 || t.length < 3) return false;
    if (!labelRe.test(t)) return false;
    // keep shallow elements (leaf-ish)
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
    const nums = t.match(/\d+%?/g);
    out.push({
      text: t.slice(0, 60),
      nums: nums ? nums.slice(0, 4) : [],
      font: cs.fontFamily.split(',')[0].replace(/"/g, ''),
      size: cs.fontSize, weight: cs.fontWeight,
      fg: cs.color, bg,
      contrast: (() => { try { return CONTRAST(cs.color, bg); } catch { return 'n/a'; } })(),
    });
  }
  return out.slice(0, 16);
};

async function clickStatsTab(page, labels) {
  for (const label of labels) {
    const btn = page.locator('text=/^\\s*' + label + '\\s*$/i').first();
    try {
      await btn.click({ timeout: 2500 });
      console.log('  clicked tab:', label);
      return true;
    } catch { /* continue */ }
  }
  return false;
}

async function crawlSofascore(browser) {
  const page = await browser.newPage();
  await page.goto('https://www.sofascore.com/football/live', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const links = await page.$$('a[href*="/match/"]');
  console.log('sofascore links:', links.length);
  if (!links.length) return [];
  let href = await links[0].getAttribute('href');
  if (!href.startsWith('http')) href = 'https://www.sofascore.com' + href;
  await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(5000);
  await clickStatsTab(page, ['Stats', 'Statistiques', 'Statistics']);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, 'sofascore-stats.png') });
  const rows = await page.evaluate(EXTRACT);
  console.log('=== SOFASCORE ===');
  rows.forEach((r) => console.log('  ' + r.text + ' | ' + r.font + ' ' + r.size + ' w' + r.weight + ' fg=' + r.fg + ' bg=' + r.bg + ' c=' + r.contrast));
  await page.close();
  return rows;
}

async function crawlFotmob(browser) {
  const page = await browser.newPage();
  await page.goto('https://www.fotmob.com/matches', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const links = await page.$$('a[href*="/matches/"]');
  console.log('fotmob links:', links.length);
  if (!links.length) return [];
  const href = await links[0].getAttribute('href');
  await page.goto('https://www.fotmob.com' + href, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(5000);
  await clickStatsTab(page, ['Stats', 'Match Stats']);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, 'fotmob-stats.png') });
  const rows = await page.evaluate(EXTRACT);
  console.log('=== FOTMOB ===');
  rows.forEach((r) => console.log('  ' + r.text + ' | ' + r.font + ' ' + r.size + ' w' + r.weight + ' fg=' + r.fg + ' bg=' + r.bg + ' c=' + r.contrast));
  await page.close();
  return rows;
}

async function crawlFlashscore(browser) {
  const page = await browser.newPage();
  await page.goto('https://www.flashscore.fr/football/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const live = await page.$$('.event__match--live');
  console.log('flashscore live:', live.length);
  if (!live.length) return [];
  await live[0].click().catch(() => {});
  await page.waitForTimeout(4500);
  await clickStatsTab(page, ['Statistiques', 'Stats']);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, 'flashscore-stats.png') });
  const rows = await page.evaluate(EXTRACT);
  console.log('=== FLASHSCORE ===');
  rows.forEach((r) => console.log('  ' + r.text + ' | ' + r.font + ' ' + r.size + ' w' + r.weight + ' fg=' + r.fg + ' bg=' + r.bg + ' c=' + r.contrast));
  await page.close();
  return rows;
}

async function crawlWhoScored(browser) {
  const page = await browser.newPage();
  await page.goto('https://www.whoscored.com/livefeed', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(6000);
  const links = await page.$$('a[href*="/live/"]');
  console.log('whoscored links:', links.length);
  if (links.length) {
    await links[0].click().catch(() => {});
    await page.waitForTimeout(5000);
  }
  await page.screenshot({ path: path.join(OUT, 'whoscored-stats.png') });
  const rows = await page.evaluate(EXTRACT);
  console.log('=== WHOSCORED ===');
  rows.forEach((r) => console.log('  ' + r.text + ' | ' + r.font + ' ' + r.size + ' w' + r.weight + ' fg=' + r.fg + ' bg=' + r.bg + ' c=' + r.contrast));
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
  fs.writeFileSync(path.join(OUT, 'summary2.json'), JSON.stringify(results, null, 1));
  await browser.close();
})();