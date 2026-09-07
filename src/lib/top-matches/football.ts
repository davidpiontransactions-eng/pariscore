// Adapter football — normalise /api/football/matches → format TopLeague
import type { SportAdapter, TopLeague, TopMatch } from './types';
import { countryFlag, isLiveStatus, isImminent } from './types';
import { computeMatchProb } from '@/lib/football-analytics';

/** Estimation basée sur le ranking mondial FIFA/API pour calculer la force relative */
function teamStrength(name: string, rank?: number | null): number {
  if (rank && rank > 0) return Math.max(10, 100 - rank * 0.6);
  // Fallback heuristique : les grands championnats ont des équipes plus fortes
  const elite = ['Man City', 'Bayern', 'Real Madrid', 'Barcelona', 'PSG', 'Inter', 'Milan', 'Arsenal', 'Liverpool', 'Juventus'];
  if (elite.includes(name)) return 85;
  return 55;
}

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
    const data = await res.json() as { matches?: any[] };
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
      const isLive = m.isLive || isLiveStatus(m.status, 'football');
      const imminent = !isLive && isImminent(m.scheduledAt, m.status);
      const liveScore = isLive && m.live
        ? {
            current: `${m.live.homeScore ?? 0} - ${m.live.awayScore ?? 0}`,
            minute: m.live.minute ?? m.live.clock ?? undefined,
            halfTime: m.live.halfTime ?? m.live.ht ?? undefined,
          }
        : undefined;
      // Cotes numériques (brutes avant conversion string)
      const oddsNum = {
        home: m.odds?.home != null ? parseFloat(String(m.odds.home)) : undefined,
        draw: m.odds?.draw != null ? parseFloat(String(m.odds.draw)) : undefined,
        away: m.odds?.away != null ? parseFloat(String(m.odds.away)) : undefined,
      };
      const hStrength = teamStrength(m.home?.name || '', m.home?.rank);
      const aStrength = teamStrength(m.away?.name || '', m.away?.rank);
      const prob = computeMatchProb(oddsNum.home, oddsNum.draw, oddsNum.away, hStrength, aStrength);
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
        status: m.status === 'finished' ? 'finished' : isLive ? 'live' : 'scheduled',
        score: liveScore?.current,
        liveScore,
        odds: m.odds
          ? {
              home: oddsNum.home != null ? String(oddsNum.home) : undefined,
              draw: oddsNum.draw != null ? String(oddsNum.draw) : undefined,
              away: oddsNum.away != null ? String(oddsNum.away) : undefined,
            }
          : undefined,
        probPct: prob.probPct,
        ev: prob.ev,
        trend: prob.trend,
        confLabel: prob.confidenceLabel,
        confLevel: prob.confidence,
        badge: imminent
          ? { label: 'Imminent', color: '#FF9800' }
          : isLive
          ? { label: 'LIVE', color: '#f44336' }
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
