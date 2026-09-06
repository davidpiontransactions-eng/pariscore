const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message.substring(0, 200)));
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Click Top 10
  await page.locator('button:has-text("Top 10")').first().click();
  await page.waitForTimeout(12000);
  
  // 1. Cards count
  const cards = await page.locator('[data-tennis-player]').count();
  console.log('[1] Cards:', cards);
  
  // 2. Next match rows in cards
  const matchRows = await page.locator('[data-tennis-player] >> text=vs').count();
  console.log('[2] Next match rows:', matchRows);
  
  // 3. Odds displayed
  const oddsElements = await page.locator('[data-tennis-player] >> text=/\\d+\\.\\d{2}/').count();
  console.log('[3] Odds displayed:', oddsElements);
  
  // 4. Player names with matches
  if (cards > 0) {
    const names = await page.locator('[data-tennis-player] .truncate').allInnerTexts();
    console.log('[4] Players:', names.slice(0, 5));
    
    // 5. Click first card → modal
    await page.locator('[data-tennis-player]').first().click();
    await page.waitForTimeout(2000);
    
    const modal = await page.locator('.fixed.inset-0.z-50').count();
    console.log('[5] Modal open:', modal > 0 ? 'YES' : 'NO');
    
    if (modal > 0) {
      // 6. Next match in modal
      const modalMatch = await page.locator('.fixed.inset-0.z-50 >> text=Prochain match').count();
      console.log('[6] Modal next match:', modalMatch > 0 ? 'YES' : 'NO');
      
      // 7. Opponent name in modal
      const opponent = await page.locator('.fixed.inset-0.z-50 >> text=vs').count();
      console.log('[7] Modal opponent:', opponent > 0 ? 'YES' : 'NO');
      
      // 8. Date/time in modal
      const dateInfo = await page.locator('.fixed.inset-0.z-50 >> text=/\\d{2}:\\d{2}/').count();
      console.log('[8] Modal date/time:', dateInfo > 0 ? 'YES' : 'NO');
      
      // 9. Odds in modal
      const modalOdds = await page.locator('.fixed.inset-0.z-50 >> text=/\\d+\\.\\d{2}/').count();
      console.log('[9] Modal odds:', modalOdds > 0 ? 'YES' : 'NO');
      
      // Screenshot modal
      await page.screenshot({ path: '/tmp/tennis-modal-match.png', fullPage: false });
      console.log('[10] Modal screenshot saved');
      
      // Close
      await page.locator('.fixed.inset-0.z-50 button').first().click();
      await page.waitForTimeout(500);
    }
  }
  
  console.log('[11] Page errors:', errors.length, errors.length === 0 ? 'PASS' : 'WARN');
  if (errors.length > 0) console.log('  Errors:', JSON.stringify(errors.slice(0, 3)));
  
  // Screenshot view
  await page.screenshot({ path: '/tmp/tennis-top10-matches.png', fullPage: false });
  console.log('[12] View screenshot saved');
  
  console.log('\n=== DONE ===');
  await browser.close();
})();
