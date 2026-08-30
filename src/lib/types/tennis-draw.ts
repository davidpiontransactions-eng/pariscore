/**
 * Types partagés pour les tableaux principaux ATP/WTA
 * et les prévisions de tournoi (Singles Forecast).
 *
 * Source: TennisAbstract-style simulation basée sur Elo surface-specific.
 */

/** Round du tableau principal. */
export type DrawRound =
  | "R128" | "R64" | "R32" | "R16"
  | "QF" | "SF" | "F" | "W";

/** Ordre chronologique des rounds (pour tri et affichage). */
export const ROUND_ORDER: DrawRound[] = [
  "R128", "R64", "R32", "R16", "QF", "SF", "F", "W",
];

/** Label d'affichage court pour chaque round. */
export const ROUND_LABELS: Record<DrawRound, string> = {
  R128: "1/128",
  R64: "1/64",
  R32: "1/32",
  R16: "1/16",
  QF: "1/4",
  SF: "1/2",
  F: "Finale",
  W: "Champion",
};

/** Status d'un match dans le draw. */
export type DrawMatchStatus =
  | "upcoming"   // pas encore joué
  | "live"       // en cours
  | "completed"; // terminé

/** Un match dans le bracket. */
export interface DrawMatch {
  /** ID du match (si disponible). */
  id?: string;
  /** Round du match. */
  round: DrawRound;
  /** Position dans le bracket (0-based, top→bottom). */
  position: number;
  /** Joueur 1 (top du bracket). */
  player1: DrawMatchPlayer;
  /** Joueur 2 (bottom du bracket). */
  player2: DrawMatchPlayer;
  /** Score du match (si complété). */
  score?: string;
  /** Status du match. */
  status: DrawMatchStatus;
  /** Gagnant (si complété). */
  winner?: 1 | 2;
}

/** Joueur dans un match du bracket. */
export interface DrawMatchPlayer {
  /** Nom affiché. */
  name: string;
  /** Seed (null si non seedé). */
  seed?: number;
  /** Code pays ISO 3166-1 alpha-2. */
  country?: string;
  /** ID du joueur (si disponible). */
  id?: string;
}

/** Un joueur dans la table de forecast. */
export interface ForecastRow {
  /** Nom du joueur. */
  name: string;
  /** Seed. */
  seed?: number;
  /** Code pays. */
  country?: string;
  /** ID du joueur. */
  id?: string;
  /** Photo URL. */
  photo?: string;
  /** Round actuel du joueur (s'il est encore en lice). */
  currentRound?: DrawRound;
  /** Probabilités cumulées d'atteindre chaque round. */
  probabilities: Partial<Record<DrawRound, number>>;
  /** Match actuel (si encore en lice). */
  currentMatch?: {
    opponent: string;
    score?: string;
    status: DrawMatchStatus;
  };
}

/** Réponse API complète pour un draw de tournoi. */
export interface TournamentDraw {
  /** Slug du tournoi. */
  slug: string;
  /** Nom du tournoi. */
  name: string;
  /** Année. */
  year: number;
  /** Surface. */
  surface: string;
  /** Catégorie (WTA 500, ATP Masters 1000, etc.). */
  category?: string;
  /** Pays. */
  country?: string;
  /** Taille du tableau principal. */
  drawSize: number;
  /** Source des données. */
  source: "tennisabstract" | "bsd" | "manual";
  /** Date de dernière mise à jour. */
  updatedAt: string;
  /** Lignes de forecast (triées par probabilité de titre décroissante). */
  forecast: ForecastRow[];
  /** Matches du bracket (optionnel, pour la vue arbre). */
  matches?: DrawMatch[];
}

/** Mapping slug TennisAbstract → nom de fichier. */
export const TENNISABSTRACT_SLUG_MAP: Record<string, string> = {
  "monterrey": "2026WTAMonterrey",
  "australian-open": "2026AustralianOpen",
  "roland-garros": "2026RolandGarros",
  "wimbledon": "2026Wimbledon",
  "us-open": "2026USOpen",
  "indian-wells": "2026IndianWells",
  "miami": "2026Miami",
  "monte-carlo": "2026MonteCarlo",
  "madrid": "2026Madrid",
  "rome": "2026Rome",
  "canada": "2026Canada",
  "cincinnati": "2026Cincinnati",
  "shanghai": "2026Shanghai",
  "paris": "2026Paris",
};
