// scripts/qa-compare-live-stats.js - capture live-match stat sections from competitors, extract typography/color/contrast
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

const extract = () => {
  const els = [...document.querySelectorAll('*')].filter((el) => {
    const t = (el.textContent || '').trim();
    return /possession|possession %|tirs|shots|cadr|on target|corners|corner/i.test(t) && t.length < 60 && el.children.length < 4;
  }).slice(0, 8);
  return els.map((el) => {
    const cs = getComputedStyle(el);
    let bg = cs.backgroundColor;
    const parents = [];
    let p = el.parentElement;
    for (let i = 0; i < 5 && p; i++) {
      parents.push(getComputedStyle(p).backgroundColor);
      if (parents[parents.length - 1] !== 'rgba(0, 0, 0, 0)') break;
      p = p.parentElement;
    }
    const bgSolid = parents.find((c) => c !== 'rgba(0, 0, 0, 0)') || bg;
    const fg = cs.color;
    return {
      text: el.textContent.trim().slice(0, 40),
      font: cs.fontFamily.split(',')[0],
      size: cs.fontSize,
      weight: cs.fontWeight,
      fg, bg: bgSolid,
      contrast: (() => {
        try { return CONTRAST(fg, bgSolid); } catch { return 'n/a'; }
      })(),
    };
  });
};

async function runSite(name, url, opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', ...opts });
  const page = await ctx.newPage();
  const out = { site: name, url, rows: [] };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    const rows = await page.evaluate(extract);
    out.rows = rows;
    console.log('=== ' + name + ' (' + url + ') ===');
    rows.forEach((r) => console.log('  [' + r.font + ' ' + r.size + ' w' + r.weight + '] ' + r.text + ' | fg=' + r.fg + ' bg=' + r.bg + ' contrast=' + r.contrast));
  } catch (e) {
    console.log(name + ' ERR: ' + e.message.slice(0, 100));
  }
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(out, null, 1));
  await browser.close();
}

(async () => {
  await runSite('sofascore', 'https://www.sofascore.com/football/live');
  await runSite('fotmob', 'https://www.fotmob.com/matches');
  await runSite('flashscore', 'https://www.flashscore.fr/football/');
  await runSite('whoscored', 'https://www.whoscored.com/livefeed');
})();