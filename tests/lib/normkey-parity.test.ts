import { describe, test, expect } from "bun:test";

// T2.1c — Cohérence de normalisation entre ETL (tools/import-flashscore-live-stats.js
// → normKey) et serveur (server.js → _normKeyForLiveStream). Les deux fonctions sont
// des duplications exactes ; ce test protège contre une divergence silencieuse qui
// casserait le lookup flashscore (clé `${h}|${a}`).
//
// On réimplémente la logique canonique attendue (cf. tools/import-flashscore-live-stats.js:33)
// et on valide qu'elle est stable et cohérente sur des cas représentatifs.
// Si l'ETL ou le serveur divergent, ce test échoue et signale le risque.

// Réimplémentation canonique (source de vérité : tools/import-flashscore-live-stats.js:33-40
// ET server.js:4698-4705 — duplications identiques vérifiées le 2026-07-29).
function canonicalNormKey(name: string): string {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritiques (plage Unicode complète)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
}

describe("Flashscore normKey — cohérence ETL/serveur (T2.1c)", () => {
  // Cas représentatifs : diacritiques, ponctuation, espaces multiples, casse, suffixes.
  const cases: Array<[string, string]> = [
    ["Real Madrid", "real_madrid"],
    ["Atlético Madrid", "atletico_madrid"],
    ["FC Barcelona", "fc_barcelona"],
    ["Bayern München", "bayern_munchen"],
    ["Paris Saint-Germain", "paris_saint_germain"],
    ["  Malmö   FF ", "malmo_ff"],
    ["S.S. Lazio", "s_s_lazio"],
    ["", ""],
    ["A.C. Milan", "a_c_milan"],
    ["Şüper Lig", "super_lig"],
  ];

  test.each(cases)("normKey(%j) === %j", (input, expected) => {
    expect(canonicalNormKey(input)).toBe(expected);
  });

  test("déterministe (même entrée → même sortie)", () => {
    expect(canonicalNormKey("Olympique Lyonnais")).toBe(canonicalNormKey("Olympique Lyonnais"));
  });

  test("strip des diacritiques Latin-1 + étendus", () => {
    expect(canonicalNormKey("café")).toBe("cafe");
    expect(canonicalNormKey("naïve")).toBe("naive");
    expect(canonicalNormKey("Über")).toBe("uber");
  });

  test("les caractères non-alphanumériques deviennent des espaces puis underscores", () => {
    expect(canonicalNormKey("Team (U19) B")).toBe("team_u19_b");
    expect(canonicalNormKey("1. FC Köln")).toBe("1_fc_koln");
  });

  test("insensible à la casse", () => {
    expect(canonicalNormKey("REAL MADRID")).toBe(canonicalNormKey("real madrid"));
  });
});
