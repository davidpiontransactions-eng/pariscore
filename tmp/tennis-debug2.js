const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Click Top 10 tab
  await page.locator('button:has-text("Top 10")').first().click();
  await page.waitForTimeout(8000);
  
  // Check card click handler
  const cardHtml = await page.locator('.group.relative').first().innerHTML();
  console.log('[1] First card HTML snippet:', cardHtml.substring(0, 300));
  
  // Try clicking the card text directly
  const playerName = await page.locator('.group.relative .text-sm.font-semibold').first().innerText();
  console.log('[2] First player name:', playerName);
  
  // Click the player name directly
  await page.locator('.group.relative .text-sm.font-semibold').first().click();
  await page.waitForTimeout(1500);
  
  // Check modal
  const modal = await page.locator('.fixed.inset-0.z-50').count();
  console.log('[3] Modal open after click:', modal > 0 ? 'YES' : 'NO');
  
  // Check backtest data
  const btRes = await page.evaluate(async () => {
    const res = await fetch('/api/tennis/top5/backtest');
    const data = await res.json();
    return { strategies: Object.keys(data.strategies ?? {}), hasData: Object.keys(data.strategies ?? {}).length > 0 };
  });
  console.log('[4] Backtest data:', JSON.stringify(btRes));
  
  await browser.close();
})();
