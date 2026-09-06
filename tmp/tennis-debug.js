const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const consoleMsgs = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      consoleMsgs.push(`[${msg.type()}] ${msg.text().substring(0, 300)}`);
    }
  });
  page.on('pageerror', err => consoleMsgs.push(`[pageerror] ${err.message.substring(0, 300)}`));
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Check what tabs are available
  const tabTexts = await page.locator('button').allInnerTexts();
  console.log('All buttons:', tabTexts.filter(t => t.length > 0 && t.length < 30).join(' | '));
  
  // Check if "Top 10" button exists
  const top10Btn = await page.locator('button:has-text("Top 10")').count();
  console.log('Top 10 button count:', top10Btn);
  
  // Click if exists
  if (top10Btn > 0) {
    await page.locator('button:has-text("Top 10")').first().click();
    console.log('Clicked Top 10');
    await page.waitForTimeout(15000);
    
    // Check all data attributes
    const allDataAttrs = await page.evaluate(() => {
      const els = document.querySelectorAll('[data-tennis-player]');
      return Array.from(els).map(e => ({
        rank: e.getAttribute('data-tennis-player'),
        text: e.textContent?.substring(0, 100)
      }));
    });
    console.log('Tennis player elements:', JSON.stringify(allDataAttrs.slice(0, 3)));
    
    // Check for any visible cards
    const visibleCards = await page.locator('[class*="rounded-xl"]').count();
    console.log('Rounded-xl elements:', visibleCards);
    
    // Screenshot
    await page.screenshot({ path: '/tmp/tennis-debug.png', fullPage: true });
    console.log('Screenshot saved');
  }
  
  // Console errors
  if (consoleMsgs.length > 0) {
    console.log('\nConsole msgs:');
    consoleMsgs.forEach(m => console.log('  ', m));
  }
  
  await browser.close();
})();
