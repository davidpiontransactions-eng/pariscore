// Adapter CS2 — normalise /api/cs2/matches → format TopLeague
import type { SportAdapter, TopLeague } from './types';

export const cs2Adapter: SportAdapter = {
  sport: 'cs2',

  async fetch(limit, _timeframe) {
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
      // Sécuriser : team1/team2 peuvent être des objets
      const ms = m.maps_score;
      const t1 = ms?.team1;
      const t2 = ms?.team2;
      const score = (t1 != null || t2 != null)
        ? `${typeof t1 === 'object' ? JSON.stringify(t1) : t1 ?? 0} - ${typeof t2 === 'object' ? JSON.stringify(t2) : t2 ?? 0}`
        : undefined;
      const isLive = m.isLive || m.status === 'live';
      // Sécuriser rounds : peut être un objet
      const rawRounds = m.current_map?.rounds ?? m.round_score;
      const rounds = rawRounds != null
        ? (typeof rawRounds === 'object' ? JSON.stringify(rawRounds) : String(rawRounds))
        : undefined;
      const liveScore = isLive
        ? {
            current: score,
            maps: score,
            rounds,
            currentMap: m.current_map?.name ?? m.map_name ?? undefined,
          }
        : undefined;
      // Sécuriser noms d'équipe : team1/team2 peuvent être des objets
      const t1Name = m.team1?.name ?? (typeof m.team1 === 'string' ? m.team1 : undefined) ?? 'Team 1';
      const t2Name = m.team2?.name ?? (typeof m.team2 === 'string' ? m.team2 : undefined) ?? 'Team 2';
      const t1Logo = m.team1?.logo ?? m.team1?.logo_local;
      const t2Logo = m.team2?.logo ?? m.team2?.logo_local;
      return {
        id: String(m.id || ''),
        home: { name: t1Name, logo: typeof t1Logo === 'string' ? t1Logo : undefined },
        away: { name: t2Name, logo: typeof t2Logo === 'string' ? t2Logo : undefined },
        kickoff: m.scheduledAt || m.scheduled || m.date || '',
        status: (isLive ? 'live' : 'scheduled') as 'live' | 'scheduled',
        score,
        liveScore,
        badge: isLive ? { label: 'LIVE', color: '#f44336' } : undefined,
      };
    });

    return matches.length
      ? [{ league: 'CS2', leagueIcon: '🎮', leagueColor: '#F59E0B', sport: 'cs2', matches }]
      : [];
  },
};
