const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Add a log for modesTennis changes
  await page.evaluate(() => {
    // Watch store changes
    const orig = console.log;
    window.__storeLogs = [];
  });
  
  await page.locator('button:has-text("Top 10")').first().click();
  
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(2000);
    const hasTop10 = (await page.content()).includes('TOP 10');
    const relevantLogs = logs.filter(l => l.includes('TennisTabContent')).slice(-3);
    console.log(`[${(i+1)*2}s] TOP10=${hasTop10} logs:`, relevantLogs.join(' | '));
  }
  
  await browser.close();
})();
