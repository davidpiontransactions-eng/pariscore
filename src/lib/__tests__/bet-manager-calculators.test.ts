import { describe, expect, test } from "bun:test";
import { promoConversion, stakingPlans } from "../bet-manager/calculators";
import type { Bet } from "../bet-manager/types";

const bet = (over: Partial<Bet>): Bet => ({
  id: "b1",
  bankrollId: "bk",
  betType: "single",
  sport: "football",
  stake: 10,
  odds: 2,
  status: "pending",
  placedAt: "2026-10-01T12:00:00.000Z",
  legs: [],
  ...over,
});

describe("promoConversion — free bet couvert (best-of bettrackai)", () => {
  test("F=10, O1=3.00, O2=1.50, c=2 % → couverture 20.00, garanti 9.40, conversion 94 %", () => {
    const r = promoConversion(10, 3.0, 1.5, 0.02);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.hedgeStake).toBe(20);
    expect(r.profitIfBonusWins).toBeCloseTo(10, 2); // 10×3 − 20
    expect(r.profitIfHedgeWins).toBeCloseTo(9.4, 2); // 30×0.98 − 20
    expect(r.guaranteedProfit).toBeCloseTo(9.4, 2);
    expect(r.conversionPct).toBeCloseTo(94, 2);
    expect(r.impliedProbHedge).toBeCloseTo(66.67, 2);
  });

  test("sans commission, les deux issues convergent (profit identique)", () => {
    const r = promoConversion(10, 3.0, 1.5, 0);
    if ("error" in r) throw new Error("erreur inattendue");
    expect(r.profitIfBonusWins).toBe(r.profitIfHedgeWins);
    expect(r.guaranteedProfit).toBe(r.profitIfBonusWins);
    expect(r.conversionPct).toBeCloseTo(100, 2);
  });

  test("bornes : montant/cotes invalides → erreur typée", () => {
    expect("error" in promoConversion(0, 3, 1.5)).toBe(true);
    expect("error" in promoConversion(-5, 3, 1.5)).toBe(true);
    expect("error" in promoConversion(10, 1, 1.5)).toBe(true);
    expect("error" in promoConversion(10, 3, 1)).toBe(true);
  });

  test("commission bornée à 50 % max", () => {
    const r = promoConversion(10, 3.0, 1.5, 0.9);
    if ("error" in r) throw new Error("erreur inattendue");
    // 30 × 0.5 − 20 = −5 → conversion négative assumée côté exchange
    expect(r.profitIfHedgeWins).toBeCloseTo(-5, 2);
  });
});

describe("stakingPlans — fix Kelly : proba = taux historique, pas proba implicite", () => {
  test("1 pari gagnant à 3.0 : Kelly 1/4 mise 6.25 (l'ancien code misait le plancher 0.50)", () => {
    const bets = [bet({ id: "w1", status: "won", stake: 10, odds: 3, placedAt: "2026-10-01T10:00:00.000Z" })];
    const plans = stakingPlans(bets, 100);
    const kq = plans.find((p) => p.name === "Kelly 1/4")!;
    // winRate 100 % → Kelly plein = 25 % (cap) → × 1/4 = 6.25 € → gain 6.25×2 = +12.50
    expect(kq.finalBankroll).toBeCloseTo(112.5, 1);
    expect(kq.profit).toBeCloseTo(12.5, 1);
  });

  test("historique sans gagné/perdu : Kelly reste au plancher (pas de NaN)", () => {
    const plans = stakingPlans([bet({ status: "pending" })], 100);
    const kq = plans.find((p) => p.name === "Kelly 1/4")!;
    expect(Number.isFinite(kq.finalBankroll)).toBe(true);
    expect(plans.length).toBe(7); // 6 plans + Montante
  });

  test("Flat reste à 10 € (non affecté par le fix)", () => {
    const plans = stakingPlans([bet({ status: "won", stake: 10, odds: 3 })], 100);
    const flat = plans.find((p) => p.name.startsWith("Flat"))!;
    // mise fixe 10 € gagnante à 3.0 → +10 × (3 − 1) = +20
    expect(flat.finalBankroll).toBeCloseTo(120, 1);
  });
});
