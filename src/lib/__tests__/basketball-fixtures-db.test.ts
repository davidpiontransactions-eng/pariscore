import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ensureBasketballFixtures,
  upsertBasketballFixtures,
  loadBasketballFixtures,
  applyBasketballResult,
  basketballOpportunities,
  basketballOpportunities as opps,
  type BasketballFixtureRow,
} from "../basketball-fixtures-db";

/**
 * ⚠️ Isolation — piège du `existsSync` :
 * `dbPath()` choisit le premier chemin EXISTANT. Si le fichier temporaire
 * n'existe pas encore, il retombe sur `pariscore.db` et les tests écrivent en
 * base réelle. Il faut donc CRÉER le fichier vide AVANT le premier `open()`,
 * sinon `ensure` lui-même valide le mauvais chemin.
 *
 * `DATABASE_PATH` est lu à chaque ouverture (pas à l'import), d'où l'assignation
 * avant chaque test.
 */
const tmpDb = path.join(os.tmpdir(), `bbfx-test-${process.pid}.db`);
const realDb = process.env.DATABASE_PATH;

function resetIsolation() {
  try { fs.rmSync(tmpDb, { force: true }); } catch { /* noop */ }
  process.env.DATABASE_PATH = tmpDb;
  // Le fichier doit exister AVANT la première lecture de dbPath().
  fs.writeFileSync(tmpDb, "");
}

function mk(partial: Partial<BasketballFixtureRow>): BasketballFixtureRow {
  return {
    bsdEventId: 1,
    league: "Euroleague",
    leagueBsdId: 2,
    scheduledAt: "2026-10-08T18:45:00+00:00",
    status: "scheduled",
    homeKey: "RMB",
    awayKey: "PAR",
    homeName: "Real Madrid",
    awayName: "Partizan",
    homeScore: null,
    awayScore: null,
    probHome: null, probAway: null,
    eloHome: null, eloAway: null,
    confidence: null, modelVersion: null,
    mlOddsHome: null, mlOddsAway: null,
    mlFairHome: null, mlFairAway: null,
    mlVigPct: null, mlBooks: null,
    homeStanding: null, awayStanding: null,
    last10ScoredHome: null, last10ScoredAway: null,
    last10TotalHome: null, last10TotalAway: null,
    venue: null,
    ahLine: null, ahBooks: null, ahFairFirst: null, ahFairSecond: null,
    ahVigPct: null, ahBestFirst: null, ahBestSecond: null,
    ouLine: null, ouBooks: null, ouFairFirst: null, ouFairSecond: null,
    ouVigPct: null, ouBestFirst: null, ouBestSecond: null,
    sourceFetchedAt: "2026-10-08T18:36:14.658Z",
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

beforeEach(() => {
  resetIsolation();
  expect(ensureBasketballFixtures(), "base de test non créée").toBe(true);
  expect(loadBasketballFixtures(), "isolation cassée — données de prod visibles").toHaveLength(0);
});
afterEach(() => {
  if (realDb === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = realDb;
  try { fs.rmSync(tmpDb, { force: true }); } catch { /* noop */ }
});

describe("basketball_fixtures — persistance", () => {
  test("création idempotente : deux appels ne cassent rien", () => {
    expect(ensureBasketballFixtures()).toBe(true);
    expect(ensureBasketballFixtures()).toBe(true);
    expect(loadBasketballFixtures()).toEqual([]);
  });

  test("upsert idempotent : rejouer le même dump ne crée pas de doublon", () => {
    const rows = [mk({ bsdEventId: 7504 }), mk({ bsdEventId: 7503, homeKey: "VAL" })];
    expect(upsertBasketballFixtures(rows)).toEqual({ written: 2, skipped: 0 });
    // Re-écriture du même cache : MAJE au lieu d'INSERT.
    expect(upsertBasketballFixtures(rows)).toEqual({ written: 2, skipped: 0 });
    expect(loadBasketballFixtures()).toHaveLength(2);
  });

  test("une ligne sans identité est refusée, pas inventée", () => {
    const r = mk({ bsdEventId: 0, homeKey: "" });
    const res = upsertBasketballFixtures([r]);
    expect(res.skipped).toBe(1);
    expect(loadBasketballFixtures()).toHaveLength(0);
  });

  test("scores des matchs terminés — les 2 scores annoncés par la mission", () => {
    // Référence : Dubaï 58-77, Maccabi 97-79.
    upsertBasketballFixtures([
      mk({ bsdEventId: 7505, league: "Euroleague", status: "finished",
           homeName: "BC Dubai", awayName: "KK Crvena zvezda",
           homeScore: 58, awayScore: 77 }),
      mk({ bsdEventId: 7500, league: "Euroleague", status: "finished",
           homeName: "Maccabi Tel Aviv", awayName: "EA7 Milano",
           homeScore: 97, awayScore: 79 }),
      mk({ bsdEventId: 7502, league: "Euroleague", status: "live",
           homeScore: 33, awayScore: 38 }),
    ]);
    applyBasketballResult(7505, "finished", 58, 77);
    applyBasketballResult(7500, "finished", 97, 79);

    const finis = loadBasketballFixtures({ status: "finished" });
    expect(finis).toHaveLength(2);
    const dubai = finis.find((f) => f.bsdEventId === 7505)!;
    const maccabi = finis.find((f) => f.bsdEventId === 7500)!;
    expect(`${dubai.homeScore}-${dubai.awayScore}`).toBe("58-77");
    expect(`${maccabi.homeScore}-${maccabi.awayScore}`).toBe("97-79");

    // Le live n'est PAS marqué finished : son état reste celui de la source.
    expect(loadBasketballFixtures({ status: "live" })).toHaveLength(1);
  });

  test("score absent ⇒ NULL, jamais 0", () => {
    // Un match à venir n'a pas de score. Un 0 afficherait « 0-0 ».
    upsertBasketballFixtures([mk({ bsdEventId: 1 })]);
    const r = loadBasketballFixtures()[0];
    expect(r.homeScore).toBeNull();
    expect(r.awayScore).toBeNull();
  });

  test("filtrage par ligue et statut", () => {
    upsertBasketballFixtures([
      mk({ bsdEventId: 1, league: "Euroleague" }),
      mk({ bsdEventId: 2, league: "NBA" }),
    ]);
    expect(loadBasketballFixtures({ league: "NBA" })).toHaveLength(1);
    expect(loadBasketballFixtures({ league: "NBA" })[0].bsdEventId).toBe(2);
  });
});

describe("basketballOpportunities — règles P4", () => {
  test("EV strictement > 0 seulement", () => {
    // Trois lignes, la règle sur chaque côté indépendamment :
    //   id1  dom 0.62×1.83 = +13.5 % ✓  |  ext 0.38×2.21 = −16.0 % ✗
    //   id2  dom 0.62×1.50 = −7.0 %  ✗  |  ext 0.38×3.00 = +14.0 % ✓
    //   id3  dom 0.62×1.61 = −0.2 %  ✗  |  ext 0.38×2.60 = −1.2 %  ✗
    // → 2 opportunités. id3 élimine la zone frontière : EV ≈ 0 n'est PAS
    //   strictement positif.
    upsertBasketballFixtures([
      mk({ bsdEventId: 1, probHome: 0.62, probAway: 0.38, mlOddsHome: 1.83, mlOddsAway: 2.21 }),
      mk({ bsdEventId: 2, probHome: 0.62, probAway: 0.38, mlOddsHome: 1.50, mlOddsAway: 3.00 }),
      mk({ bsdEventId: 3, probHome: 0.62, probAway: 0.38, mlOddsHome: 1.61, mlOddsAway: 2.60 }),
    ]);
    const o = basketballOpportunities();
    expect(o).toHaveLength(2);
    expect(o.every((x) => x.ev > 0)).toBe(true);

    // Le côté négatif n'est jamais retenu.
    expect(o.find((x) => x.bsdEventId === 1 && x.side === "away")).toBeUndefined();
    expect(o.find((x) => x.bsdEventId === 2 && x.side === "home")).toBeUndefined();
    // id3 : les deux côtés sous 0 → aucune entrée.
    expect(o.find((x) => x.bsdEventId === 3)).toBeUndefined();

    // Tri par EV décroissant : la meilleure valeur en tête.
    expect(o[0].ev).toBeGreaterThanOrEqual(o[1].ev);
  });

  test("ligue NON calibrée ⇒ aucune opportunité, même avec EV massif", () => {
    // Garde principale : sans σ de la ligue, on ne peut pas juger.
    upsertBasketballFixtures([
      mk({ bsdEventId: 9, league: "BBL", probHome: 0.9, probAway: 0.1,
           mlOddsHome: 5.0, mlOddsAway: 1.1 }),
    ]);
    expect(basketballOpportunities()).toHaveLength(0);
  });

  test("sans prédiction ⇒ aucune opportunité", () => {
    upsertBasketballFixtures([
      mk({ bsdEventId: 5, mlOddsHome: 3.0, mlOddsAway: 1.4 }),
    ]);
    expect(basketballOpportunities()).toHaveLength(0);
  });

  test("fort désaccord modèle/cote identifié et marqué (RM-Partizan)", () => {
    // Réel : modèle 38.5 % vs marché 21.9 % (cote 5.25) → ~16.6 pp
    upsertBasketballFixtures([
      mk({ bsdEventId: 7504, probHome: 0.615, probAway: 0.385,
           mlOddsHome: 1.25, mlOddsAway: 5.25 }),
    ]);
    const o = opps();
    expect(o.length).toBeGreaterThan(0);
    const away = o.find((x) => x.side === "away")!;
    expect(away.disagreementPp).toBeGreaterThan(12);
    expect(away.strongDisagreement).toBe(true);
    // Le côté domicile est négatif → exclu.
    expect(o.find((x) => x.side === "home")).toBeUndefined();
  });

  test("écart modéré (Baskonia réel) non marqué comme désaccord", () => {
    // Modèle 62.1 % vs cote 1.83 → fair 54.6 % → écart ~7.5 pp < 12
    upsertBasketballFixtures([
      mk({ bsdEventId: 7508, probHome: 0.621, probAway: 0.379,
           mlOddsHome: 1.83, mlOddsAway: 2.21 }),
    ]);
    const o = basketballOpportunities();
    expect(o).toHaveLength(1);
    expect(o[0].strongDisagreement).toBe(false);
    expect(o[0].ev).toBeCloseTo(0.1368, 3);
  });
});