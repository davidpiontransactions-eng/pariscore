// scripts/qa-debug-live-repro.js - reproduce live display issue on prod
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const OUT = path.join(__dirname, '..', '.context', 'debug-live');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 200)));

  await page.goto('https://pariscore.fr', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => errors.push('GOTO: ' + e.message.slice(0, 120)));
  await page.waitForTimeout(6000);

  // Find ALL tabs on the page
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent.trim().slice(0, 40)));
  console.log('TABS:', JSON.stringify(tabs));

  // Click Football tab
  try {
    await page.getByRole('tab', { name: /^football/i }).first().click({ timeout: 3000 });
    console.log('clicked Football');
  } catch { console.log('Football tab NOT FOUND — trying text click'); }
  await page.waitForTimeout(4000);

  // Enumerate sub-tabs now visible
  const subTabs = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent.trim().slice(0, 40)));
  console.log('SUB-TABS:', JSON.stringify(subTabs));

  // Click Live sub-tab explicitly
  for (const n of ['live', 'en direct']) {
    try { await page.getByRole('tab', { name: new RegExp(n, 'i') }).first().click({ timeout: 2000 }); console.log('clicked sub-tab:', n); break; }
    catch { console.log('sub-tab not found:', n); }
  }
  await page.waitForTimeout(6000);

  const state = await page.evaluate(() => {
    const body = document.body.textContent.replace(/\s+/g, ' ').trim();
    return {
      hasLiveSection: /EN DIRECT|EN DIRECT \(|live/i.test(body),
      liveSectionText: (body.match(/EN DIRECT[^A-Za-z]{0,40}/) || [''])[0],
      cardCount: document.querySelectorAll('article').length,
      errorOverlays: [...document.querySelectorAll('[role="alert"], .text-destructive')].map((e) => e.textContent.trim().slice(0, 100)),
    };
  });
  console.log('STATE:', JSON.stringify(state, null, 1));
  console.log('CONSOLE ERRORS:', JSON.stringify(errors.slice(0, 6), null, 1));

  await page.screenshot({ path: path.join(OUT, 'football-live.png') });
  await browser.close();
})();