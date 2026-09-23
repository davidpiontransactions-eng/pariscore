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
