// Backtest quotidien des stratégies handball — filtre de jour Europe/Paris,
// anti-lookahead (forme antérieure au coup d'envoi) et règlement par marché.

import { describe, test, expect } from "bun:test";
import {
  computeDailyStrategyBacktest,
  parisDateOf,
  type DailyStrategyRow,
} from "../handball-backtest-today";
import type { HandballMatch } from "../handball-data";

// ─── Fixtures ───

const LIGUE = { id: 1, name: "Starligue", country: "France", countryCode: "FR" };

const team = (id: number, name: string) => ({ id, name, shortName: name });

type MatchSpec = {
  id: number;
  home: { id: number; name: string; shortName?: string };
  away: { id: number; name: string; shortName?: string };
  kickoff: string;
  homeScore: number;
  awayScore: number;
  ht?: [number, number];
  status?: "finished" | "not_started";
};

function mkMatch(spec: MatchSpec): HandballMatch {
  const score: HandballMatch["score"] = {
    home: spec.homeScore,
    away: spec.awayScore,
  };
  if (spec.ht) {
    score!.homeHalf = spec.ht[0];
    score!.awayHalf = spec.ht[1];
  }
  return {
    id: spec.id,
    league: LIGUE,
    home: spec.home,
    away: spec.away,
    kickoff: spec.kickoff,
    status: spec.status ?? "finished",
    score,
  };
}

const A = team(1, "Alpha");
const B = team(2, "Beta");
const C = team(3, "Gamma");
const D = team(4, "Delta");
const X = team(5, "X-ray");
const Y = team(6, "Yankee");
const P = team(7, "Papa");
const Q = team(8, "Quebec");

/** 12 matchs terminés la veille : A/C 3 victoires, B/D 3 défaites (forme CMP complète). */
function priorDayMatches(): HandballMatch[] {
  return [
    mkMatch({ id: 101, home: A, away: X, kickoff: "2026-03-09T17:00:00.000Z", homeScore: 30, awayScore: 20, ht: [15, 9] }),
    mkMatch({ id: 102, home: Y, away: A, kickoff: "2026-03-09T18:00:00.000Z", homeScore: 22, awayScore: 28, ht: [10, 14] }),
    mkMatch({ id: 103, home: A, away: P, kickoff: "2026-03-09T19:00:00.000Z", homeScore: 26, awayScore: 24, ht: [13, 11] }),
    mkMatch({ id: 104, home: X, away: B, kickoff: "2026-03-09T17:00:00.000Z", homeScore: 30, awayScore: 20, ht: [15, 9] }),
    mkMatch({ id: 105, home: Y, away: B, kickoff: "2026-03-09T18:00:00.000Z", homeScore: 28, awayScore: 22, ht: [14, 10] }),
    mkMatch({ id: 106, home: P, away: B, kickoff: "2026-03-09T19:00:00.000Z", homeScore: 26, awayScore: 24, ht: [13, 11] }),
    mkMatch({ id: 107, home: C, away: Q, kickoff: "2026-03-09T17:00:00.000Z", homeScore: 31, awayScore: 19, ht: [16, 8] }),
    mkMatch({ id: 108, home: C, away: X, kickoff: "2026-03-09T18:00:00.000Z", homeScore: 29, awayScore: 21, ht: [14, 10] }),
    mkMatch({ id: 109, home: C, away: P, kickoff: "2026-03-09T19:00:00.000Z", homeScore: 27, awayScore: 23, ht: [13, 12] }),
    mkMatch({ id: 110, home: Q, away: D, kickoff: "2026-03-09T17:00:00.000Z", homeScore: 30, awayScore: 20, ht: [15, 9] }),
    mkMatch({ id: 111, home: Y, away: D, kickoff: "2026-03-09T18:00:00.000Z", homeScore: 28, awayScore: 22, ht: [14, 10] }),
    mkMatch({ id: 112, home: P, away: D, kickoff: "2026-03-09T19:00:00.000Z", homeScore: 26, awayScore: 24, ht: [13, 11] }),
  ];
}

/** Matchs du jour : m1 nul (25-25) avec MT, m2 63 buts SANS MT (→ void htLeader). */
function dayMatches(): HandballMatch[] {
  return [
    mkMatch({ id: 201, home: A, away: B, kickoff: "2026-03-10T17:00:00.000Z", homeScore: 25, awayScore: 25, ht: [12, 11] }),
    mkMatch({ id: 202, home: C, away: D, kickoff: "2026-03-10T19:00:00.000Z", homeScore: 33, awayScore: 30 }),
  ];
}

const rowOf = (rows: DailyStrategyRow[], key: string) =>
  rows.find((r) => r.strategy === key)!;

// ─── parisDateOf (fuseau Europe/Paris, DST inclus) ───

describe("parisDateOf", () => {
  test("hiver (CET, UTC+1) bascule sur le jour suivant après 23:00 locales", () => {
    expect(parisDateOf("2026-01-15T22:00:00Z")).toBe("2026-01-15"); // 23:00 CET
    expect(parisDateOf("2026-01-15T23:30:00Z")).toBe("2026-01-16"); // 00:30 CET
  });

  test("été (CEST, UTC+2) bascule après 22:00 locales", () => {
    expect(parisDateOf("2026-07-15T20:59:00Z")).toBe("2026-07-15"); // 22:59 CEST
    expect(parisDateOf("2026-07-15T22:30:00Z")).toBe("2026-07-16"); // 00:30 CEST
  });

  test("date invalide → chaîne vide (match exclu des filtres du jour)", () => {
    expect(parisDateOf("pas-une-date")).toBe("");
  });
});

// ─── computeDailyStrategyBacktest ───

describe("computeDailyStrategyBacktest", () => {
  const all = [...priorDayMatches(), ...dayMatches()];

  test("ne retient que les matchs terminés du jour cible", () => {
    const r = computeDailyStrategyBacktest(all, { date: "2026-03-10" });
    expect(r.date).toBe("2026-03-10");
    expect(r.timezone).toBe("Europe/Paris");
    expect(r.nFinishedToday).toBe(2);
    expect(r.strategies).toHaveLength(8);
    // Les 12 matchs de la veille servent uniquement de forme, jamais de paris
    for (const row of r.strategies) {
      expect(row.picks.every((p) => p.match.id === 201 || p.match.id === 202)).toBe(true);
    }
  });

  test("forme walk-forward : sans match antérieur, aucune stratégie de forme ne parie", () => {
    // Anti-lookahead : les picks du jour ne peuvent pas s'appuyer sur leur propre résultat
    const r = computeDailyStrategyBacktest(dayMatches(), { date: "2026-03-10" });
    expect(r.nFinishedToday).toBe(2);
    for (const key of ["bestTeam", "bestTeam1x2", "btts30", "htLeader", "valueBet"]) {
      expect(rowOf(r.strategies, key).nBets).toBe(0);
    }
    expect(rowOf(r.strategies, "bestTeam").note).toBe("Aucun signal sur les matchs du jour (forme insuffisante)");
  });

  test("règlement 1X2 : nul = perdu (m1 25-25), victoire = gagné (m2 33-30)", () => {
    const r = computeDailyStrategyBacktest(all, { date: "2026-03-10" });
    const row = rowOf(r.strategies, "bestTeam");
    expect(row.nBets).toBe(2);
    expect(row.won).toBe(1);
    expect(row.lost).toBe(1);
    expect(row.picks.find((p) => p.match.id === 201)?.result).toBe("lost");
    expect(row.picks.find((p) => p.match.id === 202)?.result).toBe("won");
    // Profit flat 1u @1.55 : +0.55 puis -1 → -0.45u, ROI -22.5 %
    expect(row.profitU).toBeCloseTo(-0.45, 2);
    expect(row.roiPct).toBeCloseTo(-22.5, 1);
    expect(row.hitRate).toBe(50);
  });

  test("totaux : Over 55.5 et Under 62.5 réglés sur le total (50 / 63)", () => {
    const r = computeDailyStrategyBacktest(all, { date: "2026-03-10" });
    const over = rowOf(r.strategies, "over55");
    expect(over.picks.map((p) => p.result)).toEqual(["lost", "won"]); // 50 ≤ 55.5, 63 > 55.5
    expect(over.profitU).toBeCloseTo(-0.1, 2); // -1 + 0.90
    const under = rowOf(r.strategies, "under62");
    expect(under.picks.map((p) => p.result)).toEqual(["won", "lost"]); // 50 < 62.5, 63 ≥ 62.5
    expect(under.profitU).toBeCloseTo(-0.15, 2); // +0.85 - 1
  });

  test("BTTS 30+ : m1 (25/25) perdu, m2 (33/30) gagné", () => {
    const r = computeDailyStrategyBacktest(all, { date: "2026-03-10" });
    const btts = rowOf(r.strategies, "btts30");
    expect(btts.picks.map((p) => p.result)).toEqual(["lost", "won"]);
    expect(btts.profitU).toBeCloseTo(-0.2, 2); // -1 + 0.80
  });

  test("handicap -4.5 : écart 0 (m1) et 3 (m2) → les deux perdus", () => {
    const r = computeDailyStrategyBacktest(all, { date: "2026-03-10" });
    const hc = rowOf(r.strategies, "handicap");
    expect(hc.nBets).toBe(2);
    expect(hc.lost).toBe(2);
    expect(hc.roiPct).toBe(-100);
  });

  test("leader MT : m1 gagné (MT 12-11 côté pick), m2 annulé (MT absente)", () => {
    const r = computeDailyStrategyBacktest(all, { date: "2026-03-10" });
    const ht = rowOf(r.strategies, "htLeader");
    expect(ht.nBets).toBe(1);
    expect(ht.won).toBe(1);
    expect(ht.voids).toBe(1);
    expect(ht.picks.find((p) => p.match.id === 202)?.result).toBe("void");
    expect(ht.profitU).toBeCloseTo(0.7, 2); // +0.70 @1.70, l'annulé ne compte pas
    expect(ht.roiPct).toBeCloseTo(70, 1);
  });

  test("cohérence des totaux (nBets = won + lost, profit = somme des picks)", () => {
    const r = computeDailyStrategyBacktest(all, { date: "2026-03-10" });
    for (const row of r.strategies) {
      expect(row.nBets).toBe(row.won + row.lost);
      expect(row.picks.length).toBe(row.nBets + row.voids);
      const sum = Math.round(row.picks.reduce((n, p) => n + p.profitU, 0) * 100) / 100;
      expect(row.profitU).toBeCloseTo(sum, 2);
      if (row.nBets === 0) expect(row.roiPct).toBeNull();
    }
    const g = r.global;
    expect(g.nBets).toBe(r.strategies.reduce((n, s) => n + s.nBets, 0));
    expect(g.profitU).toBeCloseTo(
      Math.round(r.strategies.reduce((n, s) => n + s.profitU, 0) * 100) / 100,
      2,
    );
    expect(g.voids).toBe(r.strategies.reduce((n, s) => n + s.voids, 0));
  });

  test("sans match terminé du jour : lignes vides avec note, ROI null", () => {
    const r = computeDailyStrategyBacktest(all, { date: "2026-03-11" });
    expect(r.nFinishedToday).toBe(0);
    expect(r.global.nBets).toBe(0);
    expect(r.global.roiPct).toBeNull();
    for (const row of r.strategies) {
      expect(row.nBets).toBe(0);
      expect(row.note).toBe("Aucun match terminé aujourd'hui");
    }
  });

  test("jour par défaut = aujourd'hui Europe/Paris (param now injectable)", () => {
    const r = computeDailyStrategyBacktest(all, { now: new Date("2026-03-10T20:00:00Z") });
    expect(r.date).toBe("2026-03-10"); // 21:00 CET
    expect(r.nFinishedToday).toBe(2);
  });
});
