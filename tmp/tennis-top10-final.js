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
  await page.waitForTimeout(10000);
  
  // Count player cards (the card div has specific classes)
  const cards = await page.locator('.group.relative').count();
  console.log('[1] Player cards:', cards);
  
  // Check for form bars (green/red)
  const formBars = await page.locator('.bg-emerald-500.rounded-t-sm, .bg-red-500.rounded-t-sm').count();
  console.log('[2] Form bars:', formBars);
  
  // Check for metric values
  const metricValues = await page.locator('.text-lg.font-bold').count();
  console.log('[3] Metric values:', metricValues);
  
  // Check for insight tags
  const insights = await page.locator('.text-\\[9px\\].font-medium').count();
  console.log('[4] Insight tags:', insights);
  
  // Screenshot
  await page.screenshot({ path: '/tmp/tennis-top10-final.png', fullPage: false });
  console.log('[5] Screenshot saved');
  
  // Page errors
  console.log('[6] Page errors:', errors.length, errors.length === 0 ? 'PASS' : 'WARN');
  if (errors.length > 0) console.log('  Errors:', JSON.stringify(errors.slice(0, 3)));
  
  console.log('\n=== DONE ===');
  await browser.close();
})();
