// Adapter NBA — normalise /api/v1/nba/matches → format TopLeague
import type { SportAdapter, TopLeague } from './types';

export const nbaAdapter: SportAdapter = {
  sport: 'nba',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/v1/nba/matches`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const matches: any[] = (data.matches || []).slice(0, limit).map((m: any) => ({
      id: String(m.id || ''),
      home: {
        name: m.homeTeam || m.home?.name || 'Home',
        logo: m.homeLogo || m.home?.logo || '',
      },
      away: {
        name: m.awayTeam || m.away?.name || 'Away',
        logo: m.awayLogo || m.away?.logo || '',
      },
      kickoff: m.kickoff || m.date || '',
      status: m.status === 'FT' ? 'finished' : m.is_live ? 'live' : 'scheduled',
      score: m.score || undefined,
      odds: m.odds
        ? {
            home: String(m.odds.home || ''),
            away: String(m.odds.away || ''),
          }
        : undefined,
    }));

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
