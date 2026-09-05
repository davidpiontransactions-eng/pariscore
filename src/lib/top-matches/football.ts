// Adapter football — normalise /api/v1/top-matches → format TopLeague
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

  async fetch(limit, timeframe) {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/v1/top-matches?timeframe=${timeframe}&limit=${limit}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const matches: any[] = data.matches || [];

    // Grouper par ligue
    const byLeague = new Map<string, TopMatch[]>();
    for (const m of matches) {
      const league = m.league || m.competition || 'Autre';
      if (!byLeague.has(league)) byLeague.set(league, []);
      byLeague.get(league)!.push({
        id: String(m.id || m.match_id || ''),
        home: {
          name: m.homeTeam || m.home?.name || 'Home',
          logo: m.homeLogo || m.home?.logo || '',
          rank: m.homeRank,
        },
        away: {
          name: m.awayTeam || m.away?.name || 'Away',
          logo: m.awayLogo || m.away?.logo || '',
          rank: m.awayRank,
        },
        kickoff: m.kickoff || m.date || m.start_time || '',
        status: m.status === 'FT' ? 'finished' : m.is_live ? 'live' : 'scheduled',
        score: m.score || undefined,
        odds: m.odds
          ? {
              home: String(m.odds.home || m.odds[0] || ''),
              draw: String(m.odds.draw || m.odds[1] || ''),
              away: String(m.odds.away || m.odds[2] || ''),
              best: m.topPick?.label?.includes('Home')
                ? 'home'
                : m.topPick?.label?.includes('Away')
                  ? 'away'
                  : undefined,
            }
          : undefined,
        badge: m.topPick
          ? { label: m.topPick.label, color: '#00c853' }
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
