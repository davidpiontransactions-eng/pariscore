const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('https://pariscore.fr/?sport=football', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);
  
  // Find ALL tabs with role="tab"
  const tabs = await page.locator('[role="tab"]').all();
  console.log('Total tabs found:', tabs.length);
  for (let i = 0; i < tabs.length; i++) {
    const text = await tabs[i].innerText();
    const ariaSelected = await tabs[i].getAttribute('aria-selected');
    console.log(`  Tab ${i}: "${text.trim()}" selected=${ariaSelected}`);
  }
  
  // Try clicking "Classements" using aria-label
  const classementsBtn = page.locator('[role="tab"][aria-label*="Classements"]');
  const clCount = await classementsBtn.count();
  console.log('\nClassements tabs via aria-label:', clCount);
  
  // Try via text content
  const classementsText = page.locator('button:has-text("Classements")');
  const ctCount = await classementsText.count();
  console.log('Classements buttons via text:', ctCount);
  
  if (ctCount > 0) {
    console.log('\nClicking Classements...');
    await classementsText.first().click();
    await page.waitForTimeout(8000);  // longer wait for API fetch
    
    const mainText = await page.locator('main').innerText();
    // Look for standings-related text
    const hasPSG = mainText.includes('Paris');
    const hasMonaco = mainText.includes('Monaco');
    const hasLigue1 = mainText.includes('Ligue 1') || mainText.includes('ligue1');
    const hasPts = mainText.includes('Pts');
    const has18equipes = mainText.includes('18');
    
    console.log('\nAfter click:');
    console.log('  Paris/PSG visible:', hasPSG);
    console.log('  Monaco visible:', hasMonaco);
    console.log('  Ligue 1 visible:', hasLigue1);
    console.log('  Pts column:', hasPts);
    console.log('  "18" text:', has18equipes);
    
    // Print first 500 chars of main text after click
    console.log('\n  Main text snippet:');
    console.log(mainText.substring(0, 500));
    
    await page.screenshot({ path: '/tmp/rankings-clicked.png', fullPage: false });
  }
  
  await browser.close();
})();
