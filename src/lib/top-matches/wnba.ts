// Adapter WNBA — normalise /api/wnba/matches → format TopLeague
import type { SportAdapter, TopLeague } from './types';

export const wnbaAdapter: SportAdapter = {
  sport: 'wnba',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const res = await fetch(`${base}/api/wnba/matches`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const raw: any[] = data.matches || (Array.isArray(data) ? data : []);
    const matches = raw.slice(0, limit).map((m: any) => ({
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
        league: 'WNBA',
        leagueIcon: '🏀',
        leagueColor: '#C8102E',
        sport: 'wnba',
        matches,
      },
    ];
  },
};
