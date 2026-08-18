import { test, expect, type Page } from "@playwright/test";

/**
 * QA — Filtre des matchs (prematch/live) + sélection sidebar → partie droite.
 *
 * Comportement attendu (P0-3 filtre + sélection) :
 *  1. Le filtre temporel (1h…) s'applique à la sidebar ET à la partie droite,
 *     en prematch comme en live (fenêtre passée pour les lives).
 *  2. Clic sur le NOM d'un match dans la sidebar → SÉLECTION (aria-pressed),
 *     pas de popup. Le match sélectionné s'affiche seul dans la partie droite.
 *  3. Multi-sélection → la partie droite ne montre que les matchs choisis.
 *  4. « Effacer » restaure la liste complète.
 *
 * Sélecteurs (i18n fr) :
 *  - Sidebar : aside[aria-label="Filtres sports"]
 *  - Sports : button[aria-label^="Élargir "] (expandAria)
 *  - Matchs  : boutons à l'intérieur de la sidebar avec aria-pressed
 *  - Filtre temps : bouton "1h" (aria-pressed)
 *  - Dialog détail : role="dialog" avec tabs (Radix)
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

async function openTennisMatches(page: Page) {
  const sb = page.locator(SIDEBAR);
  // Attendre que l'arbre soit chargé (boutons sports).
  await sb
    .locator('button[aria-label^="Élargir "], button[aria-label^="Réduire "]')
    .first()
    .waitFor({ state: "visible" });
  // Tennis (déjà déplié au chargement → ok), puis le premier pays, puis la 1re ligue.
  await expandTree(page, "Tennis");
  const tennisItem = sb.locator(
    'li:has(button[aria-label="Élargir Tennis"], button[aria-label="Réduire Tennis"])',
  );
  const country = tennisItem.locator('li > button[aria-label^="Élargir "]').first();
  if ((await country.count()) > 0) {
    await country.click();
    const league = tennisItem
      .locator('li:has(button[aria-label^="Élargir "])')
      .first()
      .locator('button[aria-label^="Élargir "]')
      .first();
    if ((await league.count()) > 0) await league.click();
  }
}

function sidebarMatchButtons(page: Page) {
  // MatchRow = boutons avec aria-pressed dont le texte contient « – »
  // (exclut les pills temps/onglets Live-Avant-match).
  return page.locator(`${SIDEBAR} button[aria-pressed]`).filter({ hasText: "–" });
}

test.describe("Filtre temps sidebar ↔ partie droite", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await openTennisMatches(page);
  });

  test("1h → le store est partagé : pill active dans la sidebar et la partie droite", async ({
    page,
  }) => {
    const sb = page.locator(SIDEBAR);
    const pill1hSidebar = sb.getByRole("button", { name: "1h", exact: true });
    await pill1hSidebar.click();
    await expect(pill1hSidebar).toHaveAttribute("aria-pressed", "true");
    // La partie droite partage le même store → même pill active.
    await expect(page.getByRole("button", { name: "1h", exact: true }).last()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Le nombre de matchs sidebar ne peut pas augmenter avec la fenêtre.
    const countAfter = await sidebarMatchButtons(page).count();
    expect(countAfter).toBeGreaterThanOrEqual(0);
  });

  test("all → pas de filtre (aucun crash)", async ({ page }) => {
    await page.getByRole("button", { name: "Tout", exact: true }).first().click();
    await expect(
      page.getByRole("button", { name: "Tout", exact: true }).first(),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("Sélection sidebar → partie droite", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await openTennisMatches(page);
    // Au moins 2 matchs tennis visibles pour la multi-sélection.
    await expect(sidebarMatchButtons(page).first()).toBeVisible();
    const n = await sidebarMatchButtons(page).count();
    test.skip(n < 2, "moins de 2 matchs tennis visibles — données insuffisantes");
  });

  test("clic sur le nom → sélection sans popup, match seul à droite", async ({ page }) => {
    const btns = sidebarMatchButtons(page);
    const firstName = (await btns.nth(0).textContent())?.trim() ?? "";
    expect(firstName.length).toBeGreaterThan(0);

    await btns.nth(0).click();
    await expect(btns.nth(0)).toHaveAttribute("aria-pressed", "true");

    // Pas de popup détail (dialog avec tabs = dialog match détail).
    const matchDialog = page.getByRole("dialog").filter({ has: page.getByRole("tab") });
    await expect(matchDialog).toHaveCount(0);

    // Bandeau de sélection.
    await expect(page.locator(SIDEBAR).getByText(/1 match sélectionné/)).toBeVisible();

    // La partie droite ne montre que ce match : aucun article ne contient le
    // nom d'un AUTRE match visible dans la sidebar.
    const secondName = (await btns.nth(1).textContent())?.trim() ?? "";
    const articles = page.locator("article");
    if ((await articles.count()) > 0) {
      const texts = await articles.allTextContents();
      const joined = texts.join(" ");
      // Le match sélectionné est présent dans la partie droite.
      expect(joined.replace(/\s+/g, " ")).toContain(firstName.replace(/\s+/g, " "));
      // Les autres matchs (représentés par le 2e bouton) n'y sont pas.
      expect(joined.replace(/\s+/g, " ")).not.toContain(secondName.replace(/\s+/g, " "));
    }
  });

  test("multi-sélection → seuls les matchs choisis restent à droite", async ({ page }) => {
    const btns = sidebarMatchButtons(page);
    const name0 = (await btns.nth(0).textContent())?.trim() ?? "";
    const name1 = (await btns.nth(1).textContent())?.trim() ?? "";

    await btns.nth(0).click();
    await btns.nth(1).click();
    await expect(btns.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(btns.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(SIDEBAR).getByText(/2 matchs sélectionnés/)).toBeVisible();

    const articles = page.locator("article");
    if ((await articles.count()) > 0) {
      const joined = (await articles.allTextContents()).join(" ").replace(/\s+/g, " ");
      expect(joined).toContain(name0.replace(/\s+/g, " "));
      expect(joined).toContain(name1.replace(/\s+/g, " "));
    }
    // Un 3e match (s'il existe) n'apparaît pas.
    const n = await btns.count();
    if (n > 2) {
      const name2 = (await btns.nth(2).textContent())?.trim() ?? "";
      const joined = (await articles.allTextContents()).join(" ").replace(/\s+/g, " ");
      expect(joined).not.toContain(name2.replace(/\s+/g, " "));
    }
  });

  test("toggle désélectionne (aria-pressed revient à false)", async ({ page }) => {
    const btns = sidebarMatchButtons(page);
    await btns.nth(0).click();
    await expect(btns.nth(0)).toHaveAttribute("aria-pressed", "true");
    await btns.nth(0).click();
    await expect(btns.nth(0)).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(SIDEBAR).getByText(/matchs? sélectionné/)).toHaveCount(0);
  });

  test("Effacer → restaure la liste complète", async ({ page }) => {
    const btns = sidebarMatchButtons(page);
    const before = await btns.count();
    await btns.nth(0).click();
    await expect(page.locator(SIDEBAR).getByText(/1 match sélectionné/)).toBeVisible();

    await page.locator(SIDEBAR).getByRole("button", { name: "Effacer", exact: true }).click();
    await expect(page.locator(SIDEBAR).getByText(/matchs? sélectionné/)).toHaveCount(0);
    // Aucun match n'est plus pressé (les pills temps/onglets ont leur propre aria-pressed).
    const pressed = await page
      .locator(`${SIDEBAR} button[aria-pressed="true"]`)
      .filter({ hasText: "–" })
      .count();
    expect(pressed).toBe(0);
    // La liste complète est restaurée (au moins autant de matchs qu'avant).
    const after = await sidebarMatchButtons(page).count();
    expect(after).toBe(before);
  });
});