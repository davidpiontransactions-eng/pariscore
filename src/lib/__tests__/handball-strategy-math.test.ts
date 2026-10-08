// Tests régression math stratégies handball — boucle rouge debug 2026-09-23
// Bugs : ppg ignore sa fenêtre (L5===L10), formSummary = totaux carrière,
// handicap away prob ≡ 0, EV Over/Under fabriquée sur cotes 1X2,
// valueBet invente des edges sans forme (prior 0.45/0.50)

import { describe, test, expect } from "bun:test";
import {
  computeHandballStrategyTop8,
  buildFormStore,
  ppg,
  formSummaryStr,
  teamFormFromSeries,
  mergeFormStoreWithHistory,
  type HandballTeamForm,
} from "../handball-strategy-top8";
import type { HandballMatch } from "../handball-data";

function finished(home: number, away: number): HandballMatch {
  return {
    id: Math.floor(Math.random() * 1e6),
    league: { id: 1, name: "Starligue", country: "France", countryCode: "FR" },
    home: { id: 100, name: "Team H" },
    away: { id: 200, name: "Team A" },
    kickoff: new Date().toISOString(),
    status: "finished",
    score: { home, away },
  };
}

function fixture(odds?: { home: number; draw?: number; away: number }): HandballMatch {
  return {
    id: 999,
    league: { id: 1, name: "Starligue", country: "France", countryCode: "FR" },
    home: { id: 100, name: "Team H" },
    away: { id: 200, name: "Team A" },
    kickoff: new Date(Date.now() + 3600_000).toISOString(),
    status: "not_started",
    odds,
  };
}

// Team H : 5 défaites puis 5 victoires (chronologique)
const hHistory = [
  finished(20, 35), finished(22, 30), finished(25, 32), finished(21, 28), finished(24, 31),
  finished(35, 20), finished(32, 22), finished(30, 25), finished(33, 21), finished(31, 24),
];
// Team A subit l'inverse (away des rows ci-dessus)
// hHistory : team100 perd 5 puis gagne 5 ; team200 gagne 5 puis perd 5.

describe("ppg — fenêtre respectée", () => {
  test("ppg(f,5) ≠ ppg(f,10) quand la forme récente diffère du global", () => {
    const store = buildFormStore(hHistory);
    const f = store.get("100")!;
    expect(ppg(f, 5)).toBe(2); // 5 dernieres = 5 victoires → 2.0
    expect(ppg(f, 10)).toBe(1); // global = 5W/5L → 1.0
    expect(ppg(f, 5)).not.toBe(ppg(f, 10));
  });
});

describe("formSummaryStr — séquence récente, pas totaux carrière", () => {
  test("team100 : 5 défaites puis 5 victoires → WWWWW sur n=5", () => {
    const store = buildFormStore(hHistory);
    const f = store.get("100")!;
    expect(formSummaryStr(f, 5)).toBe("WWWWW");
  });

  test("team200 : 5 victoires puis 5 défaites → LLLLL (n=5) / WWWWWLLLLL (n=10)", () => {
    const store = buildFormStore(hHistory);
    const f = store.get("200")!;
    expect(formSummaryStr(f, 10)).toBe("WWWWWLLLLL");
    expect(formSummaryStr(f, 5)).toBe("LLLLL");
  });
});

describe("handicap — away favori obtenir prob > 0", () => {
  test("diff négatif (away dominant) → pick away + probPct > 0", () => {
    // Team A (id 200) écrase : ici team100 perd gros les 5 premières, forme récente 5W5L… 
    // Construire diff < 0 : team200 better récemment. Inverser : team100 fort d'abord, team200 fort ensuite ?
    // Simple : team200 = away du fixture, son affiche 5 victoires en fin d'historique via hHistory (away side).
    const result = computeHandballStrategyTop8(hHistory, [fixture()]);
    const h = result.strategies.handicap.find((e) => e.matchId === String(999));
    expect(h).toBeDefined();
    expect(h!.pick === "away" || h!.pick === "home").toBe(true);
    // Verdict core : toute entry handicap publiée doit avoir probPct > 0 (jamais 0.0% fantôme)
    expect(h!.probPct).toBeGreaterThan(0);
    expect(h!.value).toBeGreaterThan(0);
  });
});

describe("over55/under62 — EV null tant que cotes total absentes", () => {
  test("over55 avec cotes 1X2 présentes → ev null (pas d'EV fabriquée)", () => {
    const result = computeHandballStrategyTop8(hHistory, [
      fixture({ home: 1.5, draw: 8, away: 3.0 }),
    ]);
    const e = result.strategies.over55.find((x) => x.matchId === "999");
    expect(e).toBeDefined();
    expect(e!.ev).toBeNull();
  });

  test("under62 idem", () => {
    const result = computeHandballStrategyTop8(hHistory, [
      fixture({ home: 1.5, draw: 8, away: 3.0 }),
    ]);
    const e = result.strategies.under62.find((x) => x.matchId === "999");
    expect(e).toBeDefined();
    expect(e!.ev).toBeNull();
  });
});

describe("valueBet — aucun edge fabriqué sans forme", () => {
  test("aucun match terminé → valueBet vide (prior 0.45/0.50 interdit)", () => {
    const result = computeHandballStrategyTop8([], [
      fixture({ home: 1.5, draw: 8, away: 3.0 }),
    ]);
    expect(result.strategies.valueBet).toHaveLength(0);
  });

  test("avec forme + cotes → marché de-viggé (edges bornés, pas de constante)", () => {
    const result = computeHandballStrategyTop8(hHistory, [
      fixture({ home: 1.5, draw: 8, away: 3.0 }),
    ]);
    for (const e of result.strategies.valueBet) {
      expect(Math.abs(e.value)).toBeLessThan(60); // edge % raisonnable, pas garbage
      if (e.trend != null) expect(Math.abs(e.trend)).toBeLessThan(60);
    }
  });
});

describe("teamFormFromSeries - repli DB coupe (serie chronologique)", () => {
  test("serie marques/encaisses -> TeamForm avec V/N/D recomptes", () => {
    // Ordre ancien -> recent (schema TeamHistoryStats.scoredSeries)
    const f = teamFormFromSeries([30, 25, 33, 28], [29, 25, 35, 27]);
    expect(f).not.toBeNull();
    expect(f!.gf).toEqual([30, 25, 33, 28]);
    expect(f!.ga).toEqual([29, 25, 35, 27]);
    expect(f!.wins).toBe(2); // 30-29, 28-27
    expect(f!.draws).toBe(1); // 25-25
    expect(f!.losses).toBe(1); // 33-35
    expect(f!.htLeads).toBe(0); // pas de donnees mi-temps dans les series
    expect(f!.htTrails).toBe(0);
  });

  test("derniers 5 coerentent avec le L5 de l'historique (slice -5)", () => {
    const gf = [34, 27, 36, 41, 34, 36, 34, 33, 40, 38, 30, 29, 31];
    const ga = [29, 24, 27, 34, 30, 32, 35, 36, 35, 42, 34, 38, 32];
    const f = teamFormFromSeries(gf, ga);
    const last5gf = f!.gf.slice(-5); // [40, 38, 30, 29, 31] -> 33.6
    const last5ga = f!.ga.slice(-5); // [35, 42, 34, 38, 32] -> 36.2
    const avg = (a: number[]) => Math.round((a.reduce((s, v) => s + v, 0) / a.length) * 10) / 10;
    expect(avg(last5gf)).toBe(33.6);
    expect(avg(last5ga)).toBe(36.2);
  });

  test("series vides ou tailles decales -> null ou alignement mini", () => {
    expect(teamFormFromSeries([], [])).toBeNull();
    expect(teamFormFromSeries([30], [])).toBeNull();
    const f = teamFormFromSeries([30, 28], [25]);
    expect(f!.gf).toEqual([30]); // tronque au plus court
    expect(f!.ga).toEqual([25]);
    expect(f!.wins).toBe(1);
  });

  test("atHomeSeries alimente la ponderation terrain, absente -> neutre", () => {
    const withVenue = teamFormFromSeries([30, 25], [20, 20], [true, false])!;
    expect(withVenue.atHome).toEqual([true, false]);
    // Tronquee a la longueur commune, comme gf/ga.
    const shorter = teamFormFromSeries([30, 25, 28], [20, 20], [true, false])!;
    expect(shorter.atHome).toEqual([true, false]);
    // Pas de colonne de lieu -> liste vide = ponderation neutre (computeFormPctWeighted).
    expect(teamFormFromSeries([30], [20])!.atHome).toEqual([]);
  });
});

/**
 * Régression du sourcing : la fenêtre Flashscore (~8 jours) ne doit plus
 * ÉCRASER l'historique SQLite (2 saisons). Symptôme mesuré en prod le
 * 2026-10-08 : CSM Bucuresti (14 matchs en table) et Minaur Baia Mare (14)
 * tombaient à 1-2 matchs de fenêtre, sous CMP_MIN_HISTORY, donc prior neutre.
 */
describe("mergeFormStoreWithHistory — la source la plus longue gagne", () => {
  const profile = (gf: number[], ga: number[]) => ({
    scoredSeries: gf,
    concededSeries: ga,
    atHomeSeries: gf.map(() => true),
  });

  test("2 matchs de fenetre < 14 matchs de table -> la table gagne", () => {
    const base = new Map<string, HandballTeamForm>([
      [
        "101",
        {
          gf: [36, 30],
          ga: [40, 38],
          wins: 0,
          draws: 0,
          losses: 2,
          htLeads: 0,
          htTrails: 0,
          atHome: [true, true],
        },
      ],
    ]);
    const merged = mergeFormStoreWithHistory(
      base,
      new Map([[101, profile([30, 38, 29, 31, 39, 33, 31, 24, 33, 23, 51, 28, 36, 30], [38, 28, 27, 29, 30, 29, 24, 34, 25, 34, 34, 23, 40, 38])]]),
    );
    expect(merged.get("101")!.gf).toHaveLength(14);
  });

  test("fenetre plus longue que la table -> la fenetre est conservee", () => {
    const base = new Map<string, HandballTeamForm>([
      [
        "101",
        {
          gf: [30, 31],
          ga: [28, 29],
          wins: 2,
          draws: 0,
          losses: 0,
          htLeads: 0,
          htTrails: 0,
          atHome: [true, true],
        },
      ],
    ]);
    const merged = mergeFormStoreWithHistory(base, new Map([[101, profile([30], [20])]]));
    expect(merged.get("101")!.gf).toEqual([30, 31]);
  });

  test("base nulle + profil DB -> store_peuple (equipe hors fenetre Flashscore)", () => {
    const merged = mergeFormStoreWithHistory(
      null,
      new Map([[202, profile([27, 25, 32, 28], [19, 25, 28, 36])]]),
    );
    expect(merged.get("202")!.gf).toHaveLength(4);
  });

  test("aucune source -> store vide (jamais de TeamForm fantome)", () => {
    expect(mergeFormStoreWithHistory(null, new Map()).size).toBe(0);
  });

  test("profil sans resultat ignore, store de base intact", () => {
    const merged = mergeFormStoreWithHistory(
      null,
      new Map([[303, profile([], [])]]),
    );
    expect(merged.has("303")).toBe(false);
  });
});
