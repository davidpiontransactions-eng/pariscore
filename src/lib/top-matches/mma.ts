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
    // L'API retourne un tableau d'événements, chaque événement a un tableau de fights
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = Array.isArray(data) ? data : [];
    const matches: ReturnType<typeof mmaAdapter.fetch> extends Promise<infer R> ? R extends Promise<infer T> ? T extends (infer U)[] ? U[] : never : never : never[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flat: any[] = [];
    for (const ev of events) {
      for (const f of ev.fights || []) {
        flat.push({ ...f, event_name: ev.event_name });
      }
    }

    for (const f of flat.slice(0, limit)) {
      matches.push({
        id: String(f.id || f.fighter_a + f.fighter_b),
        home: { name: f.fighter_a || 'Fighter A' },
        away: { name: f.fighter_b || 'Fighter B' },
        kickoff: f.commence_time || '',
        status: f.status === 'live' ? 'live' : 'scheduled',
        odds: f.prob_a != null
          ? { home: String(f.prob_a), away: String(f.prob_b) }
          : undefined,
        badge: f.event_name
          ? { label: f.event_name, color: '#DC2626' }
          : undefined,
      });
    }

    return matches.length
      ? [{ league: 'MMA / UFC', leagueIcon: '🥊', leagueColor: '#DC2626', sport: 'mma', matches }]
      : [];
  },
};
