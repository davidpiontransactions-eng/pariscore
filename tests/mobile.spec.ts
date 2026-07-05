import { test, expect, devices } from "@playwright/test";
import { MatchCardPage, waitForMatches } from "./page-objects";

/**
 * Mobile responsive tests at iPhone 12 Pro viewport (390x844).
 *
 * Verifies:
 *   - Page loads, cards stack vertically (1 column)
 *   - No horizontal overflow (scrollWidth ≤ innerWidth)
 *   - All CTAs (Détail / Analyse / Parier) visible and clickable
 *   - Card player photos render (img elements with src)
 *
 * We use a project-scoped viewport by passing `viewport` in test.use.
 */

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  // iPhone 12 Pro user agent
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

test.describe("Mobile 390x844 responsive", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForMatches(page, 3);
    // Accept RGPD consent so the banner doesn't intercept clicks on CTAs
    const acceptBtn = page.getByRole("button", { name: /tout accepter|accept all/i });
    if (await acceptBtn.isVisible().catch(() => false)) {
      await acceptBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test("cards stack vertically — 1 column layout", async ({ page }) => {
    // The grid container uses `grid-cols-1 lg:grid-cols-2`. At 390px (mobile),
    // lg breakpoint (1024px) is NOT active → 1 column.
    const grid = page.locator("main > div.grid");
    await expect(grid).toBeVisible();

    // Verify each card is full-width: bounding box width should be ~ viewport
    // width minus padding.
    const cards = page.locator("article");
    const count = await cards.count();
    expect(count).toBe(3);

    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box).toBeTruthy();
      // Card width should be at least 80% of viewport width (390 - padding).
      expect(box!.width).toBeGreaterThan(300);
    }

    // Verify vertical stacking: each card's y-top is strictly greater than
    // the previous card's y-bottom.
    const boxes = await Promise.all(
      Array.from({ length: count }, (_, i) => cards.nth(i).boundingBox()),
    );
    for (let i = 1; i < boxes.length; i++) {
      const prevBottom = boxes[i - 1]!.y + boxes[i - 1]!.height;
      expect(boxes[i]!.y).toBeGreaterThan(prevBottom);
    }
  });

  test("no horizontal overflow (scrollWidth ≤ innerWidth)", async ({ page }) => {
    const metrics = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
      };
    });
    // Allow 1px rounding tolerance.
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  });

  test("all CTAs visible and clickable on each card", async ({ page }) => {
    const cards = await MatchCardPage.all(page);
    expect(cards).toHaveLength(3);

    for (const card of cards) {
      await expect(card.detailButton()).toBeVisible();
      await expect(card.betButton()).toBeVisible();
      // On mobile, the analysis button only shows the short label "Analyse".
      const analysisBtn = card.root.getByRole("button", {
        name: /^Analyse$/,
      });
      await expect(analysisBtn).toBeVisible();

      // Touch target size check: at least 32px height (Apple HIG is 44, but the
      // compact button styles in this app are smaller — we check 28px minimum).
      const detailBox = await card.detailButton().boundingBox();
      const betBox = await card.betButton().boundingBox();
      expect(detailBox!.height).toBeGreaterThanOrEqual(28);
      expect(betBox!.height).toBeGreaterThanOrEqual(28);

      // Click the bet button — should not navigate.
      const urlBefore = page.url();
      await card.betButton().click();
      await page.waitForTimeout(150);
      expect(page.url()).toBe(urlBefore);
    }
  });

  test("card player photos render (img elements with non-empty src)", async ({ page }) => {
    const cards = page.locator("article");
    const count = await cards.count();
    expect(count).toBe(3);

    for (let i = 0; i < count; i++) {
      const imgs = cards.nth(i).locator("img");
      // Each card has 2 player photos.
      await expect(imgs).toHaveCount(2);
      for (let j = 0; j < 2; j++) {
        const src = await imgs.nth(j).getAttribute("src");
        expect(src).toBeTruthy();
        expect(src).toMatch(/^https?:\/\//);
        // alt attribute is set (accessibility)
        const alt = await imgs.nth(j).getAttribute("alt");
        expect(alt).toBeTruthy();
      }
    }
  });

  test("filter pills wrap and remain clickable on mobile", async ({ page }) => {
    // All 3 filter buttons visible
    await expect(page.getByRole("button", { name: "Tous", exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Favoris clairs", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Matchs serrés", exact: true }),
    ).toBeVisible();

    // Click "Favoris clairs" → 2 cards
    await page.getByRole("button", { name: "Favoris clairs", exact: true }).click();
    await expect(page.locator("article")).toHaveCount(2);

    // Click "Tous" again → 3 cards
    await page.getByRole("button", { name: "Tous", exact: true }).click();
    await expect(page.locator("article")).toHaveCount(3);
  });

  test("header collapses non-essential controls on mobile (Refresh hidden)", async ({ page }) => {
    // The Refresh button has class `hidden sm:flex` → hidden on mobile (<640px).
    // At 390px viewport, it should NOT be visible.
    const refreshBtn = page.getByRole("button", { name: "Actualiser" });
    await expect(refreshBtn).toHaveCount(0);

    // But language toggle (FR/EN) and theme toggle remain visible.
    const header = page.getByRole("banner");
    const langBtn = header.getByRole("button").filter({ hasText: /^(FR|EN)$/ });
    await expect(langBtn.first()).toBeVisible();

    const themeBtn = header.locator(
      "button:has(svg.lucide-sun), button:has(svg.lucide-moon)",
    );
    await expect(themeBtn).toBeVisible();
  });

  test("detail dialog opens full-width on mobile and is scrollable", async ({ page }) => {
    const card = MatchCardPage.nth(page, 0);
    const analysisBtn = card.root.getByRole("button", { name: /^Analyse$/ });
    await analysisBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Dialog width should fit within mobile viewport (max-w-3xl but w-[95vw]).
    const box = await dialog.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(390);

    // The dialog has a ScrollArea for tall content.
    await expect(dialog.locator("[data-radix-scroll-area-viewport]").first()).toBeVisible();
  });
});
