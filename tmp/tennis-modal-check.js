const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.locator('button:has-text("Top 10")').first().click();
  await page.waitForTimeout(15000);
  
  // Click first card
  await page.locator('[data-tennis-player]').first().click();
  await page.waitForTimeout(2500);
  
  const modal = await page.locator('.fixed.inset-0.z-50');
  const text = await modal.first().innerText();
  
  // Check for match section
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  console.log('Modal text lines:');
  lines.forEach(l => console.log('  |', l.trim()));
  
  console.log('\nHas PROCHAIN MATCH:', text.includes('PROCHAIN MATCH'));
  console.log('Has vs:', text.includes('vs'));
  console.log('Has odds pattern:', /\d+\.\d{2}/.test(text));
  console.log('Has time:', /\d{1,2}:\d{2}/.test(text));
  
  await page.screenshot({ path: '/tmp/tennis-modal-check.png', fullPage: false });
  
  await browser.close();
})();
