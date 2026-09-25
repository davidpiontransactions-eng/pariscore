// Stats handball dérivées de l'historique persisté (table
// `handball_match_history` de pariscore.db, peuplée par
// scripts/scrape-handball-history.mjs — cron hebdo pm2).
//
// Tout est PUR (aucun accès disque) : la couche DB (handball-history-db.ts)
// fournit les lignes, ce module calcule les splits documentés :
//   - buts marqués / encaissés  : L5 et L10, en situation Home (l'équipe
//     reçoit) ET Away (l'équipe est reçue), + global ;
//   - différence de buts         : marqués − encaissés, mêmes fenêtres ;
//   - forme du moment            : PPG (V=3, N=1, D=0) L5/L10 Home/Away ;
//   - winrate                    : global + Home + Away ;
//   - échelle Over               : P(total > ligne) de 59.5 à 52.5 (CMP) ;
//   - buteurs                    : P(au moins N buts) pour N ∈ {2,3,4,5}
//     (queue de Poisson, λ joueur ajusté au rythme attendu du match).
//
// Moteurs réutilisés : handball-cmp.ts (CMP, forces équipe, over/under) et
// handball-skellam.ts (1X2). Références : Felice & Ley (CMP, totaux handball),
// Karlis 2026 (Skellam).

import { cmpMean, cmpPmf, overUnderProb } from "./handball-cmp";

// ─── Constantes documentées ───

/** Seuil de réussite demandé : une ligne / un but n'est jouable que si ≥ 55 %. */
export const PROB_FLOOR = 0.55;

/** Seuil « bet predictif » : la ligne devient un pari marqué dès 60 %. */
export const BET_FLOOR = 0.6;

/** État visuel d'une ligne de l'échelle Over (pill pari / jouable / neutre). */
export type LineFlag = "bet" | "playable" | "none";

/** Classement d'une ligne : ≥ 60 % → pari, ≥ 55 % → jouable, sinon neutre. */
export function lineFlag(over: number): LineFlag {
  if (over >= BET_FLOOR) return "bet";
  if (over >= PROB_FLOOR) return "playable";
  return "none";
}

/** Échelle Over : de Over 60 (59.5) à Over 53 (52.5), pas de 1 but. */
export const DEFAULT_OVER_LINES: readonly number[] = [
  59.5, 58.5, 57.5, 56.5, 55.5, 54.5, 53.5, 52.5,
];

/** Seuils « meilleur buteur au moins N buts ». */
export const GOAL_THRESHOLDS: readonly number[] = [2, 3, 4, 5];

/** Fenêtres de forme documentées (L5 / L10). */
export const WINDOWS = [5, 10] as const;

/** λ neutre buts/équipe/match quand l'historique manque (~60 pts au total). */
export const NEUTRAL_TEAM_LAMBDA = 30;

/** Prior de shrinkage (matchs) vers la moyenne mondiale — miroir handball-cmp. */
const PRIOR_N = 3;

// ─── Types ───

/** Ligne d'historique normalisée (même forme que la table SQLite). */
export type HistoryMatch = {
  date: string;
  timeUtc?: string | null;
  home: string;
  away: string;
  homeKey: string;
  awayKey: string;
  homeGoals: number;
  awayGoals: number;
  homeHalf?: number | null;
  awayHalf?: number | null;
  league?: string | null;
  country?: string | null;
};

/** Split de buts sur une fenêtre (n = matchs réellement disponibles). */
export type WindowSplit = {
  n: number;
  /** Buts marqués / match (null si n = 0). */
  scored: number | null;
  /** Buts encaissés / match (null si n = 0). */
  conceded: number | null;
  /** Différence marqués − encaissés / match (null si n = 0). */
  diff: number | null;
  /** Points par match — V = 3, N = 1, D = 0 (null si n = 0). */
  ppg: number | null;
  /** Séquence FR des derniers résultats de la fenêtre (« VNDVV »). */
  seq: string;
};

/** Côté de terrain : l'équipe reçoit (home) ou est reçue (away). */
export type SideSplit = {
  l5: WindowSplit;
  l10: WindowSplit;
  all: WindowSplit;
};

/** Profil complet d'une équipe tel que documenté dans l'UI. */
export type TeamHistoryStats = {
  key: string;
  name: string;
  /** Matchs d'historique au total. */
  n: number;
  wins: number;
  draws: number;
  losses: number;
  /** Winrate global (victoires / matchs). */
  winrate: number | null;
  /** Winrate à domicile (l'équipe reçoit). */
  winrateHome: number | null;
  /** Winrate à l'extérieur (l'équipe est reçue). */
  winrateAway: number | null;
  /** Forme L5 globale (toutes situations). */
  overall: SideSplit;
  /** Splits quand l'équipe REÇOIT. */
  home: SideSplit;
  /** Splits quand l'équipe est REÇUE. */
  away: SideSplit;
  /** Derniers résultats (toutes situations, chronologique). */
  lastSeq: string;
  /** Buts marqués chronologiques (λ attaque — moteur CMP). */
  scoredSeries: number[];
  /** Buts encaissés chronologiques (λ défense — moteur CMP). */
  concededSeries: number[];
};

/** Une ligne de l'échelle Over : proba + jouabilité au seuil 55 %. */
export type OverLine = {
  line: number;
  /** P(total > line). */
  over: number;
  /** P(total ≤ line). */
  under: number;
  /** ≥ 55 % → pari jouable selon la règle demandée. */
  playable: boolean;
};

/** Probabilité « au moins N buts » pour un buteur. */
export type ScorerThreshold = {
  n: number;
  p: number;
  playable: boolean;
};

// ─── Utilitaires ───

const round1 = (v: number) => Math.round(v * 10) / 10;

function avg(values: number[]): number | null {
  return values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

/** Clé d'équipe insensible à casse / diacritiques / ponctuation. */
export function teamKey(name: string): string {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Résolution approximative d'un nom de calendrier vers une clé d'historique :
 * égalité exacte d'abord, puis inclusion réciproque (len ≥ 6 pour éviter
 * « hc » → « hcm »). « Fuchse Berlin (Ger) » → « fuchseberlin ».
 */
export function resolveTeamKey(available: readonly string[], wanted: string): string | null {
  const w = teamKey(wanted);
  if (!w) return null;
  if (available.includes(w)) return w;
  let best: string | null = null;
  for (const k of available) {
    if (Math.min(k.length, w.length) < 6) continue;
    if (k.includes(w) || w.includes(k)) {
      if (!best || k.length > best.length) best = k;
    }
  }
  return best;
}

// ─── Splits L5 / L10 / global ───

/** Séquence FR des n derniers résultats du point de vue de l'équipe. */
function seqOf(games: { gf: number; ga: number }[], n: number): string {
  return games
    .slice(-n)
    .map((g) => (g.gf > g.ga ? "V" : g.gf < g.ga ? "D" : "N"))
    .join("");
}

/** Split sur une fenêtre : moyennes + PGG + séquence. */
function splitOf(games: { gf: number; ga: number; win: number }[], n: number | null): WindowSplit {
  const win = n == null ? games : games.slice(-n);
  if (!win.length) return { n: 0, scored: null, conceded: null, diff: null, ppg: null, seq: "" };
  const scored = avg(win.map((g) => g.gf));
  const conceded = avg(win.map((g) => g.ga));
  const ppg = round1(win.reduce((s, g) => s + g.win, 0) / win.length);
  return {
    n: win.length,
    scored,
    conceded,
    diff: scored != null && conceded != null ? round1(scored - conceded) : null,
    ppg,
    seq: seqOf(win, win.length),
  };
}

/** Les 3 fenêtres documentées (L5, L10, tout l'historique). */
function sideOf(games: { gf: number; ga: number; win: number }[]): SideSplit {
  return {
    l5: splitOf(games, 5),
    l10: splitOf(games, 10),
    all: splitOf(games, null),
  };
}

function winrateOf(games: { win: number }[]): number | null {
  if (!games.length) return null;
  const wins = games.filter((g) => g.win === 3).length;
  return round1((wins / games.length) * 100) / 100;
}

/**
 * Profil complet d'une équipe à partir de l'historique.
 * `rows` doit être trié du plus ancien au plus récent.
 */
export function computeTeamStats(
  rows: readonly HistoryMatch[],
  key: string,
  displayName?: string
): TeamHistoryStats | null {
  type Game = { date: string; gf: number; ga: number; win: number; side: "home" | "away" };

  const games: Game[] = [];
  let name = displayName ?? key;
  for (const r of rows) {
    const isHome = r.homeKey === key;
    const isAway = r.awayKey === key;
    if (!isHome && !isAway) continue;
    const gf = isHome ? r.homeGoals : r.awayGoals;
    const ga = isHome ? r.awayGoals : r.homeGoals;
    const win = gf > ga ? 3 : gf === ga ? 1 : 0;
    games.push({ date: r.date, gf, ga, win, side: isHome ? "home" : "away" });
    if (isHome && displayName == null) name = r.home;
    if (isAway && displayName == null) name = r.away;
  }
  // Tri chronologique (la source DB renvoie date DESC).
  games.sort((a, b) => a.date.localeCompare(b.date));
  if (!games.length) return null;

  const homeGames = games.filter((g) => g.side === "home");
  const awayGames = games.filter((g) => g.side === "away");
  const overall: SideSplit = sideOf(games);

  const wins = games.filter((g) => g.win === 3).length;
  const draws = games.filter((g) => g.win === 1).length;

  return {
    key,
    name,
    n: games.length,
    wins,
    draws,
    losses: games.length - wins - draws,
    winrate: winrateOf(games),
    winrateHome: winrateOf(homeGames),
    winrateAway: winrateOf(awayGames),
    overall,
    home: sideOf(homeGames),
    away: sideOf(awayGames),
    lastSeq: seqOf(games, 5),
    scoredSeries: games.map((g) => g.gf),
    concededSeries: games.map((g) => g.ga),
  };
}

/** Moyenne pondérée d'une série (shrinkage prior PRIOR_N vers `globalMean`). */
function shrinkMean(series: number[], globalMean: number): number {
  if (!series.length) return globalMean;
  const trimmed = series.slice(-10);
  const m = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  return (trimmed.length * m + PRIOR_N * globalMean) / (trimmed.length + PRIOR_N);
}

/** Moyenne des totaux d'une série de matchs (calibration de l'échelle). */
export function meanTotal(rows: readonly HistoryMatch[]): number | null {
  if (!rows.length) return null;
  const t = rows.map((r) => r.homeGoals + r.awayGoals);
  return round1(t.reduce((a, b) => a + b, 0) / t.length);
}

/**
 * λ du match : moyennes attaque/défense shrinkées (fenêtre 10, prior
 * PRIOR_N vers la moyenne mondiale) + avantage domicile, puis calibration
 * globale `scale` (base 60 / moyenne observée).
 *
 * On N'UTILISE PAS fitCMP/teamStrength ici : le MLE Newton ne converge pas
 * sur des fenêtres de 10 matchs et renvoie alors λ=48 pour une moyenne
 * observée de 31.7 (vérifié sur Kiel) — les moyennes shrinkées sont
 * robustes et bornées par la donnée.
 */
export function matchModel(
  home: TeamHistoryStats | null,
  away: TeamHistoryStats | null,
  scale = 1,
  globalTeamGoals: number = NEUTRAL_TEAM_LAMBDA
): {
  lambdaH: number;
  lambdaA: number;
  /** Facteur de calibration appliqué (1 = non calibré). */
  scale: number;
  expectedTotal: number;
} {
  const g = Number.isFinite(globalTeamGoals) && globalTeamGoals > 0 ? globalTeamGoals : NEUTRAL_TEAM_LAMBDA;
  const attH = home ? shrinkMean(home.scoredSeries, g) : g;
  const defH = home ? shrinkMean(home.concededSeries, g) : g;
  const attA = away ? shrinkMean(away.scoredSeries, g) : g;
  const defA = away ? shrinkMean(away.concededSeries, g) : g;

  // Avantage domicile (convention handball-strategy-top8 : HOME_ADV = 1.8 →
  // +0.9 sur le local, −0.45 sur le visiteur).
  const k = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const lambdaH = Math.max(((attH + defA) / 2 + 0.9) * k, 5);
  const lambdaA = Math.max(((attA + defH) / 2 - 0.45) * k, 5);

  return {
    lambdaH,
    lambdaA,
    scale: round1(k * 1000) / 1000,
    expectedTotal: round1(lambdaH + lambdaA),
  };
}

// ─── Échelle Over ───

/**
 * λ CMP tel que E[CMP(λ, ν)] = moyenne voulue (bissection sur cmpMean).
 * Indispensable : avec ν ≠ 1, la moyenne du modèle ≠ paramètre λ — sans cette
 * inversion, ν = 1.3 écrase la moyenne (Over à 0 %) et ν = 0.7 l'écrase (100 %).
 */
function cmpLambdaForMean(meanGoals: number, nu: number): number {
  if (meanGoals <= 0) return 1e-6;
  if (Math.abs(nu - 1) < 1e-6) return meanGoals;
  let lo = 0.2 * meanGoals;
  let hi = 3 * meanGoals;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (cmpMean(mid, nu) < meanGoals) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Échelle complète Over : P(total > ligne) pour chaque ligne, marquée
 * jouable si ≥ 55 %. Descend tout en bas de l'échelle même si aucune ligne
 * ne passe le seuil (l'UI affiche alors « aucune ligne jouable »).
 *
 * `lambdaH` / `lambdaA` sont des MOYENNES attendues (buts/équipe) : elles
 * sont converties en paramètres CMP via cmpLambdaForMean avant convolution.
 */
export function overLadder(
  lambdaH: number,
  nuH: number,
  lambdaA: number,
  nuA: number,
  lines: readonly number[] = DEFAULT_OVER_LINES
): OverLine[] {
  const lh = cmpLambdaForMean(lambdaH, nuH);
  const la = cmpLambdaForMean(lambdaA, nuA);
  return lines.map((line) => {
    const { over, under } = overUnderProb(lh, nuH, la, nuA, line);
    return {
      line,
      over,
      under,
      playable: over >= PROB_FLOOR,
    };
  });
}

/** Ligne jouable la plus haute (Over 60 d'abord) — null si aucune ≥ 55 %. */
export function pickPlayableLine(ladder: readonly OverLine[]): OverLine | null {
  return ladder.find((l) => l.playable) ?? null;
}

// ─── 1X2 ───

/** P(X ≥ n) pour X ~ Poisson(λ) (queue de Poisson, bornée [0;1]). */
export function poissonAtLeast(n: number, lambda: number): number {
  const lam = Math.max(lambda, 1e-9);
  let cdf = 0;
  for (let k = 0; k < n; k++) {
    // e^(−λ) · λ^k / k! — produit de i=1 à k (i=0 → e^(−λ) seul)
    let term = Math.exp(-lam);
    for (let i = 1; i <= k; i++) term = (term * lam) / i;
    cdf += term;
  }
  return Math.min(1, Math.max(0, 1 - cdf));
}

/**
 * Proba « meilleur buteur au moins N buts » (N = 2, 3, 4, 5).
 * λ ajusté au rythme attendu du match : moyenne du joueur ×
 * (λ équipe modèle / moyenne mondiale), facteur borné [0.75 ; 1.35].
 */
export function scorerProbs(
  avgGoals: number,
  teamLambda: number,
  globalTeamGoals: number = NEUTRAL_TEAM_LAMBDA
): { lambda: number; probs: ScorerThreshold[] } {
  const ratio = Math.min(1.35, Math.max(0.75, teamLambda / Math.max(globalTeamGoals, 1)));
  const lambda = Math.max(avgGoals * ratio, 0.05);
  return {
    lambda: round1(lambda * 100) / 100,
    probs: GOAL_THRESHOLDS.map((n) => {
      const p = poissonAtLeast(n, lambda);
      return { n, p, playable: p >= PROB_FLOOR };
    }),
  };
}

/**
 * ν global des totaux par apparillage de variance : on cherche ν tel que
 * Var_modèle(λ, ν) = Var observée, λ calé pour que E_modèle = moyenne
 * observée (bissection imbriquée). Le MLE Newton de fitCMP ne converge pas
 * sur des échantillons hétérogènes de 8 jours (λ=68.7 pour une moyenne 60.5)
 * → on ne l'utilise pas ici. Repli 1.3 (ν handball du plan) si n < 30.
 */
export function fitNu(rows: readonly HistoryMatch[]): { nu: number; n: number } {
  const totals = rows.map((r) => r.homeGoals + r.awayGoals);
  const n = totals.length;
  if (n < 30) return { nu: 1.3, n };
  const m = totals.reduce((a, b) => a + b, 0) / n;
  const obs = totals.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1);
  if (!Number.isFinite(obs) || m <= 0) return { nu: 1.3, n };

  const lambdaFor = (nu: number): number => {
    let lo = 0.3 * m;
    let hi = 3 * m;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (cmpMean(mid, nu) < m) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const modelVar = (nu: number): number => {
    const pmf = cmpPmf(lambdaFor(nu), nu);
    let mu = 0;
    for (let k = 0; k < pmf.length; k++) mu += k * pmf[k];
    let v = 0;
    for (let k = 0; k < pmf.length; k++) v += (k - mu) ** 2 * pmf[k];
    return v;
  };

  // Bornes [0.7 ; 2.5] : au-delà, la grille CMP dérive (λ explose quand ν
  // s'éloigne de 1) et l'échelle Over devient absurde.
  let lo = 0.7;
  let hi = 2.5;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    // ν trop petit → variance du modèle trop grande
    if (modelVar(mid) > obs) lo = mid;
    else hi = mid;
  }
  const nu = (lo + hi) / 2;
  return { nu: Number.isFinite(nu) ? nu : 1.3, n };
}
