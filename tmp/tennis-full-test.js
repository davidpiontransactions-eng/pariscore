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
  
  // 1. Cards
  const cards = await page.locator('[data-tennis-player]').count();
  console.log('[1] Tennis cards:', cards);
  
  // 2. Player names
  if (cards > 0) {
    const names = await page.locator('[data-tennis-player] .truncate').allInnerTexts();
    console.log('[2] Players:', names.slice(0, 5));
    
    // 3. VALUE badges
    const valueBadges = await page.locator('[data-tennis-player] >> text=VALUE').count();
    console.log('[3] VALUE badges:', valueBadges);
    
    // 4. Click first card → modal
    await page.locator('[data-tennis-player]').first().click();
    await page.waitForTimeout(2000);
    
    const modal = await page.locator('.fixed.inset-0.z-50').count();
    console.log('[4] Modal open:', modal > 0 ? 'YES' : 'NO');
    
    if (modal > 0) {
      const radar = await page.locator('.fixed.inset-0.z-50 svg polygon').count();
      console.log('[5] Radar polygons:', radar);
      
      const momentum = await page.locator('.fixed.inset-0.z-50 >> text=MOMENTUM').count();
      console.log('[6] Momentum gauge:', momentum > 0 ? 'YES' : 'NO');
      
      const stats = await page.locator('.fixed.inset-0.z-50 >> text=Service points gagnes').count();
      console.log('[7] Stats:', stats > 0 ? 'YES' : 'NO');
      
      const form = await page.locator('.fixed.inset-0.z-50 >> text=Forme recente').count();
      console.log('[8] Form:', form > 0 ? 'YES' : 'NO');
      
      await page.screenshot({ path: '/tmp/tennis-modal-open.png', fullPage: false });
      console.log('[9] Modal screenshot saved');
    }
  } else {
    console.log('[2-9] SKIPPED (no cards)');
  }
  
  console.log('[10] Page errors:', errors.length, errors.length === 0 ? 'PASS' : 'WARN');
  if (errors.length > 0) console.log('  Errors:', JSON.stringify(errors.slice(0, 3)));
  
  await page.screenshot({ path: '/tmp/tennis-top10-view.png', fullPage: false });
  console.log('[11] View screenshot saved');
  
  console.log('\n=== DONE ===');
  await browser.close();
})();
