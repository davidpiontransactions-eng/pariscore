// @ts-check
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const LEAGUE_URL = '/ligues/england/premier-league';
const OUT = path.join(__dirname, '..', 'qa-screenshots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  // 1. Full page load
  console.log('[1] Navigating to league page...');
  await page.goto(BASE + LEAGUE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, '01-full-page.png'), fullPage: true });
  console.log('[1] Screenshot: 01-full-page.png');

  // Check what tabs are visible
  const tabs = await page.$$eval('[role="tab"], button, a').then(els =>
    els.map(e => ({ text: e.textContent?.trim(), tag: e.tagName, href: e.getAttribute('href') }))
      .filter(e => e.text && /stat|standing|player|table|form|overview/i.test(e.text))
  );
  console.log('[1] Tabs found:', JSON.stringify(tabs));

  // Check stat category pills
  const pills = await page.$$eval('button, [role="tab"], span').then(els =>
    els.map(e => e.textContent?.trim())
      .filter(t => t && t.length < 30)
  );
  console.log('[1] All buttons/tabs text:', JSON.stringify(pills.slice(0, 30)));

  // 2. Try clicking "Player Stats" tab
  console.log('\n[2] Looking for Player Stats tab...');
  const playerTab = await page.$('button:has-text("Player"), a:has-text("Player"), [role="tab"]:has-text("Player")');
  if (playerTab) {
    await playerTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, '02-player-stats.png'), fullPage: true });
    console.log('[2] Clicked Player Stats — screenshot: 02-player-stats.png');
  } else {
    console.log('[2] No Player Stats tab found');
    // Try text-based search
    const allButtons = await page.$$eval('button, a, [role="tab"]', els =>
      els.map(e => ({ text: e.textContent?.trim().substring(0, 50), tag: e.tagName }))
    );
    console.log('[2] All clickable elements:', JSON.stringify(allButtons.filter(e => e.text)));
  }

  // 3. Click "Standing" tab
  console.log('\n[3] Looking for Standing tab...');
  const standingTab = await page.$('button:has-text("Standing"), a:has-text("Standing"), [role="tab"]:has-text("Standing")');
  if (standingTab) {
    await standingTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, '03-standings.png'), fullPage: true });
    console.log('[3] Clicked Standing — screenshot: 03-standings.png');
  } else {
    console.log('[3] No Standing tab found');
  }

  // 4. Mobile viewport (375px)
  console.log('\n[4] Testing mobile (375px)...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, '04-mobile-375.png'), fullPage: true });
  console.log('[4] Screenshot: 04-mobile-375.png');

  // Check overflow on mobile
  const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log('[4] Horizontal scroll overflow:', hasHScroll);

  // 5. Tablet viewport (768px)
  console.log('\n[5] Testing tablet (768px)...');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, '05-tablet-768.png'), fullPage: true });
  console.log('[5] Screenshot: 05-tablet-768.png');

  const hasHScrollTablet = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log('[5] Horizontal scroll overflow:', hasHScrollTablet);

  // 6. Console errors
  console.log('\n[6] Console errors:', consoleErrors.length ? JSON.stringify(consoleErrors) : 'None');

  // 7. DOM inspection for key elements
  console.log('\n[7] DOM inspection...');
  const stats = await page.evaluate(() => {
    return {
      statPills: document.querySelectorAll('[class*="pill"], [class*="badge"], [class*="chip"], [class*="category"]').length,
      formBadges: document.querySelectorAll('[class*="form"], [class*="Form"]').length,
      heatCells: document.querySelectorAll('[class*="heat"], [class*="Heat"]').length,
      tables: document.querySelectorAll('table').length,
      headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.textContent?.trim()).slice(0, 10),
      leagueTitle: document.querySelector('h1')?.textContent?.trim() || 'NO H1',
    };
  });
  console.log('[7] DOM stats:', JSON.stringify(stats, null, 2));

  await browser.close();
  console.log('\n=== QA AUDIT COMPLETE ===');
})();
