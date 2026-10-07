import { describe, expect, test } from "bun:test";
import { buildMontante, requiredOddsForTarget, requiredStakeForTarget, tradeoffTable } from "../bet-manager/calculators";

/** capital 200 €, +20 %/j, 50 % banque, 20 % engagé, 11 paris, q = 50 %, 30 j depuis le 02/10/2026. */
const BASE = {
  capital: 200,
  days: 30,
  targetPct: 20,
  bankPct: 50,
  stakePct: 20,
  maxBets: 11,
  winProb: 0.5,
  startDate: "2026-10-02",
};

describe("montante — inversion mise/cote", () => {
  test("requiredOddsForTarget : stake x (O - 1) = target", () => {
    expect(requiredOddsForTarget(40, 40)).toBeCloseTo(2, 6);
    expect(requiredOddsForTarget(40, 20)).toBeCloseTo(3, 6);
    expect(requiredOddsForTarget(40, 80)).toBeCloseTo(1.5, 6);
  });

  test("requiredStakeForTarget : mise exacte pour une cote donnée", () => {
    expect(requiredStakeForTarget(40, 2)).toBeCloseTo(40, 6);
    expect(requiredStakeForTarget(40, 3)).toBeCloseTo(20, 6);
    expect(requiredStakeForTarget(40, 1.5)).toBeCloseTo(80, 6);
  });

  test("les deux fonctions sont inverses l'une de l'autre", () => {
    for (const stake of [5, 10, 20, 40, 80, 200]) {
      const odds = requiredOddsForTarget(40, stake)!;
      expect(requiredStakeForTarget(40, odds)!).toBeCloseTo(stake, 1);
    }
  });

  test("bornes : stake nulle et cote ≤ 1 renvoient null (pas de division infinie)", () => {
    expect(requiredOddsForTarget(40, 0)).toBeNull();
    expect(requiredOddsForTarget(40, -10)).toBeNull();
    expect(requiredStakeForTarget(40, 1)).toBeNull();
    expect(requiredStakeForTarget(40, 0.8)).toBeNull();
  });
});

describe("montante — progression composée", () => {
  const steps = buildMontante(BASE);

  test("30 paliers, du 02/10 au 31/10/2026", () => {
    expect(steps).toHaveLength(30);
    expect(steps[0].date).toBe("2026-10-02");
    expect(steps[29].date).toBe("2026-10-31");
  });

  test("palier 1 : 200 € → gain visé 40 €, 20 € banque, 220 € capital", () => {
    const s = steps[0];
    expect(s.capitalStart).toBe(200);
    expect(s.target).toBe(40);
    expect(s.toBank).toBe(20);
    expect(s.reinvest).toBe(20);
    expect(s.capitalEnd).toBe(220);
    expect(s.bankCum).toBe(20);
    expect(s.total).toBe(240);
  });

  test("capital final 3489,70 € et banque 3289,78 € après 30 paliers", () => {
    const last = steps[29];
    expect(last.capitalEnd).toBe(3489.7);
    expect(last.bankCum).toBe(3289.78);
    expect(last.total).toBe(6779.48);
  });

  test("l'écart au modèle composé pur reste négligeable (−0,18 € = 0,005 %)", () => {
    // Chaque cible quotidienne est arrondie au centime pour que le tableau soit
    // vérifiable à la main. La troncature cumulée coûte 0,18 € à 30 j.
    const pure = BASE.capital * Math.pow(1 + BASE.targetPct / 100 * (1 - BASE.bankPct / 100), 30);
    expect(pure).toBeCloseTo(3489.88, 2);
    expect(steps[29].capitalEnd - pure).toBeCloseTo(-0.18, 2);
  });

  test("chaque palier se décompose exactement : banque + réinvesti = gain visé", () => {
    for (const s of steps) {
      expect(Math.round((s.toBank + s.reinvest) * 100) / 100).toBe(s.target);
      expect(Math.round((s.capitalStart + s.reinvest) * 100) / 100).toBe(s.capitalEnd);
    }
  });

  test("la somme des gains visés vaut la banque cumulée ×2 (à 10 centimes près)", () => {
    const sum = steps.reduce((a, s) => a + s.target, 0);
    expect(Math.round(sum * 100) / 100).toBe(6579.48);
    expect(sum).toBeCloseTo(steps[29].bankCum * 2, 0);
  });

  test("chaque palier repart EXACTEMENT du capital affiché au palier précédent", () => {
    for (let i = 1; i < steps.length; i++) {
      // Invariant le plus important pour un lecteur qui vérifie le tableau à la main :
      // la fin d'un palier est le début du suivant, au centime exact.
      expect(steps[i].capitalStart).toBe(steps[i - 1].capitalEnd);
      expect(steps[i].capitalStart).toBeCloseTo(steps[i - 1].capitalStart + steps[i - 1].reinvest, 2);
      expect(steps[i].bankCum).toBeCloseTo(steps[i - 1].bankCum + steps[i].toBank, 2);
    }
  });

  test("capital final − banque cumulée = capital de départ (±0,08 € sur 30 paliers)", () => {
    // 2 x round(x/2) peut différer de x d'un demi-centime : la dérive est bornée.
    let maxDrift = 0;
    for (const s of steps) maxDrift = Math.max(maxDrift, Math.abs(s.capitalEnd - s.bankCum - BASE.capital));
    expect(maxDrift).toBeLessThanOrEqual(0.1);
  });
});

describe("montante — mise et cote du jour", () => {
  const steps = buildMontante(BASE);

  test("mise engagée = 20 % du capital du jour, cote requise = 2,00 (invariant au taux d'engagement)", () => {
    for (const s of steps) {
      expect(s.stake).toBeCloseTo(Math.round(s.capitalStart * 0.2 * 100) / 100, 1);
      expect(s.requiredOdds).toBeCloseTo(2, 4);
    }
  });

  test("palier 1 : 40 € engagés, 3,64 € par pari, 3,64 € de gain visé par pari", () => {
    const s = steps[0];
    expect(s.stake).toBe(40);
    expect(s.perBet).toBeCloseTo(3.64, 2);
    expect(s.perBetTarget).toBeCloseTo(3.64, 2);
    expect(s.neutralOdds).toBe(2);
  });

  test("palier 30 : 634,49 € de gain visé → 57,68 € par pari", () => {
    const s = steps[29];
    expect(s.target).toBeCloseTo(634.49, 2);
    expect(s.perBetTarget).toBeCloseTo(57.68, 2);
  });

  test("mise et gain visé par pari divergent dès que l'engagement ≠ l'objectif", () => {
    const s = buildMontante({ ...BASE, stakePct: 10 })[0];
    expect(s.stake).toBe(20);
    expect(s.requiredOdds).toBeCloseTo(3, 4);
    expect(s.perBet).toBeCloseTo(1.82, 2); // 20 / 11
    expect(s.perBetTarget).toBeCloseTo(3.64, 2); // 40 / 11
  });

  test("cote d'espérance nulle = 1 / q", () => {
    expect(buildMontante({ ...BASE, winProb: 0.4 })[0].neutralOdds).toBe(2.5);
    expect(buildMontante({ ...BASE, winProb: 0.6 })[0].neutralOdds).toBeCloseTo(1.6667, 3);
    expect(buildMontante({ ...BASE, winProb: 0 })[0].neutralOdds).toBeNull();
  });
});

describe("montante — table d'arbitrage", () => {
  test("cible 20 % du capital : 5 %→5,00 · 10 %→3,00 · 20 %→2,00 · 100 %→1,20", () => {
    const t = tradeoffTable(200, 20, [5, 10, 20, 100]);
    expect(t[0].odds).toBeCloseTo(5, 4);
    expect(t[1].odds).toBeCloseTo(3, 4);
    expect(t[2].odds).toBeCloseTo(2, 4);
    expect(t[3].odds).toBeCloseTo(1.2, 4);
  });

  test("la mise affichée est bien capital x pct", () => {
    const t = tradeoffTable(200, 20, [5, 10, 20, 40, 100]);
    expect(t.map(x => x.stake)).toEqual([10, 20, 40, 80, 200]);
  });
});

describe("montante — cas limites", () => {
  test("engagement 0 % → cote requise null, pas Infinity", () => {
    const s = buildMontante({ ...BASE, stakePct: 0 })[0];
    expect(s.stake).toBe(0);
    expect(s.requiredOdds).toBeNull();
  });

  test("jours et paris bornés à un minimum de 1", () => {
    expect(buildMontante({ ...BASE, days: 0, maxBets: 0 })).toHaveLength(1);
    expect(buildMontante({ ...BASE, days: -5 })).toHaveLength(1);
    expect(buildMontante({ ...BASE, days: 1, maxBets: 1 })[0].perBet).toBeCloseTo(40, 2);
  });

  test("banque 100 % : tout part en banque, le capital ne bouge pas", () => {
    const steps = buildMontante({ ...BASE, bankPct: 100 });
    for (const s of steps) expect(s.reinvest).toBe(0);
    expect(steps[0].capitalEnd).toBe(200);
    expect(steps[0].bankCum).toBe(40);
  });

  test("objectif 0 % : progression plate", () => {
    const steps = buildMontante({ ...BASE, targetPct: 0 });
    expect(steps[29].capitalEnd).toBe(200);
    expect(steps[29].bankCum).toBe(0);
  });
});