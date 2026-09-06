const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Check which sub-tab we're on
  const subTabs = await page.locator('button[role="tab"]').allInnerTexts();
  console.log('[1] Sub-tabs:', subTabs);
  
  // Click Top 10
  const top10btn = page.locator('button:has-text("Top 10")');
  const count = await top10btn.count();
  console.log('[2] Top 10 button count:', count);
  
  if (count > 0) {
    await top10btn.first().click();
    await page.waitForTimeout(10000);
    
    // Check HTML for data-tennis-player
    const html = await page.content();
    const dataAttrs = (html.match(/data-tennis-player/g) || []).length;
    console.log('[3] data-tennis-player in HTML:', dataAttrs);
    
    // Check for any player card content
    const hasTop10 = html.includes('TOP 10');
    console.log('[4] Has TOP 10 header:', hasTop10);
    
    // Check for "Aucune donnee" or "Chargement"
    const hasEmpty = html.includes('Aucune donnee');
    const hasLoading = html.includes('Chargement');
    console.log('[5] Empty state:', hasEmpty, 'Loading:', hasLoading);
    
    // Screenshot
    await page.screenshot({ path: '/tmp/tennis-top10-debug.png', fullPage: false });
    console.log('[6] Screenshot saved');
    
    // Get visible text in main area
    const mainText = await page.locator('main').first().innerText().catch(() => 'error');
    console.log('[7] Main text (first 500):', mainText.substring(0, 500));
  }
  
  await browser.close();
})();
