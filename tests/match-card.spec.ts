import { test, expect } from "@playwright/test";
import { MatchCardPage, waitForMatches } from "./page-objects";

/**
 * Match-card interaction tests.
 *
 * Verifies that each card renders the expected anatomy (2 player names, 2
 * probability rings, 6 stat chips, 3 CTAs) and that the inline accordion
 * ("Détail") expands/collapses correctly. Also checks that "Parier" is
 * clickable (analytics fire, no navigation) and that "Analyse complète"
 * opens the dialog.
 */

test.describe("Match card — anatomy + interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForMatches(page, 3);
  });

  test("each card has 2 player names, 2 probabilities, 6 stat chips, 3 CTAs", async ({
    page,
  }) => {
    const cards = await MatchCardPage.all(page);
    expect(cards).toHaveLength(3);

    for (const card of cards) {
      // Player names (h3 inside the card)
      const nameA = (await card.playerNameA()).trim();
      const nameB = (await card.playerNameB()).trim();
      expect(nameA.length).toBeGreaterThan(0);
      expect(nameB.length).toBeGreaterThan(0);

      // Two probability percentages (probA + probB).
      const probs = await card.probabilities();
      expect(probs).toHaveLength(2);
      for (const n of probs) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(100);
      }

      // 6 stat chips (Forme / Elo gap / Surface / H2H / IC 95% / Confiance)
      const chips = await card.statChips();
      expect(chips).toHaveLength(6);
      const labels = chips.map((c) => c.label);
      expect(labels).toEqual(
        expect.arrayContaining([
          "Forme",
          "Elo gap",
          "Surface",
          "H2H",
          "IC 95%",
          "Confiance",
        ]),
      );

      // 3 CTAs: Détail, Analyse complète (or short "Analyse"), Parier
      await expect(card.detailButton()).toBeVisible();
      await expect(card.betButton()).toBeVisible();
      // Analysis button: the accessible name is "Analyse complète" on desktop
      // and "Analyse" on mobile. The regex alternative covers both.
      const analysisBtn = card.root.getByRole("button", {
        name: /Analyse complète|^Analyse$/,
      });
      await expect(analysisBtn.first()).toBeVisible();
    }
  });

  test("first card has expected player names (Sabalenka / Osaka)", async ({ page }) => {
    const card = MatchCardPage.nth(page, 0);
    expect((await card.playerNameA()).trim()).toBe("Aryna Sabalenka");
    expect((await card.playerNameB()).trim()).toBe("Naomi Osaka");
  });

  test("clicking 'Détail' expands the accordion with 4 detail items + warning", async ({
    page,
  }) => {
    const card = MatchCardPage.nth(page, 0);
    await card.expandDetail();

    // The detail panel contains 4 DetailItem cards. Each DetailItem has an
    // uppercase label span ("Décomposition modèle" / "Intervalle de confiance
    // 95%" / "Écart Elo" / "Forme récente"). Scope to the detail panel.
    const detailPanel = page.locator("#match-m1-details");
    await expect(detailPanel).toBeVisible();
    const detailLabels = detailPanel.locator(
      "span.uppercase.tracking-\\[0\\.08em\\]",
    );
    await expect(detailLabels).toHaveCount(4);

    // Warning callout (amber) is visible
    await expect(card.root.getByText("Avertissement")).toBeVisible();

    // aria-expanded reflects the open state on the toggle button
    await expect(card.detailHideButton()).toHaveAttribute("aria-expanded", "true");
  });

  test("clicking 'Détail' again collapses the accordion", async ({ page }) => {
    const card = MatchCardPage.nth(page, 0);
    await card.expandDetail();
    await card.collapseDetail();

    // Detail panel hidden
    const details = page.locator("#match-m1-details");
    await expect(details).toHaveCount(0);
  });

  test("'Parier' button is clickable and does not navigate away", async ({ page }) => {
    const card = MatchCardPage.nth(page, 1);
    const betBtn = card.betButton();
    await expect(betBtn).toBeEnabled();

    const urlBefore = page.url();
    // Listen for any unexpected navigation. The Parier handler only fires an
    // analytics event — no router.push / href.
    await betBtn.click();
    await page.waitForTimeout(300);
    expect(page.url()).toBe(urlBefore);

    // The page is still on the same route — 3 cards still visible.
    await expect(page.locator("article")).toHaveCount(3);
  });

  test("clicking 'Analyse complète' opens the dialog", async ({ page }) => {
    const card = MatchCardPage.nth(page, 0);
    const analysisBtn = card.root.getByRole("button", {
      name: /Analyse complète|^Analyse$/,
    });
    await analysisBtn.first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Dialog title shows both player names
    await expect(dialog).toContainText("Sabalenka");
    await expect(dialog).toContainText("Osaka");
  });

  test("all three CTAs exist on every card", async ({ page }) => {
    const cards = await MatchCardPage.all(page);
    for (const card of cards) {
      await expect(card.detailButton()).toBeVisible();
      await expect(card.betButton()).toBeVisible();
      const analysisBtn = card.root.getByRole("button", {
        name: /Analyse complète|^Analyse$/,
      });
      await expect(analysisBtn.first()).toBeVisible();
    }
  });
});
