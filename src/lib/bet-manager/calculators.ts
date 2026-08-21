// 17 calculateurs de paris sportifs (best-of Bet-Analytix × BettingTracker)
// Fonctions pures, partagées entre l'API et les pages tools.

import type { Bet } from "./types";
import { isRisked } from "./stats";
import { computeKellyStake } from "@/lib/kelly";

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// ─── 1. Convertisseur de cotes ──────────────────────────────────────────────
export function oddsConverter(decimal: number) {
  const d = Math.max(1.01, decimal);
  const pct = (1 / d) * 100;
  const fractional = d >= 2 ? `${d - 1}/1` : `1/${round(1 / (d - 1), 0)}`;
  const american = d >= 2 ? `+${Math.round((d - 1) * 100)}` : `-${Math.round(100 / (d - 1))}`;
  return { decimal: round(d, 2), fractional, american, impliedProb: round(pct, 2) };
}

// ─── 2. Calculateur combiné ─────────────────────────────────────────────────
export function parlayCalculator(odds: number[], stake: number) {
  const total = odds.filter((o) => o > 1).reduce((acc, o) => acc * o, 1);
  return { totalOdds: round(total, 2), payout: round(stake * total, 2), profit: round(stake * total - stake, 2) };
}

// ─── 3. Seuil de rentabilité (break-even) ───────────────────────────────────
export function breakEven(odds: number) {
  const wr = odds > 1 ? (1 / odds) * 100 : 0;
  return { winRateRequired: round(wr, 2) };
}

// ─── 4. Remboursé si nul (DNB) — répartition victoire/couverture nul ────────
export function dnbSplit(stake: number, oddsWin: number, oddsDraw: number) {
  if (oddsWin <= 1 || oddsDraw <= 1) return { winStake: 0, drawStake: 0, guaranteed: 0, error: "Cotes invalides" };
  const winStake = (stake * oddsDraw) / (oddsWin + oddsDraw);
  const drawStake = stake - winStake;
  return { winStake: round(winStake, 2), drawStake: round(drawStake, 2), guaranteed: round(winStake * oddsWin, 2) };
}

// ─── 5. Double chance ───────────────────────────────────────────────────────
export function doubleChance(odds1: number, odds2: number, odds12: number) {
  const d = (o: number) => (o > 1 ? 1 / o : 0);
  const p = d(odds1) + d(odds2) + d(odds12);
  const fair = p > 0 ? (d(odds1) + d(odds2)) / p : 0;
  const fairOdds = fair > 0 ? 1 / fair : 0;
  return { combinedProb: round((d(odds1) + d(odds2)) * 100, 2), fairOdds: round(fairOdds, 2) };
}

// ─── 6. Taux de retour (TRJ) + marge ────────────────────────────────────────
export function trj(odds: number[]) {
  const inv = odds.filter((o) => o > 1).reduce((s, o) => s + 1 / o, 0);
  const overround = inv > 0 ? inv - 1 : 0;
  return { trj: round(inv > 0 ? (1 / inv) * 100 : 0, 2), margin: round(overround * 100, 2) };
}

// ─── 7. Valeur attendue (EV) ────────────────────────────────────────────────
export function expectedValue(odds: number, probPct: number, stake: number) {
  const p = Math.max(0, Math.min(1, probPct / 100));
  const ev = stake * (p * (odds - 1) - (1 - p));
  const roi = ev / stake;
  return { ev: round(ev, 2), roi: round(roi * 100, 2), value: round(ev / stake, 4) };
}

// ─── 8. Critère de Kelly (réutilise src/lib/kelly.ts) ───────────────────────
export function kelly(probPct: number, decimal: number, bankroll: number) {
  const k = computeKellyStake(probPct, decimal);
  return { pct: round(k.pct, 2), capped: k.capped, stake: round((bankroll * k.pct) / 100, 2) };
}

// ─── 9. Couverture (hedge) — garantir un profit en cours de pari ────────────
export function hedgeCalculator(originalStake: number, originalOdds: number, hedgeOdds: number) {
  const payout = originalStake * originalOdds;
  const hedgeStake = hedgeOdds > 1 ? payout / hedgeOdds : 0;
  const guaranteed = payout - hedgeStake - originalStake;
  return {
    hedgeStake: round(hedgeStake, 2),
    guaranteedProfit: round(guaranteed, 2),
    profitIfOriginalWins: round(payout - hedgeStake - originalStake, 2),
    lossIfHedgeWins: round(hedgeStake * hedgeOdds - hedgeStake - originalStake, 2),
  };
}

// ─── 10. Dutching — gain identique quel que soit le résultat ────────────────
export function dutching(stake: number, odds: number[]) {
  const inv = odds.filter((o) => o > 1).map((o) => 1 / o);
  const total = inv.reduce((s, v) => s + v, 0);
  if (total <= 0) return { stakes: [], guaranteed: 0, error: "Cotes invalides" };
  const stakes = inv.map((v) => (stake * v) / total);
  const guaranteed = total > 0 ? stake / total : 0;
  return {
    stakes: stakes.map((s) => round(s, 2)),
    guaranteed: round(guaranteed, 2),
    profit: round(guaranteed - stake, 2),
  };
}

// ─── 11. Cotes justes sans marge (démarginalisation) ────────────────────────
export function fairOdds(odds: number[]) {
  const inv = odds.filter((o) => o > 1).map((o) => 1 / o);
  const total = inv.reduce((s, v) => s + v, 0);
  return { fairOdds: inv.map((v) => round(total / v, 2)), probabilities: inv.map((v) => round((v / total) * 100, 2)) };
}

// ─── 12. Pari Lay (exchange) ────────────────────────────────────────────────
export function layCalculator(backStake: number, backOdds: number, layOdds: number, layCommission = 0.02) {
  const liability = backStake * (layOdds - 1);
  const profit = backStake * (backOdds - 1) - liability;
  const netLayProfit = backStake * (1 - layCommission);
  return {
    liability: round(liability, 2),
    profitIfBackWins: round(profit, 2),
    profitIfLayWins: round(netLayProfit, 2),
  };
}

// ─── 13. Détecteur d'arbitrage (surebet) ────────────────────────────────────
export function arbitrage(odds: number[], stake = 100) {
  const inv = odds.filter((o) => o > 1).map((o) => 1 / o);
  const total = inv.reduce((s, v) => s + v, 0);
  if (total <= 0) return { isArbitrage: false, stakes: [], profit: 0, margin: 0, error: "Cotes invalides" };
  const isArb = total < 1;
  const stakes = inv.map((v) => (stake / total) * v);
  return {
    isArbitrage: isArb,
    margin: round((1 - total) * 100, 2),
    stakes: stakes.map((s) => round(s, 2)),
    profit: round(stake * (1 / total - 1), 2),
  };
}

// ─── 14. Pari Middle ────────────────────────────────────────────────────────
export function middleCalculator(totalPoints: number, lineA: number, lineB: number, oddsA: number, oddsB: number, stakePerSide: number) {
  const diff = Math.abs(lineA - lineB);
  const winBoth = totalPoints > lineA && totalPoints < lineB;
  const winOne = totalPoints > lineA || totalPoints < lineB;
  const profitBoth = winBoth ? stakePerSide * (oddsA - 1) + stakePerSide * (oddsB - 1) : 0;
  const profitOne = winOne ? stakePerSide * (oddsA - 1) - stakePerSide : 0;
  const profitNone = -2 * stakePerSide;
  return {
    middleWidth: diff,
    winBoth: round(profitBoth, 2),
    winOne: round(profitOne, 2),
    loseBoth: round(profitNone, 2),
  };
}

// ─── 15. Convertisseur handicap ─────────────────────────────────────────────
export function handicapConverter(odds: number, handicap: number) {
  // Handicap européen → probabilité implicite ajustée (approximation normale)
  const baseProb = 1 / odds;
  const adjusted = baseProb * (1 + handicap * 0.05);
  return { european: round(baseProb * 100, 2), asianAdjusted: round(Math.min(95, Math.max(5, adjusted * 100)), 2) };
}

// ─── 16. Simulateur Monte Carlo (trajectoires de bankroll) ──────────────────
export type MonteCarloResult = {
  median: number;
  p10: number;
  p90: number;
  ruinProb: number; // probabilité de tomber sous 20% du capital initial
  expectedFinal: number;
  trajectories: number[];
};

export function monteCarlo(
  initialBankroll: number,
  winRatePct: number,
  avgOdds: number,
  stakePctOfBankroll: number,
  simulations = 1000,
  betsPerSim = 100
): MonteCarloResult {
  const p = Math.max(0.01, Math.min(0.99, winRatePct / 100));
  const net = avgOdds - 1;
  const stakeFrac = Math.max(0.01, Math.min(1, stakePctOfBankroll / 100));
  const finals: number[] = [];
  let ruin = 0;
  for (let s = 0; s < simulations; s++) {
    let bank = initialBankroll;
    for (let i = 0; i < betsPerSim; i++) {
      const stake = bank * stakeFrac;
      bank += Math.random() < p ? stake * net : -stake;
      if (bank <= 0) break;
    }
    finals.push(Math.max(0, bank));
    if (bank < initialBankroll * 0.2) ruin += 1;
  }
  const sorted = [...finals].sort((a, b) => a - b);
  const q = (qty: number) => sorted[Math.min(sorted.length - 1, Math.floor(qty * sorted.length))];
  const expected = finals.reduce((s, v) => s + v, 0) / finals.length;
  return {
    median: round(q(0.5), 0),
    p10: round(q(0.1), 0),
    p90: round(q(0.9), 0),
    ruinProb: round((ruin / simulations) * 100, 2),
    expectedFinal: round(expected, 0),
    trajectories: finals.slice(0, 50),
  };
}

// ─── 17. Plans de mise (staking) — comparaison sur historique réel ──────────
export type StakingPlan = { name: string; finalBankroll: number; profit: number; roi: number; maxDrawdown: number };

export function stakingPlans(bets: Bet[], initialBankroll: number): StakingPlan[] {
  const settled = bets.filter(isRisked).sort((a, b) => a.placedAt.localeCompare(b.placedAt));
  type PlanDef = { name: string; fn: (bank: number, b: Bet) => number };
  const plans: PlanDef[] = [
    { name: "Flat (10 €)", fn: () => 10 },
    { name: "1% bankroll", fn: (bank: number) => bank * 0.01 },
    { name: "2% bankroll", fn: (bank: number) => bank * 0.02 },
    { name: "5% bankroll", fn: (bank: number) => bank * 0.05 },
    { name: "Kelly 1/4", fn: (bank: number, b: Bet) => bank * Math.max(0, computeKellyStake((1 / b.odds) * 100, b.odds).pct / 100) * 0.25 },
    { name: "Kelly 1/2", fn: (bank: number, b: Bet) => bank * Math.max(0, computeKellyStake((1 / b.odds) * 100, b.odds).pct / 100) * 0.5 },
  ];

  const results: StakingPlan[] = [];
  const runPlan = (name: string, fn: (bank: number, b: Bet, lastWin: boolean, lastStake: number) => number) => {
    let bank = initialBankroll;
    let peak = bank;
    let maxDD = 0;
    let lastWin = true;
    let lastStake = 10;
    let staked = 0;
    for (const b of settled) {
      const stake = Math.min(Math.max(0.5, fn(bank, b, lastWin, lastStake)), bank * 0.5);
      lastStake = stake;
      staked += stake;
      const pl = b.status === "won" || b.status === "cashout" ? stake * (b.odds - 1) : -stake;
      lastWin = pl >= 0;
      bank += pl;
      if (bank > peak) peak = bank;
      const dd = peak > 0 ? ((peak - bank) / peak) * 100 : 0;
      if (dd > maxDD) maxDD = dd;
      if (bank <= 0) break;
    }
    results.push({
      name,
      finalBankroll: round(bank, 2),
      profit: round(bank - initialBankroll, 2),
      roi: round(((bank - initialBankroll) / Math.max(1, staked)) * 100, 2),
      maxDrawdown: round(maxDD, 2),
    });
  };

  for (const p of plans) runPlan(p.name, (bank, b) => p.fn(bank, b));
  // Montante : mise x1.5 après perte, reset à 10 après gain (plafond 20% bankroll)
  runPlan("Montante 1.5x", (_bank, _b, lastWin, lastStake) => (lastWin ? 10 : Math.min(lastStake * 1.5, _bank * 0.2)));

  return results;
}

// ─── Export CSV des paris (compatible import) ───────────────────────────────
export function betsToCSV(bets: Bet[]): string {
  const header = "placedAt,sport,competition,match,market,pick,stake,odds,status,payout,bookmaker,tipster,category,tags,note";
  const rows = bets.map((b) =>
    [
      b.placedAt,
      b.sport,
      b.competition ?? "",
      b.matchLabel ?? "",
      b.market ?? "",
      b.pick ?? "",
      b.stake,
      b.odds,
      b.status,
      b.payout ?? "",
      b.bookmaker ?? "",
      b.tipster ?? "",
      b.category ?? "",
      b.tags ?? "",
      (b.note ?? "").replace(/[\n\r]+/g, " "),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...rows].join("\n");
}

/** Parse un CSV de paris (lignes, en-tête flexible) vers des bets bruts. */
export function parseBetsCSV(csv: string): Partial<Bet>[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
  const col = (h: string) => header.indexOf(h);
  const get = (row: string[], h: string) => {
    const i = col(h);
    return i >= 0 && i < row.length ? row[i].replace(/^"|"$/g, "").trim() : "";
  };
  const num = (v: string) => (v === "" || isNaN(Number(v)) ? 0 : Number(v));
  const bets: Partial<Bet>[] = [];
  for (const line of lines.slice(1)) {
    const row = line.split(",").map((c) => c.trim());
    const placedAt = get(row, "placedat") || get(row, "date");
    const statusRaw = get(row, "status").toLowerCase();
    const status = ["won", "lost", "void", "cashout", "pending"].includes(statusRaw) ? statusRaw : "pending";
    const stake = num(get(row, "stake") || get(row, "mise"));
    const odds = num(get(row, "odds") || get(row, "cote"));
    const payoutRaw = get(row, "payout");
    const payout =
      payoutRaw !== ""
        ? num(payoutRaw)
        : status === "won"
          ? stake * odds
          : status === "void" || status === "cashout"
            ? stake
            : status === "lost"
              ? 0
              : undefined;
    bets.push({
      placedAt: placedAt || new Date().toISOString(),
      sport: get(row, "sport") || "football",
      competition: get(row, "competition") || null,
      matchLabel: get(row, "match") || null,
      market: get(row, "market") || null,
      pick: get(row, "pick") || null,
      stake,
      odds,
      status: status as Bet["status"],
      payout: payout ?? null,
      bookmaker: get(row, "bookmaker") || null,
      tipster: get(row, "tipster") || null,
      category: get(row, "category") || null,
      tags: get(row, "tags") || null,
      note: get(row, "note") || null,
    });
  }
  return bets;
}