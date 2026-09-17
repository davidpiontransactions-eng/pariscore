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
