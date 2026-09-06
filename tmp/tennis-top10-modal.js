const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message.substring(0, 200)));
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Click Top 10 tab
  await page.locator('button:has-text("Top 10")').first().click();
  await page.waitForTimeout(8000);
  
  // Count cards
  const cards = await page.locator('.group.relative').count();
  console.log('[1] Player cards:', cards);
  
  // Check for VALUE badges
  const valueBadges = await page.locator('.text-emerald-400:has-text("VALUE")').count();
  console.log('[2] VALUE badges:', valueBadges);
  
  // Check for backtest mini
  const btMini = await page.locator('.text-zinc-500:has-text("WR")').count();
  console.log('[3] Backtest mini:', btMini);
  
  // Click first card to open modal
  if (cards > 0) {
    const firstCard = page.locator('.group.relative').first();
    await firstCard.click();
    await page.waitForTimeout(1500);
    
    // Check modal is open
    const modal = await page.locator('.fixed.inset-0.z-50').count();
    console.log('[4] Modal open:', modal > 0 ? 'YES' : 'NO');
    
    // Check radar chart
    const radar = await page.locator('svg polygon').count();
    console.log('[5] Radar SVG polygons:', radar);
    
    // Check stat rows
    const statRows = await page.locator('.text-xs.text-zinc-400:has-text("Service")').count();
    console.log('[6] Stat rows:', statRows > 0 ? 'YES' : 'NO');
    
    // Check momentum gauge
    const gauge = await page.locator('svg text:has-text("MOMENTUM")').count();
    console.log('[7] Momentum gauge:', gauge > 0 ? 'YES' : 'NO');
    
    // Screenshot modal
    await page.screenshot({ path: '/tmp/tennis-top10-modal.png', fullPage: false });
    console.log('[8] Modal screenshot saved');
    
    // Close modal
    const closeBtn = page.locator('.fixed.inset-0.z-50 button:has(svg)');
    if (await closeBtn.count() > 0) {
      await closeBtn.first().click();
      await page.waitForTimeout(500);
    }
  }
  
  console.log('[9] Page errors:', errors.length, errors.length === 0 ? 'PASS' : 'WARN');
  if (errors.length > 0) console.log('  Errors:', JSON.stringify(errors.slice(0, 3)));
  
  console.log('\n=== DONE ===');
  await browser.close();
})();
