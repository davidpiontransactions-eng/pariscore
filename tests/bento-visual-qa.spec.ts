import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://pariscore.fr";

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

test.describe("Bento Grid Visual QA", () => {
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    test(`homepage @ ${name} (${vp.width}×${vp.height})`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize(vp);
      await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(3000);

      await page.screenshot({
        path: `tests/qa-screenshots/homepage-${name}.png`,
        fullPage: true,
      });

      const bentoTiles = page.locator(".liquid-glass--clear");
      const count = await bentoTiles.count();
      console.log(`[${name}] Bento tiles with .liquid-glass--clear: ${count}`);

      const heroTile = page.locator('[class*="md:col-span-2"][class*="md:row-span-2"]');
      const heroCount = await heroTile.count();
      console.log(`[${name}] Hero tiles (2×2): ${heroCount}`);
    });
  }

  test("homepage - scroll reveal animations", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: "tests/qa-screenshots/homepage-before-scroll.png",
    });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: "tests/qa-screenshots/homepage-after-scroll.png",
      fullPage: true,
    });
  });

  test("tennis tab", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(3000);

    const tennisTab = page.locator('button:has-text("Tennis"), [data-sport="tennis"]').first();
    if (await tennisTab.isVisible()) {
      await tennisTab.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({
      path: "tests/qa-screenshots/tennis-tab.png",
      fullPage: true,
    });
  });

  test("football tab", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(3000);

    const footballTab = page.locator('button:has-text("Football"), [data-sport="football"]').first();
    if (await footballTab.isVisible()) {
      await footballTab.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({
      path: "tests/qa-screenshots/football-tab.png",
      fullPage: true,
    });
  });

  test("dashboard page", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: "tests/qa-screenshots/dashboard.png",
      fullPage: true,
    });
  });
});
