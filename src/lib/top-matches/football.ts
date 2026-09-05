// Adapter football — normalise /api/football/matches → format TopLeague
import type { SportAdapter, TopLeague, TopMatch } from './types';

const LEAGUE_COLORS: Record<string, string> = {
  'champions league': '#6C3CB4',
  'premier league': '#3D195B',
  'la liga': '#FF4B44',
  'serie a': '#024494',
  'bundesliga': '#D20515',
  'ligue 1': '#0D47A1',
  'eredivisie': '#FF6600',
  'liga portugal': '#E30613',
  'europa league': '#F57C00',
};

function getLeagueColor(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(LEAGUE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#455A64';
}

export const footballAdapter: SportAdapter = {
  sport: 'football',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/football/matches`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matches: any[] = (data.matches || []).slice(0, limit * 3);

    const byLeague = new Map<string, TopMatch[]>();
    for (const m of matches) {
      const league = m.league?.name || 'Autre';
      if (!byLeague.has(league)) byLeague.set(league, []);
      if (byLeague.get(league)!.length >= limit) continue;
      byLeague.get(league)!.push({
        id: String(m.id || ''),
        home: {
          name: m.home?.name || m.home?.shortName || 'Home',
          logo: m.home?.logo || '',
        },
        away: {
          name: m.away?.name || m.away?.shortName || 'Away',
          logo: m.away?.logo || '',
        },
        kickoff: m.scheduledAt || '',
        status: m.status === 'finished' ? 'finished' : m.isLive ? 'live' : 'scheduled',
        odds: m.odds
          ? {
              home: m.odds.home != null ? String(m.odds.home) : undefined,
              draw: m.odds.draw != null ? String(m.odds.draw) : undefined,
              away: m.odds.away != null ? String(m.odds.away) : undefined,
            }
          : undefined,
      });
    }

    const groups: TopLeague[] = [];
    for (const [league, leagueMatches] of byLeague) {
      groups.push({
        league,
        leagueIcon: '⚽',
        leagueColor: getLeagueColor(league),
        sport: 'football',
        matches: leagueMatches,
      });
    }
    return groups;
  },
};
