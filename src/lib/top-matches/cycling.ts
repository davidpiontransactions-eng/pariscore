// Adapter Cycling — normalise /api/cycling → format TopLeague (stage bets)
import type { SportAdapter, TopLeague } from './types';

export const cyclingAdapter: SportAdapter = {
  sport: 'cycling',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const res = await fetch(`${base}/api/cycling`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bets: any[] = (data.bets || []).slice(0, limit).map((b: any, i: number) => ({
      id: `cycling-bet-${i}`,
      home: { name: b.selection || b.label || `Rider ${i + 1}` },
      away: { name: b.type || 'Stage Winner' },
      kickoff: data.date || '',
      status: 'scheduled' as const,
      metric: b.prob != null
        ? { label: 'Prob', value: `${(b.prob * 100).toFixed(1)}%` }
        : undefined,
      badge: b.edge && b.edge > 0
        ? { label: `Edge ${b.edge.toFixed(1)}%`, color: '#059669' }
        : undefined,
    }));

    const stageLabel = data.race
      ? `${data.race} — ${data.route || ''} (Stage ${data.stage || '?'})`
      : '🚴 Cycling';

    return bets.length
      ? [{ league: stageLabel, leagueIcon: '🚴', leagueColor: '#059669', sport: 'cycling', matches: bets }]
      : [];
  },
};
