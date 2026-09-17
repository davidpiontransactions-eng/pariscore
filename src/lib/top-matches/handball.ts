// Adapter handball — normalise /api/handball/matches → format TopLeague
import type { SportAdapter, TopLeague, TopMatch } from './types';
import { isLiveStatus, isImminent, countryFlag } from './types';

const LEAGUE_COLORS: Record<string, string> = {
  'starligue': '#1E88E5',
  'lnh': '#1E88E5',
  'hbl': '#FDD835',
  'bundesliga': '#FDD835',
  'ehf': '#7B1FA2',
  'champions league': '#7B1FA2',
  'asobal': '#E53935',
  'liga': '#E53935',
};

function getLeagueColor(league: string): string {
  const lower = league.toLowerCase();
  for (const [key, color] of Object.entries(LEAGUE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#00897B';
}

// Données mock pour le fallback quand l'API-Sports est indisponible
const MOCK_HANDBALL_LEAGUES = [
  { name: 'Starligue', country: 'France', color: '#1E88E5' },
  { name: 'Bundesliga', country: 'Allemagne', color: '#FDD835' },
  { name: 'Liga ASOBAL', country: 'Espagne', color: '#E53935' },
  { name: 'EHF Champions League', country: 'Europe', color: '#7B1FA2' },
];

const MOCK_TEAMS: Record<string, string[]> = {
  'Starligue': ['Paris Saint-Germain', 'HBC Nantes', 'Montpellier HB', 'Toulouse HB', 'Saint-Raphaël', 'US Créteil', 'Chambéry', 'Ivry'],
  'Bundesliga': ['THW Kiel', 'SG Flensburg', 'SC Magdeburg', 'Füchse Berlin', 'Rhein-Neckar Löwen', 'TBV Lemgo', 'MT Melsungen', 'HSG Wetzlar'],
  'Liga ASOBAL': ['FC Barcelona', 'Ademar León', 'Bidasoa Irun', 'Logroño La Rioja', 'Granollers', 'Puerto Sagunto'],
  'EHF Champions League': ['FC Barcelona', 'THW Kiel', 'Paris Saint-Germain', 'SC Magdeburg', 'Veszprém', 'Kielce', 'Aalborg', 'GOG'],
};

function generateMockHandballMatches(): TopLeague[] {
  const now = new Date();
  const groups: TopLeague[] = [];

  for (const league of MOCK_HANDBALL_LEAGUES) {
    const teams = MOCK_TEAMS[league.name] || [];
    const matches: TopMatch[] = [];

    // Générer 2-3 matchs par ligue
    for (let i = 0; i < Math.min(3, Math.floor(teams.length / 2)); i++) {
      const homeIdx = i * 2;
      const awayIdx = i * 2 + 1;
      if (awayIdx >= teams.length) break;

      const kickoff = new Date(now);
      kickoff.setHours(kickoff.getHours() + i + 1, 0, 0, 0);

      matches.push({
        id: `mock-hb-${league.name.toLowerCase().replace(/\s+/g, '-')}-${i}`,
        home: { name: teams[homeIdx] },
        away: { name: teams[awayIdx] },
        kickoff: kickoff.toISOString(),
        status: 'scheduled',
      });
    }

    if (matches.length > 0) {
      groups.push({
        league: league.name,
        leagueIcon: '🤾',
        leagueColor: league.color,
        sport: 'handball',
        country: league.country,
        matches,
      });
    }
  }

  return groups;
}

export const handballAdapter: SportAdapter = {
  sport: 'handball',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const res = await fetch(`${base}/api/handball/matches`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json() as { matches?: unknown[]; degraded?: boolean };
    const matches = (data.matches || []) as Array<{
      id?: number;
      league?: { name?: string; country?: string; countryCode?: string };
      home?: { name?: string; shortName?: string };
      away?: { name?: string; shortName?: string };
      kickoff?: string;
      status?: string;
      score?: { home?: number; away?: number; homeHalf?: number; awayHalf?: number };
      minute?: number;
      odds?: { home?: number; draw?: number; away?: number };
      stats?: { home7m?: number; away7m?: number; homeSaves?: number; awaySaves?: number };
    }>;

    // Si l'API est dégradée (pas de données), utiliser les données mockées
    if (data.degraded && matches.length === 0) {
      return generateMockHandballMatches();
    }

    // Filtrer matchs futurs/live uniquement
    const now = Date.now();
    const future = matches.filter((m) => {
      if (m.status === 'finished' || m.status === 'postponed' || m.status === 'cancelled') return false;
      const ko = new Date(m.kickoff || 0).getTime();
      return isLiveStatus(m.status, 'handball') || ko >= now - 30 * 60_000;
    });
    future.sort((a, b) => new Date(a.kickoff || 0).getTime() - new Date(b.kickoff || 0).getTime());
    const sliced = future.slice(0, limit * 3);

    const byLeague = new Map<string, TopMatch[]>();
    for (const m of sliced) {
      const leagueName = m.league?.name || 'Autre';
      if (!byLeague.has(leagueName)) byLeague.set(leagueName, []);
      if (byLeague.get(leagueName)!.length >= limit) continue;

      const live = isLiveStatus(m.status, 'handball');
      const imminent = !live && isImminent(m.kickoff || '', m.status || '');

      const scoreStr = m.score ? `${m.score.home} - ${m.score.away}` : undefined;

      byLeague.get(leagueName)!.push({
        id: String(m.id || ''),
        home: { name: m.home?.name || m.home?.shortName || 'Dom.' },
        away: { name: m.away?.name || m.away?.shortName || 'Ext.' },
        kickoff: m.kickoff || '',
        status: live ? 'live' : m.status === 'finished' ? 'finished' : 'scheduled',
        score: scoreStr,
        liveScore: live
          ? {
              current: scoreStr,
              minute: m.minute,
              halfTime: m.status === 'halftime' ? 'HT' : undefined,
            }
          : undefined,
        odds: m.odds
          ? {
              home: m.odds.home != null ? String(m.odds.home) : undefined,
              draw: m.odds.draw != null ? String(m.odds.draw) : undefined,
              away: m.odds.away != null ? String(m.odds.away) : undefined,
            }
          : undefined,
        badge: imminent
          ? { label: 'Imminent', color: '#FF9800' }
          : live
          ? { label: 'LIVE', color: '#E53935' }
          : undefined,
      });
    }

    const groups: TopLeague[] = [];
    for (const [leagueName, leagueMatches] of byLeague) {
      const country = leagueMatches[0]?.home?.name ? undefined : undefined;
      groups.push({
        league: leagueName,
        leagueIcon: '🤾',
        leagueColor: getLeagueColor(leagueName),
        sport: 'handball',
        country,
        matches: leagueMatches,
      });
    }
    return groups;
  },
};
