import { test, expect, type Page } from "@playwright/test";

/**
 * QA — Football sidebar match selection → right panel.
 * Expected: clicking a football match in sidebar shows its card in the right panel.
 */

const SIDEBAR = 'aside[aria-label="Filtres sports"]';

async function expandTree(page: Page, label: string) {
  const sb = page.locator(SIDEBAR);
  const expand = sb.locator(`button[aria-label="Élargir ${label}"]`);
  const collapse = sb.locator(`button[aria-label="Réduire ${label}"]`);
  if ((await expand.count()) > 0 && (await expand.getAttribute("aria-expanded")) !== "true") {
    await expand.click();
  } else if ((await collapse.count()) === 0) {
    return false;
  }
  return true;
}

async function openFootballMatches(page: Page) {
  const sb = page.locator(SIDEBAR);
  await sb
    .locator('button[aria-label^="Élargir "], button[aria-label^="Réduire "]')
    .first()
    .waitFor({ state: "visible" });
  await expandTree(page, "Football");
  const footballItem = sb.locator(
    'li:has(button[aria-label="Élargir Football"], button[aria-label="Réduire Football"])',
  );
  const country = footballItem.locator('li > button[aria-label^="Élargir "]').first();
  if ((await country.count()) > 0) {
    await country.click();
    const league = footballItem
      .locator('li:has(button[aria-label^="Élargir "])')
      .first()
      .locator('button[aria-label^="Élargir "]')
      .first();
    if ((await league.count()) > 0) await league.click();
  }
}

function sidebarMatchButtons(page: Page) {
  return page.locator(`${SIDEBAR} button[aria-pressed]`).filter({ hasText: "–" });
}

test.describe("Football: Sélection sidebar → partie droite", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Switch to football tab using the store (more reliable than clicking UI)
    await page.evaluate(() => {
      // @ts-ignore: Ignore TypeScript errors for accessing store in test
      window.useSportsSidebarStore?.getState()?.selectSport("football");
    });
    // Wait for football tab to become active (look for the active tab indicator)
    await page.locator('button:has-text("Football")').filter({ hasClass: "ring-1 ring-white/20" }).first().waitFor({ state: "visible", timeout: 5000 });
    
    await openFootballMatches(page);
    await expect(sidebarMatchButtons(page).first()).toBeVisible({ timeout: 15000 });
    const n = await sidebarMatchButtons(page).count();
    console.log(`Found ${n} football match buttons in sidebar`);
    test.skip(n < 1, "aucun match football visible — données insuffisantes");
  });

  test("clic sur match foot → sélection sans popup, match affiché à droite", async ({ page }) => {
    const btns = sidebarMatchButtons(page);
    const firstName = (await btns.nth(0).textContent())?.trim() ?? "";
    console.log(`Selecting football match: ${firstName}`);
    expect(firstName.length).toBeGreaterThan(0);

    await btns.nth(0).click();
    await expect(btns.nth(0)).toHaveAttribute("aria-pressed", "true");

    // Pas de popup détail (dialog avec tabs = dialog match détail).
    const matchDialog = page.getByRole("dialog").filter({ has: page.getByRole("tab") });
    await expect(matchDialog).toHaveCount(0);

    // Bandeau de sélection dans la sidebar.
    await expect(page.locator(SIDEBAR).getByText(/1 match sélectionné/)).toBeVisible({ timeout: 5000 });

    // Attendre un peu pour permettre à React de mettre à jour le DOM
    await page.waitForTimeout(2000);

    // Vérifier le nombre d'éléments enfants dans le contenu principal
    const mainContent = page.locator("main, [role='main']").first();
    const childCount = await mainContent.locator("*").count();
    console.log(`Number of child elements in main content: ${childCount}`);
    
    // Vérifier la partie droite (contenu principal) : devrait contenir le match sélectionné
    // sous forme d'article (comme pour le tennis).
    const articles = page.locator("main article, [role='main'] article, article");
    const articleCount = await articles.count();
    console.log(`Articles in main content: ${articleCount}`);
    
    // Aussi vérifier le texte pour voir si on voit "Aucun match trouvé" ou similaire
    const mainText = await mainContent.textContent();
    console.log(`Main content text (first 200): ${mainText.substring(0, 200)}`);
    
    if (articleCount > 0) {
      const texts = await articles.allTextContents();
      const joined = texts.join(" ").replace(/\s+/g, " ");
      console.log(`Main content text (first 500): ${joined.substring(0, 500)}`);
      // Le match sélectionné est présent dans la partie droite.
      expect(joined).toContain(firstName.replace(/\s+/g, " "));
    } else if (childCount > 0) {
      // Il y a des éléments mais pas d'articles - les composants sont rendus mais pas en tant qu'articles
      console.log("BUG: Components are rendered but not as article elements");
      await page.screenshot({ path: 'test-results/football-selection-no-articles.png', fullPage: true });
      throw new Error("Football match selection renders components but not as article elements");
    } else if (mainText.includes("Aucun match trouvé") || mainText.includes("No matches found")) {
      // Aucun match trouvé - problème de données ou de filtrage
      console.log("BUG: No matches found - data or filtering issue");
      await page.screenshot({ path: 'test-results/football-selection-no-matches.png', fullPage: true });
      throw new Error("Football match selection results in no matches found");
    } else {
      // Vraiment rien dans le contenu principal
      console.log("BUG CONFIRMED: No articles and no content in main content for football selection");
      await page.screenshot({ path: 'test-results/football-selection-no-right-panel.png', fullPage: true });
      throw new Error("Football match selection doesn't show card in right panel - no articles found");
    }
  });

  test("multi-sélection foot → seuls les matchs choisis restent à droite", async ({ page }) => {
    const btns = sidebarMatchButtons(page);
    const n = await btns.count();
    test.skip(n < 2, "moins de 2 matchs foot visibles");
    
    const name0 = (await btns.nth(0).textContent())?.trim() ?? "";
    const name1 = (await btns.nth(1).textContent())?.trim() ?? "";

    await btns.nth(0).click();
    await btns.nth(1).click();
    await expect(btns.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(btns.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(SIDEBAR).getByText(/2 matchs sélectionnés/)).toBeVisible();

    const articles = page.locator("main article, [role='main'] article, article");
    if ((await articles.count()) > 0) {
      const joined = (await articles.allTextContents()).join(" ").replace(/\s+/g, " ");
      expect(joined).toContain(name0.replace(/\s+/g, " "));
      expect(joined).toContain(name1.replace(/\s+/g, " "));
    } else {
      console.log("BUG: No articles in main content for football multi-selection");
      throw new Error("Football multi-selection doesn't show cards in right panel");
    }
  });
});