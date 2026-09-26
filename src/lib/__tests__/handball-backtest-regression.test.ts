// Test de RÉGRESSION du walk-forward handball-backtest (Phase 5 du fix perf
// 2026-09-25 : forme incrémentale partagée au lieu d'un buildFormStore par
// match × stratégie). Golden figé AVANT l'optimisation — toute divergence de
// règlement (nBets/wins/profit/ROI/Kelly/curve) fait échouer ce test.
import { describe, test, expect } from "bun:test";
import { runHandballBacktest } from "../handball-backtest";
import type { HandballMatch } from "../handball-data";

/** Fixture déterministe (60 matchs, ids/soles/halves fixes — pas de Math.random). */
function fixture(): HandballMatch[] {
  const matches: HandballMatch[] = [];
  for (let i = 0; i < 60; i++) {
    const homeId = 1 + (i % 8);
    const awayId = 1 + ((i + 3) % 8);
    const hg = 24 + ((i * 7) % 17); // 24..40
    const ag = 22 + ((i * 5) % 15); // 22..36
    matches.push({
      id: 1000 + i,
      league: { id: 1, name: "France: Starligue", country: "France", countryCode: "FR" },
      home: { id: homeId, name: `Team${homeId}` },
      away: { id: awayId, name: `Team${awayId}` },
      kickoff: new Date(Date.UTC(2026, 8, 1, 16, 0) + i * 3_600_000).toISOString(),
      status: "finished",
      score: { home: hg, away: ag, homeHalf: Math.floor(hg / 2), awayHalf: Math.floor(ag / 2) },
      odds: { home: 1.5, draw: 9, away: 3.5 },
    });
  }
  return matches;
}

type Golden = {
  key: string;
  nBets: number;
  wins: number;
  hitRate: number;
  profitU: number;
  roiPct: number;
  profitKellyU: number;
  curveLen: number;
};

// Golden capturé AVANT l'optimisation (valeurs figées ici — script jetable supprimé)
const GOLDEN: Golden[] = [
  { key: "over55", nBets: 60, wins: 42, hitRate: 0.7, profitU: 19.8, roiPct: 33, profitKellyU: 88.18, curveLen: 60 },
  { key: "under62", nBets: 60, wins: 43, hitRate: 0.7166666666666667, profitU: 19.55, roiPct: 32.583333333333336, profitKellyU: 93.5, curveLen: 60 },
  { key: "bestTeam1x2", nBets: 57, wins: 21, hitRate: 0.3684210526315789, profitU: -24.45, roiPct: -42.89473684210526, profitKellyU: 0, curveLen: 57 },
  { key: "htLeader", nBets: 57, wins: 18, hitRate: 0.3157894736842105, profitU: -26.4, roiPct: -46.31578947368421, profitKellyU: 0, curveLen: 57 },
  { key: "bestTeam", nBets: 57, wins: 19, hitRate: 0.3333333333333333, profitU: -27.55, roiPct: -48.333333333333336, profitKellyU: 0, curveLen: 57 },
  { key: "valueBet", nBets: 24, wins: 8, hitRate: 0.3333333333333333, profitU: -11.6, roiPct: -48.333333333333336, profitKellyU: -3.03, curveLen: 24 },
  { key: "handicap", nBets: 57, wins: 14, hitRate: 0.24561403508771928, profitU: -30.4, roiPct: -53.333333333333336, profitKellyU: 0, curveLen: 57 },
  { key: "btts30", nBets: 60, wins: 12, hitRate: 0.2, profitU: -38.4, roiPct: -64, profitKellyU: 0, curveLen: 60 },
];

const GOLDEN_GLOBAL = {
  nBets: 432,
  wins: 177,
  hitRate: 0.4097222222222222,
  profitU: -119.45,
  roiPct: -27.650462962962962,
  curveLen: 432,
};

describe("runHandballBacktest — golden de régression (walk-forward)", () => {
  const result = runHandballBacktest(fixture(), "all");

  test("chaque stratégie : nBets, wins, hitRate, profit flat, ROI, Kelly, longueur de courbe", () => {
    for (const g of GOLDEN) {
      const row = result.strategies.find((s) => s.key === g.key);
      expect(row, `stratégie ${g.key} absente`).toBeDefined();
      expect(row!.nBets, `${g.key}.nBets`).toBe(g.nBets);
      expect(row!.wins, `${g.key}.wins`).toBe(g.wins);
      expect(row!.hitRate, `${g.key}.hitRate`).toBeCloseTo(g.hitRate, 10);
      expect(row!.profitU, `${g.key}.profitU`).toBeCloseTo(g.profitU, 6);
      expect(row!.roiPct, `${g.key}.roiPct`).toBeCloseTo(g.roiPct, 6);
      expect(row!.profitKellyU, `${g.key}.profitKellyU`).toBeCloseTo(g.profitKellyU, 2);
      expect(row!.curve.length, `${g.key}.curve`).toBe(g.curveLen);
    }
  });

  test("global : agrégat identique (432 paris, profit −119.45 u)", () => {
    expect(result.global.nBets).toBe(GOLDEN_GLOBAL.nBets);
    expect(result.global.wins).toBe(GOLDEN_GLOBAL.wins);
    expect(result.global.hitRate).toBeCloseTo(GOLDEN_GLOBAL.hitRate, 10);
    expect(result.global.profitU).toBeCloseTo(GOLDEN_GLOBAL.profitU, 6);
    expect(result.global.roiPct).toBeCloseTo(GOLDEN_GLOBAL.roiPct, 6);
    expect(result.global.curve.length).toBe(GOLDEN_GLOBAL.curveLen);
  });

  test("tri ROI décroissant préservé", () => {
    const rois = result.strategies.map((s) => s.roiPct ?? Number.NEGATIVE_INFINITY);
    for (let i = 1; i < rois.length; i++) expect(rois[i]).toBeLessThanOrEqual(rois[i - 1] + 1e-9);
  });
});
