// scripts/qa-compare-sites2.js - deep structural analysis: layout regions, density, typography scale
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const OUT = path.join(__dirname, '..', '.context', 'design-compare');

const SITES = [
  { name: 'sofascore', url: 'https://www.sofascore.com/' },
  { name: 'fotmob', url: 'https://www.fotmob.com/' },
  { name: 'flashscore', url: 'https://www.flashscore.com/football/' },
  { name: 'forebet', url: 'https://www.forebet.com/en/football-predictions' },
  { name: 'whoscored', url: 'https://www.whoscored.com/' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });

  for (const site of SITES) {
    const dir = path.join(OUT, site.name);
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'fr-FR',
    });
    const page = await ctx.newPage();
    const report = { site: site.name, ok: true, note: '' };
    try {
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await page.waitForTimeout(2500);
      // dismiss consent banners if present
      for (const sel of ['button[id*="accept"]', 'button[class*="accept"]', '[class*="consent"] button', '[class*="cookie"] button', 'button:has-text("Accept")', 'button:has-text("Tout accepter")', 'button:has-text("Accepter")', '#onetrust-accept-btn-handler', '[class*="fc-button"]']) {
        const b = page.locator(sel).first();
        if (await b.count() && await b.isVisible().catch(() => false)) {
          await b.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(1200);
          break;
        }
      }
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(dir, 'desktop-clean.png') });

      // scroll capture: check sticky/fixed elements
      const sticky = await page.evaluate(() => {
        const all = [];
        document.querySelectorAll('header, nav, [class*="sticky"], [class*="fixed"], [class*="bottom-nav"], [class*="header"]').forEach(el => {
          const cs = getComputedStyle(el);
          if (cs.position === 'sticky' || cs.position === 'fixed') {
            const r = el.getBoundingClientRect();
            all.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 80), pos: cs.position, top: Math.round(r.top), h: Math.round(r.height), bg: cs.backgroundColor });
          }
        });
        return all.slice(0, 8);
      });

      // structure: sections + their backgrounds + heights
      const structure = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('main > *, body > *').forEach((el, i) => {
          if (i > 40) return;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (r.height < 8 || r.width < 100) return;
          const bg = cs.backgroundColor;
          if (bg === 'rgba(0, 0, 0, 0)' && !el.querySelector('[class*="card"], table')) return;
          out.push({
            tag: el.tagName, cls: (el.className || '').toString().slice(0, 60),
            h: Math.round(r.height), bg,
            radius: cs.borderRadius,
            hasTable: !!el.querySelector('table'),
            cardCount: el.querySelectorAll('[class*="card"]').length,
            linkCount: el.querySelectorAll('a').length,
          });
        });
        return out;
      });

      // typography scale
      const typeScale = await page.evaluate(() => {
        const sizes = new Map();
        document.querySelectorAll('body *').forEach(el => {
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs > 0 && fs < 60) {
            const k = Math.round(fs * 2) / 2;
            sizes.set(k, (sizes.get(k) || 0) + 1);
          }
        });
        return [...sizes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, n]) => s + 'px x' + n);
      });

      // color accents used (link colors, buttons)
      const accents = await page.evaluate(() => {
        const colors = new Map();
        document.querySelectorAll('a, button, [class*="badge"], [class*="score"], [class*="live"]').forEach(el => {
          const c = getComputedStyle(el).color;
          const k = c.replace(/\s/g, '');
          colors.set(k, (colors.get(k) || 0) + 1);
        });
        return [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      });

      // spacing density: average gap between rows in a match list if any
      const rowSpacing = await page.evaluate(() => {
        const rows = document.querySelectorAll('[class*="row"], table tbody tr, [class*="match"]');
        if (!rows.length) return null;
        let total = 0, n = 0;
        for (let i = 1; i < Math.min(rows.length, 12); i++) {
          const a = rows[i - 1].getBoundingClientRect(), b = rows[i].getBoundingClientRect();
          total += Math.abs(b.top - a.bottom); n++;
        }
        return Math.round(total / Math.max(n, 1)) + 'px';
      });

      report.sticky = sticky;
      report.structure = structure.slice(0, 10);
      report.typeScale = typeScale;
      report.accents = accents;
      report.rowSpacing = rowSpacing;
    } catch (e) {
      report.ok = false;
      report.note = e.message.slice(0, 150);
    }
    fs.writeFileSync(path.join(dir, 'structure.json'), JSON.stringify(report, null, 1));
    console.log(site.name, report.ok ? 'OK' : 'ERR ' + report.note.slice(0, 60));
    await ctx.close();
  }
  await browser.close();
})();