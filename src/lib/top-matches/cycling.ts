// Adapter Cycling — normalise /api/cycling → format TopLeague
import type { SportAdapter, TopLeague } from './types';

export const cyclingAdapter: SportAdapter = {
  sport: 'cycling',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const res = await fetch(`${base}/api/cycling`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = data.riders || data.standings || (Array.isArray(data) ? data : []);
    const matches = raw.slice(0, limit).map((m: any, i: number) => ({
      id: String(m.id || i),
      home: { name: m.name || m.rider || `Rider ${i + 1}`, rank: m.rank || i + 1 },
      away: { name: m.team || m.teamName || '' },
      kickoff: '',
      status: 'scheduled' as const,
      metric: m.points != null ? { label: 'Points', value: m.points } : undefined,
    }));

    return matches.length
      ? [{ league: '🚴 Cycling', leagueIcon: '🚴', leagueColor: '#059669', sport: 'cycling', matches }]
      : [];
  },
};
