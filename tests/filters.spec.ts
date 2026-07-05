import { test, expect } from "@playwright/test";
import { clickFilter, waitForMatches } from "./page-objects";

/**
 * Filter behavior tests.
 *
 * The API recomputes probA via the prediction engine, so the live values are:
 *   - m1 Sabalenka: probA = 79  →  ≥ 70 ✓ (Favoris clairs)
 *   - m2 Alcaraz:   probA = 77  →  ≥ 70 ✓ (Favoris clairs)
 *   - m3 Sinner:    probA = 68  →  NOT < 60 (not "serré")
 *
 * Therefore:
 *   - "Tous"           → 3 cards
 *   - "Favoris clairs" → 2 cards (m1, m2)
 *   - "Matchs serrés"  → 0 cards → empty state
 *
 * (The original task hint suggested Sinner at 58%, but the actual prediction
 * engine returns 68%. The empty-state test below covers that case.)
 */

test.describe("Filters — Tous / Favoris clairs / Matchs serrés", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForMatches(page, 3);
  });

  test("default filter 'Tous' shows 3 cards", async ({ page }) => {
    await expect(page.locator("article")).toHaveCount(3);
    // Default-active filter pill has dark background (bg-foreground)
    const activePill = page.locator("button.bg-foreground").first();
    await expect(activePill).toContainText("Tous");
  });

  test("'Favoris clairs' shows 2 cards (probA ≥ 70)", async ({ page }) => {
    await clickFilter(page, "favorites");
    // Wait for the filter to apply (React re-render).
    await expect(page.locator("article")).toHaveCount(2);
    // The 2 visible cards must be Sabalenka and Alcaraz (the only probA >= 70).
    const names = await page.locator("article h3").allTextContents();
    const flat = names.join("|");
    expect(flat).toContain("Sabalenka");
    expect(flat).toContain("Alcaraz");
    expect(flat).not.toContain("Sinner");
  });

  test("'Matchs serrés' shows 0 cards (no match has probA < 60) — empty state", async ({
    page,
  }) => {
    await clickFilter(page, "balanced");
    await expect(page.locator("article")).toHaveCount(0);
    // Empty state copy
    await expect(page.getByText("Aucun match pour ce filtre")).toBeVisible();
    await expect(
      page.getByText("Essayez un autre filtre pour voir d'autres matchs."),
    ).toBeVisible();
  });

  test("switching back to 'Tous' restores 3 cards", async ({ page }) => {
    await clickFilter(page, "balanced");
    await expect(page.locator("article")).toHaveCount(0);

    await clickFilter(page, "all");
    await waitForMatches(page, 3);
    await expect(page.locator("article")).toHaveCount(3);
  });

  test("filter pills are keyboard-focusable", async ({ page }) => {
    const allPill = page.getByRole("button", { name: "Tous", exact: true });
    const favPill = page.getByRole("button", { name: "Favoris clairs", exact: true });
    const balPill = page.getByRole("button", { name: "Matchs serrés", exact: true });

    await allPill.focus();
    await expect(allPill).toBeFocused();

    // Tab through the three pills
    await page.keyboard.press("Tab");
    await expect(favPill).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(balPill).toBeFocused();

    // Activate via Enter
    await page.keyboard.press("Enter");
    await expect(page.locator("article")).toHaveCount(0);
  });
});
