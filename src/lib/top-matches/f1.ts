// Adapter F1 — normalise /api/v1/f1 → format TopLeague (value bets)
import type { SportAdapter, TopLeague } from './types';

export const f1Adapter: SportAdapter = {
  sport: 'f1',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/v1/f1`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const gpName = data.next_gp?.name || 'Grand Prix';
    const bets: any[] = (data.value_bets || []).slice(0, limit).map((b: any, i: number) => ({
      id: `f1-bet-${i}`,
      home: { name: b.driver || b.selection || 'Pilote' },
      away: { name: b.event || b.market || 'Podium' },
      kickoff: data.next_gp?.date || '',
      status: 'scheduled' as const,
      odds: b.odds ? { away: String(b.odds) } : undefined,
      badge:
        b.edge > 0
          ? { label: `Edge ${b.edge.toFixed(1)}%`, color: '#00c853' }
          : undefined,
    }));

    return [
      {
        league: `🏎️ ${gpName}`,
        leagueIcon: '🏎️',
        leagueColor: '#E10600',
        sport: 'f1',
        matches: bets,
      },
    ];
  },
};
