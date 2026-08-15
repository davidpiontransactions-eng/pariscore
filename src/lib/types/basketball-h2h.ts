/**
 * Types partagés H2H Basketball (NBA & WNBA).
 * Miroir TypeScript de services/basketballH2HService.js — source : ESPN, recalcul local.
 * Référence : .context/report-h2h-basketballstats.md (formules §5, décisions §9).
 */

export type BasketballLeague = "nba" | "wnba";

export type H2HTeam = {
  id: string;
  name: string;
  abbr: string;
  logo: string | null;
};

/** Ligne de distribution Over : % de matchs au-dessus du seuil. */
export type OverRow = {
  threshold: number;
  pct: number;
};

/** Distribution à 3 colonnes (A / B / moyenne des deux %). */
export type OverRow3 = {
  threshold: number;
  a: number;
  b: number;
  avg: number;
};

export type OverBlock = {
  avg: number | null;
  thresholds: OverRow[];
};

export type QuarterOver = { q: "Q1" | "Q2" | "Q3" | "Q4" } & OverBlock;
export type HalfOver = { h: "1H" | "2H" } & OverBlock;

export type H2HSplit = {
  aWins: number;
  bWins: number;
  total: number;
  aPct: number | null;
  bPct: number | null;
};

/** Data points H2H — 8 métriques (OffRating supprimée, décision §9). */
export type H2HDataPoints = {
  wins: { a: number | null; b: number | null };
  ppg: { a: number | null; b: number | null };
  pointSpread: { a: number | null; b: number | null };
  fgPct: { a: number | null; b: number | null };
  threePct: { a: number | null; b: number | null };
  assistsPerGame: { a: number | null; b: number | null };
  reboundsPerGame: { a: number | null; b: number | null };
};

/** Stats saison par venue. netRating = avgMargin = marge moyenne (décision §9). */
export type VenueStats = {
  games: number;
  winPct: number | null;
  ppg: number | null;
  papg: number | null;
  avgMargin: number | null;
  leadAtHalfPct: number | null;
} | null;

export type TeamSeasonStats = {
  overall: VenueStats;
  home: VenueStats;
  away: VenueStats;
  /** Séquence W/L des 6 derniers (plus récent en premier). */
  form6: ("W" | "L")[];
  results5: ("W" | "L")[];
};

export type TeamOverStats = {
  avg: number | null;
  points: OverBlock;
  quarters: QuarterOver[];
  halves: HalfOver[];
};

export type TeamSpreadStats = {
  avgMargin: number | null;
  positive: OverRow[];
  negative: OverRow[];
};

export type MatchOverStats = {
  avgA: number | null;
  avgB: number | null;
  avgMatch: number | null;
  thresholds: OverRow3[];
};

export type BttsScope = "ft" | "h1" | "h2" | "q1" | "q2" | "q3" | "q4";

export type BttsBlock = MatchOverStats;

export type H2HMatch = {
  id: string;
  date: string;
  season: string;
  league: string;
  home: H2HTeam;
  away: H2HTeam;
  homeScore: number;
  awayScore: number;
  winnerId: string;
};

export type H2HPlayer = {
  id: string;
  name: string;
  pos: string;
  jersey: string;
  photo: string | null;
  slug: string;
  gp: number | null;
  ppg: number | null;
  threesMade: number | null;
  rebounds: number | null;
  offReb: number | null;
  defReb: number | null;
  /** Format rapport "x.x (total/matchs)". */
  gpFgm: string | null;
  fgm: number | null;
  fgPct: number | null;
  assists: number | null;
  blocks: number | null;
  steals: number | null;
  /** Non fourni par le gamelog ESPN — toujours null en V1. */
  plusMinus: number | null;
  minutes: number | null;
};

export type StandingRow = {
  rank: number;
  team: H2HTeam;
  wins: number;
  losses: number;
  winPct: number | null;
};

/** Réponse GET /api/v1/basketball/h2h. */
export type H2HResponse = {
  league: BasketballLeague;
  scope: string;
  teamA: {
    info: H2HTeam;
    seasonStats: TeamSeasonStats;
    overStats: TeamOverStats;
    spreadStats: TeamSpreadStats;
  };
  teamB: {
    info: H2HTeam;
    seasonStats: TeamSeasonStats;
    overStats: TeamOverStats;
    spreadStats: TeamSpreadStats;
  };
  split: H2HSplit;
  dataPoints: H2HDataPoints;
  /** ok | partial | pending — FG%/3P%/AST/REB H2H via summaries ESPN (lazy). */
  enrichment: "ok" | "partial" | "pending";
  matches: H2HMatch[];
  matchOver: MatchOverStats;
  btts: Record<BttsScope, BttsBlock>;
  generatedAt: string;
};

/** Réponse GET /api/v1/basketball/h2h/teams. */
export type TeamsResponse = H2HTeam[];

/** Réponse GET /api/v1/basketball/h2h/players. */
export type PlayersResponse = {
  team: H2HTeam;
  players: H2HPlayer[];
  standings: StandingRow[];
};
