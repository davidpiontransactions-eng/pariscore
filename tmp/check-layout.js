const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('https://pariscore.fr', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  const dims = await page.evaluate(() => {
    const sections = document.querySelectorAll('section[data-sport]');
    const grids = document.querySelectorAll('[class*="grid"]');
    const flexMain = document.querySelector('.flex.min-w-0.flex-1');
    const aside = document.querySelector('aside[aria-label]');
    const heroTile = document.querySelector('[class*="col-span-2"][class*="row-span-2"]');
    return {
      viewport: window.innerWidth,
      mainFlex: flexMain ? { w: flexMain.offsetWidth, rect: flexMain.getBoundingClientRect() } : null,
      aside: aside ? { w: aside.offsetWidth, display: getComputedStyle(aside).display } : null,
      heroTile: heroTile ? { w: heroTile.offsetWidth, h: heroTile.offsetHeight } : null,
      sections: Array.from(sections).map(s => ({
        w: s.offsetWidth,
        maxW: getComputedStyle(s).maxWidth,
        left: s.getBoundingClientRect().left,
      })),
    };
  });
  console.log(JSON.stringify(dims, null, 2));
  await browser.close();
})();
