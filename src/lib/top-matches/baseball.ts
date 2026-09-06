// Adapter Baseball — normalise /api/baseball/schedule → format TopLeague
import type { SportAdapter, TopLeague } from './types';
import { isLiveStatus, isImminent } from './types';

export const baseballAdapter: SportAdapter = {
  sport: 'baseball',

  async fetch(limit, _timeframe) {
    // Date du jour en heure Paris (UTC+1/UTC+2)
    const now = new Date();
    const parisDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(now);

    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const res = await fetch(`${base}/api/baseball/schedule?date=${parisDate}&league=ALL`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const raw: any[] = data.matches || [];

    const nowMs = Date.now();
    // Filtrer matchs futurs/live (pas les finalisés)
    const filtered = raw.filter((m: any) => {
      const game = m.game;
      if (!game) return false;
      if (game.status === 'final') return false;
      const ko = new Date(game.gameDateIso || 0).getTime();
      return game.status === 'live' || isLiveStatus(game.status, 'baseball') || ko >= nowMs - 30 * 60_000;
    });

    // Regrouper par ligue
    const byLeague = new Map<string, any[]>();
    for (const m of filtered) {
      const league = m.game?.league || 'MLB';
      if (!byLeague.has(league)) byLeague.set(league, []);
      byLeague.get(league)!.push(m);
    }

    const LEAGUE_ICONS: Record<string, { icon: string; color: string; country: string }> = {
      MLB: { icon: '⚾', color: '#002D72', country: 'USA' },
      KBO: { icon: '⚾', color: '#C8102E', country: 'South Korea' },
      NPB: { icon: '⚾', color: '#002B5C', country: 'Japan' },
      CPBL: { icon: '⚾', color: '#004B87', country: 'Taiwan' },
      LMB: { icon: '⚾', color: '#CE1126', country: 'Mexico' },
      LIDOM: { icon: '⚾', color: '#003DA5', country: 'Dominican Republic' },
      LVBP: { icon: '⚾', color: '#FFD100', country: 'Venezuela' },
    };

    const groups: TopLeague[] = [];

    for (const [league, matches] of byLeague) {
      const meta = LEAGUE_ICONS[league] || { icon: '⚾', color: '#333', country: '' };
      const mapped = matches.slice(0, limit).map((m: any) => {
        const game = m.game;
        const isLive = game.status === 'live' || isLiveStatus(game.status, 'baseball');
        const imminent = !isLive && isImminent(game.gameDateIso, game.status);
        const homeName = m.homeTeam?.name || `Team ${game.homeTeamId}`;
        const awayName = m.awayTeam?.name || `Team ${game.awayTeamId}`;
        const score = (game.homeRuns != null && game.awayRuns != null)
          ? `${game.homeRuns} - ${game.awayRuns}`
          : undefined;

        return {
          id: `baseball-${game.gamePk}`,
          home: { name: homeName, logo: m.homeTeam?.logoPath || undefined },
          away: { name: awayName, logo: m.awayTeam?.logoPath || undefined },
          kickoff: game.gameDateIso || '',
          status: (isLive ? 'live' : 'scheduled') as 'live' | 'scheduled',
          score,
          liveScore: isLive ? { current: score } : undefined,
          metric: m.quick
            ? { label: 'Win%', value: Math.round((m.quick.homeWinProb || 0.5) * 100), max: 100 }
            : undefined,
          badge: imminent
            ? { label: 'Imminent', color: '#FF9800' }
            : isLive
            ? { label: 'LIVE', color: '#f44336' }
            : undefined,
        };
      });

      if (mapped.length > 0) {
        groups.push({
          league: league,
          leagueIcon: meta.icon,
          leagueColor: meta.color,
          sport: 'baseball',
          country: meta.country,
          matches: mapped,
        });
      }
    }

    return groups;
  },
};
