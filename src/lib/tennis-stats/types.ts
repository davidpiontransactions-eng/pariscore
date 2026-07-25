// Types pour l'enrichissement des stats joueurs Tennis Prematch.
//
// Ces 6 métriques (Elo standard, Ranking ATP/WTA, Elo Surface, Rang Elo
// Surface, SPS, Rang SPS) sont lues directement de `pariscore.db` — la base
// SQLite peuplée en production par `computeTennisElo()` (server.js) et le
// cron Python `cron_sps_updater.py`. Toutes les valeurs sont `| null` : si
// le joueur ou la surface n'est pas en base, l'UI affiche un fallback `—`
// plutôt qu'une valeur trompeuse (ex: `#0` ou `Elo 1500`).

export type PlayerStats = {
  /** #1 — Elo standard (overall). Source: tennis_players_elo.elo_rating. */
  elo: number | null;
  /** #2 — Ranking ATP actuel. Source: tennis_players_elo.atp_rank. */
  atpRank: number | null;
  /** #2 — Ranking WTA actuel. Source: tennis_players_elo.wta_rank. */
  wtaRank: number | null;
  /** #3 — Elo calculé sur la surface du match. Source: tennis_elo.elo. */
  eloSurface: number | null;
  /** #4 — Classement Elo Surface (rang du joueur sur cette surface).
   *  Calculé via RANK() OVER (PARTITION BY surface ORDER BY elo DESC). */
  surfaceEloRank: number | null;
  /** #5 — Surface PowerScore [0-100]. Source: player_surface_scores.sps. */
  sps: number | null;
  /** #6 — Classement SPS (rang du joueur sur cette surface).
   *  Calculé via RANK() OVER (PARTITION BY surface ORDER BY sps DESC). */
  spsRank: number | null;
  /** Bonus UX — confiance du SPS (0/1 binaire: 1 si sample suffisant).
   *  Source: player_surface_scores.confidence_full. */
  spsConfidence: number | null;
  /** Bonus UX — nombre de matchs pris en compte pour le SPS.
   *  Source: player_surface_scores.matches_played. */
  spsMatches: number | null;
  /** #7 — Dominance Ratio médian sur les 5 derniers matchs (filtré surface).
   *  Source: tennisabstract /jsfrags/ via dr-cache.json (cron nocturne,
   *  flag LEGAL_OVERRIDE_CONFIRMED). Fallback tous-surfaces si <3 matchs sur
   *  la surface demandée. null = indisponible (joueur absent du cache). */
  drMoyen5m?: number | null;
  /** #8 — % de points gagnés au service (médiane 5 derniers matchs, surface).
   *  Source: tennisabstract (cache DR étendu). Alimente le modèle Over/Under
   *  Games. null = indisponible (fallback Elo côté modèle). */
  servePtsWonPct?: number | null;
  /** #9 — % de points gagnés au retour. Heuristique (≈0.36 moyenne tour) faute
   *  de données adverses détaillées. null = indisponible. */
  returnPtsWonPct?: number | null;
};

/** Map indexé par nom normalisé de joueur. */
export type PlayerStatsMap = Record<string, PlayerStats>;

/** Surfaces telles que stockées en base (anglais, format Sackmann). */
export const DB_SURFACES = ["Hard", "Clay", "Grass", "Carpet"] as const;
export type DBSurface = (typeof DB_SURFACES)[number];

/** Surfaces telles qu'affichées dans l'UI (français, type Surface du domaine). */
export type UISurface = "Dur" | "Terre battue" | "Gazon";
