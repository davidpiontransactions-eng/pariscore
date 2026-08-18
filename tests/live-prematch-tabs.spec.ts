import { test, expect } from "@playwright/test";

/**
 * Séparation Live | Pre-match + filtre par heure de début (besoin 1xbet.com).
 *
 * Prérequis : dev server sur http://localhost:3000 (pas de webServer auto
 * dans playwright.config.ts — les specs s'exécutent contre le serveur local).
 *
 * Les données sont réelles (API live) : les assertions évitent donc tout
 * comptage exact de matchs et ciblent la structure ARIA déterministe :
 *   - tablist "Filtrer par statut de match" avec onglets Live / Pre-match
 *   - compteurs exposés via aria-label localisé (matchTabs.liveAria /
 *     matchTabs.prematchAria : "N matchs en direct" / "N live matches") et via
 *     un badge visuel aria-hidden (format "N" ou "99+" — pas de parenthèses)
 *   - filtre horaire "Heure de début" : chips Toutes/1h/2h/4h/6h/12h/24h
 *   - navigation clavier ArrowLeft/ArrowRight (roving tabindex)
 */

const LIVE_TABS_LIST = `[role="tablist"][aria-label="Filtrer par statut de match"]`;

async function openSportTab(page: import("@playwright/test").Page, name: string) {
  const tab = page.locator('nav[role="tablist"]').first().getByRole("tab", { name: new RegExp(name, "i") });
  await tab.click();
}

test.describe("Live | Pre-match — Football", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await openSportTab(page, "Football");
    await expect(page.locator(LIVE_TABS_LIST)).toBeVisible({ timeout: 30_000 });
  });

  test("affiche les sous-onglets Live et Pre-match avec compteurs", async ({ page }) => {
    const liveTab = page.locator(`${LIVE_TABS_LIST} [role="tab"]`).filter({ hasText: "Live" });
    const preTab = page.locator(`${LIVE_TABS_LIST} [role="tab"]`).filter({ hasText: "Pre-match" });

    await expect(liveTab).toBeVisible();
    await expect(preTab).toBeVisible();

    // Les compteurs sont portés par l'aria-label localisé (déterministe,
    // indépendant du nombre exact de matchs) et par un badge visuel aria-hidden.
    await expect(liveTab).toHaveAttribute(
      "aria-label",
      /\d+\s+(matchs en direct|live matches)/,
    );
    await expect(preTab).toHaveAttribute(
      "aria-label",
      /\d+\s+(matchs à venir|upcoming matches)/,
    );
    await expect(liveTab.locator("span[aria-hidden]")).toHaveText(/\d/);
    await expect(preTab.locator("span[aria-hidden]")).toHaveText(/\d/);
  });

  test("bascule Live → Pre-match et expose le filtre horaire", async ({ page }) => {
    const liveTab = page.locator(`${LIVE_TABS_LIST} [role="tab"]`).filter({ hasText: "Live" });
    const preTab = page.locator(`${LIVE_TABS_LIST} [role="tab"]`).filter({ hasText: "Pre-match" });

    await expect(liveTab).toHaveAttribute("aria-selected", "true");

    await preTab.click();
    await expect(preTab).toHaveAttribute("aria-selected", "true");
    await expect(liveTab).toHaveAttribute("aria-selected", "false");

    // Filtre horaire visible uniquement côté pre-match.
    const timeGroup = page.locator('[role="group"][aria-label="Heure de début"]');
    await expect(timeGroup).toBeVisible();
    for (const label of ["Toutes", "1h", "2h", "4h", "6h", "12h", "24h"]) {
      // exact: true — sinon "2h" matche aussi "12h" et "4h" matche "24h".
      await expect(timeGroup.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
  });

  test("filtre horaire 1h : activation aria-pressed + panneau re-rendu", async ({ page }) => {
    await page.locator(`${LIVE_TABS_LIST} [role="tab"]`).filter({ hasText: "Pre-match" }).click();

    const oneHour = page.locator('[role="group"][aria-label="Heure de début"]').getByRole("button", {
      name: "1h",
      exact: true,
    });
    await oneHour.click();
    await expect(oneHour).toHaveAttribute("aria-pressed", "true");

    const all = page.locator('[role="group"][aria-label="Heure de début"]').getByRole("button", {
      name: "Toutes",
      exact: true,
    });
    await expect(all).toHaveAttribute("aria-pressed", "false");

    // Le panneau pre-match est rendu (liste, état vide ou matchs — non déterministe).
    const panel = page.locator('[role="tabpanel"]').last();
    await expect(panel).toBeVisible();
  });

  test("navigation clavier : ArrowRight active Pre-match", async ({ page }) => {
    const liveTab = page.locator(`${LIVE_TABS_LIST} [role="tab"]`).filter({ hasText: "Live" });
    const preTab = page.locator(`${LIVE_TABS_LIST} [role="tab"]`).filter({ hasText: "Pre-match" });

    await liveTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(preTab).toHaveAttribute("aria-selected", "true");
    await expect(preTab).toBeFocused();

    await page.keyboard.press("ArrowLeft");
    await expect(liveTab).toHaveAttribute("aria-selected", "true");
    await expect(liveTab).toBeFocused();
  });
});

test.describe("Live | Pre-match — Tennis (TennisSubTabs existants + filtre horaire)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await openSportTab(page, "Tennis");
    // Sous-onglets tennis existants (Live / Aujourd'hui / Tournois / Liste).
    await expect(page.locator('[role="tablist"][aria-label="Sous-onglets tennis"]')).toBeVisible({
      timeout: 30_000,
    });
  });

  test("filtre par heure de début présent sur la vue « Aujourd'hui »", async ({ page }) => {
    const timeGroup = page.locator('[role="group"][aria-label="Heure de début"]');
    await expect(timeGroup).toBeVisible({ timeout: 15_000 });

    const twoHours = timeGroup.getByRole("button", { name: "2h", exact: true });
    await twoHours.click();
    await expect(twoHours).toHaveAttribute("aria-pressed", "true");
  });

  test("filtre horaire masqué sur l'onglet Live tennis", async ({ page }) => {
    const liveTab = page.locator('[role="tablist"][aria-label="Sous-onglets tennis"] [role="tab"]', {
      hasText: "Live",
    });
    await liveTab.click();
    await expect(page.locator('[role="group"][aria-label="Heure de début"]')).toHaveCount(0);
  });
});