// Types pour les live odds OddAlerts (table live_odds_oddalerts dans pariscore.db)

export type OddAlertsLiveOddsMarket = {
  id: string;
  smid: number;
  matchId: string | null;
  marketTitle: string;
  marketName: string;
  marketType: 'basic' | 'grid';
  oddsJson: string; // JSON string: { "home": 1.5, "draw": 3.5, "away": 6.0 }
  bookmakerId: number;
  marketId: number | null;
  dataAgeSeconds: number | null;
  oddsAgeSeconds: number | null;
  serverTime: number; // BigInt en DB, number en JS
  oddsUpdatedAt: number | null;
  gameStatus: string | null;
  elapsed: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  createdAt: string;
  updatedAt: string;
};

export type OddAlertsLiveOddsParsed = OddAlertsLiveOddsMarket & {
  odds: Record<string, number>;
};

export type OddAlertsLiveGameSummary = {
  smid: number;
  matchId: string | null;
  homeName: string;
  awayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  elapsed: number | null;
  status: string | null;
  markets: OddAlertsLiveOddsParsed[];
  dataAgeSeconds: number | null;
  oddsAgeSeconds: number | null;
  serverTime: number;
  oddsUpdatedAt: number | null;
};

/** Marchés prioritaires pour l'affichage UI */
export const PRIORITY_MARKETS: string[] = [
  'ft_result',
  'total_goals',
  'btts',
  'double_chance',
  'ht_result',
  'dnb',
  'total_goals_1h',
  'asian_handicap',
  'asian_corners',
  'total_corners',
  'total_cards',
  'home_goals',
  'away_goals',
  'asian_corners_1h',
  'goal_line',
  'goal_line_1h',
];

/** Titre français pour un marché */
export function marketTitleFr(title: string): string {
  const map: Record<string, string> = {
    ft_result: 'Résultat final (1X2)',
    total_goals: 'Total buts (Over/Under)',
    btts: 'Les deux équipes marquent (BTTS)',
    double_chance: 'Double chance',
    ht_result: 'Résultat mi-temps',
    dnb: 'Draw No Bet (Remboursé si nul)',
    total_goals_1h: 'Buts 1ère mi-temps (Over/Under)',
    asian_handicap: 'Handicap asiatique',
    asian_corners: 'Corners asiatiques',
    total_corners: 'Total corners (Over/Under)',
    total_cards: 'Total cartons (Over/Under)',
    home_goals: 'Buts domicile (Over/Under)',
    away_goals: 'Buts extérieur (Over/Under)',
    asian_corners_1h: 'Corners asiatiques 1ère mi-temps',
    goal_line: 'Goal line (Over/Under buts)',
    goal_line_1h: 'Goal line 1ère mi-temps',
  };
  return map[title] ?? title;
}

/** Formate les cotes pour affichage */
export function formatOdds(odds: Record<string, number>): Array<{ label: string; value: string }> {
  const labelMap: Record<string, string> = {
    home: '1',
    draw: 'X',
    away: '2',
    home_draw: '1X',
    home_away: '12',
    away_draw: 'X2',
    yes: 'Oui',
    no: 'Non',
    home_p025: 'H +0.25',
    home_0: 'H 0.0',
    home_m025: 'H -0.25',
    home_m05: 'H -0.5',
    home_p05: 'H +0.5',
    away_p025: 'E +0.25',
    away_0: 'E 0.0',
    away_m025: 'E -0.25',
    away_m05: 'E -0.5',
    away_p05: 'E +0.5',
    over_05: 'Over 0.5',
    over_15: 'Over 1.5',
    over_25: 'Over 2.5',
    over_35: 'Over 3.5',
    over_45: 'Over 4.5',
    over_55: 'Over 5.5',
    over_65: 'Over 6.5',
    over_75: 'Over 7.5',
    over_85: 'Over 8.5',
    over_95: 'Over 9.5',
    under_05: 'Under 0.5',
    under_15: 'Under 1.5',
    under_25: 'Under 2.5',
    under_35: 'Under 3.5',
    under_45: 'Under 4.5',
    under_55: 'Under 5.5',
    under_65: 'Under 6.5',
    under_75: 'Under 7.5',
    under_85: 'Under 8.5',
    under_95: 'Under 9.5',
  };

  return Object.entries(odds).map(([k, v]) => ({
    label: labelMap[k] ?? k,
    value: typeof v === 'number' ? v.toFixed(v % 1 === 0 ? 0 : 2) : String(v),
  }));
}

/** Classe de fraîcheur pour UI */
export function freshnessClass(ageSeconds: number | null): 'fresh' | 'warning' | 'stale' | 'unknown' {
  if (ageSeconds === null) return 'unknown';
  if (ageSeconds <= 10) return 'fresh';
  if (ageSeconds <= 30) return 'warning';
  return 'stale';
}