import { test, expect } from "@playwright/test";

/**
 * Tennis tab — QA mobile (audit U4) : grille sans débordement horizontal
 * sur écrans < 360px et absence de l'erreur bloquante "Unable to fetch
 * matches" (audit B1) quel que soit l'état de la source de données.
 *
 * Prérequis : dev server sur http://localhost:3000 (pas de webServer auto
 * dans playwright.config.ts — les specs s'exécutent contre le serveur local).
 *
 * Les données sont réelles ou en repli (cache/mock selon la disponibilité des
 * sources) : les assertions ciblent donc la structure (pas de comptage de
 * matchs) — débordement, erreurs bloquantes, présence de la grille.
 */

test.setTimeout(90_000);

async function openTennisTab(page: import("@playwright/test").Page) {
  // Accept RGPD consent so the banner doesn't intercept clicks on the tabs.
  // Le banner apparaît de façon asynchrone (quelques secondes) : attente
  // explicite au lieu d'un check immédiat.
  const acceptBtn = page.getByRole("button", { name: /tout accepter|accept all/i });
  try {
    await expect(acceptBtn).toBeVisible({ timeout: 15_000 });
    await acceptBtn.click();
  } catch {
    // Banner déjà accepté ou absent — pas bloquant.
  }
  const tab = page.locator('nav[role="tablist"]').first().getByRole("tab", { name: /Tennis/i });
  await tab.click({ timeout: 20_000 });
  await page.waitForTimeout(4_000);
}

test.describe("Tennis — QA mobile < 360px (U4)", () => {
  test("pas de débordement horizontal ni d'erreur bloquante (320px)", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/");
    await openTennisTab(page);
    await page.waitForTimeout(6_000);

    // Bug B1 : l'erreur bloquante ne doit jamais apparaître (le repli
    // cache/mock de la route garantit un 200).
    await expect(page.locator("body")).not.toContainText("Unable to fetch matches");
    await expect(page.locator("body")).not.toContainText("Loading error");

    // U4 : pas de débordement horizontal sur < 360px.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);

    // La grille principale doit exister (zone d'affichage non vide).
    const main = page.locator("main").first();
    await expect(main).toBeVisible();
  });

  test("bandeau dégradé cohérent s'il est présent (320px)", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/");
    await openTennisTab(page);
    await page.waitForTimeout(6_000);

    // Si le bandeau "Mode dégradé" est affiché, il doit être visible sans
    // casser la mise en page (débordement).
    const banner = page.locator("text=/Mode dégradé/i");
    if (await banner.count()) {
      await expect(banner.first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(2);
    }
  });
});