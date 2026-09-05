// Endpoint GET /api/v1/top-matches/all — agrège tous les sports
import { NextRequest, NextResponse } from 'next/server';
import { fetchTopMatches } from '@/lib/top-matches';
import type { SportType } from '@/lib/top-matches/types';

const VALID_SPORTS = [
  'all',
  'football',
  'tennis',
  'nba',
  'wnba',
  'f1',
  'cs2',
  'mma',
  'cycling',
];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sport = (sp.get('sport') || 'all') as SportType | 'all';
  const limit = Math.min(
    20,
    Math.max(1, parseInt(sp.get('limit') || '10')),
  );
  const timeframe = sp.get('timeframe') || 'today';

  if (!VALID_SPORTS.includes(sport)) {
    return NextResponse.json(
      { error: `Invalid sport. Valid: ${VALID_SPORTS.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const groups = await fetchTopMatches(sport, limit, timeframe);
    return NextResponse.json(
      {
        groups,
        generated_at: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control':
            'public, s-maxage=60, stale-while-revalidate=120',
        },
      },
    );
  } catch {
    return NextResponse.json({
      groups: [],
      generated_at: new Date().toISOString(),
    });
  }
}
