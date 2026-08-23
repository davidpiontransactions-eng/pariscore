// Types partagés pour les stats de ligues OddAlerts (table league_season_stats).

export type StatItem = {
  key: string;
  label: string;
  value: number | null;
  pct: number | null;
  avg: number | null;
};

export type StatsSection = {
  id: string;
  title: string;
  items: StatItem[];
};

export type SeasonOption = {
  label: string;
  url: string;
  current?: boolean;
};

export type FixtureTeam = {
  name: string;
  badge: string | null;
};

export type FixtureOdds = {
  home: number;
  draw: number;
  away: number;
};

export type LeagueFixture = {
  kickoffText: string | null;
  live: boolean;
  home: FixtureTeam;
  away: FixtureTeam;
  odds: FixtureOdds | null;
};

/** Entrée légère pour l'index des ligues. */
export type LeagueIndexEntry = {
  id: string;
  country: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  seasonLabel: string | null;
  gamesPlayed: number;
  updatedAt: string;
};

/** Détail complet d'une ligue (page championnat). */
export type LeagueDetail = LeagueIndexEntry & {
  sport: string;
  seasons: SeasonOption[];
  sections: StatsSection[];
  fixtures: LeagueFixture[];
  sourceUrl: string | null;
};

/** Regroupement par pays pour la page index. */
export type CountryGroup = {
  country: string;
  count: number;
};
