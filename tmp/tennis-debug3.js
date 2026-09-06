const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message.substring(0, 200)));
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  await page.locator('button:has-text("Top 10")').first().click();
  await page.waitForTimeout(8000);
  
  const cards = await page.locator('[data-tennis-player]').count();
  console.log('[1] Tennis cards:', cards);
  
  if (cards > 0) {
    const firstName = await page.locator('[data-tennis-player] .text-sm.font-semibold').first().innerText();
    console.log('[2] First player:', firstName);
    
    await page.locator('[data-tennis-player]').first().click();
    await page.waitForTimeout(1500);
    
    const modal = await page.locator('.fixed.inset-0.z-50').count();
    console.log('[3] Modal open:', modal > 0 ? 'YES' : 'NO');
    
    if (modal > 0) {
      const radar = await page.locator('.fixed.inset-0.z-50 svg polygon').count();
      console.log('[4] Radar polygons:', radar);
      
      const momentum = await page.locator('.fixed.inset-0.z-50 svg text:has-text("MOMENTUM")').count();
      console.log('[5] Momentum gauge:', momentum > 0 ? 'YES' : 'NO');
      
      const stats = await page.locator('.fixed.inset-0.z-50').locator('text=Service points gagnes').count();
      console.log('[6] Stats section:', stats > 0 ? 'YES' : 'NO');
      
      await page.screenshot({ path: '/tmp/tennis-modal-open.png', fullPage: false });
      console.log('[7] Modal screenshot saved');
      
      await page.locator('.fixed.inset-0.z-50 button').first().click();
      await page.waitForTimeout(500);
    }
  }
  
  const valueBadges = await page.locator('[data-tennis-player] >> text=VALUE').count();
  console.log('[8] VALUE badges:', valueBadges);
  
  const btMini = await page.locator('[data-tennis-player] >> text=WR').count();
  console.log('[9] Backtest mini:', btMini);
  
  console.log('[10] Page errors:', errors.length, errors.length === 0 ? 'PASS' : 'WARN');
  if (errors.length > 0) console.log('  Errors:', JSON.stringify(errors.slice(0, 3)));
  
  console.log('\n=== DONE ===');
  await browser.close();
})();
