// Adapter tennis — normalise /api/v1/tennis/top10 → format TopLeague
import type { SportAdapter, TopLeague, TopMatch } from './types';

const SURFACE_COLORS: Record<string, string> = {
  clay: '#E65100',
  hard: '#1565C0',
  grass: '#2E7D32',
  indoor: '#6A1B9A',
};

function getSurfaceColor(surface: string): string {
  const lower = surface.toLowerCase();
  for (const [key, color] of Object.entries(SURFACE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#455A64';
}

function mapReason(
  reason?: string,
): { label: string; color: string } {
  switch ((reason || '').toLowerCase()) {
    case 'en direct':
    case 'live':
      return { label: 'LIVE', color: '#f44336' };
    case 'valeur':
    case 'value':
      return { label: 'VALEUR', color: '#00c853' };
    case 'vapeur':
      return { label: 'VAPEUR', color: '#ff9800' };
    case 'classique':
    case 'classic':
      return { label: 'TOP', color: '#FFD700' };
    case 'drama':
      return { label: 'DRAMA', color: '#38bdf8' };
    case 'upset':
      return { label: 'UPSET', color: '#00bcd4' };
    default:
      return { label: 'TOP', color: '#455A64' };
  }
}

export const tennisAdapter: SportAdapter = {
  sport: 'tennis',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/v1/tennis/top10?mode=viewer`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const matches: any[] = (data.top10 || []).slice(0, limit);

    // Grouper par tournoi
    const byTourney = new Map<string, TopMatch[]>();
    for (const m of matches) {
      const tourney = m.tournament || 'Autre';
      if (!byTourney.has(tourney)) byTourney.set(tourney, []);
      const badge = mapReason(m.reason);
      byTourney.get(tourney)!.push({
        id: String(m.matchId || m.id || ''),
        home: { name: m.player1 || 'J1', rank: m.rank_p1 },
        away: { name: m.player2 || 'J2', rank: m.rank_p2 },
        kickoff: m.start_time
          ? new Date(m.start_time * 1000).toISOString()
          : '',
        status: m.is_live
          ? 'live'
          : m.status === 'FT'
            ? 'finished'
            : 'scheduled',
        score: m.live_score || undefined,
        metric:
          m.score_top10 != null
            ? { label: 'Score', value: m.score_top10, max: 100 }
            : undefined,
        badge: { label: badge.label, color: badge.color },
      });
    }

    const groups: TopLeague[] = [];
    for (const [tourney, tourneyMatches] of byTourney) {
      const firstBadge = tourneyMatches[0]?.badge?.label || '';
      groups.push({
        league: tourney,
        leagueIcon: '🎾',
        leagueColor: getSurfaceColor(firstBadge),
        sport: 'tennis',
        matches: tourneyMatches,
      });
    }
    return groups;
  },
};
