// Adapter hockey — normalise /api/hockey/matches → format TopLeague
import type { SportAdapter, TopLeague, TopMatch } from './types';
import { isLiveStatus, isImminent, countryFlag } from './types';

const LEAGUE_COLORS: Record<string, string> = {
  'nhl': '#111111',
  'khl': '#C62828',
  'magnus': '#1565C0',
  'french_ligue_magnus': '#1565C0',
  'ligue magnus': '#1565C0',
  'ligue-magnus': '#1565C0',
};

const LEAGUE_ICONS: Record<string, string> = {
  'nhl': '🇺🇸',
  'khl': '🇷🇺',
  'magnus': '🇫🇷',
  'french_ligue_magnus': '🇫🇷',
  'ligue magnus': '🇫🇷',
  'ligue-magnus': '🇫🇷',
};

function getLeagueColor(league: string): string {
  const lower = league.toLowerCase();
  for (const [key, color] of Object.entries(LEAGUE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#8b5cf6'; // violet hockey par défaut
}

function getLeagueIcon(league: string): string {
  const lower = league.toLowerCase();
  for (const [key, icon] of Object.entries(LEAGUE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '🏒';
}

// Normalise les alias de ligue (magnus, ligue-magnus, french_ligue_magnus…) vers LeagueId
export function normalizeHockeyLeagueId(raw?: string | null): string {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return '';
  if (s.includes('nhl')) return 'nhl';
  if (s.includes('khl')) return 'khl';
  if (s.includes('magnus')) return 'magnus';
  return s.replace(/[\s_]+/g, '-');
}

export const hockeyAdapter: SportAdapter = {
  sport: 'hockey',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const res = await fetch(`${base}/api/hockey/matches`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json() as { matches?: unknown[]; degraded?: boolean; source?: string };
    const matches = (data.matches || []) as Array<{
      id?: number | string;
      homeName?: string;
      awayName?: string;
      scheduledAt?: string;
      isLive?: boolean;
      leagueId?: string;
      leagueName?: string;
      countryName?: string;
      countryCode?: string;
      oddsH?: number;
      oddsD?: number;
      oddsA?: number;
      probSkipH?: number;
      probSkipA?: number;
      probBSDH?: number;
      probBSDA?: number;
      source?: string;
      status?: string;
    }>;

    // Filtrer matchs futurs/live uniquement
    const now = Date.now();
    const future = matches.filter((m) => {
      if (m.status === 'finished' || m.status === 'postponed' || m.status === 'cancelled') return false;
      const ko = new Date(m.scheduledAt || 0).getTime();
      return m.isLive || isLiveStatus(m.status, 'hockey') || ko >= now - 30 * 60_000;
    });
    future.sort((a, b) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime());
    const sliced = future.slice(0, limit * 3);

    const byLeague = new Map<string, TopMatch[]>();
    for (const m of sliced) {
      const leagueId = normalizeHockeyLeagueId(m.leagueId);
      const leagueName = m.leagueName || leagueId || 'Hockey';
      if (!byLeague.has(leagueName)) byLeague.set(leagueName, []);
      if (byLeague.get(leagueName)!.length >= limit) continue;

      const live = m.isLive || isLiveStatus(m.status, 'hockey');
      const imminent = !live && isImminent(m.scheduledAt || '', m.status || '');

      // Probabilité favori depuis sources disponibles
      let probPct: number | undefined;
      if (m.probBSDH != null) probPct = Math.round(Number(m.probBSDH) * 100);
      else if (m.probSkipH != null) probPct = Math.round(Number(m.probSkipH));

      byLeague.get(leagueName)!.push({
        id: String(m.id || ''),
        home: { name: m.homeName || 'Dom.' },
        away: { name: m.awayName || 'Ext.' },
        kickoff: m.scheduledAt || '',
        status: live ? 'live' : m.status === 'finished' ? 'finished' : 'scheduled',
        odds: m.oddsH != null
          ? {
              home: String(m.oddsH),
              draw: m.oddsD != null ? String(m.oddsD) : undefined,
              away: m.oddsA != null ? String(m.oddsA) : undefined,
            }
          : undefined,
        badge: imminent
          ? { label: 'Imminent', color: '#FF9800' }
          : live
          ? { label: 'LIVE', color: '#E53935' }
          : undefined,
        probPct,
      });
    }

    const groups: TopLeague[] = [];
    for (const [leagueName, leagueMatches] of byLeague) {
      groups.push({
        league: leagueName,
        leagueIcon: getLeagueIcon(leagueName),
        leagueColor: getLeagueColor(leagueName),
        sport: 'hockey',
        country: leagueMatches[0]?.home?.name ? undefined : undefined,
        matches: leagueMatches,
      });
    }
    return groups;
  },
};
