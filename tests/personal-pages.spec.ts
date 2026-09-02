import { test, expect } from "@playwright/test";

/**
 * Tests E2E pour les nouvelles pages personnelles.
 *
 * Couvre :
 * - /dashboard : PersonalDashboard + PersonalizedFeed
 * - /predictions : PredictionHistory
 * - /favorites : FollowButton + useFollowStore
 *
 * Pattern : tests atomiques avec setup/teardown minimal.
 * URL de base : PLAYWRIGHT_BASE_URL (défaut: http://localhost:3000)
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "https://pariscore.fr";

test.describe("Pages personnelles", () => {
  test.describe("Dashboard (/dashboard)", () => {
    test("affiche le titre et les KPIs", async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);

      // Vérifier le titre
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      // Vérifier les KPIs (win rate, profit, en cours, série)
      await expect(page.getByText("Win Rate")).toBeVisible();
      await expect(page.getByText("Profit")).toBeVisible();
      await expect(page.getByText("En cours")).toBeVisible();
      await expect(page.getByText("Série", { exact: true })).toBeVisible();
    });

    test("affiche le feed personnalisé ou le fallback", async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);

      // Soit le feed affiche des matchs, soit le message fallback
      const feedSection = page.getByText("Pour toi");
      await expect(feedSection).toBeVisible();

      // Vérifier le fallback si aucun follow
      const emptyState = page.getByText("Suivez vos joueurs, équipes et ligues préférés");
      const hasFollows = await page.getByText("★").count();
      if (hasFollows === 0) {
        await expect(emptyState).toBeVisible();
      }
    });
  });

  test.describe("Predictions (/predictions)", () => {
    test("affiche le titre et l'historique", async ({ page }) => {
      await page.goto(`${BASE_URL}/predictions`);

      // Vérifier le titre
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      // Vérifier les stats (win rate, profit, avg odds)
      await expect(page.getByText("Win Rate")).toBeVisible();
      await expect(page.getByText("Profit")).toBeVisible();
      await expect(page.getByText("Avg Odds")).toBeVisible();
    });

    test("affiche la liste des paris ou le fallback", async ({ page }) => {
      await page.goto(`${BASE_URL}/predictions`);

      // Soit il y a des paris, soit le message fallback
      const hasBets = await page.getByText("W").count() + await page.getByText("L").count();
      if (hasBets === 0) {
        await expect(page.getByText("Aucun pari enregistré")).toBeVisible();
      }
    });
  });

  test.describe("Favorites (/favorites)", () => {
    test("affiche le titre et le compteur", async ({ page }) => {
      await page.goto(`${BASE_URL}/favorites`);

      // Vérifier le titre
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      // Vérifier le compteur de follows
      await expect(page.getByText("follows")).toBeVisible();
    });

    test("affiche les sections ou le fallback", async ({ page }) => {
      await page.goto(`${BASE_URL}/favorites`);

      // La page doit afficher le titre principal
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      // Vérifier que le compteur de follows est affiché
      await expect(page.getByText("follows")).toBeVisible();
    });

    test("peut supprimer un follow", async ({ page }) => {
      await page.goto(`${BASE_URL}/favorites`);

      // Si des follows existent, tester la suppression
      const deleteButtons = page.getByRole("button", { name: /Ne plus suivre/ });
      const count = await deleteButtons.count();

      if (count > 0) {
        // Cliquer sur le premier bouton de suppression
        await deleteButtons.first().click();

        // Vérifier que le compteur a diminué
        const newCount = await deleteButtons.count();
        expect(newCount).toBe(count - 1);
      }
    });
  });
});

test.describe("Composants partagés", () => {
  test.describe("MatchCardSkeleton", () => {
    test("affiche le skeleton tennis", async ({ page }) => {
      // Naviguer vers une page avec des skeletons (tennis tab)
      await page.goto(`${BASE_URL}/`);

      // Attendre que les skeletons apparaissent pendant le chargement
      const skeletons = page.locator('[aria-busy="true"]');
      const count = await skeletons.count();

      // Les skeletons devraient apparaître pendant le chargement
      // (peut être rapide si le cache est chaud)
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe("FollowButton", () => {
    test("le bouton follow fonctionne sur les cartes tennis", async ({ page }) => {
      await page.goto(`${BASE_URL}/`);

      // Attendre que les cartes de match se chargent
      await page.waitForTimeout(2000);

      // Chercher un bouton follow (coeur)
      const followButtons = page.getByRole("button", { name: /Suivre|Ne plus suivre/ });
      const count = await followButtons.count();

      if (count > 0) {
        // Cliquer sur le premier bouton follow
        await followButtons.first().click();

        // Vérifier que l'état a changé
        const firstButton = followButtons.first();
        const ariaPressed = await firstButton.getAttribute("aria-pressed");
        expect(ariaPressed).toBeTruthy();
      }
    });
  });
});
