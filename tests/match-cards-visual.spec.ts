import { test, expect } from "@playwright/test";

/**
 * QA visuelle des cartes de match après l'extraction `MatchShell` + `MatchStateBadge`.
 *
 * ## Quelle URL cette spec cible
 *
 * `QA_BASE_URL` (et **pas** `PLAYWRIGHT_BASE_URL`, qui n'est lu par personne
 * ici — un run « contre la prod » tapait en réalité `127.0.0.1:3000` et
 * échouait sur un serveur absent, ce qui fit conclure à tort que l'UI de prod
 * était figée ; constat du 2026-10-09). Sans variable, la spec vise le local.
 *
 * ## Ce qui est vérifié sans dépendre des données
 *
 * Le rendu ne casse pas (pas d'erreur React fatale), pas de débordement horizontal à
 * 375 px, screenshot de preuve. Un onglet sans match doit porter son
 * `empty-state` : sans cette ancre, « pas de match » et « liste cassée » sont
 * indiscernables.
 *
 * ## Ce qui est vérifié SI des données sont présentes
 *
 * La présence du badge d'état. C'est la seule assertion qui prouve le câblage réel :
 * `MatchStateBadge` est rendu par `MatchShell`, que basketball et handball appellent
 * désormais.
 */

const BASE = process.env.QA_BASE_URL ?? "http://127.0.0.1:3000";
const OUT = "tests/qa-screenshots";
/** Temps de stabilisation du panneau avant toute assertion — voir `openSportTab`. */
const SETTLE_MS = 35_000;

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
 * Ouvre un onglet sport. Renvoie `false` si le sport n'est atteignable ni par la
 * barre ni par le menu « Plus ».
 *
 * `SPORT_TABS` compte 12 sports : les favoris sont en barre, les autres passent
 * par le menu « Plus » (débordement). Handball est secondaire, donc absent de la
 * barre — sans ce repli, ses tests étaient skippés et la carte Value Bet
 * handball n'a jamais été scannée.
 *
 * Le bouton « Plus » n'a **pas** d'`aria-label` (cf. `sport-tabs.tsx:256-274`) :
 * on le cible par `aria-haspopup="true"` + texte, pas par un libellé supposé.
 */
async function openSportTab(
  page: import("@playwright/test").Page,
  sport: RegExp,
): Promise<boolean> {
  const bar = page
    .locator('[role="tablist"][aria-label="Navigation par sport"]')
    .getByRole("tab", { name: sport })
    .first();
  if ((await bar.count()) > 0) {
    await bar.click({ timeout: 15_000 });
  } else {
    // Repli « Plus » : le portal est rendu dans `document.body`, hors du
    // tablist — on cherche donc le sport dans toute la page après ouverture.
    const more = page.locator('button[aria-haspopup="true"]:has-text("Plus")').first();
    if ((await more.count()) === 0) return false;
    await more.click({ timeout: 15_000 });

    // L'option doit être cherchée DANS le portal du menu, pas dans toute la
    // page : `button:has-text("Handball")` matchait d'abord le bouton de la
    // barre latérale (`aria-label="Élargir Handball"`), et le clic partait alors
    // dans l'overlay de fermeture `fixed inset-0 z-40` — timeout à chaque fois.
    //
    // Le portal est identifié par `min-w-[140px]`, sa classe propre : cibler
    // `z-50` ne suffit pas, le bandeau responsible-gambling est lui aussi en
    // `z-50` et sortait en premier, ce qui faisait échouer silencieusement.
    const menu = page.locator('div[class*="min-w-[140px]"]').first();
    const option = menu.locator("button").filter({ hasText: sport }).first();
    if ((await option.count()) === 0) return false;
    await option.click({ timeout: 15_000 });
  }

  // Le panneau met plusieurs sources à charger (NBA, WNBA, EuroLeague, EuroCup
  // — mesuré en prod : 1,2 s à 1,7 s par route) et le rendu suit la dernière.
  //
  // On n'attend PAS « la disparition de Chargement… » : ce texte existe dans
  // plusieurs panneaux (handball-tab-content, football-league-rankings-widget,
  // tennis-top10-section…) et `getByText(...).first()` visait un nœud arbitraire.
  // On ne sonde PAS non plus « une carte est-elle présente ? » : les panneaux des
  // AUTRES sports restent montés, donc ce test est vrai dès la première seconde
  // et la spec relatait l'état trop tôt (mesuré : 0 carte côté spec quand une
  // sonde isolée en voyait 3 à 35 s). D'où un temps de stabilisation BRUT,
  // calé sur la valeur mesurée, et non sur une terminaison devinée.
  await page.waitForTimeout(SETTLE_MS);
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
          // Zéro carte, zéro état vide, zéro erreur 5xx : le panneau n'a atteint
          // AUCUN état terminal. On le nomme explicitement plutôt que de supposer
          // « sport vide » — c'est ce qui avait masqué la panne du 2026-10-09.
          const stillLoading = await page.evaluate(() =>
            Array.from(document.querySelectorAll("*")).some(
              (el) =>
                (el as HTMLElement).offsetParent !== null &&
                el.children.length === 0 &&
                /Chargement/i.test(el.textContent ?? ""),
            ),
          );
          expect(
            stillLoading,
            `aucun état terminal atteint après ${SETTLE_MS / 1000} s sur ` +
              `${target.name}/${vpName} : ` +
              `ni carte, ni [data-testid="empty-state"], ni erreur API — ` +
              `le panneau est-il figé ? (voir ${file})`,
          ).toBe(false);

          // État vide toléré, mais seulement si le composant l'annonce.
          const emptyState = await page.locator('[data-testid="empty-state"]').count();
          expect(
            emptyState,
            `aucune carte ET aucun [data-testid="empty-state"] : impossible de ` +
              `dire si le sport est vide ou si la liste est cassée ` +
              `(voir ${file})`,
          ).toBeGreaterThan(0);
          return;
        }

        // 4. Des cartes rendues ⇒ le badge d'état de MatchShell doit l'être aussi.
        expect(states, "des cartes sont rendues mais aucun badge d'état").toBeGreaterThan(0);
      });
    }
  }

  /**
   * Dialog handball → grille de prédiction → carte Value Bet.
   *
   * La liste ne prouve que le câblage `MatchShell` / `MatchStateBadge`. La
   * cascade Value Bet (mission §2) n'existe qu'à l'intérieur du dialog, donc
   * elle exige d'ouvrir une carte.
   *
   * `pariscore` est non nul dès qu'un match est sélectionné
   * (`handball-match-detail-dialog.tsx:1355-1364`), la grille est donc toujours
   * attendue ; et `HandballPredictionCards` ne rend sa carte Value Bet que si
   * `match` lui est passé — c'est vérifié explicitement plutôt que supposé.
   */
  test("HandballMatchCard @ desktop — dialog, cartes de prédiction et Value Bet", async ({ page }) => {
    test.setTimeout(240_000);
    const fatals = await watchPage(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await acceptCookies(page);

    const opened = await openSportTab(page, /handball/i);
    expect(opened, "onglet handball inaccessible (ni barre ni menu Plus)").toBe(true);

    const card = page.locator('[data-testid="handball-match-card"]:visible').first();
    expect(
      await card.count(),
      `aucune carte handball cliquable (voir ${OUT}/match-card-handballmatchcard-desktop.png)`,
    ).toBeGreaterThan(0);

    await card.click({ timeout: 20_000 });
    await page.waitForTimeout(SETTLE_MS);

    const dialog = page.locator('[role="dialog"]:visible').first();
    expect(dialog, "le dialog de détail ne s'est pas ouvert au clic sur la carte").toBeVisible();

    const cards = dialog.locator('[data-testid="handball-prediction-cards"]');
    expect(
      await cards.count(),
      "dialog ouvert mais grille HandballPredictionCards absente " +
        `— la prop match est-elle passée au composant ? ` +
        `(voir ${OUT}/handball-value-bet-dialog.png)`,
    ).toBe(1);

    // La carte Value Bet : titre « Value Bet », ou son état vide explicite
    // (« Aucun Value Bet détecté »). Les DEUX sont des rendus valides — refuser
    // le second ferait échouer la spec dès qu'aucun pari n'atteint 1.20.
    const valueBet = cards.getByText("Value Bet", { exact: true });
    const noValueBet = cards.getByText(/Aucun Value Bet détecté/i);
    expect(
      (await valueBet.count()) + (await noValueBet.count()),
      "ni carte « Value Bet » ni état vide « Aucun Value Bet détecté » " +
        `(voir ${OUT}/handball-value-bet-dialog.png)`,
    ).toBeGreaterThan(0);

    await page.screenshot({ path: `${OUT}/handball-value-bet-dialog.png`, fullPage: false });

    // Rien ne doit avoir cassé au montage du dialog.
    expect(fatals, `erreurs fatales: ${fatals.join(" | ")}`).toEqual([]);
  });
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
