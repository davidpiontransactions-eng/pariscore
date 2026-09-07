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

/** Score live structuré par sport */
export interface LiveMatchScore {
  /** Score actuel ex: "2 - 1" */
  current?: string;
  /** Football : minute de jeu */
  minute?: number;
  /** Football : mi-temps (1, 2, HT, ET) */
  halfTime?: string;
  /** Tennis : sets [6-4, 3-6, 4-2] */
  sets?: string[];
  /** Tennis : jeux du set en cours ex: "30-15" ou "4-3" */
  gameScore?: string;
  /** Tennis : joueur au service */
  serving?: string;
  /** Basketball : score par quart [25-22, 18-20] */
  quarters?: string[];
  /** Basketball : chrono restant quart en cours */
  clock?: string;
  /** Basketball : quart en cours (Q1-Q4, OT) */
  period?: string;
  /** CS2 : score cartes BO3/BO5 */
  maps?: string;
  /** CS2 : rounds map en cours ex: "11-9" */
  rounds?: string;
  /** CS2 : map en cours */
  currentMap?: string;
  /** MMA : round en cours */
  round?: number;
  /** MMA : chrono round */
  roundClock?: string;
}

export interface TopMatch {
  id: string;
  home: TopTeam;
  away: TopTeam;
  kickoff: string;
  status: 'scheduled' | 'live' | 'finished';
  score?: string;
  /** Score live structuré (peuplé quand status=live) */
  liveScore?: LiveMatchScore;
  odds?: TopOdds;
  metric?: TopMetric;
  badge?: TopBadge;
  /** Tour de la compétition (ex: "Quart de finale", "SF", "R32") */
  round?: string;
  /** Surface / terrain (tennis: clay/hard/grass, foot: pelouse synthétique) */
  surface?: string;
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
  | "fiba"
  | "baseball"
  | "rugby";

/** Valeurs SportType en tant que chaîne (pour utilisation runtime). */
export const SPORT_TYPES: SportType[] = [
  "football",
  "tennis",
  "nba",
  "wnba",
  "f1",
  "cs2",
  "mma",
  "cycling",
  "fiba",
  "baseball",
  "rugby",
];

export interface SportAdapter {
  sport: SportType;
  fetch(limit: number, timeframe: string): Promise<TopLeague[]>;
}

/* ─── Normalisation des statuts live ─── */

/** Statuts source API considérés comme "en cours" par sport */
const LIVE_STATUS_PATTERNS: Record<string, RegExp[]> = {
  football: [/^live$/i, /^in_play$/i, /^1h$/i, /^2h$/i, /^ht$/i, /^et$/i, /^pen$/i, /^extra_time$/i, /^half[_\s-]?time$/i],
  tennis:   [/^live$/i, /^set[1-5]$/i, /^break$/i, /^tiebreak$/i, /^in_play$/i, /^match[_\s-]?point$/i],
  nba:      [/^live$/i, /^is_live$/i, /^in_play$/i, /^q[1-4]$/i, /^ot$/i, /^halftime$/i, /^half[_\s-]?time$/i],
  wnba:     [/^live$/i, /^is_live$/i, /^in_play$/i, /^q[1-4]$/i, /^ot$/i, /^halftime$/i, /^half[_\s-]?time$/i],
  cs2:      [/^live$/i, /^in_progress$/i, /^map[_\s-]?in[_\s-]?progress$/i, /^ongoing$/i],
  mma:      [/^live$/i, /^in_progress$/i, /^round[1-5]$/i, /^fight[_\s-]?in[_\s-]?progress$/i],
  fiba:     [/^live$/i, /^in_play$/i, /^q[1-4]$/i, /^ot$/i],
  cycling:  [], // value bets uniquement
  f1:       [], // value bets uniquement
  baseball: [/^live$/i, /^in_progress$/i, /^bottom$/i, /^top$/i, /^mid$/i],
  rugby:    [/^live$/i, /^in_progress$/i, /^1st$/i, /^2nd$/i, /^ht$/i],
};

/**
 * Vérifie si un statut brut (depuis l'API source) est un statut "live".
 * Compare via regex pour couvrir toutes les variantes (IN_PLAY, Q1, SET2, etc.)
 */
export function isLiveStatus(rawStatus: string | undefined | null, sport: string): boolean {
  if (!rawStatus) return false;
  const patterns = LIVE_STATUS_PATTERNS[sport.toLowerCase()];
  if (!patterns) return rawStatus.toLowerCase() === 'live';
  return patterns.some((re) => re.test(rawStatus));
}

/**
 * Détermine si un match est "imminent" (début dans < 30 min, statut scheduled).
 */
export function isImminent(kickoff: string, status: string): boolean {
  if (status !== 'scheduled' || !kickoff) return false;
  const ms = new Date(kickoff).getTime() - Date.now();
  return ms > 0 && ms < 30 * 60_000;
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
