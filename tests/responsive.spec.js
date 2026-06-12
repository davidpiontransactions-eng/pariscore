const { test, expect } = require('@playwright/test');

const VIEWPORTS = {
  mobile: { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 2, isMobile: false },
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
  desktopSmall: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false },
};

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000/pariscore.html';

test.describe('Responsive Design - Mobile/Desktop Segregation', () => {

  async function waitForViewportClass(page) {
    await page.waitForFunction(() => {
      return document.documentElement.classList.contains('ps-mobile-v2')
          || document.documentElement.classList.contains('ps-desktop-v1');
    }, { timeout: 5000 });
  }

  test('DESKTOP : bottom-nav mobile masquee, nav desktop visible', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(BASE_URL);
    await waitForViewportClass(page);

    await expect(page.locator('html')).toHaveClass(/ps-desktop-v1/);

    const bottomNav = page.locator('#bottom-nav');
    await expect(bottomNav).not.toBeVisible();

    await expect(page.locator('nav .nav-links')).toBeVisible();
    await expect(page.locator('#matches-table')).toBeVisible();
    await expect(page.locator('#vb-cards')).not.toBeVisible();
  });

  test('DESKTOP petit ecran (1280px) : ne bascule PAS en mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktopSmall);
    await page.goto(BASE_URL);
    await waitForViewportClass(page);

    await expect(page.locator('html')).toHaveClass(/ps-desktop-v1/);
    await expect(page.locator('#bottom-nav')).not.toBeVisible();
    await expect(page.locator('nav .nav-links')).toBeVisible();
  });

  test('MOBILE : bottom-nav visible, nav desktop masquee', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(BASE_URL);
    await waitForViewportClass(page);

    await expect(page.locator('html')).toHaveClass(/ps-mobile-v2/);

    const bottomNav = page.locator('#bottom-nav');
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.locator('.bn-ico')).toHaveCount(5);

    await expect(page.locator('nav .nav-links')).not.toBeVisible();
    await expect(page.locator('#mob-toolbar')).toBeVisible();
    await expect(page.locator('#matches-table')).not.toBeVisible();
    await expect(page.locator('#vb-cards')).toBeVisible();
  });

  test('TABLET (iPad) : comportement coherent', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto(BASE_URL);
    await waitForViewportClass(page);

    const htmlClass = await page.locator('html').getAttribute('class');
    const hasMobile = htmlClass.includes('ps-mobile-v2');
    const hasDesktop = htmlClass.includes('ps-desktop-v1');

    expect(hasMobile || hasDesktop).toBeTruthy();
    expect(hasMobile && hasDesktop).toBeFalsy();

    if (hasMobile) {
      await expect(page.locator('#bottom-nav')).toBeVisible();
    } else {
      await expect(page.locator('#bottom-nav')).not.toBeVisible();
    }
  });

  test('Viewport unique : pas de width=1280 scale=0.3', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(BASE_URL);

    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');

    expect(viewportMeta).not.toContain('width=1280');
    expect(viewportMeta).not.toContain('initial-scale=0.3');
    expect(viewportMeta).toContain('width=device-width');
  });

  test('Escape hatch : ?view=desktop force desktop sur mobile UA', async ({ page, browser }) => {
    const context = await browser.newContext({
      viewport: VIEWPORTS.mobile,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    });
    const p = await context.newPage();
    await p.goto(`${BASE_URL}?view=desktop`);
    await waitForViewportClass(p);

    await expect(p.locator('html')).toHaveClass(/ps-desktop-v1/);
    await expect(p.locator('#bottom-nav')).not.toBeVisible();

    await context.close();
  });
});
