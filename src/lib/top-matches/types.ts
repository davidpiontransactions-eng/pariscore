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
  country?: string;
  countryCode?: string;
  matches: TopMatch[];
}

export interface TopMatchResponse {
  groups: TopLeague[];
  generated_at: string;
}

export type SportType =
  | "football"
  | "tennis"
  | "basket"
  | "nba"
  | "wnba"
  | "f1"
  | "cs2"
  | "mma"
  | "cycling"
  | "fiba";

/** Valeurs SportType en tant que chaîne (pour utilisation runtime). */
export const SPORT_TYPES: SportType[] = [
  "football",
  "tennis",
  "basket",
  "nba",
  "wnba",
  "f1",
  "cs2",
  "mma",
  "cycling",
  "fiba",
];

export interface SportAdapter {
  sport: SportType;
  fetch(limit: number, timeframe: string): Promise<TopLeague[]>;
}

/** Convert country name or ISO code to flag emoji */
export function countryFlag(input: string): string {
  if (!input) return '';
  // Si c'est déjà un code ISO 2 lettres
  if (input.length === 2 && input === input.toUpperCase()) {
    return String.fromCodePoint(
      0x1F1E6 + input.charCodeAt(0) - 65,
      0x1F1E6 + input.charCodeAt(1) - 65,
    );
  }
  // Mapping pays → code ISO
  const MAP: Record<string, string> = {
    'england': 'GB', 'france': 'FR', 'spain': 'ES', 'germany': 'DE',
    'italy': 'IT', 'portugal': 'PT', 'netherlands': 'NL', 'belgium': 'BE',
    'turkey': 'TR', 'greece': 'GR', 'scotland': 'GB', 'wales': 'GB',
    'brazil': 'BR', 'argentina': 'AR', 'usa': 'US', 'united states': 'US',
    'china': 'CN', 'japan': 'JP', 'south korea': 'KR', 'australia': 'AU',
    'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK', 'finland': 'FI',
    'poland': 'PL', 'czech republic': 'CZ', 'czechia': 'CZ',
    'austria': 'AT', 'switzerland': 'CH', 'croatia': 'HR', 'serbia': 'RS',
    'ukraine': 'UA', 'russia': 'RU', 'saudi arabia': 'SA', 'egypt': 'EG',
    'morocco': 'MA', 'tunisia': 'TN', 'algeria': 'DZ', 'senegal': 'SN',
    'cameroon': 'CM', 'nigeria': 'NG', 'ghana': 'GH', 'mexico': 'MX',
    'colombia': 'CO', 'chile': 'CL', 'peru': 'PE', 'uruguay': 'UY',
    'paraguay': 'PY', 'bolivia': 'BO', 'ecuador': 'EC', 'romania': 'RO',
    'hungary': 'HU', 'bulgaria': 'BG', 'slovakia': 'SK', 'slovenia': 'SI',
    'ireland': 'IE', 'iceland': 'IS', 'cyprus': 'CY', 'israel': 'IL',
    'south africa': 'ZA', 'india': 'IN', 'canada': 'CA',     'new zealand': 'NZ',
    'vietnam': 'VN',
  };
  const code = MAP[input.toLowerCase()];
  if (!code) return '';
  return String.fromCodePoint(
    0x1F1E6 + code.charCodeAt(0) - 65,
    0x1F1E6 + code.charCodeAt(1) - 65,
  );
}
