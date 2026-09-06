const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const logs = [];
  page.on('console', msg => {
    if (msg.text().includes('TennisTabContent')) {
      logs.push(msg.text());
    }
  });
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('Logs after load:', logs.join('\n'));
  
  // Click Top 10
  logs.length = 0;
  await page.locator('button:has-text("Top 10")').first().click();
  await page.waitForTimeout(5000);
  console.log('Logs after Top 10 click:', logs.join('\n'));
  
  // Check content
  const hasTop10 = (await page.content()).includes('TOP 10');
  const hasTop5 = (await page.content()).includes('TOP 5 MATCHS');
  console.log('Has TOP 10:', hasTop10, 'Has TOP 5:', hasTop5);
  
  await browser.close();
})();
