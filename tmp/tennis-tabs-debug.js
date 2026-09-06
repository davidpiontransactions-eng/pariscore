const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Find all sub-tab buttons
  const tabs = await page.locator('[role="tablist"] button, [class*="sub-tab"] button, nav button').all();
  console.log('Buttons found:', tabs.length);
  for (let i = 0; i < tabs.length; i++) {
    const text = await tabs[i].innerText();
    console.log('  Tab', i, ':', text.trim().substring(0, 50));
  }
  
  // Try to find by BarChart3 icon or "Top" text
  const topTab = page.locator('button:has-text("Top")');
  const topCount = await topTab.count();
  console.log('\nTop tabs:', topCount);
  
  // Try by aria-label
  const rankingsTab = page.locator('button[aria-label*="Top 10"]');
  console.log('Rankings aria-label:', await rankingsTab.count());
  
  await browser.close();
})();
