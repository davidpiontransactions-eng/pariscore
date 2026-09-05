// Adapter F1 — normalise /api/f1 → format TopLeague (value bets)
import type { SportAdapter, TopLeague } from './types';

export const f1Adapter: SportAdapter = {
  sport: 'f1',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const res = await fetch(`${base}/api/f1`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const gpName = data.next_gp?.name || data.nextGP?.name || 'Grand Prix';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bets: any[] = (data.value_bets || data.valueBets || []).slice(0, limit).map((b: any, i: number) => ({
      id: `f1-bet-${i}`,
      home: { name: b.driver || b.selection || 'Pilote' },
      away: { name: b.event || b.market || 'Podium' },
      kickoff: data.next_gp?.date || data.nextGP?.date || '',
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
