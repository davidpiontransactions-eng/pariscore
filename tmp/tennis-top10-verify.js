const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message.substring(0, 200)));
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Click Rankings sub-tab
  const rankingsTab = page.locator('button:has-text("Top 10")');
  const tabCount = await rankingsTab.count();
  console.log('[1] Top 10 tab found:', tabCount > 0 ? 'YES' : 'NO');
  
  if (tabCount > 0) {
    await rankingsTab.first().click();
    await page.waitForTimeout(8000);
    
    // Check for player cards
    const cards = await page.locator('[class*="rounded-xl"][class*="border-white"]').count();
    console.log('[2] Player cards:', cards);
    
    // Check for player names
    const mainText = await page.locator('main').innerText();
    console.log('[3] Has player names:', mainText.length > 100 ? 'YES (' + mainText.length + ' chars)' : 'NO');
    
    // Check for momentum bars
    const momentumBars = await page.locator('[class*="h-1"][class*="w-12"]').count();
    console.log('[4] Momentum bars:', momentumBars);
    
    // Check for form bars
    const formBars = await page.locator('[class*="w-2"][class*="rounded-t-sm"]').count();
    console.log('[5] Form bars:', formBars);
    
    // Screenshot
    await page.screenshot({ path: '/tmp/tennis-top10.png', fullPage: false });
    console.log('[6] Screenshot saved');
    
    // Print some text
    console.log('[7] Text snippet:', mainText.substring(0, 300));
  }
  
  console.log('[8] Page errors:', errors.length, errors.length === 0 ? 'PASS' : 'WARN');
  if (errors.length > 0) console.log('  Errors:', JSON.stringify(errors.slice(0, 3)));
  
  await browser.close();
})();
