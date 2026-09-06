// Adapter NBA — normalise /api/nba/matches → format TopLeague
import type { SportAdapter, TopLeague } from './types';
import { isLiveStatus, isImminent } from './types';

export const nbaAdapter: SportAdapter = {
  sport: 'nba',

  async fetch(limit, _timeframe) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const res = await fetch(`${base}/api/nba/matches`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const raw: any[] = data.matches || (Array.isArray(data) ? data : []);
    // Filtrer matchs futurs/live, exclure terminés et passés
    const now = Date.now();
    const filtered = raw.filter((m: any) => {
      const st = m.status === 'FT' ? 'finished' : (m.is_live || isLiveStatus(m.status, 'nba')) ? 'live' : 'scheduled';
      if (st === 'finished') return false;
      const ko = new Date(m.kickoff || m.date || m.scheduledAt || 0).getTime();
      return st === 'live' || ko >= now - 30 * 60_000;
    });
    const matches = filtered.slice(0, limit).map((m: any) => {
      const isLive = m.is_live || isLiveStatus(m.status, 'nba');
      const imminent = !isLive && isImminent(m.kickoff || m.date || m.scheduledAt, m.status);
      const liveScore = isLive
        ? {
            current: m.score || undefined,
            quarters: m.quarters ?? m.period_scores ?? undefined,
            clock: m.clock ?? m.time_remaining ?? undefined,
            period: m.period ?? m.quarter ?? undefined,
          }
        : undefined;
      return {
        id: String(m.id || ''),
        home: {
          name: m.homeTeam || m.home?.name || 'Home',
          logo: m.homeLogo || m.home?.logo || '',
        },
        away: {
          name: m.awayTeam || m.away?.name || 'Away',
          logo: m.awayLogo || m.away?.logo || '',
        },
        kickoff: m.kickoff || m.date || m.scheduledAt || '',
        status: (m.status === 'FT' ? 'finished' : isLive ? 'live' : 'scheduled') as 'scheduled' | 'live' | 'finished',
        score: m.score || liveScore?.current,
        liveScore,
        odds: m.odds
          ? {
              home: String(m.odds.home || ''),
              away: String(m.odds.away || ''),
            }
          : undefined,
        badge: imminent
          ? { label: 'Imminent', color: '#FF9800' }
          : isLive
          ? { label: 'LIVE', color: '#f44336' }
          : undefined,
      };
    });

    return [
      {
        league: 'NBA',
        leagueIcon: '🏀',
        leagueColor: '#1D428A',
        sport: 'nba',
        matches,
      },
    ];
  },
};
