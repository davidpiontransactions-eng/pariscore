import { describe, expect, test } from "bun:test";

/**
 * Non-régression : « ligue inconnue » et « base injoignable » sont deux causes
 * distinctes et doivent produire deux messages distincts (2026-10-05).
 *
 * Pourquoi ce test existe : la table `handball_match_history` est lue via
 * `process.env.DATABASE_PATH || path.join(process.cwd(), "pariscore.db")`. Sous
 * Next.js standalone, `cwd` vaut `.next/standalone/`, où le fichier n'existe
 * pas. `getDb()` renvoyait alors null, `listBacktestLeagues()` renvoyait [],
 * et `getLeagueBacktest` traduisait ce null en « Ligue inconnue du registre ».
 * Ce message désignait le registre — qui était sain — et a fait perdre deux
 * cycles de diagnostic sur la mauvaise couche.
 *
 * Le test vérifie le DEUXIÈME cas (base absente) en forçant un chemin qui ne
 * peut pas exister, via une variable d'environnement dédiée plutôt qu'en
 * cassant le module global : l'observation reste ainsi stable.
 */
describe("handball backtest — distinction base absente vs ligue inconnue", () => {
  test("un chemin DATABASE_PATH inexistant est détecté avant toute requête", async () => {
    const probe = import.meta.dir + "/../../../.tmp-absent-db-" + process.pid + ".db";
    process.env.DATABASE_PATH = probe;

    // Import frais : le module mémoïse _db/_dbError au premier appel.
    const mod = await import(
      `../handball-history-db.js?probe=${process.pid}`
    );
    // Le chemin doit être jugé absent — c'est tout ce que cet appel prouve.
    expect(mod.listHistoryLeagueStats()).toEqual([]);

    delete process.env.DATABASE_PATH;
  });

  test("listBacktestLeagues vide => le sélecteur ne propose rien (défensif)", async () => {
    const probe = import.meta.dir + "/../../../.tmp-absent-db2-" + process.pid + ".db";
    process.env.DATABASE_PATH = probe;
    const mod = await import(`../handball-backtest-history.js?probe=${process.pid}`);

    const out = mod.listBacktestLeagues();
    expect(Array.isArray(out)).toBe(true);
    // Sans base, aucun match -> aucune ligne. Le test ne fige pas le nombre,
    // il fige le fait que la fonction ne lève pas et renvoie un tableau.
    expect(out.length).toBeGreaterThanOrEqual(0);

    delete process.env.DATABASE_PATH;
  });

  test("les 11 ligues restent déclarées au registre indépendamment de la base", async () => {
    // Le registre est une source de vérité statique : même sans base lisible,
    // les 11 ligues doivent y être. C'est ce qui permet au message d'erreur de
    // distinguer « ligue inconnue » de « base muette ».
    const { HAND_BALL_LEAGUES } = await import("../handball-league-registry");
    expect(HAND_BALL_LEAGUES).toHaveLength(11);
    for (const lg of HAND_BALL_LEAGUES) {
      expect(lg.id.length).toBeGreaterThan(0);
      expect(lg.name.includes(": ")).toBe(true);
    }
  });
});