const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message.substring(0, 200)));
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // 1. Check sidebar — should NOT have Top 5 widget
  const sidebarText = await page.locator('aside, [class*="sidebar"], nav').first().innerText().catch(() => '');
  const hasTop5Sidebar = sidebarText.includes('Top 5') || sidebarText.includes('TOP 5');
  console.log('[1] Top 5 in sidebar:', hasTop5Sidebar ? 'YES (BAD)' : 'NO (GOOD)');
  
  // 2. Check sidebar has QuickLinks, MyTeams, Favorites (normal sidebar items)
  const hasQuickLinks = sidebarText.includes('QuickLinks') || sidebarText.includes('Liens');
  console.log('[2] Sidebar normal items present:', hasQuickLinks ? 'YES' : 'check manually');
  
  // 3. Click Top 10 tab in central area
  await page.locator('button:has-text("Top 10")').first().click();
  await page.waitForTimeout(12000);
  
  // 4. Central area should have Top 10 cards
  const cards = await page.locator('[data-tennis-player]').count();
  console.log('[3] Central Top 10 cards:', cards);
  
  // 5. Click first card → modal
  if (cards > 0) {
    await page.locator('[data-tennis-player]').first().click();
    await page.waitForTimeout(2000);
    const modal = await page.locator('.fixed.inset-0.z-50').count();
    console.log('[4] Modal opens:', modal > 0 ? 'YES' : 'NO');
    if (modal > 0) {
      await page.locator('.fixed.inset-0.z-50 button').first().click();
      await page.waitForTimeout(500);
    }
  }
  
  // 6. Click "Aujourd'hui" — should show match list, no Top 5
  await page.locator('button:has-text("Aujourd")').first().click();
  await page.waitForTimeout(5000);
  const todayCards = await page.locator('[data-match-id], [class*="match-card"]').count();
  console.log('[5] Today tab match cards:', todayCards);
  
  console.log('[6] Page errors:', errors.length, errors.length === 0 ? 'PASS' : 'WARN');
  if (errors.length > 0) console.log('  Errors:', JSON.stringify(errors.slice(0, 3)));
  
  await page.screenshot({ path: '/tmp/tennis-sidebar-fix.png', fullPage: false });
  console.log('[7] Screenshot saved');
  
  console.log('\n=== DONE ===');
  await browser.close();
})();
