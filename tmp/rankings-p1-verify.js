const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('https://pariscore.fr/?sport=football', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Click Classements
  await page.locator('button:has-text("Classements")').first().click();
  await page.waitForTimeout(8000);
  
  console.log('=== P1 UX Verification ===');
  
  // 1. Zone separators visible
  const zoneSep = await page.locator('text=Lutte au titre').count();
  const zoneEuropa = await page.locator('text=Europe').count();
  const zoneMid = await page.locator('text=Milieu de tableau').count();
  const zoneReleg = await page.locator('text=Relégation').count();
  console.log('[1] Zone "Lutte au titre":', zoneSep > 0 ? 'YES' : 'NO');
  console.log('[2] Zone "Europe":', zoneEuropa > 0 ? 'YES' : 'NO');
  console.log('[3] Zone "Milieu de tableau":', zoneMid > 0 ? 'YES' : 'NO');
  console.log('[4] Zone "Relégation":', zoneReleg > 0 ? 'YES' : 'NO');
  
  // 2. Points bars visible (check for the bar container)
  const pointsBars = await page.locator('.h-1\\.5.w-16').count();
  console.log('[5] Points bars found:', pointsBars, pointsBars > 0 ? 'PASS' : 'WARN');
  
  // 3. Form dots with text (CVD)
  const formDotText = await page.locator('.text-\\[7px\\]').count();
  console.log('[6] Form dot text labels:', formDotText, formDotText > 0 ? 'PASS' : 'WARN');
  
  // 4. Team names visible
  const psg = await page.locator('text=Paris Saint-Germain').count();
  const monaco = await page.locator('text=Monaco').count();
  console.log('[7] PSG visible:', psg > 0 ? 'YES' : 'NO');
  console.log('[8] Monaco visible:', monaco > 0 ? 'YES' : 'NO');
  
  // 5. Pts column with bar
  const ptsHeader = await page.locator('th:has-text("Pts")').count();
  console.log('[9] Pts column:', ptsHeader > 0 ? 'YES' : 'NO');
  
  // 6. Screenshot
  await page.screenshot({ path: '/tmp/rankings-p1.png', fullPage: false });
  console.log('[10] Screenshot saved');
  
  // 7. Page errors
  const errors = [];
  page.on('pageerror', err => errors.push(err.message.substring(0, 200)));
  await page.waitForTimeout(1000);
  console.log('[11] Page errors:', errors.length, errors.length === 0 ? 'PASS' : 'WARN');
  
  console.log('\n=== DONE ===');
  await browser.close();
})();
