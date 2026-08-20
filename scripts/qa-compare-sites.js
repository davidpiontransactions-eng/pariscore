// scripts/qa-compare-sites.js - comparative design analysis of 5 sports prediction/data sites
// Output: .context/design-compare/<site>/{desktop.png, mobile.png, tokens.json}
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const OUT = path.join(__dirname, '..', '.context', 'design-compare');

const SITES = [
  { name: 'sofascore', url: 'https://www.sofascore.com/', desc: 'Reference UX/data dark' },
  { name: 'fotmob', url: 'https://www.fotmob.com/', desc: 'Reference UI dark' },
  { name: 'flashscore', url: 'https://www.flashscore.com/football/', desc: 'Data massive light' },
  { name: 'forebet', url: 'https://www.forebet.com/en/football-predictions', desc: 'Predictions/probas' },
  { name: 'whoscored', url: 'https://www.whoscored.com/', desc: 'Stats analysis' },
];

function samplePixels(buf, w, h, bins) {
  // dominant colors by coarse binning (5 bits per channel)
  const counts = new Map();
  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 4) {
      const i = (y * w + x) * 4;
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, bins).map(([k, n]) => ({
    hex: '#' + (((k >> 10) & 31) << 3).toString(16).padStart(2, '0') +
      (((k >> 5) & 31) << 3).toString(16).padStart(2, '0') +
      ((k & 31) << 3).toString(16).padStart(2, '0'),
    share: +(n / (Math.ceil(w / 4) * Math.ceil(h / 4))).toFixed(3),
  }));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const site of SITES) {
    const dir = path.join(OUT, site.name);
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'fr-FR',
    });
    const page = await ctx.newPage();
    const tokens = { site: site.name, url: site.url, status: 'ok', time: 0, note: '' };
    try {
      const t0 = Date.now();
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await page.waitForTimeout(4000);
      tokens.time = Date.now() - t0;
      await page.screenshot({ path: path.join(dir, 'desktop.png') });

      // tokens from DOM
      tokens.dom = await page.evaluate(() => {
        const cs = (el) => el ? getComputedStyle(el) : null;
        const body = document.body;
        const bcs = cs(body);
        const firstCard = document.querySelector('[class*="card"], [class*="match"], [class*="event"], [class*="row"]') || body;
        const ccs = cs(firstCard);
        const nav = document.querySelector('header nav, nav, [class*="nav"]') || body;
        const ncs = cs(nav);
        const root = getComputedStyle(document.documentElement);
        const vars = {};
        ['--background', '--surface', '--card', '--primary', '--accent', '--text', '--muted', '--border', '--radius', '--font-family'].forEach(v => {
          const val = root.getPropertyValue(v).trim();
          if (val) vars[v] = val;
        });
        const fonts = new Set();
        document.querySelectorAll('body *').forEach(el => {
          const f = cs(el).fontFamily;
          fonts.add(f.split(',')[0].replace(/["']/g, ''));
        });
        return {
          bodyBg: bcs?.backgroundColor,
          bodyColor: bcs?.color,
          bodyFont: bcs?.fontFamily?.split(',')[0]?.replace(/["']/g, ''),
          bodyFontSize: bcs?.fontSize,
          cardBg: ccs?.backgroundColor,
          cardRadius: ccs?.borderRadius,
          cardShadow: ccs?.boxShadow,
          navBg: ncs?.backgroundColor,
          navPosition: ncs?.position,
          h1: document.querySelector('h1')?.textContent?.trim().slice(0, 60) || null,
          fonts: [...fonts].slice(0, 8),
          cssVars: vars,
          headerH: document.querySelector('header')?.offsetHeight || null,
          stickyNav: !!document.querySelector('header[class*="sticky"], [class*="sticky"] nav'),
          tabs: document.querySelectorAll('[role="tab"], [class*="tab"], nav a').length,
          tables: document.querySelectorAll('table').length,
          images: document.querySelectorAll('img').length,
          darkMode: bcs?.backgroundColor && /rgb\((\d+)/.test(bcs.backgroundColor) ? parseInt(bcs.backgroundColor.match(/rgb\((\d+)/)[1]) < 60 : null,
          iframes: document.querySelectorAll('iframe').length,
          overlays: document.querySelectorAll('[class*="overlay"], [class*="popup"], [class*="modal"], [class*="dialog"]').length,
          buttons: document.querySelectorAll('button, [role="button"]').length,
        };
      });

      // mobile shot
      const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await mp.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
      await mp.waitForTimeout(3000);
      await mp.screenshot({ path: path.join(dir, 'mobile.png'), fullPage: false });
      await mp.close();

      // dominant palette from screenshot
      const img = require('sharp');
      const { data, info } = await img(path.join(dir, 'desktop.png')).resize(720, 450).raw().toBuffer({ resolveWithObject: true });
      tokens.palette = samplePixels(data, info.width, info.height, 8);
    } catch (e) {
      tokens.status = 'error';
      tokens.note = e.message.slice(0, 200);
    }
    fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify(tokens, null, 1));
    console.log(site.name, '->', tokens.status, tokens.dom?.darkMode === null ? '' : (tokens.dom?.darkMode ? 'dark' : 'light'), tokens.time + 'ms');
    await ctx.close();
  }
  await browser.close();
  console.log('DONE -> ' + OUT);
})();