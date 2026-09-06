const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Click Top 10
  await page.locator('button:has-text("Top 10")').first().click();
  await page.waitForTimeout(12000);
  
  // Count ALL mains
  const mains = await page.locator('main').count();
  console.log('[1] main elements:', mains);
  
  for (let i = 0; i < mains; i++) {
    const text = await page.locator('main').nth(i).innerText();
    console.log('[2] main[' + i + '] text (first 200):', text.substring(0, 200));
  }
  
  // Check all elements with max-w-4xl
  const maxW = await page.locator('.max-w-4xl').count();
  console.log('[3] max-w-4xl elements:', maxW);
  
  // Check for loading spinner in max-w-4xl
  if (maxW > 0) {
    const innerText = await page.locator('.max-w-4xl').first().innerText();
    console.log('[4] max-w-4xl content (first 300):', innerText.substring(0, 300));
  }
  
  // Check for any "TOP 10" or "Top 10" text anywhere
  const top10Elements = await page.locator('text=/TOP 10/i').count();
  console.log('[5] TOP 10 text elements:', top10Elements);
  
  // Check for "Aucune donnee"
  const emptyElements = await page.locator('text=Aucune donnee').count();
  console.log('[6] Aucune donnee elements:', emptyElements);
  
  // Check for loading spinner
  const spinners = await page.locator('.animate-spin').count();
  console.log('[7] Spinners:', spinners);
  
  await browser.close();
})();
