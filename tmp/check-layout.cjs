const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('https://pariscore.fr', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  const result = await page.evaluate(() => {
    const aside = document.querySelector('aside[aria-label]');
    const mainFlex = document.querySelector('.flex.min-w-0.flex-1');
    const heroSection = document.querySelector('section[data-sport]');
    const heroGrid = heroSection ? heroSection.querySelector('[class*="grid"]') : null;
    return {
      asideVisible: aside ? getComputedStyle(aside).display : 'not found',
      asideWidth: aside ? aside.offsetWidth : 0,
      mainFlexWidth: mainFlex ? mainFlex.offsetWidth : 0,
      heroSectionWidth: heroSection ? heroSection.offsetWidth : 0,
      heroSectionMaxW: heroSection ? getComputedStyle(heroSection).maxWidth : 'none',
      heroGridWidth: heroGrid ? heroGrid.offsetWidth : 0,
      viewportWidth: window.innerWidth,
    };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
