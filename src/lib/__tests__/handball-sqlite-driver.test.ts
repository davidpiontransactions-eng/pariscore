import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";

/**
 * Voie A : sous Bun, la lecture de l'historique handball doit produire des
 * données, pas un `[]` silencieux.
 *
 * ── Le défaut que ce test garde (mesuré en prod, 2026-10-05) ───────────────
 * Runtime de prod = Bun, où `better-sqlite3` est REFUSÉ :
 * « 'better-sqlite3' is not yet supported in Bun ». Ce n'est pas un conflit
 * d'ABI corrigeable par un rebuild — le module est bloqué à la source.
 * `getDb()` ne pouvait donc plus s'ouvrir : il retombait de `bun:sqlite`
 * (réécrit par le bundler, en échec) vers `better-sqlite3` (refusé par Bun),
 * renvoyait `null`, et toute la lecture partait en `[]`. L'API annonçait alors
 * « Ligue inconnue du registre », le registre étant sain.
 *
 * Le test échoue si la liste redevient vide alors que la base est présente.
 * C'est le seul signal qui compte : pas le pilote choisi, mais le RÉSULTAT.
 */
describe("lecture de l'historique handball sous Bun", () => {
  test("la base de test est présente, sinon le test ne prouve rien", () => {
    // Un test qui passe faute de données est un test vert qui ne teste rien.
    // On échoue explicitement plutôt que de laisser croire à une couverture.
    expect(existsSync("pariscore.db")).toBe(true);
  });

  test("listHistoryLeagueStats renvoie des ligues quand la base est lisible", async () => {
    const mod = await import("../handball-history-db.js");

    // Base absente du cwd -> le module doit le dire explicitement.
    if (!existsSync("pariscore.db")) {
      expect(mod.historyDbError()).toContain("introuvable");
      return;
    }

    // Base presente + fichier existe : une liste vide signifie que le pilote
    // n'a pas su ouvrir la base. C'est exactement la régression à garder.
    const stats = mod.listHistoryLeagueStats();

    expect(stats.length).toBeGreaterThan(0);
    // `historyDbError()` doit rester null quand tout s'est bien passé :
    // c'est le garde-fou contre un futur « on ignore l'erreur » silencieux.
    expect(mod.historyDbError()).toBeNull();

    // Cohérence minimale : une ligue agrégée a forcément des matchs et une date.
    for (const s of stats) {
      expect(s.league.length).toBeGreaterThan(0);
      expect(s.n).toBeGreaterThan(0);
    }
  });
});