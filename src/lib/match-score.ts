/**
 * Match Score Engine — "Meilleurs matchs du jour"
 *
 * Calcule un score composite 0-10 pour chaque match tennis.
 * Base sur la methode Dispatcharr (deterministe, tanh compression)
 * avec des poids specialises tennis.
 *
 * Signaux : Closeness, Tournament Importance, Elo Quality,
 *           Star Power, Form, Rivalry.
 *
 * Ref: Dispatcharr Ranked Matchups, Lahvicka Monte Carlo, Watchability Score.
 */

import { resolveTournamentPriority } from "./tournament-priority";
import { resolveRoundPriority } from "./round-priority";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchLabel = "TOP MATCH" | "FEATURED" | "INTERESTING" | "STANDARD";

export interface SignalBreakdown {
  closeness: number;       // 0-1
  tournamentImp: number;   // 0-1
  eloQuality: number;      // 0-1
  starPower: number;        // 0-1
  form: number;             // 0-1
  rivalry: number;          // 0-1
}

export interface MatchScoreResult {
  score: number;            // 0-10 (tanh compressed)
  raw: number;              // avant compression
  breakdown: SignalBreakdown;
  label: MatchLabel;
  labelColor: string;       // CSS color
  labelBg: string;          // CSS bg-color
}

// ---------------------------------------------------------------------------
// Poids des signaux (somme = 11.5)
// ---------------------------------------------------------------------------

const WEIGHTS = {
  closeness: 2.5,
  tournamentImp: 3.0,
  eloQuality: 2.0,
  starPower: 2.0,
  form: 1.5,
  rivalry: 0.5,
} as const;

const TOTAL_WEIGHT =
  WEIGHTS.closeness +
  WEIGHTS.tournamentImp +
  WEIGHTS.eloQuality +
  WEIGHTS.starPower +
  WEIGHTS.form +
  WEIGHTS.rivalry; // 11.5

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compte les victoires dans un tableau de forme W/L. */
function countWins(form: ("W" | "L")[] | undefined | null): number {
  if (!form || form.length === 0) return 0;
  return form.filter((r) => r === "W").length;
}

/**
 * Closeness : 1.0 = coinflip parfait (50-50), 0.0 = blowout.
 * Formule : 1 - |P(A) - 0.5| * 2
 */
function closeness(probA: number): number {
  const p = probA / 100; // normaliser 0-100 → 0-1
  return 1 - Math.abs(p - 0.5) * 2;
}

/**
 * Tournament importance : resout via tournament-priority.ts.
 * GS=0 → ITF=10. On inverse et normalise : (10 - priority) / 10.
 * + bonus round : Finale=+0.3, SF=+0.2, QF=+0.1.
 */
function tournamentImportance(
  tournament: string,
  round: string,
): number {
  const tPriority = resolveTournamentPriority(tournament);
  const rPriority = resolveRoundPriority(round);

  // Base : 0-10 → 0-1 (inverse : GS=1.0, ITF=0.1)
  let imp = (10 - tPriority) / 10;

  // Round bonus
  if (rPriority <= 0) imp += 0.3;       // Finale
  else if (rPriority === 1) imp += 0.2;  // Demi
  else if (rPriority === 2) imp += 0.1;  // Quart

  return Math.min(1, imp);
}

/**
 * Elo quality : moyenne des deux Elos normalisee.
 * 1500=baseline, 2500=elite → 1.0.
 */
function eloQuality(eloA: number, eloB: number): number {
  const avg = (eloA + eloB) / 2;
  return Math.min(1, Math.max(0, (avg - 1400) / 1100));
}

/**
 * Star power : inverse du rang moyen.
 * Rang 1+1=2 → 1.0, Rang 100+100=200 → 0.0.
 */
function starPower(rankA: number, rankB: number): number {
  const avgRank = (rankA + rankB) / 2;
  return Math.min(1, Math.max(0, 1 - (avgRank - 1) / 99));
}

/**
 * Forme : victoires totales sur les 5 derniers / 10.
 * Les deux joueurs en forme = match excitant.
 */
function formScore(
  formA: ("W" | "L")[] | undefined | null,
  formB: ("W" | "L")[] | undefined | null,
): number {
  const winsA = countWins(formA);
  const winsB = countWins(formB);
  return (winsA + winsB) / 10;
}

/**
 * Rivalry : H2H proche de 50-50 = bonus.
 * Si pas d'H2H → 0.3 (defaut neutre).
 */
function rivalryScore(
  h2hHistory?: Array<{ winnerId: string }>,
  playerAId?: string,
): number {
  if (!h2hHistory || h2hHistory.length === 0) return 0.3;

  const total = h2hHistory.length;
  const winsA = h2hHistory.filter((h) => h.winnerId === playerAId).length;
  const ratio = winsA / total;

  // Plus c'est proche de 0.5, plus c'est bon
  return 1 - Math.abs(ratio - 0.5) * 2;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

function getLabel(score: number): {
  label: MatchLabel;
  color: string;
  bg: string;
} {
  if (score >= 8.5)
    return { label: "TOP MATCH", color: "text-emerald-400", bg: "bg-emerald-500/20" };
  if (score >= 7.0)
    return { label: "FEATURED", color: "text-amber-400", bg: "bg-amber-500/20" };
  if (score >= 5.0)
    return { label: "INTERESTING", color: "text-sky-400", bg: "bg-sky-500/20" };
  return { label: "STANDARD", color: "text-zinc-400", bg: "bg-zinc-500/10" };
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

export interface MatchScoreInput {
  probA: number;
  eloA: number;
  eloB: number;
  rankA: number;
  rankB: number;
  formA?: ("W" | "L")[] | null;
  formB?: ("W" | "L")[] | null;
  tournament: string;
  round: string;
  h2hHistory?: Array<{ winnerId: string }>;
  playerAId?: string;
}

/**
 * Calcule le score composite d'un match (0-10).
 *
 * Methode : somme ponderee des signaux → compression tanh → 0-10.
 * Deterministe : memes inputs = meme score.
 */
export function computeMatchScore(input: MatchScoreInput): MatchScoreResult {
  // 1. Calculer chaque signal (0-1)
  const sCloseness = closeness(input.probA);
  const sTournament = tournamentImportance(input.tournament, input.round);
  const sElo = eloQuality(input.eloA, input.eloB);
  const sStar = starPower(input.rankA, input.rankB);
  const sForm = formScore(input.formA, input.formB);
  const sRivalry = rivalryScore(input.h2hHistory, input.playerAId);

  // 2. Somme ponderee
  const raw =
    WEIGHTS.closeness * sCloseness +
    WEIGHTS.tournamentImp * sTournament +
    WEIGHTS.eloQuality * sElo +
    WEIGHTS.starPower * sStar +
    WEIGHTS.form * sForm +
    WEIGHTS.rivalry * sRivalry;

  // 3. Compression tanh → 0-10
  // tanh(raw / (TOTAL_WEIGHT * 0.5)) * 10
  // Le diviseur 0.5 ajuste la courbe pour que 10 soit asymptotique
  const score = Math.tanh(raw / (TOTAL_WEIGHT * 0.5)) * 10;

  // 4. Arrondir a 1 decimale
  const rounded = Math.round(score * 10) / 10;

  // 5. Label + couleurs
  const { label, color, bg } = getLabel(rounded);

  return {
    score: rounded,
    raw,
    breakdown: {
      closeness: sCloseness,
      tournamentImp: sTournament,
      eloQuality: sElo,
      starPower: sStar,
      form: sForm,
      rivalry: sRivalry,
    },
    label,
    labelColor: color,
    labelBg: bg,
  };
}

/**
 * Filtre et trie les matchs par score descendant.
 * Retourne les top N matchs avec leur score.
 */
export function rankTopMatches<T>(
  matches: T[],
  getScoreInput: (m: T) => MatchScoreInput,
  limit: number = 10,
): Array<T & { matchScore: MatchScoreResult }> {
  return matches
    .map((m) => ({
      ...m,
      matchScore: computeMatchScore(getScoreInput(m)),
    }))
    .sort((a, b) => b.matchScore.score - a.matchScore.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Football scoring
// ---------------------------------------------------------------------------

export interface FootballScoreInput {
  homeProb: number;        // 0-100
  drawProb: number;        // 0-100
  awayProb: number;        // 0-100
  homeRank: number;
  awayRank: number;
  homeForm?: ("W" | "D" | "L")[];
  awayForm?: ("W" | "D" | "L")[];
  league: string;
  round: string;
}

/** Closeness pour football : 1.0 = 33-33-33, 0.0 = favori dominant. */
function footballCloseness(homeProb: number, awayProb: number): number {
  const pHome = homeProb / 100;
  const pAway = awayProb / 100;
  // Plus les probs sont proches de 1/3 chacune, mieux c'est
  const balance = 1 - Math.abs(pHome - pAway);
  return balance;
}

/** Importance du championnat ( Premier League > Ligue 2 > National). */
function leagueImportance(league: string): number {
  const norm = league.toLowerCase();
  // Top 5 leagues
  if (/premier league|la liga|bundesliga|serie a|ligue 1/i.test(norm)) return 1.0;
  // Europa league / Conference
  if (/europa|conference|champions/i.test(norm)) return 0.9;
  // Liga boxeux / top 10
  if (/eredivisie|primeira liga|super lig|championship/i.test(norm)) return 0.7;
  // Ligue 2 / Serie B / 2. bundesliga
  if (/ligue 2|serie b|2\. bundesliga|la liga 2/i.test(norm)) return 0.6;
  // National / lower
  return 0.4;
}

/** Forme W/D/L → score 0-1 (victoires + 0.5*nuls). */
function footballFormScore(
  form: ("W" | "D" | "L")[] | undefined | null,
): number {
  if (!form || form.length === 0) return 0.5;
  let pts = 0;
  for (const r of form) {
    if (r === "W") pts += 1;
    else if (r === "D") pts += 0.5;
  }
  return pts / form.length;
}

/**
 * Score composite pour un match football (0-10).
 */
export function computeFootballScore(input: FootballScoreInput): MatchScoreResult {
  const sCloseness = footballCloseness(input.homeProb, input.awayProb);
  const sLeague = leagueImportance(input.league);
  const sRank = starPower(input.homeRank, input.awayRank);
  const sForm = (footballFormScore(input.homeForm) + footballFormScore(input.awayForm)) / 2;

  const raw =
    3.0 * sCloseness +
    3.0 * sLeague +
    2.5 * sRank +
    2.0 * sForm;

  const score = Math.tanh(raw / 10) * 10;
  const rounded = Math.round(score * 10) / 10;
  const { label, color, bg } = getLabel(rounded);

  return {
    score: rounded,
    raw,
    breakdown: {
      closeness: sCloseness,
      tournamentImp: sLeague,
      eloQuality: 0.5,  // placeholder (pas d'Elo football)
      starPower: sRank,
      form: sForm,
      rivalry: 0.3,
    },
    label,
    labelColor: color,
    labelBg: bg,
  };
}

// ---------------------------------------------------------------------------
// Basketball scoring
// ---------------------------------------------------------------------------

export interface BasketballScoreInput {
  pHome: number | null;    // 0-1 probability home win
  edgeElo: number | null;  // elo differential
  homeRecord?: string | null;  // "45-20"
  awayRecord?: string | null;
  league: string;
}

/** Record "45-20" → win%. */
function recordWinPct(record: string | null | undefined): number {
  if (!record) return 0.5;
  const m = record.match(/(\d+)-(\d+)/);
  if (!m) return 0.5;
  const wins = parseInt(m[1], 10);
  const losses = parseInt(m[2], 10);
  const total = wins + losses;
  return total > 0 ? wins / total : 0.5;
}

/**
 * Score composite pour un match basketball (0-10).
 */
export function computeBasketballScore(input: BasketballScoreInput): MatchScoreResult {
  const probHome = input.pHome ?? 0.5;
  const sCloseness = 1 - Math.abs(probHome - 0.5) * 2;

  // League importance (NBA > WNBA > Euroleague > others)
  const norm = input.league.toLowerCase();
  let sLeague = 0.5;
  if (/nba/i.test(norm)) sLeague = 1.0;
  else if (/wnba/i.test(norm)) sLeague = 0.8;
  else if (/euroleague|euroleague/i.test(norm)) sLeague = 0.7;

  // Team quality based on win%
  const homePct = recordWinPct(input.homeRecord);
  const awayPct = recordWinPct(input.awayRecord);
  const sQuality = (homePct + awayPct) / 2;

  const raw =
    3.0 * sCloseness +
    2.5 * sLeague +
    3.0 * sQuality +
    1.5 * 0.5;  // form placeholder

  const score = Math.tanh(raw / 10) * 10;
  const rounded = Math.round(score * 10) / 10;
  const { label, color, bg } = getLabel(rounded);

  return {
    score: rounded,
    raw,
    breakdown: {
      closeness: sCloseness,
      tournamentImp: sLeague,
      eloQuality: sQuality,
      starPower: 0.5,
      form: 0.5,
      rivalry: 0.3,
    },
    label,
    labelColor: color,
    labelBg: bg,
  };
}

// ---------------------------------------------------------------------------
// CS2 scoring
// ---------------------------------------------------------------------------

export interface Cs2ScoreInput {
  team1Rank: number | null;
  team2Rank: number | null;
  bestOf: number | null;   // 1, 3, ou 5
  tournament: string;
}

/**
 * Score composite pour un match CS2 (0-10).
 */
export function computeCs2Score(input: Cs2ScoreInput): MatchScoreResult {
  const rank1 = input.team1Rank ?? 50;
  const rank2 = input.team2Rank ?? 50;
  const sRank = starPower(rank1, rank2);

  // BO5 > BO3 > BO1
  const bo = input.bestOf ?? 3;
  const sFormat = bo >= 5 ? 1.0 : bo >= 3 ? 0.7 : 0.4;

  // Tournament importance
  const norm = input.tournament.toLowerCase();
  let sTournament = 0.5;
  if (/major|champions/i.test(norm)) sTournament = 1.0;
  else if (/league|blast|iem/i.test(norm)) sTournament = 0.8;
  else if (/minor|esl one/i.test(norm)) sTournament = 0.6;

  const raw =
    2.5 * sRank +
    2.5 * sFormat +
    3.0 * sTournament +
    2.0 * 0.5;  // form placeholder

  const score = Math.tanh(raw / 10) * 10;
  const rounded = Math.round(score * 10) / 10;
  const { label, color, bg } = getLabel(rounded);

  return {
    score: rounded,
    raw,
    breakdown: {
      closeness: 0.5,
      tournamentImp: sTournament,
      eloQuality: sRank,
      starPower: sRank,
      form: 0.5,
      rivalry: 0.3,
    },
    label,
    labelColor: color,
    labelBg: bg,
  };
}
