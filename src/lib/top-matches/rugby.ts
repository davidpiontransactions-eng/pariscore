// Adapter Rugby — itère les compétitions featured ESPN → format TopLeague
import type { SportAdapter, TopLeague } from './types';
import { isLiveStatus, isImminent } from './types';

/** Compétitions featured à interroger pour les top matchs */
const FEATURED_SLUGS = [
  'six-nations',
  'top-14',
  'premiership',
  'super-rugby-pacific',
  'united-rugby-championship',
  'champions-cup',
];

const COMP_META: Record<string, { icon: string; color: string; country: string }> = {
  'six-nations':            { icon: '🏉', color: '#006B3F', country: 'Europe' },
  'top-14':                 { icon: '🏉', color: '#003DA5', country: 'France' },
  'premiership':            { icon: '🏉', color: '#C8102E', country: 'England' },
  'super-rugby-pacific':    { icon: '🏉', color: '#1C1C1C', country: 'Oceania' },
  'united-rugby-championship': { icon: '🏉', color: '#003DA5', country: 'Europe & SA' },
  'champions-cup':          { icon: '🏉', color: '#D4AF37', country: 'Europe' },
};

export const rugbyAdapter: SportAdapter = {
  sport: 'rugby',

  async fetch(limit, _timeframe) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const groups: TopLeague[] = [];
    const nowMs = Date.now();

    // Fetch en parallèle les compétitions featured
    const results = await Promise.allSettled(
      FEATURED_SLUGS.map(async (slug) => {
        const res = await fetch(`${base}/api/rugby/predictions?slug=${slug}`, {
          next: { revalidate: 60 },
        });
        if (!res.ok) return null;
        const data: any = await res.json();
        return { slug, matches: data.matches || [] };
      }),
    );

    for (const r of results) {
      if (r.status !== 'fulfilled' || !r.value) continue;
      const { slug, matches: rawMatches } = r.value;

      // Filtrer : scheduled ou live, pas finished, kickoff pas trop ancien
      const filtered = rawMatches.filter((m: any) => {
        if (!m || !m.match) return false;
        const match = m.match;
        if (match.status === 'finished') return false;
        const ko = new Date(match.date || 0).getTime();
        return match.status === 'scheduled' || match.status === 'inprogress' || isLiveStatus(match.status, 'rugby') || ko >= nowMs - 30 * 60_000;
      });

      const meta = COMP_META[slug] || { icon: '🏉', color: '#333', country: '' };
      const mapped = filtered.slice(0, limit).map((m: any) => {
        const match = m.match;
        const isLive = match.status === 'inprogress' || isLiveStatus(match.status, 'rugby');
        const imminent = !isLive && isImminent(match.date, match.status);
        const score = (match.homeScore != null && match.awayScore != null)
          ? `${match.homeScore} - ${match.awayScore}`
          : undefined;

        return {
          id: `rugby-${match.id}`,
          home: { name: match.home?.name || 'TBD', logo: match.home?.logo || undefined },
          away: { name: match.away?.name || 'TBD', logo: match.away?.logo || undefined },
          kickoff: match.date || '',
          status: (isLive ? 'live' : 'scheduled') as 'live' | 'scheduled',
          score,
          liveScore: isLive ? { current: score } : undefined,
          badge: imminent
            ? { label: 'Imminent', color: '#FF9800' }
            : isLive
            ? { label: 'LIVE', color: '#f44336' }
            : undefined,
        };
      });

      if (mapped.length > 0) {
        groups.push({
          league: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          leagueIcon: meta.icon,
          leagueColor: meta.color,
          sport: 'rugby',
          country: meta.country,
          matches: mapped,
        });
      }
    }

    return groups;
  },
};
