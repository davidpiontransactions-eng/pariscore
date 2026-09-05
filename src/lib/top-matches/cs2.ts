// Adapter CS2 — normalise /api/cs2/matches → format TopLeague
import type { SportAdapter, TopLeague } from './types';

export const cs2Adapter: SportAdapter = {
  sport: 'cs2',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const res = await fetch(`${base}/api/cs2/matches`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const raw: any[] = data.matches || (Array.isArray(data) ? data : []);
    // Filtrer matchs futurs/live
    const now = Date.now();
    const filtered = raw.filter((m: any) => {
      if (m.status === 'finished') return false;
      const ko = new Date(m.scheduledAt || m.date || 0).getTime();
      return m.isLive || m.status === 'live' || ko >= now - 30 * 60_000;
    });
    const matches = filtered.slice(0, limit).map((m: any) => {
      // Score maps (CS2 : maps gagnés par équipe)
      const ms = m.maps_score;
      const score = (ms && (ms.team1 != null || ms.team2 != null))
        ? `${ms.team1 ?? 0} - ${ms.team2 ?? 0}`
        : undefined;
      return {
        id: String(m.id || ''),
        home: { name: m.team1?.name || m.team1 || 'Team 1', logo: m.team1?.logo || m.team1?.logo_local },
        away: { name: m.team2?.name || m.team2 || 'Team 2', logo: m.team2?.logo || m.team2?.logo_local },
        kickoff: m.scheduledAt || m.scheduled || m.date || '',
        status: m.status === 'live' ? 'live' : 'scheduled',
        score,
        badge: m.isLive ? { label: 'LIVE', color: '#f44336' } : undefined,
      };
    });

    return matches.length
      ? [{ league: 'CS2', leagueIcon: '🎮', leagueColor: '#F59E0B', sport: 'cs2', matches }]
      : [];
  },
};
