import { describe, expect, test } from "bun:test";
import {
  PLAN_DEFAULTS,
  addDaysKey,
  betPL,
  computeReal,
  computeTheoretical,
  cumulativeProfitAt,
  cumulativeProfitByDay,
  dailyLoanRepayment,
  diffDays,
  loanCumulatedAt,
  loanRemainingAt,
  objectiveGainsAt,
  stakeForTarget,
  type BankLoan,
  type PlanParams,
} from "../bet-manager/plan";
import { tradeoffTable } from "../bet-manager/calculators";

/** Même base que le test montante : 200 €, +20 %/j, 50 % banque, 11 paris, 30 j. */
const BASE: PlanParams = { ...PLAN_DEFAULTS };

const near = (got: number, want: number, tol = 0.1) => Math.abs(got - want) <= tol;

describe("plan — projection théorique (chiffres figés entrée RAPPORT 126)", () => {
  const rows = computeTheoretical(BASE);

  test("30 lignes, jour 1 : G = 40.00, banque 20.00, C 220.00, B 20.00, T 240.00", () => {
    expect(rows.length).toBe(30);
    const d1 = rows[0];
    expect(d1.cStart).toBe(200);
    expect(d1.G).toBeCloseTo(40, 6);
    expect(d1.toBank).toBe(20);
    expect(d1.reinvest).toBe(20);
    expect(d1.C).toBe(220);
    expect(d1.B).toBe(20);
    expect(d1.T).toBe(240);
    expect(d1.key).toBe("2026-10-02");
  });

  test("jour 30 : C ≈ 3489.88 · B ≈ 3289.88 · T ≈ 6779.76 (drift ≤ 0.10)", () => {
    const d30 = rows[29];
    expect(near(d30.C, 3489.88)).toBe(true);
    expect(near(d30.B, 3289.88)).toBe(true);
    expect(near(d30.T, 6779.76)).toBe(true);
    // Identité entrée 126 : Σ = T − capital initial = 2 × B (réinvesti + banni)
    expect(near(d30.T - BASE.capital, 2 * d30.B, 0.5)).toBe(true);
  });

  test("oReq jour 1 = 1 + G/stake = 2.00, oNeutral = 1/0.5 = 2.00", () => {
    expect(rows[0].oReq).toBeCloseTo(2, 6);
    expect(rows[0].oNeutral).toBeCloseTo(2, 6);
  });

  test("stake 20 % et gain 20 % ⇒ mise/pari = gain/pari (coïncidence des défauts)", () => {
    expect(rows[0].miseParPari).toBeCloseTo(rows[0].gainParPari, 6);
    expect(rows[0].gainParPari).toBeCloseTo(40 / 11, 6);
  });

  test("progression composée ×1,10/j : C₁₀ ≈ 200 × 1.1¹⁰ (fin de J10)", () => {
    expect(near(rows[9].C, 200 * Math.pow(1.1, 10), 0.2)).toBe(true);
  });

  test("table d'arbitrage : 5 %→5.00 … 100 %→1.20", () => {
    const t = tradeoffTable(200, 20, [5, 10, 15, 20, 30, 40, 50, 100]);
    const want = [5.0, 3.0, 2.33, 2.0, 1.67, 1.5, 1.4, 1.2];
    t.forEach((r, i) => expect(r.odds).toBeCloseTo(want[i], 2));
  });
});

describe("plan — betPL (source de vérité du journal)", () => {
  test("6 branches", () => {
    expect(betPL({ stake: 10, odds: 2, status: "pending" })).toEqual({ pl: null, src: "en cours" });
    expect(betPL({ stake: 10, odds: 2, status: "won" })).toEqual({ pl: 10, src: "calculé" });
    expect(betPL({ stake: 10, odds: 2, status: "lost" })).toEqual({ pl: -10, src: "calculé" });
    expect(betPL({ stake: 10, odds: 2, status: "void" })).toEqual({ pl: 0, src: "annulé" });
    expect(betPL({ stake: 10, odds: 2, status: "cashout", payout: 15 })).toEqual({ pl: 5, src: "payout" });
    expect(betPL({ stake: 10, odds: 2, status: "won", payout: 25 })).toEqual({ pl: 15, src: "payout" });
  });
});

describe("plan — suivi réel vs théorique (date figée)", () => {
  const th = computeTheoretical(BASE);

  test("aucun pari : retard J1 = 40.00 (T_th − T_re), jrest = 30, retard/j = 1.33", () => {
    const r = computeReal(BASE, th, {}, "2026-10-02");
    expect(r.lastDay).toBe(1);
    const d1 = r.rows[0];
    expect(d1.future).toBe(false);
    expect(d1.tRe).toBe(200);
    expect(d1.retard).toBeCloseTo(40, 6);
    expect(d1.jrest).toBe(30);
    expect(d1.retardJour).toBeCloseTo(40 / 30, 6);
    // Jours suivants : « à venir », aucun retard
    expect(r.rows[1].future).toBe(true);
    expect(r.rows[1].retard).toBeNull();
    expect(r.rows[1].retardJour).toBeNull();
    expect(r.liveJrest).toBe(30);
  });

  test("gain réel J1 = +10 −5 = 5 ⇒ auto-virement 2.50, capital 202.50, retard 35", () => {
    const days = {
      "2026-10-02": [
        { stake: 10, odds: 2, status: "won", payout: 20 },
        { stake: 5, odds: 1.5, status: "lost" },
      ],
    };
    const r = computeReal(BASE, th, days, "2026-10-02");
    const d1 = r.rows[0];
    expect(d1.gRe).toBe(5);
    expect(d1.toBank).toBe(2.5);
    expect(d1.cap).toBe(202.5);
    expect(d1.bank).toBe(2.5);
    expect(d1.tRe).toBe(205);
    expect(d1.retard).toBeCloseTo(35, 6);
    expect(d1.retardJour).toBeCloseTo(35 / 30, 6);
    expect(d1.won).toBe(1);
    expect(d1.lost).toBe(1);
    expect(d1.staked).toBe(15);
    expect(r.cumStaked).toBe(15);
  });

  test("pari pending : compté mais pas dans le P/L (pl = null)", () => {
    const days = { "2026-10-02": [{ stake: 10, odds: 2, status: "pending" }] };
    const r = computeReal(BASE, th, days, "2026-10-02");
    expect(r.rows[0].pending).toBe(1);
    expect(r.rows[0].gRe).toBe(0);
    expect(r.rows[0].tRe).toBe(200);
  });

  test("période finie : lastDay = days, liveJrest null", () => {
    const r = computeReal(BASE, th, {}, "2026-12-31");
    expect(r.lastDay).toBe(30);
    expect(r.liveJrest).toBeNull();
    expect(r.rows[29].future).toBe(false);
  });

  test("période pas commencée : lastDay = 0, toutes les lignes à venir", () => {
    const r = computeReal(BASE, th, {}, "2026-10-01");
    expect(r.lastDay).toBe(0);
    expect(r.live).toBeNull();
    expect(r.rows.every((x) => x.future)).toBe(true);
  });
});

describe("plan — utilitaires", () => {
  test("stakeForTarget : gain/(cote−1), null si cote ≤ 1 (Feuille2 F corrigée)", () => {
    expect(stakeForTarget(3.64, 2)).toBeCloseTo(3.64, 6);
    expect(stakeForTarget(10, 3)).toBeCloseTo(5, 6);
    expect(stakeForTarget(10, 1)).toBeNull();
    expect(stakeForTarget(10, 0.9)).toBeNull();
  });

  test("dates UTC immunisées : addDaysKey/diffDays sur fin de mois et année", () => {
    expect(addDaysKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffDays("2026-10-02", "2026-10-31")).toBe(29);
    expect(diffDays("2026-10-31", "2026-10-02")).toBe(-29);
  });
});

describe("plan — objectif vs réel (colonne Retard + graphique)", () => {
  test("objectiveGainsAt : jour 1 = T1 − capital0 = 40", () => {
    expect(objectiveGainsAt(PLAN_DEFAULTS, "2026-10-02")).toBeCloseTo(40, 6);
  });

  test("objectiveGainsAt : avant le plan → null ; dernier jour = 6579.76", () => {
    expect(objectiveGainsAt(PLAN_DEFAULTS, "2026-10-01")).toBeNull();
    expect(objectiveGainsAt(PLAN_DEFAULTS, "2026-10-31")).toBeCloseTo(6579.76, 1);
  });

  test("objectiveGainsAt : au-delà de la période → borné au dernier objectif", () => {
    const end = objectiveGainsAt(PLAN_DEFAULTS, "2026-10-31");
    expect(objectiveGainsAt(PLAN_DEFAULTS, "2027-06-01")).toBeCloseTo(end as number, 6);
  });

  const cum = cumulativeProfitByDay([
    { placedAt: "2026-10-02T10:00:00.000Z", settledAt: "2026-10-02T18:00:00.000Z", status: "won", stake: 10, payout: 20 },
    { placedAt: "2026-10-01T10:00:00.000Z", settledAt: "2026-10-03T18:00:00.000Z", status: "lost", stake: 10 },
    { placedAt: "2026-10-03T10:00:00.000Z", status: "pending", stake: 10 },
    { placedAt: "2026-10-04T10:00:00.000Z", settledAt: "2026-10-04T18:00:00.000Z", status: "void", stake: 10, payout: 10 },
  ]);

  test("cumulativeProfitByDay : +10 au 02, −10 au 03 (settledAt), void/pending exclus", () => {
    expect(cum.get("2026-10-02")).toBeCloseTo(10, 6);
    expect(cum.get("2026-10-03")).toBeCloseTo(0, 6);
    expect(cum.has("2026-10-04")).toBe(false);
  });

  test("cumulativeProfitAt : dernier jour connu ≤ date, 0 avant tout", () => {
    expect(cumulativeProfitAt(cum, "2026-10-01")).toBe(0);
    expect(cumulativeProfitAt(cum, "2026-10-02")).toBeCloseTo(10, 6);
    expect(cumulativeProfitAt(cum, "2026-10-05")).toBeCloseTo(0, 6);
  });

  test("retard ligne = objectif − réel (jour 1 : 40 − 10 = 30)", () => {
    const retard = (objectiveGainsAt(PLAN_DEFAULTS, "2026-10-02") as number) - cumulativeProfitAt(cum, "2026-10-02");
    expect(retard).toBeCloseTo(30, 6);
  });
});

describe("plan — emprunt banque (v1v8)", () => {
  //200 € pris le 02/10 sur 24 j (scénario utilisateur : 200 € le 07/10/2026 sur 24 j)
  const L24: BankLoan = { amount: 200, startDate: "2026-10-02", days: 24 };

  test("dailyLoanRepayment : amount / days", () => {
    expect(dailyLoanRepayment(L24)).toBeCloseTo(200 / 24, 6);
  });

  test("dailyLoanRepayment : montant ou durée nuls → null (inactif)", () => {
    expect(dailyLoanRepayment(null)).toBeNull();
    expect(dailyLoanRepayment(undefined)).toBeNull();
    expect(dailyLoanRepayment({ amount: 0, startDate: "2026-10-02", days: 24 })).toBeNull();
    expect(dailyLoanRepayment({ amount: 200, startDate: "2026-10-02", days: 0 })).toBeNull();
  });

  test("loanCumulatedAt : 0 avant le début, daily le jour J, borné au montant", () => {
    const daily = 200 / 24;
    expect(loanCumulatedAt(L24, "2026-10-01")).toBe(0);
    expect(loanCumulatedAt(L24, "2026-10-02")).toBeCloseTo(daily, 6);
    expect(loanCumulatedAt(L24, "2026-10-25")).toBeCloseTo(daily * 24, 6); // jour 24 (start+23)
    expect(loanCumulatedAt(L24, "2026-10-31")).toBeCloseTo(200, 6); // borné après la fin
    expect(loanCumulatedAt(null, "2026-10-10")).toBe(0);
  });

  test("loanRemainingAt : reste décroissant jusqu'à 0", () => {
    const daily = 200 / 24;
    expect(loanRemainingAt(L24, "2026-10-01")).toBe(200);
    expect(loanRemainingAt(L24, "2026-10-02")).toBeCloseTo(200 - daily, 6);
    expect(loanRemainingAt(L24, "2026-11-15")).toBe(0);
    expect(loanRemainingAt(null, "2026-10-10")).toBe(0);
  });

  test("objectiveGainsAt : objectif TOTAL = gains + amortissement (rétrocompat sans loan)", () => {
    const daily = 200 / 24;
    const gainsOnly = objectiveGainsAt(PLAN_DEFAULTS, "2026-10-02");
    expect(gainsOnly).toBeCloseTo(40, 6);
    expect(objectiveGainsAt(PLAN_DEFAULTS, "2026-10-02", null)).toBeCloseTo(40, 6);
    expect(objectiveGainsAt(PLAN_DEFAULTS, "2026-10-02", L24)).toBeCloseTo(40 + daily, 6);
    // Avant le plan → null même avec emprunt
    expect(objectiveGainsAt(PLAN_DEFAULTS, "2026-10-01", L24)).toBeNull();
  });

  test("KPI retard total = retard plan + amortissement cumulé", () => {
    const daily = 200 / 24;
    const retardPlan = 40; // ex. : objectif J1 40, réel 0
    const retardTotal = retardPlan + loanCumulatedAt(L24, "2026-10-02");
    expect(retardTotal).toBeCloseTo(40 + daily, 6);
  });
});
