// Adapter MMA — normalise /api/mma/fights → format TopLeague
import type { SportAdapter, TopLeague, TopMatch } from './types';
import { isLiveStatus, isImminent } from './types';

export const mmaAdapter: SportAdapter = {
  sport: 'mma',

  async fetch(limit, _timeframe) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const res = await fetch(`${base}/api/mma/fights`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const events: any[] = Array.isArray(data) ? data : [];
    const matches: TopMatch[] = [];
    const flat: any[] = [];
    for (const ev of events) {
      for (const f of ev.fights || []) {
        flat.push({ ...f, event_name: ev.event_name });
      }
    }

    for (const f of flat.slice(0, limit)) {
      const isLive = isLiveStatus(f.status, 'mma');
      const imminent = !isLive && isImminent(f.commence_time, f.status);
      const liveScore = isLive
        ? {
            current: f.round_status ?? undefined,
            round: f.current_round ?? f.round ?? undefined,
            roundClock: f.time_remaining ?? f.clock ?? undefined,
          }
        : undefined;
      matches.push({
        id: String(f.id || f.fighter_a + f.fighter_b),
        home: { name: f.fighter_a || 'Fighter A' },
        away: { name: f.fighter_b || 'Fighter B' },
        kickoff: f.commence_time || '',
        status: (isLive ? 'live' : 'scheduled') as 'live' | 'scheduled',
        liveScore,
        odds: f.prob_a != null
          ? { home: String(f.prob_a), away: String(f.prob_b) }
          : undefined,
        badge: imminent
          ? { label: 'Imminent', color: '#FF9800' }
          : f.event_name
          ? { label: f.event_name, color: '#DC2626' }
          : undefined,
      });
    }

    return matches.length
      ? [{ league: 'MMA / UFC', leagueIcon: '🥊', leagueColor: '#DC2626', sport: 'mma', matches }]
      : [];
  },
};
