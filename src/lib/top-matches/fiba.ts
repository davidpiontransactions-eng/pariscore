// Adapter FIBA — normalise /api/fiba/scoreboard (ESPN) → format TopLeague
import type { SportAdapter, TopLeague } from './types';
import { isLiveStatus, isImminent } from './types';

export const fibaAdapter: SportAdapter = {
  sport: 'fiba',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const res = await fetch(`${base}/api/fiba/scoreboard`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const raw: any[] = data.matches || [];

    const now = Date.now();
    const filtered = raw.filter((m: any) => {
      if (m.status === 'post') return false;
      const ko = new Date(m.date || 0).getTime();
      return m.status === 'in' || isLiveStatus(m.status, 'fiba') || ko >= now - 30 * 60_000;
    });

    const matches = filtered.slice(0, limit).map((m: any) => {
      const isLive = m.status === 'in' || isLiveStatus(m.status, 'fiba');
      const imminent = !isLive && isImminent(m.date, m.status);
      const score = (m.home?.score != null && m.away?.score != null)
        ? `${m.home.score} - ${m.away.score}`
        : undefined;
      const liveScore = isLive
        ? {
            current: score,
            quarters: m.home?.linescores?.length
              ? m.home.linescores.map((v: number, i: number) => {
                  const aScore = m.away?.linescores?.[i];
                  return `${v}-${aScore ?? '?'}`;
                })
              : undefined,
            clock: m.clock || undefined,
            period: m.period ? `Q${m.period}` : undefined,
          }
        : undefined;

      return {
        id: `fiba-${m.id}`,
        home: {
          name: m.home?.name || 'TBD',
          logo: m.home?.logo || '',
        },
        away: {
          name: m.away?.name || 'TBD',
          logo: m.away?.logo || '',
        },
        kickoff: m.date || '',
        status: (isLive ? 'live' : 'scheduled') as 'live' | 'scheduled',
        score,
        liveScore,
        badge: imminent
          ? { label: 'Imminent', color: '#FF9800' }
          : isLive
          ? { label: 'LIVE', color: '#f44336' }
          : m.group
          ? { label: `Groupe ${m.group}`, color: '#7B3FA0' }
          : undefined,
      };
    });

    return matches.length
      ? [{ league: 'FIBA Basketball', leagueIcon: '🏀', leagueColor: '#7B3FA0', sport: 'fiba', country: 'International', matches }]
      : [];
  },
};
