// scripts/qa-find-tiny.js - locate sub-11px elements + football page state
const { chromium } = require('@playwright/test');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('https://pariscore.fr/?v=tiny', { waitUntil: 'networkidle', timeout: 60000 });
  const tiny = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('*').forEach(el => {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs > 0 && fs < 11 && el.textContent.trim()) {
        out.push({ fs, tag: el.tagName, cls: (el.className || '').toString().slice(0, 70), txt: el.textContent.trim().slice(0, 40) });
      }
    });
    return out.slice(0, 10);
  });
  console.log('TINY(' + tiny.length + '): ' + JSON.stringify(tiny, null, 1));

  await p.goto('https://pariscore.fr/football?v=tiny2', { waitUntil: 'networkidle', timeout: 60000 });
  const foot = await p.evaluate(() => ({
    h1: (document.querySelector('h1,h2') || {}).textContent?.trim().slice(0, 80),
    cards: document.querySelectorAll('[class*="card"], [class*="Card"]').length,
    hasLive: /live/i.test(document.body.innerText),
    bodyText: document.body.innerText.slice(0, 200),
  }));
  console.log('FOOT: ' + JSON.stringify(foot, null, 1));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });