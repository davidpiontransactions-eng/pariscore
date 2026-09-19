// Adapter Rugby — itère les compétitions featured ESPN → format TopLeague
import type { SportAdapter, TopLeague } from './types';
import { isLiveStatus, isImminent } from './types';

/** Compétitions featured à interroger pour les top matchs */
const FEATURED_SLUGS = [
  'six-nations',
  'top-14',
  'pro-d2',
  'premiership',
  'super-rugby-pacific',
  'united-rugby-championship',
  'champions-cup',
];

const COMP_META: Record<string, { icon: string; color: string; country: string }> = {
  'six-nations':            { icon: '🏉', color: '#006B3F', country: 'Europe' },
  'top-14':                 { icon: '🏉', color: '#003DA5', country: 'France' },
  'pro-d2':                 { icon: '🏉', color: '#E63946', country: 'France' },
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
        // Pro D2 : source Idalgo (widget Rugbyrama) + moteur Poisson
        if (slug === 'pro-d2') {
          const res = await fetch(`${base}/api/rugby/prod2/predictions`, {
            next: { revalidate: 60 },
          });
          if (!res.ok) return null;
          const data: any = await res.json();
          return { slug, matches: data.matches || [] };
        }
        // Autres compétitions : ESPN via predictions API
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

      // Filtrer : scheduled, live, ou finished récents (score visible)
      const filtered = rawMatches.filter((m: any) => {
        if (!m || !m.match) return false;
        const match = m.match;
        const ko = new Date(match.date || 0).getTime();
        // Matchs terminés : garder ceux des dernières 24h pour afficher le score
        if (match.status === 'finished') return ko >= nowMs - 24 * 60 * 60_000;
        return match.status === 'scheduled' || match.status === 'inprogress' || isLiveStatus(match.status, 'rugby') || ko >= nowMs - 30 * 60_000;
      });

      const meta = COMP_META[slug] || { icon: '🏉', color: '#333', country: '' };
      const mapped = filtered.slice(0, limit).map((m: any) => {
        const match = m.match;
        const pred = m.prediction;
        const isLive = match.status === 'inprogress' || isLiveStatus(match.status, 'rugby');
        const isFinished = match.status === 'finished';
        const imminent = !isLive && !isFinished && isImminent(match.date, match.status);
        const score = (match.homeScore != null && match.awayScore != null)
          ? `${match.homeScore} - ${match.awayScore}`
          : undefined;

        // Win probability depuis le moteur Poisson (0-100)
        const probPct = pred ? Math.round(pred.homeWinProb * 100) : undefined;
        // Label de confiance basé sur le verdict
        const confLabel = pred?.verdict === 'backing-home' || pred?.verdict === 'backing-away'
          ? 'Très Forte'
          : pred?.verdict?.startsWith('leaning')
          ? 'Élevée'
          : pred?.verdict === 'toss-up'
          ? 'Moyenne'
          : undefined;
        const confLevel = pred?.verdict === 'backing-home' || pred?.verdict === 'backing-away'
          ? 1 as const
          : pred?.verdict?.startsWith('leaning')
          ? 2 as const
          : 3 as const;

        return {
          id: `rugby-${match.id}`,
          home: { name: match.home?.name || 'TBD', logo: match.home?.logo || undefined },
          away: { name: match.away?.name || 'TBD', logo: match.away?.logo || undefined },
          kickoff: match.date || '',
          status: (isLive ? 'live' : isFinished ? 'finished' : 'scheduled') as 'live' | 'scheduled' | 'finished',
          score,
          liveScore: isLive ? { current: score } : undefined,
          probPct,
          confLabel,
          confLevel,
          badge: imminent
            ? { label: 'Imminent', color: '#FF9800' }
            : isLive
            ? { label: 'LIVE', color: '#f44336' }
            : isFinished
            ? { label: 'Terminé', color: '#6b7280' }
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
