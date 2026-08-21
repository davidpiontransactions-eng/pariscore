// Statistiques de bankroll — fonctions pures, portées depuis use-bankroll
// et enrichies (drawdown, streaks, variance, courbe de capital).

import type { Bet, BankrollStats, CapitalPoint, GroupStats } from "./types";

export const STATUS_DECIDED: Bet["status"][] = ["won", "lost", "cashout"];

/** P/L réel d'un pari réglé (cashout = payout - stake aussi). */
export function betProfit(b: Bet): number {
  if (b.status === "pending") return 0;
  return (b.payout ?? 0) - b.stake;
}

/** Les void (RET/WO) sont exclus des mises risquées et du taux de réussite. */
export function isRisked(b: Bet): boolean {
  return b.status !== "pending" && b.status !== "void";
}

export function computeBankrollStats(bets: Bet[], initial: number): BankrollStats {
  const settled = bets.filter(isRisked);
  const pending = bets.filter((b) => b.status === "pending");
  const won = bets.filter((b) => b.status === "won");
  const lost = bets.filter((b) => b.status === "lost");
  const voids = bets.filter((b) => b.status === "void");
  const cashed = bets.filter((b) => b.status === "cashout");

  const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
  const totalReturned = settled.reduce((s, b) => s + (b.payout ?? 0), 0);
  const profit = totalReturned - totalStaked;
  const decided = won.length + lost.length;

  // Cote moyenne / mise moyenne (tous paris sauf void)
  const oddBets = bets.filter((b) => b.odds > 0);
  const avgOdds = oddBets.length ? oddBets.reduce((s, b) => s + b.odds, 0) / oddBets.length : 0;
  const avgStake = bets.length ? bets.reduce((s, b) => s + b.stake, 0) / bets.length : 0;

  // Streaks — série chronologique par date de règlement
  const timeline = bets
    .filter((b) => b.status === "won" || b.status === "lost")
    .sort((a, b) => (a.settledAt ?? a.placedAt).localeCompare(b.settledAt ?? b.placedAt));

  let bestStreak = 0;
  let worstStreak = 0;
  let currentStreak = 0;
  let run = 0;
  for (const b of timeline) {
    run = b.status === "won" ? Math.max(1, run + 1) : Math.min(-1, run - 1);
    if (run > bestStreak) bestStreak = run;
    if (run < worstStreak) worstStreak = run;
  }
  currentStreak = run;

  // Drawdown max sur la courbe de capital
  let peak = initial;
  let maxDrawdown = 0;
  let capital = initial;
  const byDate = new Map<string, number>();
  for (const b of bets.filter((b) => isRisked(b))) {
    const day = (b.settledAt ?? b.placedAt).slice(0, 10);
    byDate.set(day, (byDate.get(day) ?? 0) + betProfit(b));
  }
  const days = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, pl] of days) {
    capital += pl;
    if (capital > peak) peak = capital;
    const dd = peak > 0 ? ((peak - capital) / peak) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Variance / écart-type des P/L (paris réglés)
  const pls = settled.map(betProfit);
  const variance =
    pls.length > 1
      ? pls.reduce((s, p) => s + p * p, 0) / pls.length - (pls.reduce((s, p) => s + p, 0) / pls.length) ** 2
      : 0;

  return {
    initial,
    current: initial + profit,
    profit,
    roi: totalStaked > 0 ? (profit / totalStaked) * 100 : 0,
    yield: totalStaked > 0 ? (profit / totalStaked) * 100 : 0,
    winRate: decided > 0 ? (won.length / decided) * 100 : 0,
    totalBets: bets.length,
    settledCount: settled.length,
    pendingCount: pending.length,
    wonCount: won.length,
    lostCount: lost.length,
    voidCount: voids.length,
    cashoutCount: cashed.length,
    totalStaked,
    totalReturned,
    avgOdds,
    avgStake,
    bestStreak,
    worstStreak,
    currentStreak,
    maxDrawdown,
    variance,
    stdev: Math.sqrt(variance),
  };
}

/** Courbe de capital par jour (ou par mois si month=true). */
export function capitalCurve(bets: Bet[], initial: number, month = false): CapitalPoint[] {
  const map = new Map<string, number>();
  for (const b of bets) {
    if (!isRisked(b)) continue;
    const iso = b.settledAt ?? b.placedAt;
    const key = month ? iso.slice(0, 7) : iso.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + betProfit(b));
  }
  const keys = Array.from(map.keys()).sort();
  let running = initial;
  const points: CapitalPoint[] = [{ key: "start", bankroll: initial, profit: 0 }];
  for (const k of keys) {
    running += map.get(k) ?? 0;
    points.push({ key: k, bankroll: running, profit: map.get(k) ?? 0 });
  }
  return points;
}

/**
 * Groupes de stats par clé (sport, bookmaker, type, mois, plage de cote...).
 * Profit/ROI/winRate calculés sur les paris réglés ; les void sont comptés
 * dans `bets` mais pas dans les mises risquées. Tri par profit desc.
 */
export function groupStats(bets: Bet[], getKey: (b: Bet) => string): GroupStats[] {
  const map = new Map<string, GroupStats>();
  for (const bet of bets) {
    const key = getKey(bet);
    let g = map.get(key);
    if (!g) {
      g = { key, label: key, bets: 0, won: 0, lost: 0, pending: 0, settled: 0, staked: 0, profit: 0, roi: 0, winRate: 0 };
      map.set(key, g);
    }
    g.bets += 1;
    if (bet.status === "pending") {
      g.pending += 1;
    } else if (bet.status === "void") {
      g.settled += 1;
    } else {
      g.settled += 1;
      g.staked += bet.stake;
      g.profit += betProfit(bet);
      if (bet.status === "won" || bet.status === "cashout") g.won += 1;
      else g.lost += 1;
    }
  }
  const groups = Array.from(map.values());
  for (const g of groups) {
    g.roi = g.staked > 0 ? (g.profit / g.staked) * 100 : 0;
    const decided = g.won + g.lost;
    g.winRate = decided > 0 ? (g.won / decided) * 100 : 0;
  }
  groups.sort((a, b) => b.profit - a.profit || a.key.localeCompare(b.key));
  return groups;
}

/** Plage de cote (labels stables pour les filtres/groupes). */
export function oddsBucket(odds: number): string {
  if (odds <= 0) return "—";
  if (odds < 1.5) return "1.00–1.49";
  if (odds < 2) return "1.50–1.99";
  if (odds < 3) return "2.00–2.99";
  if (odds < 5) return "3.00–4.99";
  return "5.00+";
}

export function monthKey(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}