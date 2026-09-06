const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const logs = [];
  page.on('console', msg => {
    if (msg.text().includes('TennisTabContent')) {
      logs.push('[' + Math.round((Date.now() - startTime)) + 'ms] ' + msg.text());
    }
  });
  
  const startTime = Date.now();
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('=== After load ===');
  logs.forEach(l => console.log(l));
  
  logs.length = 0;
  await page.locator('button:has-text("Top 10")').first().click();
  
  // Poll every 2s for 20s
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(2000);
    const hasTop10 = (await page.content()).includes('TOP 10');
    const hasTop5 = (await page.content()).includes('TOP 5 MATCHS');
    const dataAttrs = ((await page.content()).match(/data-tennis-player/g) || []).length;
    console.log(`[${(i+1)*2}s] TOP10=${hasTop10} TOP5=${hasTop5} cards=${dataAttrs}`);
    if (logs.length > 0) {
      logs.forEach(l => console.log('  ', l));
      logs.length = 0;
    }
  }
  
  await browser.close();
})();
