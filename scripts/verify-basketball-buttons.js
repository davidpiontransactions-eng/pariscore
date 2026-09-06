const { chromium } = require('C:\\Users\\David\\ZCodeProject\\pariscore\\node_modules\\.bun\\playwright@1.61.1\\node_modules\\playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // Step 1: Navigate to basketball view
    console.log('Navigating to basketball view...');
    await page.goto('https://pariscore.fr/?sport=basketball', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Step 2: Wait for page to fully load
    console.log('Waiting for page to load...');
    await page.waitForTimeout(3000);

    // Step 3: Take screenshot of basketball view with Matchs/H2H/FIBA WC buttons
    console.log('Taking screenshot of basketball view...');
    await page.screenshot({
      path: 'scripts/screenshots/basketball-view-buttons.png',
      fullPage: false
    });
    console.log('Screenshot saved: basketball-view-buttons.png');

    // Step 4: Look for FIBA WC button and click it
    console.log('Looking for FIBA WC button...');
    
    // Try multiple selectors for the FIBA WC button
    const fibaSelectors = [
      'button:has-text("FIBA WC")',
      'text=FIBA WC',
      '[data-testid*="fiba"]',
      'button:has-text("FIBA")',
      '.toggle-button:has-text("FIBA")',
      'div:has-text("FIBA WC")'
    ];
    
    let fibaButton = null;
    for (const selector of fibaSelectors) {
      try {
        fibaButton = await page.$(selector);
        if (fibaButton) {
          console.log(`Found FIBA WC button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (fibaButton) {
      await fibaButton.click();
      console.log('Clicked FIBA WC button');
      await page.waitForTimeout(2000);
      
      // Step 5: Take screenshot of FIBA WC view with tabs
      console.log('Taking screenshot of FIBA WC view...');
      await page.screenshot({
        path: 'scripts/screenshots/fiba-wc-view-tabs.png',
        fullPage: false
      });
      console.log('Screenshot saved: fiba-wc-view-tabs.png');
    } else {
      console.log('FIBA WC button not found. Taking page screenshot for analysis...');
      await page.screenshot({
        path: 'scripts/screenshots/basketball-page-full.png',
        fullPage: true
      });
      
      // Log all visible buttons for debugging
      const buttons = await page.$$('button');
      console.log(`Found ${buttons.length} buttons on page:`);
      for (const btn of buttons.slice(0, 20)) {
        const text = await btn.textContent();
        if (text && text.trim()) {
          console.log(`  - "${text.trim()}"`);
        }
      }
    }

    // Get page title and URL for verification
    console.log(`Page title: ${await page.title()}`);
    console.log(`Page URL: ${page.url()}`);

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({
      path: 'scripts/screenshots/error-screenshot.png',
      fullPage: true
    });
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
