import { test, expect, Page } from "@playwright/test";

/**
 * QA visuel — Filtres multi-choix desktop (legacy pariscore.html)
 *
 * Cible : legacy deployé via tunnel SSH `localhost:13300` (VPS :3000).
 * Objectif : valider que la sidebar desktop affiche bien les accordéons
 * multi-choix Championnats + Stratégies (relocalisés par `_psSbRelocateMls`).
 *
 * UA = desktop (pas de device mobile) → html.ps-desktop-v1.
 */

const BASE = "http://localhost:13300";

async function gotoMatchs(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    if (typeof w.showPage === "function") w.showPage("matchs");
  });
  await page.waitForTimeout(500);
}

async function ensureNoAuthModal(page: Page) {
  try {
    await page.waitForSelector("#auth-modal", { state: "visible", timeout: 8000 });
    await page.evaluate(() => {
      const w = window as any;
      if (typeof w.closeAuthModal === "function") w.closeAuthModal();
    });
  } catch {
    /* pas de modal — ok */
  }
  await page.waitForTimeout(300);
}

test.describe("Filtres multi-choix desktop — sidebar", () => {
  test("accordéons Championnats + Stratégies visibles dans la sidebar desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await gotoMatchs(page);
    await page.waitForSelector("#ps-foot-sidebar", { state: "visible", timeout: 15000 });
    await ensureNoAuthModal(page);

    // Le bloc multi-choix est dans la sidebar
    const mlsBlock = page.locator("#ps-sb-mls");
    await expect(mlsBlock).toBeVisible();

    // Championnats (ml-league) relocalisé dans #ps-sb-mls
    const mlLeague = page.locator("#ps-sb-mls #ml-league");
    await expect(mlLeague).toBeVisible();

    // Stratégies (ts-select) relocalisé dans #ps-sb-mls
    const tsSelect = page.locator("#ps-sb-mls #ts-select");
    await expect(tsSelect).toBeVisible();

    // La liste championnats est peuplée (pays)
    await page.waitForSelector("#ps-sb-mls #ml-list .mls-grp", { state: "attached", timeout: 15000 });
    const countries = await page.locator("#ps-sb-mls #ml-list .mls-grp").count();
    expect(countries).toBeGreaterThan(20);

    const leagues = await page.locator("#ps-sb-mls #ml-list .mls-league").count();
    expect(leagues).toBeGreaterThan(60);
  });

  test("multi-sélection championnats met à jour le label", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await gotoMatchs(page);
    await page.waitForSelector("#ps-sb-mls #ml-list .mls-league", { state: "attached", timeout: 15000 });
    await ensureNoAuthModal(page);

    const label = page.locator("#ps-sb-mls #ml-label");
    await expect(label).toHaveText(/Toutes les ligues/i);

    // le premier groupe pays est replié — cliquer le bouton expand (mls-exp)
    await page.locator("#ps-sb-mls #ml-list .mls-grp").first().locator(".mls-exp").click();
    await page.waitForTimeout(300);

    // cliquer deux ligues → label "2 sélections"
    const first = page.locator("#ps-sb-mls #ml-list .mls-league").nth(0);
    const second = page.locator("#ps-sb-mls #ml-list .mls-league").nth(1);
    await first.scrollIntoViewIfNeeded();
    await first.click();
    await second.scrollIntoViewIfNeeded();
    await second.click();
    await page.waitForTimeout(400);
    await expect(label).toContainText("2");
    await page.screenshot({ path: "test-results/desktop-mls-selection.png", fullPage: false });
  });

  test("multi-sélection stratégies met à jour le label", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await gotoMatchs(page);
    await page.waitForSelector("#ps-sb-mls #ts-select", { timeout: 15000 });
    await ensureNoAuthModal(page);

    // #ts-list est construit en lazy au 1er toggle
    const tsHeader = page.locator("#ps-sb-mls #ts-select .mls-acc-header");
    await tsHeader.click();
    await page.waitForSelector("#ps-sb-mls #ts-select #ts-list .mls-row", { timeout: 8000 });

    const rows = page.locator("#ps-sb-mls #ts-select #ts-list .mls-row");
    const n = await rows.count();
    expect(n).toBeGreaterThan(10);

    const label = page.locator("#ps-sb-mls #ts-label");
    const row = rows.nth(0);
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await page.waitForTimeout(400);
    await expect(label).not.toHaveText(/Toutes stratégies/i);
  });
});