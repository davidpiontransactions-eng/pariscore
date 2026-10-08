// Tests des identifiants de sous-onglets tennis.
//
// Cible : `src/lib/tennis-sub-tab-ids.ts`, source unique de vérité partagée par
// la rangée de tête, le store zustand et la migration de la persistance.
//
// Le piège couvert ici est Silent : sans `parseTennisSubTab`, un identifiant
// périmé en persistance (`today`, `calendar`) affiche ZERO onglet actif — la
// rangée ne trouve aucun `tab.id === active` et l'utilisateur tombe sur une vue
// vide sans comprendre pourquoi.

import { describe, test, expect } from "bun:test";
import {
  DEFAULT_TENNIS_SUB_TAB,
  TENNIS_SUB_TABS,
  TENNIS_SUB_TAB_IDS,
  isTennisSubTabId,
  migrateTennisSubTab,
  parseTennisSubTab,
  type TennisSubTabId,
} from "../tennis-sub-tab-ids";

const ALL_IDS: TennisSubTabId[] = [
  "prematch",
  "live",
  "cards",
  "tournaments",
  "list",
  "rankings",
  "strategies",
];

/** Identifiants hérités, re-déclarés ici volontairement : le test ne doit pas
 *  importer la table d'alias du module sous test (il la vérifierait donc avec
 *  la même source de vérité —CircularError silencieux).
 *  Les 5 derniers sont l'ancien jeu de la rangée interne (`calendrier`,
 *  `top10`, `resultats`, `stats`, `backtesting`), qui coexistait avec le
 *  canonique sans le lire : leur persistance est réelle. */
const LEGACY_IDS = ["today", "calendar", "calendrier", "top10", "resultats", "stats", "backtesting"] as const;

/** Destination attendue de chaque identifiant hérité. */
const LEGACY_EXPECTED: Record<string, TennisSubTabId> = {
  today: "prematch",
  calendar: "strategies",
  calendrier: "prematch",
  top10: "strategies",
  resultats: "list",
  stats: "rankings",
  backtesting: "list",
};

describe("TENNIS_SUB_TABS — contrat de la liste canonique", () => {
  test("contient exactement les 7 identifiants attendus", () => {
    expect([...TENNIS_SUB_TAB_IDS].sort()).toEqual([...ALL_IDS].sort());
    expect(TENNIS_SUB_TABS).toHaveLength(7);
  });

  test("aucun identifiant en double", () => {
    const ids = TENNIS_SUB_TABS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("TENNIS_SUB_TABS et TENNIS_SUB_TAB_IDS décrivent le même ensemble, dans le même ordre", () => {
    expect(TENNIS_SUB_TABS.map((t) => t.id)).toEqual([...TENNIS_SUB_TAB_IDS]);
  });

  test("le premier sous-onglet est le défaut (invariant du store)", () => {
    expect(TENNIS_SUB_TABS[0].id).toBe(DEFAULT_TENNIS_SUB_TAB);
    expect(DEFAULT_TENNIS_SUB_TAB).toBe("prematch");
  });

  test("`cards` est en 3e position, pas en 1re", () => {
    // Cette vue CONTIENT live + prematch : en tête elle deviendrait le défaut
    // et changerait ce que voit l'utilisateur à l'ouverture de l'onglet tennis.
    expect(TENNIS_SUB_TABS[2].id).toBe("cards");
  });

  test("aucun identifiant hérité ne se chevauche avec un identifiant canonique", () => {
    for (const legacy of LEGACY_IDS) {
      expect([...TENNIS_SUB_TAB_IDS]).not.toContain(legacy);
    }
  });

  test("chaque entrée porte une clé i18z `subTab*` non vide", () => {
    for (const tab of TENNIS_SUB_TABS) {
      expect(tab.labelKey).toMatch(/^subTab/);
    }
  });
});

describe("isTennisSubTabId", () => {
  test("accepte les 7 identifiants canoniques", () => {
    for (const id of ALL_IDS) expect(isTennisSubTabId(id)).toBe(true);
  });

  test("rejette les identifiants hérités et les inconnus", () => {
    for (const id of ["today", "calendar", "cards-x", "LIVE", "", "prematch "]) {
      expect(isTennisSubTabId(id)).toBe(false);
    }
  });

  test("rejette les non-strings sans lever", () => {
    for (const v of [null, undefined, 42, {}, []]) {
      expect(isTennisSubTabId(v)).toBe(false);
    }
  });
});

describe("parseTennisSubTab", () => {
  test("identité sur les 7 identifiants canoniques", () => {
    for (const id of ALL_IDS) expect(parseTennisSubTab(id)).toBe(id);
  });

  test("retombe sur le défaut pour une valeur absente", () => {
    expect(parseTennisSubTab(undefined)).toBe(DEFAULT_TENNIS_SUB_TAB);
    expect(parseTennisSubTab(null)).toBe(DEFAULT_TENNIS_SUB_TAB);
    expect(parseTennisSubTab("")).toBe(DEFAULT_TENNIS_SUB_TAB);
  });

  test("retombe sur le défaut pour un identifiant inconnu", () => {
    expect(parseTennisSubTab("cards-x")).toBe(DEFAULT_TENNIS_SUB_TAB);
    expect(parseTennisSubTab("matchs")).toBe(DEFAULT_TENNIS_SUB_TAB);
  });

  test("migre les identifiants hérités vers leur remplaçant", () => {
    expect(parseTennisSubTab("today")).toBe("prematch");
    expect(parseTennisSubTab("calendar")).toBe("strategies");
  });

  test("migre les 5 ids de l'ancienne rangée interne vers leur remplaçant", () => {
    // Régression : la rangée interne portait `calendrier`/`top10`/… pendant que le
    // module canonique portait `prematch`/`strategies`/…. Sans ces alias, un
    // utilisateur sur `calendrier` retombait sur le DÉFAUT `prematch` au lieu
    // de retrouver sa vue — et inversement, un clic `top10` nechangeait rien.
    for (const [legacy, expected] of Object.entries(LEGACY_EXPECTED)) {
      expect(parseTennisSubTab(legacy)).toBe(expected);
    }
  });

  test("ne privilégise JAMAIS un alias sur un identifiant canonique", () => {
    // `prematch` et `strategies` sont les cibles de migration de `today` et
    // `calendar` : s'ils étaient eux-mêmes des alias, la résolution pourrait
    // boucler ou détourner un id valide déjà supporté.
    expect(parseTennisSubTab("prematch")).toBe("prematch");
    expect(parseTennisSubTab("strategies")).toBe("strategies");
    expect(parseTennisSubTab("cards")).toBe("cards");
  });

  test("toujours renvoie un identifiant de la liste canonique", () => {
    const CANONICAL: readonly string[] = TENNIS_SUB_TAB_IDS;
    for (const v of [undefined, null, "", ...LEGACY_IDS, "zzz", "cards"]) {
      expect(CANONICAL).toContain(parseTennisSubTab(v));
    }
  });
});

describe("migrateTennisSubTab", () => {
  test("renvoie undefined quand rien n'est persisté (à l'appelant d'injecter)", () => {
    expect(migrateTennisSubTab(undefined)).toBeUndefined();
    expect(migrateTennisSubTab(null)).toBeUndefined();
  });

  test("renvoie undefined pour un identifiant inconnu — ne doit pas polluer le store", () => {
    expect(migrateTennisSubTab("zzz")).toBeUndefined();
    expect(migrateTennisSubTab("")).toBeUndefined();
  });

  test("laisse passer un identifiant canonique inchangé", () => {
    for (const id of ALL_IDS) expect(migrateTennisSubTab(id)).toBe(id);
  });

  test("remplace chaque identifiant hérité", () => {
    expect(migrateTennisSubTab("today")).toBe("prematch");
    expect(migrateTennisSubTab("calendar")).toBe("strategies");
  });

  test("remplace chaque identifiant de l'ancienne rangée interne", () => {
    for (const [legacy, expected] of Object.entries(LEGACY_EXPECTED)) {
      expect(migrateTennisSubTab(legacy)).toBe(expected);
    }
  });

  test("toute valeur migrée est un identifiant canonique", () => {
    const CANONICAL: readonly string[] = TENNIS_SUB_TAB_IDS;
    for (const v of [...LEGACY_IDS, ...ALL_IDS]) {
      const out = migrateTennisSubTab(v);
      if (out !== undefined) expect(CANONICAL).toContain(out);
    }
  });

  test("migration idempotente", () => {
    for (const v of [...LEGACY_IDS, ...ALL_IDS]) {
      const once = migrateTennisSubTab(v);
      if (once === undefined) continue;
      expect(migrateTennisSubTab(once)).toBe(once);
    }
  });
});
