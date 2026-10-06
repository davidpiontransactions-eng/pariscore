// Statistiques de bankroll — fonctions pures, enrichies (drawdown, streaks,
// variance, courbe de capital). L'ancien store localStorage use-bankroll a été
// retiré en P7 bettrack : Prisma est la source unique.

import type { Bet, BankrollStats, CapitalPoint, GroupStats } from "./types";

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
  let run = 0;
  for (const b of timeline) {
    run = b.status === "won" ? Math.max(1, run + 1) : Math.min(-1, run - 1);
    if (run > bestStreak) bestStreak = run;
    if (run < worstStreak) worstStreak = run;
  }

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

  // Exposition en cours (famille Active Bets de bettrackai)
  const pendingExposure = pending.reduce((s, b) => s + b.stake, 0);
  const potentialPayout = pending.reduce((s, b) => s + b.stake * Math.max(0, b.odds), 0);

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
    currentStreak: run,
    maxDrawdown,
    variance,
    stdev: Math.sqrt(variance),
    pendingExposure,
    potentialPayout,
  };
}

// ─── Ledger banque (mouvements BankrollTx) ──────────────────────────────────

export type LedgerKpis = {
  deposits: number; // Σ kind=deposit (> 0)
  withdrawals: number; // Σ kind=withdrawal (< 0, affiché en négatif)
  bonuses: number; // Σ kind=bonus (> 0)
  adjustments: number; // Σ kind=adjustment (signé)
  net: number; // mouvement net = Σ de tous les montants
  /** Solde courant = initial + mouvement net + P/L des paris. */
  current: number;
};

/** KPIs du ledger : agrégats de transactions + solde courant. */
export function ledgerKpis(
  txs: { kind: string; amount: number }[],
  initial: number,
  betProfitTotal: number
): LedgerKpis {
  const sum = (kind: string) => txs.filter((t) => t.kind === kind).reduce((s, t) => s + t.amount, 0);
  const net = txs.reduce((s, t) => s + t.amount, 0);
  return {
    deposits: sum("deposit"),
    withdrawals: sum("withdrawal"),
    bonuses: sum("bonus"),
    adjustments: sum("adjustment"),
    net,
    current: initial + net + betProfitTotal,
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
  // Séries chronologiques par groupe (won/lost seulement — règle de computeBankrollStats)
  const timelines = new Map<string, { at: string; won: boolean }[]>();
  for (const bet of bets) {
    const key = getKey(bet);
    let g = map.get(key);
    if (!g) {
      g = { key, label: key, bets: 0, won: 0, lost: 0, pending: 0, settled: 0, staked: 0, profit: 0, roi: 0, winRate: 0, volumePct: 0, bestStreak: 0, worstStreak: 0 };
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
      if (bet.status === "won" || bet.status === "lost") {
        let seq = timelines.get(key);
        if (!seq) {
          seq = [];
          timelines.set(key, seq);
        }
        seq.push({ at: bet.settledAt ?? bet.placedAt, won: bet.status === "won" });
      }
    }
  }
  const groups = Array.from(map.values());
  let totalStaked = 0;
  for (const g of groups) totalStaked += g.staked;
  for (const g of groups) {
    g.roi = g.staked > 0 ? (g.profit / g.staked) * 100 : 0;
    const decided = g.won + g.lost;
    g.winRate = decided > 0 ? (g.won / decided) * 100 : 0;
    g.volumePct = totalStaked > 0 ? (g.staked / totalStaked) * 100 : 0;
    const seq = (timelines.get(g.key) ?? []).sort((a, b) => a.at.localeCompare(b.at));
    let run = 0;
    for (const t of seq) {
      run = t.won ? Math.max(1, run + 1) : Math.min(-1, run - 1);
      if (run > g.bestStreak) g.bestStreak = run;
      if (run < g.worstStreak) g.worstStreak = run;
    }
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

/**
 * CLV (Closing Line Value) — positif quand NOTRE cote bat la cote de clôture :
 * odds 2,10 clôturée à 2,00 → on a acheté mieux que le marché final
 * (1/closing − 1/odds = +0,0238). Null sans closingOdd exploitable.
 */
export function clvEdge(b: Bet): number | null {
  if (b.odds <= 1 || !b.closingOdd || b.closingOdd <= 1) return null;
  return 1 / b.closingOdd - 1 / b.odds;
}

export type ClvStats = {
  /** Paris avec closingOdd exploitable. */
  tracked: number;
  /** CLV Edge moyen (points de probabilité). */
  avgEdge: number;
  /** CLV brut moyen = odds − closingOdd (points de cote, positif = beat close). */
  avgRaw: number;
  /** % des tracked ayant battu la clôture. */
  positiveRate: number;
};

/** Agrégats CLV (panneau CLV : Avg Edge / Avg Raw / Positive Rate / Tracked). */
export function computeClvStats(bets: Bet[]): ClvStats {
  let sumEdge = 0;
  let sumRaw = 0;
  let positive = 0;
  let tracked = 0;
  for (const b of bets) {
    const e = clvEdge(b);
    if (e === null) continue;
    tracked += 1;
    sumEdge += e;
    sumRaw += b.odds - (b.closingOdd as number);
    if (e > 0) positive += 1;
  }
  return {
    tracked,
    avgEdge: tracked ? sumEdge / tracked : 0,
    avgRaw: tracked ? sumRaw / tracked : 0,
    positiveRate: tracked ? (positive / tracked) * 100 : 0,
  };
}

/** Axe « By Timing » des analytics : plage horaire UTC de placement du pari. */
export function timingBucket(iso: string): string {
  const m = /^\d{4}-\d{2}-\d{2}T(\d{2})/.exec(iso ?? "");
  if (!m) return "—";
  const h = Number(m[1]);
  if (h < 6) return "00-06 Nuit";
  if (h < 12) return "06-12 Matin";
  if (h < 18) return "12-18 Après-midi";
  return "18-24 Soir";
}