// Adapter tennis — normalise /api/tennis/prematch → format TopLeague
import type { SportAdapter, TopLeague, TopMatch } from './types';

const SURFACE_COLORS: Record<string, string> = {
  clay: '#E65100',
  hard: '#1565C0',
  grass: '#2E7D32',
  indoor: '#6A1B9A',
};

function getSurfaceColor(tournament: string): string {
  const lower = tournament.toLowerCase();
  if (lower.includes('clay') || lower.includes('terre')) return SURFACE_COLORS.clay;
  if (lower.includes('grass') || lower.includes('gazon')) return SURFACE_COLORS.grass;
  return SURFACE_COLORS.hard;
}

export const tennisAdapter: SportAdapter = {
  sport: 'tennis',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/tennis/prematch`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matches: any[] = (data.matches || []).slice(0, limit * 3);

    const byTourney = new Map<string, TopMatch[]>();
    for (const m of matches) {
      const tourney = m.tournament || 'Autre';
      if (!byTourney.has(tourney)) byTourney.set(tourney, []);
      if (byTourney.get(tourney)!.length >= limit) continue;
      byTourney.get(tourney)!.push({
        id: String(m.id || ''),
        home: {
          name: m.playerA?.name || m.playerA?.shortName || 'J1',
          rank: m.playerA?.rank,
        },
        away: {
          name: m.playerB?.name || m.playerB?.shortName || 'J2',
          rank: m.playerB?.rank,
        },
        kickoff: m.scheduledAt || '',
        status: m.status === 'live' ? 'live' : m.status === 'finished' ? 'finished' : 'scheduled',
        odds: m.odds
          ? {
              home: m.odds.playerA != null ? String(m.odds.playerA) : undefined,
              away: m.odds.playerB != null ? String(m.odds.playerB) : undefined,
            }
          : undefined,
        badge: m.tournamentCategory
          ? { label: m.tournamentCategory, color: '#7B2FBE' }
          : undefined,
      });
    }

    const groups: TopLeague[] = [];
    for (const [tourney, tourneyMatches] of byTourney) {
      groups.push({
        league: tourney,
        leagueIcon: '🎾',
        leagueColor: getSurfaceColor(tourney),
        sport: 'tennis',
        matches: tourneyMatches,
      });
    }
    return groups;
  },
};
