const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Click Top 10
  await page.locator('button:has-text("Top 10")').first().click();
  await page.waitForTimeout(10000);
  
  // Check what's in the DOM now
  const body = await page.content();
  
  // Check for TOP 10 text
  const hasTop10Header = body.includes('TOP 10');
  console.log('[1] TOP 10 in body:', hasTop10Header);
  
  // Check for Aucune donnee
  const hasEmpty = body.includes('Aucune donnee');
  console.log('[2] Empty state:', hasEmpty);
  
  // Check for loading
  const hasLoading = body.includes('Chargement');
  console.log('[3] Loading:', hasLoading);
  
  // Check data-tennis-player  
  const dataAttrs = (body.match(/data-tennis-player/g) || []).length;
  console.log('[4] data-tennis-player attrs:', dataAttrs);
  
  // Check for Top 5 section (old content)
  const hasTop5 = body.includes('TOP 5 MATCHS TENNIS');
  console.log('[5] Still showing TOP 5:', hasTop5);
  
  // Check active sub-tab
  const activeTabs = await page.locator('[role="tab"][data-state="active"]').allInnerTexts();
  console.log('[6] Active tabs:', activeTabs);
  
  // Check aria-selected
  const selectedTabs = await page.locator('button[aria-selected="true"]').allInnerTexts();
  console.log('[7] aria-selected true:', selectedTabs);
  
  // Screenshot
  await page.screenshot({ path: '/tmp/tennis-tab-debug.png', fullPage: false });
  console.log('[8] Screenshot saved');
  
  await browser.close();
})();
