import { describe, expect, test } from "bun:test";
import {
  HAND_BALL_LEAGUES,
  getHandballLeague,
  leagueVariants,
  normalizeHandballLeague,
} from "../handball-league-registry";

// Bug structurel que ce fichier verrouille : trois scrapers écrivent la même
// colonne `league` de `handball_match_history` avec trois conventions
// (`Pays: Ligue`, nom nu, slug). Sans registre, un GROUP BY par ligue Returning
// trois lignes pour un championnat et tout agrégat filtré faux.

describe("registre des ligues — cohérence interne", () => {
  test("9 ligues, ids et noms canoniques uniques", () => {
    expect(HAND_BALL_LEAGUES).toHaveLength(9);
    expect(new Set(HAND_BALL_LEAGUES.map((l) => l.id)).size).toBe(9);
    expect(new Set(HAND_BALL_LEAGUES.map((l) => l.name)).size).toBe(9);
  });

  test("toute ligue a un pays, un chemin BetExplorer et au moins un alias", () => {
    for (const l of HAND_BALL_LEAGUES) {
      expect(l.country.length).toBeGreaterThan(0);
      expect(l.path.startsWith("/handball/")).toBe(true);
      expect(l.aliases.length).toBeGreaterThan(0);
    }
  });

  test("aucune variante n'est partagée entre deux ligues (sinon fusion fantôme)", () => {
    const seen = new Map<string, string>();
    for (const l of HAND_BALL_LEAGUES) {
      for (const v of [l.name, ...l.aliases]) {
        const key = v.toLowerCase();
        const owner = seen.get(key);
        expect(owner === undefined || owner === l.id).toBe(true);
        seen.set(key, l.id);
      }
    }
  });
});

describe("normalizeHandballLeague — les 3 écritures convergent", () => {
  test("slug (betexplorer-season) → nom canonique", () => {
    expect(normalizeHandballLeague("starligue")).toBe("France: Starligue");
    expect(normalizeHandballLeague("bundesliga2")).toBe("Germany: 2. Bundesliga");
    expect(normalizeHandballLeague("d2women")).toBe("Denmark: 1. Division Women");
  });

  test("nom nu (flashscore) → nom canonique", () => {
    expect(normalizeHandballLeague("Starligue")).toBe("France: Starligue");
    expect(normalizeHandballLeague("2. Bundesliga")).toBe("Germany: 2. Bundesliga");
    expect(normalizeHandballLeague("HLA")).toBe("Austria: HLA");
  });

  test("déjà canonique → inchangé (idempotent)", () => {
    expect(normalizeHandballLeague("France: Starligue")).toBe("France: Starligue");
    expect(normalizeHandballLeague("France: Proligue")).toBe("France: Proligue");
  });

  test("insensible à la casse et aux espaces autour", () => {
    expect(normalizeHandballLeague("STARLIGUE")).toBe("France: Starligue");
    expect(normalizeHandballLeague("  starligue  ")).toBe("France: Starligue");
  });

  test("ligue hors registre / valeur vide → null (jamais de rattachement deviné)", () => {
    // `Division 1` est volontairement absent : 7 lignes src=flashscore, pays
    // indéterminable (polonais I Liga ou danois 1. Division). Deviner fusionnerait
    // deux ligues distinctes.
    expect(normalizeHandballLeague("Division 1")).toBeNull();
    expect(normalizeHandballLeague("Poland: I Liga")).toBeNull();
    expect(normalizeHandballLeague("")).toBeNull();
    expect(normalizeHandballLeague(null)).toBeNull();
    expect(normalizeHandballLeague(undefined)).toBeNull();
  });
});

describe("leagueVariants — WHERE league IN (...)", () => {
  test("inclut le canonique ET tous les alias (sinon la série est tronquée)", () => {
    const v = leagueVariants("starligue");
    expect(v).toContain("France: Starligue");
    expect(v).toContain("starligue");
    expect(v).toContain("Starligue");
  });

  test("id inconnu → [] (fail-closed, pas de « tout le pays »)", () => {
    expect(leagueVariants("nawak")).toEqual([]);
    expect(leagueVariants("")).toEqual([]);
  });
});

describe("getHandballLeague", () => {
  test("retourne la fiche par id, null sinon", () => {
    expect(getHandballLeague("hla")?.name).toBe("Austria: HLA");
    expect(getHandballLeague("nawak")).toBeNull();
  });
});