// scripts/qa-tiny-sizes.js - find all elements with font-size < 11px on a page
const { chromium } = require('@playwright/test');

const BASE = process.env.QA_BASE_URL || 'https://pariscore.fr';

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/?v=tiny-' + Date.now(), { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const found = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    document.querySelectorAll('*').forEach(el => {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs > 0 && fs < 11) {
        const id = fs + '|' + el.tagName + '|' + (el.className || '').toString().slice(0, 90) + '|' + (el.textContent || '').trim().slice(0, 40);
        if (!seen.has(id)) {
          seen.add(id);
          out.push({ fs, tag: el.tagName, cls: (el.className || '').toString().slice(0, 110), txt: (el.textContent || '').trim().slice(0, 40), vis: !!el.offsetParent, inModal: !!el.closest('[role="dialog"], .fixed, [class*="modal"]') });
        }
      }
    });
    return out;
  });
  console.log(JSON.stringify(found, null, 1));
  await b.close();
})();