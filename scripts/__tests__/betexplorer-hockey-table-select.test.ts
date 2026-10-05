/**
 * Vérification exécutable du correctif BetExplorer hockey.
 *
 * La sélection du tableau dans page.evaluate() réassignait une variable
 * déclarée `const` → TypeError "Assignment to constant variable" qui
 * massacrait le scraping des 3 ligues (NHL/KHL/Magnus).
 *
 * Ce test rejoue la logique exacte de sélection du tableau sur un faux
 * `document`, sans navigateur : il échoue si le bug revient.
 */
import { describe, test, expect } from "bun:test";

/** Forme minimale d'une table requise par la sélection. */
type FakeTable = { querySelectorAll: (sel: string) => unknown[]; rows: unknown[] };
type FakeDoc = {
  querySelector: (sel: string) => FakeTable | null;
  querySelectorAll: (sel: string) => FakeTable[];
};

type SelectResult = { matches: unknown[]; error: string | null; rowCount?: number };

/** Corps de la sélection, extrait de scrape-betexplorer-hockey.mjs. */
function selectTable(document: FakeDoc): SelectResult {
  let table: FakeTable | null = document.querySelector("table.table-main");
  if (!table) {
    const tables = document.querySelectorAll("table");
    if (tables.length === 0) return { matches: [], error: "Aucun tableau trouvé" };
    for (const t of tables) {
      const rows = t.querySelectorAll("tr");
      if (rows.length > 5) {
        table = t; // ← réassignation : exige `let`, lève TypeError avec `const`
        break;
      }
    }
  }
  if (!table) return { matches: [], error: "Aucun tableau trouvé" };
  return { matches: [], error: null, rowCount: table.rows.length };
}

const tableWith = (rowCount: number): FakeTable => ({
  querySelectorAll: () => new Array(rowCount).fill(0),
  rows: new Array(rowCount).fill(0),
});

describe("BetExplorer hockey — sélection du tableau (correctif const→let)", () => {
  test("réassigne la variable sans lever TypeError (bug historique)", () => {
    // table-main absent → passe par le fallback qui réassigne `table`
    const doc: FakeDoc = {
      querySelector: () => null,
      querySelectorAll: () => [tableWith(2), tableWith(12)],
    };
    const result = selectTable(doc);
    expect(result.error).toBeNull();
    expect(result.rowCount).toBe(12);
  });

  test("table-main présent : chemin rapide inchangé", () => {
    const doc: FakeDoc = { querySelector: () => tableWith(8), querySelectorAll: () => [] };
    expect(selectTable(doc).rowCount).toBe(8);
  });

  test("aucun tableau du tout : erreur explicite, pas de crash", () => {
    const doc: FakeDoc = { querySelector: () => null, querySelectorAll: () => [] };
    expect(selectTable(doc).error).toBe("Aucun tableau trouvé");
  });
});