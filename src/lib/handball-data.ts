// Types pour l'onglet Handball de PariScore

export type HandballLeague = {
  id: number;
  name: string;
  country: string;
  countryCode: string;
  logo?: string;
  season?: string;
};

export type HandballTeam = {
  id: number;
  name: string;
  shortName?: string;
  logo?: string;
};

export type HandballScore = {
  home: number;
  away: number;
  homeHalf?: number;
  awayHalf?: number;
};

export type HandballMatchStatus =
  | "not_started"
  | "live"
  | "halftime"
  | "finished"
  | "postponed"
  | "cancelled";

/**
 * Cotes d'ouverture 1xbet du snapshot (proxy CLV).
 * Snapshot actuel = 1X2 seul (fav1x2) ; totaux/handicap/BTTS remplis
 * quand le scrape les capture. Tout champ absent = marché non testable.
 */
export type HandballOpeningOdds = {
  /** Over 55.5 (cote ouverture) */
  over55?: number;
  /** Under 62.5 (cote ouverture) */
  under62?: number;
  /** 1X2 favori (cotes ouverture) */
  fav1x2?: { home?: number; draw?: number; away?: number };
  /** Handicap favori -4.5 (cote ouverture) */
  handicap?: number;
  /** Les deux équipes à 30+ (cote ouverture) */
  btts30?: number;
};

export type HandballMatch = {
  id: number;
  league: HandballLeague;
  home: HandballTeam;
  away: HandballTeam;
  kickoff: string; // ISO date
  status: HandballMatchStatus;
  score?: HandballScore;
  minute?: number;
  odds?: {
    home?: number;
    draw?: number;
    away?: number;
  };
  /** Cotes d'ouverture (proxy CLV) — voir HandballOpeningOdds */
  openingOdds?: HandballOpeningOdds;
  // Stats live optionnelles
  stats?: {
    home7m?: number;
    away7m?: number;
    homeSaves?: number;
    awaySaves?: number;
    homeRedCards?: number;
    awayRedCards?: number;
  };
};
