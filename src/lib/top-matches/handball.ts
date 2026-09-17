// Adapter handball — normalise /api/handball/matches → format TopLeague
import type { SportAdapter, TopLeague, TopMatch } from './types';
import { isLiveStatus, isImminent, countryFlag } from './types';

const LEAGUE_COLORS: Record<string, string> = {
  'starligue': '#1E88E5',
  'lnh': '#1E88E5',
  'hbl': '#FDD835',
  'bundesliga': '#FDD835',
  'ehf': '#7B1FA2',
  'champions league': '#7B1FA2',
  'asobal': '#E53935',
  'liga': '#E53935',
};

function getLeagueColor(league: string): string {
  const lower = league.toLowerCase();
  for (const [key, color] of Object.entries(LEAGUE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#00897B';
}

export const handballAdapter: SportAdapter = {
  sport: 'handball',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const res = await fetch(`${base}/api/handball/matches`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json() as { matches?: unknown[]; degraded?: boolean; source?: string };
    const matches = (data.matches || []) as Array<{
      id?: number | string;
      league?: { name?: string; country?: string; countryCode?: string };
      home?: { name?: string; shortName?: string };
      away?: { name?: string; shortName?: string };
      kickoff?: string;
      status?: string;
      score?: { home?: number; away?: number; homeHalf?: number; awayHalf?: number };
      minute?: number;
      odds?: { home?: number; draw?: number; away?: number };
      stats?: { home7m?: number; away7m?: number; homeSaves?: number; awaySaves?: number };
    }>;

    // Filtrer matchs futurs/live uniquement
    const now = Date.now();
    const future = matches.filter((m) => {
      if (m.status === 'finished' || m.status === 'postponed' || m.status === 'cancelled') return false;
      const ko = new Date(m.kickoff || 0).getTime();
      return isLiveStatus(m.status, 'handball') || ko >= now - 30 * 60_000;
    });
    future.sort((a, b) => new Date(a.kickoff || 0).getTime() - new Date(b.kickoff || 0).getTime());
    const sliced = future.slice(0, limit * 3);

    const byLeague = new Map<string, TopMatch[]>();
    for (const m of sliced) {
      const leagueName = m.league?.name || 'Autre';
      if (!byLeague.has(leagueName)) byLeague.set(leagueName, []);
      if (byLeague.get(leagueName)!.length >= limit) continue;

      const live = isLiveStatus(m.status, 'handball');
      const imminent = !live && isImminent(m.kickoff || '', m.status || '');

      const scoreStr = m.score ? `${m.score.home} - ${m.score.away}` : undefined;

      byLeague.get(leagueName)!.push({
        id: String(m.id || ''),
        home: { name: m.home?.name || m.home?.shortName || 'Dom.' },
        away: { name: m.away?.name || m.away?.shortName || 'Ext.' },
        kickoff: m.kickoff || '',
        status: live ? 'live' : m.status === 'finished' ? 'finished' : 'scheduled',
        score: scoreStr,
        liveScore: live
          ? {
              current: scoreStr,
              minute: m.minute,
              halfTime: m.status === 'halftime' ? 'HT' : undefined,
            }
          : undefined,
        odds: m.odds
          ? {
              home: m.odds.home != null ? String(m.odds.home) : undefined,
              draw: m.odds.draw != null ? String(m.odds.draw) : undefined,
              away: m.odds.away != null ? String(m.odds.away) : undefined,
            }
          : undefined,
        badge: imminent
          ? { label: 'Imminent', color: '#FF9800' }
          : live
          ? { label: 'LIVE', color: '#E53935' }
          : undefined,
      });
    }

    const groups: TopLeague[] = [];
    for (const [leagueName, leagueMatches] of byLeague) {
      const country = leagueMatches[0]?.home?.name ? undefined : undefined;
      groups.push({
        league: leagueName,
        leagueIcon: '🤾',
        leagueColor: getLeagueColor(leagueName),
        sport: 'handball',
        country,
        matches: leagueMatches,
      });
    }
    return groups;
  },
};
