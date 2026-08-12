// Moteur d'agrégation des statistiques moyennes par tournoi (tennis).
//
// Source : toutes les rencontres TERMINÉES d'une édition de tournoi, filtrées
// sur la BDD BSD (`bsd-tennis-service`). Pour chaque joueuse/joueur on calcule
// les moyennes par match des 6 métriques de service :
//   - Aces / match
//   - Doubles fautes / match
//   - % 1er service réussi
//   - % Points gagnés sur 1er service
//   - % Points gagnés sur 2d service
//   - % Balles de break sauvées
//
// Fallback sûr : si la joueuse n'a disputé AUCUN match dans l'édition en cours
// (ex. débutante à son 1er tour), on bascule sur sa moyenne de la SAISON sur
// surface dure — le champ `source` le signale à l'UI qui affiche le badge
// « Moyenne Surface Dur 2026 ».
//
// Formatage strict : `Math.round()` sur les pourcentages, arrondi à 1 décimale
// sur les moyennes par match. Aucune décimale parasite.

import type { BSDMatch } from "./bsd-tennis-service";

/** Origine des statistiques d'un joueur. */
export type TournamentStatsSource = "tournament" | "season-hard";

/** Moyennes calculées pour un joueur sur un échantillon de matchs. */
export type PlayerTournamentStats = {
  playerId: number;
  playerName: string;
  /** Nombre de matchs utilisés pour le calcul (non-null seulement). */
  matchesPlayed: number;
  /** "tournament" = édition en cours · "season-hard" = fallback saison sur dur. */
  source: TournamentStatsSource;
  /** Moyennes par match — null si aucune valeur exploitable. */
  acesPerMatch: number | null;
  doubleFaultsPerMatch: number | null;
  /** Pourcentages moyens (déjà arrondis à l'entier). */
  firstServePct: number | null;
  firstServeWonPct: number | null;
  secondServeWonPct: number | null;
  breakPointsSavedPct: number | null;
};

export type TournamentStatsResult = {
  tournamentId: number;
  tournamentName: string;
  season: number;
  players: PlayerTournamentStats[];
};

const P_SURFACE: Record<string, string> = {
  hard: "Dur",
  clay: "Terre battue",
  grass: "Gazon",
  carpet: "Dur",
} as const;

/** Récupère les stats de service d'un joueur dans un match BSD (p1 ou p2). */
function statsOf(
  match: BSDMatch,
  playerId: number,
): {
  aces: number | null;
  doubleFaults: number | null;
  firstServePct: number | null;
  firstServeWonPct: number | null;
  secondServeWonPct: number | null;
  breakPointsSavedPct: number | null;
} | null {
  if (match.player1?.id === playerId) {
    return {
      aces: match.p1_aces,
      doubleFaults: match.p1_double_faults,
      firstServePct: match.p1_first_serve_pct,
      firstServeWonPct: match.p1_first_serve_won_pct,
      secondServeWonPct: match.p1_second_serve_won_pct,
      breakPointsSavedPct: match.p1_break_points_saved_pct,
    };
  }
  if (match.player2?.id === playerId) {
    return {
      aces: match.p2_aces,
      doubleFaults: match.p2_double_faults,
      firstServePct: match.p2_first_serve_pct,
      firstServeWonPct: match.p2_first_serve_won_pct,
      secondServeWonPct: match.p2_second_serve_won_pct,
      breakPointsSavedPct: match.p2_break_points_saved_pct,
    };
  }
  return null;
}

type Acc = {
  count: number;
  total: number;
};

function avg(acc: Acc): number | null {
  if (acc.count === 0) return null;
  return Math.round((acc.total / acc.count) * 10) / 10;
}

function pct(acc: Acc): number | null {
  if (acc.count === 0) return null;
  return Math.round(acc.total / acc.count);
}

/**
 * Agrège les stats moyennes d'un joueur sur un ensemble de matchs BSD.
 * Chaque métrique est moyennée sur ses propres occurrences non-null :
 * un match sans valeur exploitable n'est pas compté comme un 0.
 */
export function aggregatePlayerStats(
  matches: BSDMatch[],
  playerId: number,
  playerName: string | null,
  source: TournamentStatsSource,
): PlayerTournamentStats {
  const aces: Acc = { count: 0, total: 0 };
  const dfs: Acc = { count: 0, total: 0 };
  const fsp: Acc = { count: 0, total: 0 };
  const fsw: Acc = { count: 0, total: 0 };
  const ssw: Acc = { count: 0, total: 0 };
  const bps: Acc = { count: 0, total: 0 };
  let matchesPlayed = 0;

  for (const m of matches) {
    const s = statsOf(m, playerId);
    if (!s) continue;
    if (s.aces !== null) { aces.total += s.aces; aces.count++; }
    if (s.doubleFaults !== null) { dfs.total += s.doubleFaults; dfs.count++; }
    if (s.firstServePct !== null) { fsp.total += s.firstServePct; fsp.count++; }
    if (s.firstServeWonPct !== null) { fsw.total += s.firstServeWonPct; fsw.count++; }
    if (s.secondServeWonPct !== null) { ssw.total += s.secondServeWonPct; ssw.count++; }
    if (s.breakPointsSavedPct !== null) { bps.total += s.breakPointsSavedPct; bps.count++; }
    // Match échantillonné si au moins une métrique exploitable.
    if (
      s.aces !== null || s.doubleFaults !== null || s.firstServePct !== null ||
      s.firstServeWonPct !== null || s.secondServeWonPct !== null || s.breakPointsSavedPct !== null
    ) {
      matchesPlayed++;
    }
  }

  return {
    playerId,
    playerName: playerName ?? "Joueur",
    matchesPlayed,
    source,
    acesPerMatch: avg(aces),
    doubleFaultsPerMatch: avg(dfs),
    firstServePct: pct(fsp),
    firstServeWonPct: pct(fsw),
    secondServeWonPct: pct(ssw),
    breakPointsSavedPct: pct(bps),
  };
}

/** Vrai si le joueur a au moins un match exploitable sur l'échantillon. */
export function hasUsableSample(stats: PlayerTournamentStats): boolean {
  return (
    stats.acesPerMatch !== null ||
    stats.doubleFaultsPerMatch !== null ||
    stats.firstServePct !== null ||
    stats.firstServeWonPct !== null ||
    stats.secondServeWonPct !== null ||
    stats.breakPointsSavedPct !== null
  );
}

/** Normalisation light pour comparer les noms BSD (p1/p2) et UI. */
export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Sélectionne la source d'un joueur : édition du tournoi si échantillon
 * exploitable, sinon fallback saison sur surface dure.
 */
export function pickTournamentStats(
  tournamentAgg: PlayerTournamentStats,
  seasonHardAgg: PlayerTournamentStats | null,
): PlayerTournamentStats {
  if (hasUsableSample(tournamentAgg)) return tournamentAgg;
  if (seasonHardAgg && hasUsableSample(seasonHardAgg)) return seasonHardAgg;
  return tournamentAgg;
}

/** Surface BSD canonique → surface UI française. */
export function surfaceUiLabel(raw: string | null | undefined): string {
  if (!raw) return "Dur";
  const key = raw.toLowerCase();
  return P_SURFACE[key] ?? "Dur";
}