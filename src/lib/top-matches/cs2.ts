// Adapter CS2 — normalise /api/cs2/matches → format TopLeague
import type { SportAdapter, TopLeague } from './types';

export const cs2Adapter: SportAdapter = {
  sport: 'cs2',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/cs2/matches`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = data.matches || (Array.isArray(data) ? data : []);
    const matches = raw.slice(0, limit).map((m: any) => ({
      id: String(m.id || ''),
      home: { name: m.team1 || m.home?.name || 'Team 1' },
      away: { name: m.team2 || m.away?.name || 'Team 2' },
      kickoff: m.scheduledAt || m.date || '',
      status: m.status === 'live' ? 'live' : 'scheduled',
      badge: m.isLive ? { label: 'LIVE', color: '#f44336' } : undefined,
    }));

    return matches.length
      ? [{ league: 'CS2', leagueIcon: '🎮', leagueColor: '#F59E0B', sport: 'cs2', matches }]
      : [];
  },
};
