const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Click Top 10
  await page.locator('button:has-text("Top 10")').first().click();
  await page.waitForTimeout(15000);
  
  // Get all HTML and search for tennis-related content
  const html = await page.content();
  
  // Count data-tennis-player
  const dataAttrs = (html.match(/data-tennis-player/g) || []).length;
  console.log('[1] data-tennis-player in HTML:', dataAttrs);
  
  // Check for网球 player names (Sinner, Alcaraz, Djokovic etc.)
  const hasSinner = html.includes('Sinner');
  const hasAlcaraz = html.includes('Alcaraz');
  console.log('[2] Has Sinner:', hasSinner, 'Has Alcaraz:', hasAlcaraz);
  
  // Check for "MAX-W-4XL" or "max-w-4xl"
  const hasMaxW = html.includes('max-w-4xl');
  console.log('[3] Has max-w-4xl:', hasMaxW);
  
  // Check for TOP 10 in any form
  const hasTop10 = html.includes('TOP 10');
  console.log('[4] Has TOP 10:', hasTop10);
  
  // Search for player-card class
  const hasCard = html.includes('group relative');
  console.log('[5] Has group relative:', hasCard);
  
  // Search for "Elo surface"
  const hasEloSurface = html.includes('Elo surface');
  console.log('[6] Has Elo surface:', hasEloSurface);
  
  // Get the text around max-w-4xl
  const idx = html.indexOf('max-w-4xl');
  if (idx >= 0) {
    console.log('[7] Context around max-w-4xl:', html.substring(Math.max(0, idx-100), idx+200).replace(/<[^>]+>/g, ' ').trim());
  }
  
  // Screenshot
  await page.screenshot({ path: '/tmp/tennis-debug-html.png', fullPage: false });
  console.log('[8] Screenshot saved');
  
  await browser.close();
})();
