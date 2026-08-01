// Types pour le dashboard statistique global des ligues
// Route: GET /api/v1/leagues/:league_id/stats

export type LocationFilter = "all" | "home" | "away";

export type LeagueInfo = {
  id: string;
  name: string;
  country: string;
  sport: "football" | "basketball" | "tennis";
  logo: string;
  season: string;
};

export type TeamStandingStats = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  pointsPerGame: number;
  xG: number;
  xGA: number;
  xGD: number;
  over15Pct: number;
  over15PctL5: number;
  over15PctL10: number;
  under35Pct: number;
  under35PctL5: number;
  under35PctL10: number;
  bttsYesPct: number;
  bttsYesPctL5: number;
  bttsYesPctL10: number;
};

export type TeamStanding = {
  rank: number;
  team: {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    color: string;
  };
  stats: TeamStandingStats;
};

export type MarketTopEntry = {
  teamId: string;
  teamName: string;
  shortName: string;
  logo: string;
  value: number;
};

export type MarketTops = {
  pointsPerGame: MarketTopEntry[];
  over15Pct: MarketTopEntry[];
  under35Pct: MarketTopEntry[];
  bttsYesPct: MarketTopEntry[];
  xG: MarketTopEntry[];
  xGA: MarketTopEntry[];
};

export type LeagueStatsResponse = {
  league: LeagueInfo;
  location: LocationFilter;
  standings: TeamStanding[];
  marketTops: MarketTops;
  meta: {
    source: "bsd" | "cache" | "mock";
    computedAt: string;
    ttlSeconds: number;
  };
};
