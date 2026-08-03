// Contrat de données partagé entre le connecteur ESPN gratuit, le moteur
// de pression (Pressure Index) et le composant MomentumChart (détail match).
// Voir docs/superpowers/specs/2026-08-04-football-momentum-timeline-design.md
//
// Règle défensive : les données par minute ne sont PAS garanties pour toutes
// les ligues. Chaque couche est optionnelle et signalée via `layers` dans
// MatchTimelineData (le client adapte le rendu, jamais de crash).

export type MatchSide = "home" | "away";

export type MatchEventKind = "goal" | "corner" | "shot";

/** Événement minute-par-minute d'un match de football. */
export interface MatchEvent {
  /** Minute de l'événement (0 → 90+, stoppage clampé sur la minute de base). */
  minute: number;
  kind: MatchEventKind;
  side: MatchSide;
  /** Nom du buteur (uniquement pour kind === "goal"). */
  scorer?: string | null;
  teamName?: string | null;
  /** xG de l'action (BSD/ESPN lorsqu'il est disponible). */
  xg?: number | null;
  /** Score après l'événement (but uniquement). */
  score?: { home: number; away: number } | null;
  goalType?: "regular" | "own" | "penalty";
}

/** Point de courbe de momentum/pression. value ∈ [-100,+100], + = domicile. */
export interface MomentumTimePoint {
  /** Minute du point (centre du bucket de 5 min, ou minute brute). */
  minute: number;
  value: number;
  /** Contribution domicile normalisée 0..100. */
  homePressure: number;
  /** Contribution extérieur normalisée 0..100. */
  awayPressure: number;
}

/** Bucket de danger dérivé (5 min) — volume d'attaques dangereuses proxy. */
export interface DangerousBucket {
  /** Minute de début du bucket (0 | 5 | ... | 85). */
  start: number;
  home: number; // 0..100
  away: number; // 0..100
}

/** Totaux match (fallback / matchstats) pour la courbe lissée. */
export interface TimelineTotals {
  possession: { home: number; away: number };
  corners: { home: number; away: number };
  shots: { home: number; away: number };
  sot: { home: number; away: number };
}

/** Données complètes de la timeline momentum d'un match (GET .../stats). */
export interface MatchTimelineData {
  momentum: MomentumTimePoint[];
  events: MatchEvent[];
  xgPerMinute: { minute: number; home: number; away: number }[];
  dangerous: DangerousBucket[];
  pressure: { homePct: number; awayPct: number };
  layers: {
    goals: boolean;
    corners: boolean;
    dangerous: boolean;
    /** false → courbe lissée dérivée des totaux (pas de données par minute). */
    perMinute: boolean;
  };
  source: "bsd" | "espn" | "bsd+espn";
  updatedAt?: string;
}

/**
 * Clone défensif d'un tableau inconnu → array typé vide si invalide.
 * Cache les incohérences de payloads externes (ESPN/BSD).
 */
export function toArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}