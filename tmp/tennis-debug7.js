const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Check which sub-tab buttons exist and their states
  const allBtns = await page.locator('button').all();
  for (let i = 0; i < allBtns.length; i++) {
    const text = await allBtns[i].innerText();
    if (text.includes('Top 10') || text.includes('Tournois') || text.includes('Liste') || text.includes('Live') || text.includes("Aujourd'hui")) {
      const isActive = await allBtns[i].getAttribute('data-state');
      console.log(`[btn ${i}] "${text.trim().replace(/\n/g, ' ')}" data-state=${isActive}`);
    }
  }
  
  // Click Top 10 with force and wait
  const top10btn = page.locator('button:has-text("Top 10")');
  console.log('\n[1] Clicking Top 10...');
  await top10btn.first().click({ force: true });
  await page.waitForTimeout(2000);
  
  // Check state after click
  const activeTabs2 = await page.locator('button[data-state="active"]').allInnerTexts();
  console.log('[2] Active tabs after click:', activeTabs2);
  
  // Check console for TennisTabContent logs
  page.on('console', msg => {
    if (msg.text().includes('TennisTabContent')) console.log('[console]', msg.text());
  });
  
  await page.waitForTimeout(5000);
  
  // Check for rankings content
  const top10 = await page.locator('text=/TOP 10/i').count();
  console.log('[3] TOP 10 elements:', top10);
  
  const maxW = await page.locator('.max-w-4xl').count();
  console.log('[4] max-w-4xl:', maxW);
  
  await page.screenshot({ path: '/tmp/tennis-tab-state.png', fullPage: false });
  console.log('[5] Screenshot saved');
  
  await browser.close();
})();
