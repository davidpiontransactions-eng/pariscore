// `source` annonçait « odds-api+ml » même quand la prod servait du 1xBet brut.
// Une ReferenceError avait fait basculer toute la chaîne ML sur le fallback, et
// rien ne le disait : les logs disaient le contraire de la réalité. Ces tests
// verrouillent que `source` décrit le chemin RÉELLEMENT emprunté.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/mma/fights/route.ts", "utf-8");

describe("le champ source ne peut plus mentir", () => {
  test("source n'est plus ecrit en dur", () => {
    // Le bug : `source: "odds-api+ml"` littéral dans payload(), quel que soit
    // le chemin. Il ne doit plus exister.
    expect(route).not.toMatch(/source:\s*"odds-api\+ml"/);
  });

  test("les deux valeurs possibles sont declarees", () => {
    expect(route).toContain('"odds-api+ml"');
    expect(route).toContain('"1xbet-fallback"');
  });

  test("payload prend la source en parametre", () => {
    expect(route).toMatch(/payload\s*=\s*\([^)]*source:\s*DataSource/);
  });

  test("chaque chemin de reponse nomme sa source", () => {
    // Assertions structurelles : on verifie que le cableage existe, pas le
    // comportement (un test comportemental exigerait d'importer la route, qui
    // tire next/server et un cache module-level). Le test de comportement
    // reste : lire `source` sur la reponse reelle du VPS.
    expect(route).toContain("cache.source");   // serviceurs fresh + stale
    expect(route).toContain("data.source");    // cache miss
    expect(route).toContain('source: "1xbet-fallback"'); // branche 503
  });

  test("le cache porte la source, sinon un hit ment aussi", () => {
    expect(route).toMatch(/type CacheEntry = \{[^}]*source: DataSource/);
  });

  test("le repli 1xBet est trace dans les logs", () => {
    // Le 2026-10-04, le catch du service etait muet : une exception unique
    // suffisait a tuer la prod sans trace. Silence interdit.
    expect(route).toMatch(/console\.(error|warn)\(\s*"\[mma\/fights\]/);
    // Et le catch ne doit plus etre vide
    expect(route).not.toMatch(/\}\s*catch\s*\{\s*\n\s*fights = read1xBetDirect\(now\);\s*\n\s*\}/);
  });
});

describe("l'onglet consomme le champ source sans le casser", () => {
  test("mma-tab-content remplace l'ancien libelle cote client", () => {
    // Il fait `data.source.replace("odds-api+ml", "The Odds API + ML")` : un
    // fallback affiche donc « 1xbet-fallback » en clair, ce qui est
    // exactement le comportement voulu (l'utilisateur voit la degradation).
    const tab = readFileSync("src/components/mma/mma-tab-content.tsx", "utf-8");
    expect(tab).toContain("data.source");
  });
});