const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://pariscore.fr/?sport=football', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.locator('button:has-text("Classements")').first().click();
  await page.waitForTimeout(8000);
  const sparklines = await page.locator('svg polyline').count();
  const zones = await page.locator('text=Europe').count();
  const dots = await page.locator('.text-\\[7px\\]').count();
  console.log('sparklines:', sparklines, 'zones:', zones, 'formDots:', dots);
  await page.screenshot({ path: '/tmp/rankings-p2.png', fullPage: false });
  await browser.close();
})();
