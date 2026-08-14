import type { FootballMatch } from "@/lib/football-data";

/**
 * Backtest & Fiabilité — Phase 4 de la suite AI Pricing.
 *
 * Le backtest évalue la stratégie « favori du modèle » (pick 1X2 le plus probable)
 * sur les matchs TERMINÉS (live.status === "FT") dont le résultat réel et les cotes
 * sont connus. Aucune donnée n'est inventée : sans matchs terminés, le backtest est
 * vide et la fiabilité reflète un échantillon insuffisant.
 */

export type StakingMethod = "flat1" | "flat2" | "flat5" | "kelly" | "halfKelly";

export const STAKING_LABELS: Record<StakingMethod, string> = {
  flat1: "Mise fixe 1%",
  flat2: "Mise fixe 2%",
  flat5: "Mise fixe 5%",
  kelly: "Kelly plein",
  halfKelly: "Half-Kelly",
};

export type BacktestBet = {
  matchId: string;
  league: string;
  date: string;
  pick: "1" | "X" | "2";
  modelProb: number;
  odds: number;
  won: boolean;
  stake: number;
  pnl: number;
};

export type BacktestResult = {
  bets: BacktestBet[];
  totalBets: number;
  wins: number;
  winRate: number;
  roi: number;
  unitsProfit: number;
  pnlCurve: number[];
  maxDrawdown: number;
  longestLosingStreak: number;
};

const START_BANKROLL = 100;
const KELLY_CAP = 0.1;

/** Résultat réel d'un match terminé → "1" | "X" | "2". */
function actualOutcome(match: FootballMatch): "1" | "X" | "2" | null {
  const live = match.live;
  if (!live || live.status !== "FT") return null;
  if (live.homeScore > live.awayScore) return "1";
  if (live.homeScore < live.awayScore) return "2";
  return "X";
}

/** Fraction de bankroll selon la méthode de staking. */
function stakeFraction(method: StakingMethod, modelProb: number, odds: number): number {
  switch (method) {
    case "flat1":
      return 0.01;
    case "flat2":
      return 0.02;
    case "flat5":
      return 0.05;
    case "kelly":
    case "halfKelly": {
      const p = modelProb / 100;
      const f = (p * odds - 1) / (odds - 1);
      const capped = Math.max(0, Math.min(KELLY_CAP, f));
      return method === "halfKelly" ? capped / 2 : capped;
    }
    default:
      return 0.01;
  }
}

/**
 * Lance le backtest sur les matchs terminés. `windowDays` limite la fenêtre
 * glissante (30/60/120) ; 0 = tout l'historique disponible.
 */
export function runBacktest(
  matches: FootballMatch[],
  method: StakingMethod = "flat2",
  windowDays = 0,
): BacktestResult {
  const cutoff = windowDays > 0 ? Date.now() - windowDays * 24 * 3600 * 1000 : 0;

  const finished = matches
    .filter((m) => {
      if (!m.live || m.live.status !== "FT") return false;
      if (!m.odds) return false;
      if (cutoff && new Date(m.scheduledAt).getTime() < cutoff) return false;
      return true;
    })
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const bets: BacktestBet[] = [];
  let bankroll = START_BANKROLL;
  let peak = START_BANKROLL;
  let maxDrawdown = 0;
  let losingStreak = 0;
  let longestLosingStreak = 0;
  let totalStaked = 0;

  for (const m of finished) {
    const p = m.prediction;
    const probs: { pick: "1" | "X" | "2"; prob: number; odds: number }[] = [
      { pick: "1", prob: p.homeProb, odds: m.odds!.home },
      { pick: "X", prob: p.drawProb, odds: m.odds!.draw },
      { pick: "2", prob: p.awayProb, odds: m.odds!.away },
    ];
    const best = probs.reduce((a, b) => (b.prob > a.prob ? b : a));
    if (!Number.isFinite(best.odds) || best.odds <= 1) continue;

    const fraction = stakeFraction(method, best.prob, best.odds);
    if (fraction <= 0) continue;
    const stake = bankroll * fraction;
    if (stake <= 0) continue;

    const outcome = actualOutcome(m);
    const won = outcome === best.pick;
    const pnl = won ? stake * (best.odds - 1) : -stake;

    bankroll += pnl;
    totalStaked += stake;
    peak = Math.max(peak, bankroll);
    maxDrawdown = Math.max(maxDrawdown, peak - bankroll);
    losingStreak = won ? 0 : losingStreak + 1;
    longestLosingStreak = Math.max(longestLosingStreak, losingStreak);

    bets.push({
      matchId: m.id,
      league: m.league.name,
      date: m.scheduledAt,
      pick: best.pick,
      modelProb: best.prob,
      odds: best.odds,
      won,
      stake,
      pnl,
    });
  }

  const wins = bets.filter((b) => b.won).length;
  const unitsProfit = bankroll - START_BANKROLL;
  const roi = totalStaked > 0 ? (unitsProfit / totalStaked) * 100 : 0;

  const pnlCurve: number[] = [];
  let cum = 0;
  for (const b of bets) {
    cum += b.pnl;
    pnlCurve.push(cum);
  }

  return {
    bets,
    totalBets: bets.length,
    wins,
    winRate: bets.length > 0 ? (wins / bets.length) * 100 : 0,
    roi,
    unitsProfit,
    pnlCurve,
    maxDrawdown,
    longestLosingStreak,
  };
}

// ---------------------------------------------------------------------------
// Score de fiabilité (0-100, 5 piliers)
// ---------------------------------------------------------------------------

export type ReliabilityPillar = {
  key: string;
  label: string;
  score: number;
  detail: string;
};

export type ReliabilityResult = {
  overall: number;
  pillars: ReliabilityPillar[];
};

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

/** Calcule la note de fiabilité 0-100 depuis un résultat de backtest. */
export function computeReliability(bt: BacktestResult, matches: FootballMatch[]): ReliabilityResult {
  const n = bt.totalBets;

  // 1. Taille de l'échantillon (40+ matchs terminés = plein).
  const sampleScore = clamp((n / 40) * 100);

  // 2. Rendement : ROI (60%) + win-rate des 10 derniers (40%).
  const roiScore = clamp(50 + bt.roi);
  const last10 = bt.bets.slice(-10);
  const l10WinRate = last10.length > 0 ? (last10.filter((b) => b.won).length / last10.length) * 100 : 50;
  const returnScore = n > 0 ? clamp(0.6 * roiScore + 0.4 * l10WinRate) : 0;

  // 3. Consistance temporelle : stabilité du ROI sur 3 segments chronologiques.
  let consistencyScore = 50;
  if (n >= 6) {
    const segSize = Math.floor(n / 3);
    const segRois: number[] = [];
    for (let s = 0; s < 3; s++) {
      const seg = bt.bets.slice(s * segSize, s === 2 ? n : (s + 1) * segSize);
      const staked = seg.reduce((a, b) => a + b.stake, 0);
      const pnl = seg.reduce((a, b) => a + b.pnl, 0);
      segRois.push(staked > 0 ? (pnl / staked) * 100 : 0);
    }
    const mean = segRois.reduce((a, b) => a + b, 0) / segRois.length;
    const variance = segRois.reduce((a, b) => a + (b - mean) ** 2, 0) / segRois.length;
    const std = Math.sqrt(variance);
    consistencyScore = clamp(100 - std * 2);
  }

  // 4. Diversité du mix de ligues (1 − HHI). Sur-concentration = pénalité.
  const leagueCounts = new Map<string, number>();
  for (const b of bt.bets) leagueCounts.set(b.league, (leagueCounts.get(b.league) ?? 0) + 1);
  let leagueMixScore = 50;
  if (n > 0) {
    let hhi = 0;
    for (const count of leagueCounts.values()) hhi += (count / n) ** 2;
    leagueMixScore = clamp((1 - hhi) * 130);
  }

  // 5. Risque de downside : drawdown max + série perdante.
  const downsideScore = n > 0
    ? clamp(100 - bt.maxDrawdown * 4 - bt.longestLosingStreak * 6)
    : 0;

  const pillars: ReliabilityPillar[] = [
    { key: "sample", label: "Taille de l'échantillon", score: Math.round(sampleScore), detail: `${n} match${n > 1 ? "s" : ""} terminé${n > 1 ? "s" : ""}` },
    { key: "return", label: "Rendement", score: Math.round(returnScore), detail: `ROI ${bt.roi.toFixed(1)}% · L10 ${Math.round(l10WinRate)}%` },
    { key: "consistency", label: "Consistance", score: Math.round(consistencyScore), detail: n >= 6 ? "Stabilité sur 3 périodes" : "Échantillon trop court" },
    { key: "leagueMix", label: "Mix de ligues", score: Math.round(leagueMixScore), detail: `${leagueCounts.size} ligue${leagueCounts.size > 1 ? "s" : ""}` },
    { key: "downside", label: "Risque de baisse", score: Math.round(downsideScore), detail: `Drawdown ${bt.maxDrawdown.toFixed(1)}u · série ${bt.longestLosingStreak}` },
  ];

  const weights: Record<string, number> = {
    sample: 0.2,
    return: 0.3,
    consistency: 0.15,
    leagueMix: 0.15,
    downside: 0.2,
  };
  const overall = Math.round(pillars.reduce((a, p) => a + p.score * weights[p.key], 0));

  return { overall: clamp(overall), pillars };
}

/** Matchs terminés disponibles (pour informer l'utilisateur de l'échantillon). */
export function countFinishedMatches(matches: FootballMatch[]): number {
  return matches.filter((m) => m.live?.status === "FT").length;
}
