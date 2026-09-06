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
  await page.waitForTimeout(15000);
  
  // 1. Tennis cards
  const cards = await page.locator('[data-tennis-player]').count();
  console.log('[1] Tennis cards:', cards);
  
  // 2. VALUE badges
  const valueBadges = await page.locator('[data-tennis-player] >> text=VALUE').count();
  console.log('[2] VALUE badges:', valueBadges);
  
  // 3. Backtest mini
  const btMini = await page.locator('[data-tennis-player] >> text=WR').count();
  console.log('[3] Backtest mini:', btMini);
  
  // 4. Player names
  const playerNames = await page.locator('[data-tennis-player] .truncate').allInnerTexts();
  console.log('[4] Player names:', playerNames.slice(0, 5));
  
  // 5. Click first card → modal
  if (cards > 0) {
    await page.locator('[data-tennis-player]').first().click();
    await page.waitForTimeout(2000);
    
    const modal = await page.locator('.fixed.inset-0.z-50').count();
    console.log('[5] Modal open:', modal > 0 ? 'YES' : 'NO');
    
    if (modal > 0) {
      // Radar
      const radar = await page.locator('.fixed.inset-0.z-50 svg polygon').count();
      console.log('[6] Radar polygons:', radar);
      
      // Momentum gauge
      const momentum = await page.locator('.fixed.inset-0.z-50 >> text=MOMENTUM').count();
      console.log('[7] Momentum gauge:', momentum > 0 ? 'YES' : 'NO');
      
      // Stats
      const stats = await page.locator('.fixed.inset-0.z-50 >> text=Service points gagnes').count();
      console.log('[8] Stats:', stats > 0 ? 'YES' : 'NO');
      
      // Form
      const form = await page.locator('.fixed.inset-0.z-50 >> text=Forme recente').count();
      console.log('[9] Form section:', form > 0 ? 'YES' : 'NO');
      
      // Screenshot modal
      await page.screenshot({ path: '/tmp/tennis-modal-open.png', fullPage: false });
      console.log('[10] Modal screenshot saved');
    }
  }
  
  // Errors
  console.log('[11] Page errors:', errors.length, errors.length === 0 ? 'PASS' : 'WARN');
  if (errors.length > 0) console.log('  Errors:', JSON.stringify(errors.slice(0, 3)));
  
  // Screenshot main view
  await page.screenshot({ path: '/tmp/tennis-top10-final.png', fullPage: false });
  console.log('[12] View screenshot saved');
  
  console.log('\n=== DONE ===');
  await browser.close();
})();
