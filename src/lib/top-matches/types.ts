// Types partagés pour le composant Top Multi-Sport

export interface TopTeam {
  name: string;
  logo?: string;
  rank?: number;
}

export interface TopOdds {
  home?: string;
  draw?: string;
  away?: string;
  best?: 'home' | 'draw' | 'away';
}

export interface TopMetric {
  label: string;
  value: number | string;
  max?: number;
}

export interface TopBadge {
  label: string;
  color: string;
}

export interface TopMatch {
  id: string;
  home: TopTeam;
  away: TopTeam;
  kickoff: string;
  status: 'scheduled' | 'live' | 'finished';
  score?: string;
  odds?: TopOdds;
  metric?: TopMetric;
  badge?: TopBadge;
}

export interface TopLeague {
  league: string;
  leagueIcon: string;
  leagueColor: string;
  sport: string;
  matches: TopMatch[];
}

export interface TopMatchResponse {
  groups: TopLeague[];
  generated_at: string;
}

export type SportType = 'football' | 'tennis' | 'nba' | 'wnba' | 'f1' | 'cs2' | 'mma' | 'cycling';

export interface SportAdapter {
  sport: SportType;
  fetch(limit: number, timeframe: string): Promise<TopLeague[]>;
}
