// Types et client pour OddAlerts Live Data API (https://data.oddalerts.com/latency)

export type OddAlertsGameListItem = {
  smid: number;
  id: number;
  home_name: string;
  away_name: string;
  home_goals: number | null;
  away_goals: number | null;
  elapsed: number | null;
  status: 'LIVE' | 'HT' | 'FT' | 'NS' | string;
  ht_score: string | null;
  ft_score: string | null;
  updated: number;
  league_name: string | null;
  unix: number;
};

export type OddAlertsGamesResponse = {
  games: OddAlertsGameListItem[];
};

export type OddAlertsLiveOddsMarket = {
  title: string;
  name: string;
  type: 'basic' | 'grid';
  had_decimal: boolean;
  odds: Record<string, number>;
  bookmaker_id: number;
  id: number;
  can_alert?: boolean;
};

export type OddAlertsGameDetail = {
  game: OddAlertsGameListItem & {
    ft_score: string | null;
  };
  server_time: number;
  data_age_seconds: number | null;
  live_odds: OddAlertsLiveOddsMarket[] | null;
  odds_age_seconds: number | null;
  odds_updated_at: number | null;
};

const BASE_URL = 'https://data.oddalerts.com/latency';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  if (!res.ok) {
    throw new Error(`OddAlerts API HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Récupère la liste des matchs actuellement live */
export async function fetchLiveGames(): Promise<OddAlertsGamesResponse> {
  return fetchJson<OddAlertsGamesResponse>(`${BASE_URL}/games`);
}

/** Récupère les détails + live odds d'un match par son SMID */
export async function fetchLiveGameDetail(smid: number): Promise<OddAlertsGameDetail> {
  return fetchJson<OddAlertsGameDetail>(`${BASE_URL}/game/${smid}`);
}

/** Marchés prioritaires pour l'affichage UI (ordre d'importance) */
export const PRIORITY_MARKETS: OddAlertsLiveOddsMarket['title'][] = [
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

/** Classe de fraîcheur pour UI (vert/jaune/rouge) */
export function freshnessClass(ageSeconds: number | null): 'fresh' | 'warning' | 'stale' | 'unknown' {
  if (ageSeconds === null) return 'unknown';
  if (ageSeconds <= 10) return 'fresh';
  if (ageSeconds <= 30) return 'warning';
  return 'stale';
}