// Agrégateur — fetch parallèle de tous les adapters sport
import type { SportType, TopLeague } from './types';
import { footballAdapter } from './football';
import { tennisAdapter } from './tennis';
import { nbaAdapter } from './nba';
import { wnbaAdapter } from './wnba';
import { f1Adapter } from './f1';
import { cs2Adapter } from './cs2';
import { mmaAdapter } from './mma';
import { cyclingAdapter } from './cycling';

const adapters = {
  football: footballAdapter,
  tennis: tennisAdapter,
  nba: nbaAdapter,
  wnba: wnbaAdapter,
  f1: f1Adapter,
  cs2: cs2Adapter,
  mma: mmaAdapter,
  cycling: cyclingAdapter,
};

const ALL_SPORTS = Object.keys(adapters) as SportType[];

export async function fetchTopMatches(
  sport: SportType | 'all',
  limit: number,
  timeframe: string,
): Promise<TopLeague[]> {
  // "basket" regroupe NBA + WNBA
  let sports: string[];
  if (sport === 'all') {
    sports = ALL_SPORTS;
  } else if (sport === 'basket') {
    sports = ['nba', 'wnba'];
  } else {
    sports = [sport];
  }
  const results = await Promise.allSettled(
    sports.map((s) => adapters[s as SportType].fetch(limit, timeframe)),
  );
  const groups: TopLeague[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') groups.push(...r.value);
  }
  return groups;
}
