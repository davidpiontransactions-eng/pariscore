// Adapter MMA — normalise /api/mma/fights → format TopLeague
import type { SportAdapter, TopLeague } from './types';

export const mmaAdapter: SportAdapter = {
  sport: 'mma',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const res = await fetch(`${base}/api/mma/fights`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = data.fights || data.matches || (Array.isArray(data) ? data : []);
    const matches = raw.slice(0, limit).map((m: any) => ({
      id: String(m.id || ''),
      home: { name: m.fighter1 || m.fighterA || m.home?.name || 'Fighter 1' },
      away: { name: m.fighter2 || m.fighterB || m.away?.name || 'Fighter 2' },
      kickoff: m.scheduledAt || m.date || '',
      status: m.status === 'live' ? 'live' : 'scheduled',
    }));

    return matches.length
      ? [{ league: 'MMA / UFC', leagueIcon: '🥊', leagueColor: '#DC2626', sport: 'mma', matches }]
      : [];
  },
};
