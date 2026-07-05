import { test, expect } from "@playwright/test";
import { DetailDialogPage, MatchCardPage, waitForMatches } from "./page-objects";

/**
 * Match-detail dialog tests.
 *
 * Verifies the dialog opens via "Analyse complète", has 4 tabs (Vue d'ensemble
 * / H2H / Forme / Cotes), each tab renders its expected content, and Escape
 * closes the dialog.
 */

test.describe("Detail dialog — tabs + content", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForMatches(page, 3);
  });

  test("dialog opens with 4 tabs visible; default tab is Vue d'ensemble", async ({ page }) => {
    const card = MatchCardPage.nth(page, 0);
    const dialog = new DetailDialogPage(page);
    await dialog.open(card);

    // All 4 tabs exist
    await expect(dialog.tabOverview()).toBeVisible();
    await expect(dialog.tabH2H()).toBeVisible();
    await expect(dialog.tabForm()).toBeVisible();
    await expect(dialog.tabOdds()).toBeVisible();

    // Default selected tab is Vue d'ensemble (aria-selected=true)
    await expect(dialog.tabOverview()).toHaveAttribute("aria-selected", "true");
    await expect(dialog.tabH2H()).toHaveAttribute("aria-selected", "false");
  });

  test("Vue d'ensemble tab shows 4 stat cards + probability bars + IC visualization", async ({
    page,
  }) => {
    const card = MatchCardPage.nth(page, 0);
    const dialog = new DetailDialogPage(page);
    await dialog.open(card);

    // 4 DetailStat cards in the overview tab. They have uppercase labels:
    // Modèle / Probabilité centrale / Écart Elo / Confiance.
    const tab = page.getByRole("tabpanel");
    await expect(tab).toBeVisible();

    await expect(tab.getByText("Modèle", { exact: true })).toBeVisible();
    await expect(tab.getByText("Probabilité centrale", { exact: true })).toBeVisible();
    await expect(tab.getByText("Écart Elo", { exact: true })).toBeVisible();
    await expect(tab.getByText("Confiance", { exact: true })).toBeVisible();

    // IC visualization title: "Intervalle de confiance 95% — SABALENKA"
    await expect(tab.getByText(/Intervalle de confiance 95%/)).toBeVisible();

    // Probability bars are visible (one per player). Look for "Probabilité"
    // label which is the small caption above each bar.
    await expect(tab.getByText("Probabilité", { exact: true }).first()).toBeVisible();
  });

  test("H2H tab shows summary (5-2), chart, and history table", async ({ page }) => {
    const card = MatchCardPage.nth(page, 0); // Sabalenka vs Osaka, H2H 5-2
    const dialog = new DetailDialogPage(page);
    await dialog.open(card);
    await dialog.switchToH2H();

    // H2H summary cards: SABALENKA 5 | H2H direct | OSAKA 2
    const tab = page.getByRole("tabpanel");
    await expect(tab).toBeVisible();
    await expect(tab.getByText("H2H direct", { exact: true })).toBeVisible();

    // The summary numbers (5 + 2) are in `<div class="text-2xl font-bold">`
    // elements. Recharts axis labels also render numbers as `<tspan>` so we
    // must scope to the summary cards specifically.
    const summaryCards = tab.locator("div.grid.grid-cols-3 > div");
    await expect(summaryCards).toHaveCount(3);
    const numA = await summaryCards.nth(0).locator("div.text-2xl").textContent();
    const numB = await summaryCards.nth(2).locator("div.text-2xl").textContent();
    expect(numA?.trim()).toBe("5");
    expect(numB?.trim()).toBe("2");

    // H2H by surface chart (Recharts renders .recharts-wrapper)
    await expect(tab.getByText("H2H par surface", { exact: true })).toBeVisible();
    await expect(tab.locator(".recharts-wrapper").first()).toBeVisible();

    // History table heading + at least one row
    await expect(tab.getByText("Historique des confrontations", { exact: true })).toBeVisible();
    // Each history row contains a score like "6-0, 6-3"
    await expect(tab.getByText(/6-\d/).first()).toBeVisible();
  });

  test("Forme tab shows 2 charts (form bars + Elo line)", async ({ page }) => {
    const card = MatchCardPage.nth(page, 0);
    const dialog = new DetailDialogPage(page);
    await dialog.open(card);
    await dialog.switchToForm();

    const tab = page.getByRole("tabpanel");
    await expect(tab).toBeVisible();

    // Form chart title
    await expect(tab.getByText("Forme récente (6 derniers matchs)", { exact: true })).toBeVisible();
    // Elo progression chart title
    await expect(tab.getByText("Progression Elo (12 derniers mois)", { exact: true })).toBeVisible();

    // Two distinct Recharts charts — `.recharts-wrapper` is one per chart
    // (whereas `.recharts-surface` may render multiple SVGs per chart for
    // tooltip interactions, leading to inflated counts).
    const wrappers = tab.locator(".recharts-wrapper");
    await expect(wrappers).toHaveCount(2);
  });

  test("Cotes tab shows odds comparator with 5 bookmakers", async ({ page }) => {
    const card = MatchCardPage.nth(page, 0); // Sabalenka vs Osaka
    const dialog = new DetailDialogPage(page);
    await dialog.open(card);
    await dialog.switchToOdds();

    const tab = page.getByRole("tabpanel");
    await expect(tab).toBeVisible();

    // The table has a "Bookmaker" header
    await expect(tab.getByText("Bookmaker", { exact: true }).first()).toBeVisible();

    // 5 bookmaker rows: Bet365, Bwin, Unibet, Winamax, PMU
    for (const bm of ["Bet365", "Bwin", "Unibet", "Winamax", "PMU"]) {
      await expect(tab.getByText(bm, { exact: true }).first()).toBeVisible();
    }

    // 5 table rows in the odds table
    const rows = tab.locator("table tbody tr");
    await expect(rows).toHaveCount(5);
  });

  test("Escape closes the dialog", async ({ page }) => {
    const card = MatchCardPage.nth(page, 0);
    const dialog = new DetailDialogPage(page);
    await dialog.open(card);

    await expect(dialog.dialog()).toBeVisible();
    await dialog.close();
    await expect(dialog.dialog()).toHaveCount(0);
  });

  test("dialog tabs are keyboard-navigable (Arrow Right moves to next tab)", async ({
    page,
  }) => {
    const card = MatchCardPage.nth(page, 0);
    const dialog = new DetailDialogPage(page);
    await dialog.open(card);

    // Focus the active tab trigger
    await dialog.tabOverview().focus();
    await expect(dialog.tabOverview()).toBeFocused();

    // Radix Tabs supports ArrowRight to move to the next tab.
    await page.keyboard.press("ArrowRight");
    await expect(dialog.tabH2H()).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("ArrowRight");
    await expect(dialog.tabForm()).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("ArrowRight");
    await expect(dialog.tabOdds()).toHaveAttribute("aria-selected", "true");
  });
});
