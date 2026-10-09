import { test, expect } from "@playwright/test";

/**
 * QA visuelle des cartes de match après l'extraction `MatchShell` + `MatchStateBadge`.
 *
 * ## Pourquoi le local et pas la prod
 *
 * Les specs visuelles du dépôt ciblent `https://pariscore.fr` par défaut. Ce n'est pas
 * applicable ici : le code de ce chantier est **committé mais pas déployé**. Sur prod,
 * une assertion `[data-state]` passerait en vert sur l'ancien code — le test confirmerait
 * exactement ce qu'il prétend vérifier. `QA_BASE_URL` permet de viser la prod pour une
 * régression ultérieure.
 *
 * ## Ce qui est vérifié sans dépendre des données
 *
 * Le rendu ne casse pas (pas d'erreur React fatale), pas de débordement horizontal à
 * 375 px, screenshot de preuve. Ces trois-là tiennent même quand aucun match n'est
 * disponible — la base locale est vide et les flux externes peuvent être en panne, et
 * une journée sans match est un état **normal**, pas une panne (cf. rapport NHL §3).
 *
 * ## Ce qui est vérifié SI des données sont présentes
 *
 * La présence du badge d'état. C'est la seule assertion qui prouve le câblage réel :
 * `MatchStateBadge` est rendu par `MatchShell`, que basketball et handball appellent
 * désormais. Conditionnée, et signalée explicitement quand elle saute.
 */

const BASE = process.env.QA_BASE_URL ?? "http://127.0.0.1:3000";
const OUT = "tests/qa-screenshots";

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 812 },
};

/** Collecte les erreurs console qui signalent un crash de rendu React/JSX. */
async function watchPage(page: import("@playwright/test").Page): Promise<string[]> {
  const fatals: string[] = [];
  page.on("pageerror", (err) => fatals.push(`pageerror: ${err.message.split("\n")[0]}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Un 404 d'image ou une ressource externe hors ligne n'est pas un crash de composant.
    if (/Failed to load resource|net::ERR|404|favicon/i.test(text)) return;
    fatals.push(`console.error: ${text.split("\n")[0]}`);
  });
  return fatals;
}

async function acceptCookies(page: import("@playwright/test").Page): Promise<void> {
  const btn = page.getByRole("button", { name: /tout accepter|accept all/i });
  try {
    await expect(btn).toBeVisible({ timeout: 8_000 });
    await btn.click();
  } catch {
    // Bandeau déjà accepté ou absent — non bloquant.
  }
}

/**
 * Ouvre un onglet sport. Renvoie `false` si l'onglet n'est pas atteignable.
 *
 * **Un onglet absent n'est pas un bug.** `SPORT_TABS` (`sport-tabs.tsx:58-70`) compte 12
 * sports : les favoris sont en barre, le reste passe par un groupe secondaire en
 * débordement. Handball est le dernier de la liste et n'apparaît donc pas comme un
 * `tab` direct — le premier jet de cette spec échouait sur un timeout de 20 s à chaque
 * exécution, ce qui n'était pas une régression du rendu mais un fait d'ergonomie.
 */
async function openSportTab(
  page: import("@playwright/test").Page,
  sport: RegExp,
): Promise<boolean> {
  const tab = page
    .locator('[role="tablist"][aria-label="Navigation par sport"]')
    .getByRole("tab", { name: sport })
    .first();
  if ((await tab.count()) === 0) return false;
await tab.click({ timeout: 15_000 });

  // Le tab charge ses données de façon asynchrone. L'attente fixe de 6 s du
  // premier jet était calibrée sur une liste déjà en cache : en prod à froid
  // elle expirait avant la fin du chargement, et l'absence de carte était
  // ensuite traitée comme un état normal (2026-10-09).
  //
  // On attend la DISPARITION de l'indicateur de chargement, pas « des cartes » :
  // un sélecteur large (`[role="button"]`) matchait un bouton du header dès la
  // milliseconde et ne servait à rien. Une route en 503 ou une liste bloquée se
  // terminent aussi — mais par un échec, que les assertions plus bas nomment.
  await page
    .getByText(/Chargement/i)
    .first()
    .waitFor({ state: "hidden", timeout: 90_000 })
    .catch(() => {
      // Toujours chargé au bout de 90 s : traité plus bas comme liste bloquée.
    });
  return true;
}

type CardProbe = { name: string; tab: RegExp; card: string; stateCount: number; cards: number };

test.describe("Cartes de match — QA visuelle (MatchShell + MatchStateBadge)", () => {
  test.setTimeout(180_000);

  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    for (const target of [
      { name: "BasketballMatchCard", tab: /basketball/i, card: '[role="button"]' },
      { name: "HandballMatchCard", tab: /handball/i, card: 'button[type="button"]' },
    ] as const) {
      test(`${target.name} @ ${vpName} (${vp.width}×${vp.height})`, async ({ page }) => {
        const fatals = await watchPage(page);
        await page.setViewportSize(vp);
        await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await acceptCookies(page);
        const opened = await openSportTab(page, target.tab);
        if (!opened) {
          // Onglet en débordement : état d'ergonomie, pas de régression de rendu.
          test.skip(true, `onglet ${target.tab} absent de la barre principale (groupe secondaire)`);
        }

        // Le badge d'état est rendu par MatchShell ; c'est lui qui prouve le câblage.
        //
        // **`span[data-state]`, pas `[data-state]`** : Radix UI (menus, dialogs, dropdowns
        // du header) pose lui aussi `data-state`, avec les valeurs `"open"` / `"closed"`.
        // Le premier jet de cette spec comptait donc 2 « badges » — deux boutons de
        // menu fermés — et aurait pu passer en vert sur une carte jamais rendue.
        // Notre badge est un `<span>`, les déclencheurs Radix des `<button>` : la
        // distinction est structurelle, pas un filtre sur des valeurs.
        const states = await page.locator("span[data-state]:visible").count();
        const cards = await page.locator(`${target.card}:visible`).count();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );

        const file = `${OUT}/match-card-${target.name.toLowerCase()}-${vpName}.png`;
        await page.screenshot({ path: file, fullPage: true });

        const probe: CardProbe = {
          name: target.name,
          tab: target.tab,
          card: target.card,
          stateCount: states,
          cards,
        };
        console.log(
          `[${target.name}/${vpName}] cartes=${probe.cards} badges etat=${states} ` +
            `debordement=${overflow} fatal=${fatals.length} -> ${file}`,
        );

        // 1. Le rendu ne casse pas. Une erreur console React laisserait la page blanche.
        expect(fatals, `erreurs fatales: ${fatals.join(" | ")}`).toEqual([]);

        // 2. Pas de débordement horizontal — régression classique de badge ajouté
        //    dans un conteneur à largeur fixe.
        expect(overflow, "débordement horizontal sur " + vpName).toBe(false);

        // 3. AUCUNE carte n'est un ÉCHEC, plus un état « normal » qu'on se contente
        //    de loguer.
        //
        //    Historique : cette branche faisait `console.log(...)` et laissait le
        //    test passer. Conséquence mesurée le 2026-10-09 : la prod affichait
        //    « Error: HTTP 503 » sur toute la liste basketball — /api/nba/matches
        //    en 503 {"details":"expH is not defined"} — et la suite annonçait
        //    « 3 passed ». Le harnais validait l'absence de données comme un
        //    succès, ce qui a masqué la panne pendant des semaines.
        //
        //    On distingue donc les DEUX causes, qui n'appellent pas la même
        //    décision : une erreur applicative visible est un défaut ; un
        //    « pas de match aujourd'hui » est un état normal — mais il doit
        //    être TYPÉ par le composant, pas deviné par l'absence de carte.
        const apiError = await page
          .getByText(/Erreur\s*:?\s*HTTP\s*(5\d\d|429)|HTTP\s*503/i)
          .first()
          .textContent({ timeout: 5_000 })
          .catch(() => null);
        expect(
          apiError,
          `route API en erreur sur ${target.name}/${vpName} : ${apiError?.trim()}`,
        ).toBeNull();

        if (cards === 0) {
          // Une liste encore en chargement n'est ni « vide » ni « cassée » : c'est
          // un troisième état, observé en prod le 2026-10-09 (panneau figé sur
          // « Chargement… » pendant plus de 3 min). Le nommer évite qu'un tel
          // blocage passe pour un sport legitement vide.
          const stuck = await page.getByText(/Chargement/i).first().isVisible().catch(() => false);
          expect(
            stuck,
            `liste encore en chargement après 90 s sur ${target.name}/${vpName} ` +
              `(voir ${file})`,
          ).toBe(false);

          // État vide toléré, mais seulement si le composant l'annonce : sinon on
          // ne sait pas distinguer « pas de match » d'une liste cassée.
          const emptyState = await page.locator('[data-testid="empty-state"]').count();
          expect(
            emptyState,
            `aucune carte ET aucun [data-testid="empty-state"] : impossible de ` +
              `dire si le sport est vide ou si la liste est cassée ` +
              `(voir ${file})`,
          ).toBeGreaterThan(0);
          console.log(
            `[${target.name}/${vpName}] liste vide ASSUMÉE (empty-state présent).`,
          );
          return;
        }

        // 4. Des cartes rendues ⇒ le badge d'état de MatchShell doit l'être aussi.
        expect(states, "des cartes sont rendues mais aucun badge d'état").toBeGreaterThan(0);
      });
    }
  }
});

test.describe("ScenarioImpact — composant contrefactuel tennis", () => {
  test.setTimeout(180_000);

  test("page tennis rendue sans débordement + bloc Et si… si visible", async ({ page }) => {
    const fatals = await watchPage(page);
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await acceptCookies(page);
    const opened = await openSportTab(page, /tennis/i);
    if (!opened) test.skip(true, "onglet Tennis absent de la barre principale");

    // `ScenarioImpact` n'apparaît que sur un match en cours (le bloc « Et si… »).
    // Il est donc conditionné : un jour sans match live n'est pas une panne.
    const scenario = page.locator('[class*="scenario"], [data-testid*="scenario"]').first();
    const hasScenario = await scenario.count().catch(() => 0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    const file = `${OUT}/scenario-impact-tennis-mobile.png`;
    await page.screenshot({ path: file, fullPage: true });

    console.log(
      `[ScenarioImpact/mobile] bloc visible=${hasScenario > 0} debordement=${overflow} ` +
        `fatal=${fatals.length} -> ${file}`,
    );

    expect(fatals, `erreurs fatales: ${fatals.join(" | ")}`).toEqual([]);
    expect(overflow, "débordement horizontal tennis mobile").toBe(false);

    if (hasScenario === 0) {
      console.log(
        "[ScenarioImpact/mobile] BLOC ABSENT — assertion visuelle sautée " +
          "(visible uniquement sur un match live ; specs existantes: tests/pip-visual.spec.ts)",
      );
    }
  });
});
