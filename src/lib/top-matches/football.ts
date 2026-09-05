// Adapter football — normalise /api/football/matches → format TopLeague
import type { SportAdapter, TopLeague, TopMatch } from './types';
import { countryFlag } from './types';

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
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const res = await fetch(`${base}/api/football/matches`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const matches: any[] = data.matches || [];

    // Filtrer : only scheduled/live, exclude finished & past kickoff
    const now = Date.now();
    const future = matches.filter((m: any) => {
      if (m.status === 'finished') return false;
      const ko = new Date(m.scheduledAt || 0).getTime();
      // Garder live en cours + scheduled dans le futur (marge 30min pour les retards)
      return m.isLive || ko >= now - 30 * 60_000;
    });
    // Trier par kickoff croissant (prochains d'abord)
    future.sort((a: any, b: any) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime());
    const sliced = future.slice(0, limit * 3);

    const byLeague = new Map<string, { matches: TopMatch[]; country?: string }>();
    for (const m of sliced) {
      const league = m.league?.name || 'Autre';
      if (!byLeague.has(league)) byLeague.set(league, { matches: [], country: m.league?.country });
      if (byLeague.get(league)!.matches.length >= limit) continue;
      byLeague.get(league)!.matches.push({
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
        score: m.isLive && m.live
          ? `${m.live.homeScore ?? 0} - ${m.live.awayScore ?? 0}`
          : undefined,
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
    for (const [league, data] of byLeague) {
      groups.push({
        league,
        leagueIcon: '⚽',
        leagueColor: getLeagueColor(league),
        sport: 'football',
        country: data.country,
        matches: data.matches,
      });
    }
    return groups;
  },
};
