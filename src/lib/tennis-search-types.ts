/**
 * Types partagés pour la recherche tennis (P8).
 *
 * Ces types sont utilisés par :
 *   - src/app/api/tennis/search/route.ts
 *   - src/app/api/tennis/tournaments/route.ts
 *   - src/lib/tennis-search-index.ts
 *   - src/lib/tennis-tournaments-index.ts
 *   - src/components/tennis/tennis-search-bar.tsx (composant unifié joueurs + tournois)
 *   - src/hooks/use-tennis-search.ts
 */

/** Joueur pour autocomplétion. */
export type PlayerResult = {
  /** Slug identifiant (ex: "jannik_sinner") — utilisé dans l'URL /tennis/player/[slug] */
  id: string;
  /** Nom complet affiché (ex: "Jannik Sinner") */
  name: string;
  /** Slug = id (alias pour clarté côté client) */
  slug: string;
  /** Rang ATP ou WTA (si connu) */
  rank?: number;
  /** Code pays ISO 2 lettres (ex: "IT") — pour drapeau emoji */
  country?: string;
  /** URL photo (headshot) */
  photoUrl?: string;
  /** Circuit : ATP ou WTA */
  circuit?: "ATP" | "WTA";
};

/** Tournoi pour autocomplétion. */
export type TournamentResult = {
  /** Slug identifiant (ex: "roland-garros") */
  id: string;
  /** Nom affiché (ex: "Roland-Garros") */
  name: string;
  /** Slug = id (alias) */
  slug: string;
  /** Surface principale */
  surface?: "Dur" | "Terre" | "Gazon" | "Moquette" | string;
  /** Code pays ISO 2 (ex: "FR") */
  country?: string;
  /** Catégorie : Grand Slam / ATP Masters 1000 / ATP 500 / ATP 250 / WTA ... */
  category?:
    | "Grand Slam"
    | "ATP Masters 1000"
    | "ATP 500"
    | "ATP 250"
    | "ATP Finals"
    | "WTA 1000"
    | "WTA 500"
    | "WTA 250"
    | "Challenger"
    | "ITF"
    | string;
  /** Ville (ex: "Paris") */
  city?: string;
  /** Date de début ISO (optionnel) */
  startDate?: string;
  /** Date de fin ISO (optionnel) */
  endDate?: string;
};

/** Réponse de /api/tennis/search. */
export type SearchResponse = {
  players: PlayerResult[];
  tournaments: TournamentResult[];
  total: number;
  query: string;
  type: "players" | "tournaments" | "all";
  /** Indique la source réelle utilisée (transparence pour debug) */
  source: "hardcoded-top100" | "db" | "bsd" | "tennistemple" | "empty";
  updatedAt: string;
};

/** Réponse de /api/tennis/tournaments. */
export type TournamentsResponse = {
  tournaments: TournamentResult[];
  source: "bsd" | "hardcoded" | "tennistemple" | "empty";
  date: string;
  updatedAt: string;
};

/** Paramètres de recherche validés par Zod. */
export const SEARCH_TYPES = ["players", "tournaments", "all"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
