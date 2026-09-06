// Agrégateur — fetch parallèle de tous les adapters sport
import type { SportType, TopLeague } from './types';
import { SPORT_TYPES, isImminent } from './types';
import { footballAdapter } from './football';
import { tennisAdapter } from './tennis';
import { nbaAdapter } from './nba';
import { wnbaAdapter } from './wnba';
import { f1Adapter } from './f1';
import { cs2Adapter } from './cs2';
import { mmaAdapter } from './mma';
import { cyclingAdapter } from './cycling';
import { fibaAdapter } from './fiba';

const adapters: Record<string, { sport: SportType; fetch(limit: number, timeframe: string): Promise<TopLeague[]> }> = {
  football: footballAdapter,
  tennis: tennisAdapter,
  nba: nbaAdapter,
  wnba: wnbaAdapter,
  f1: f1Adapter,
  cs2: cs2Adapter,
  mma: mmaAdapter,
  cycling: cyclingAdapter,
  fiba: fibaAdapter,
};

const ALL_SPORTS = SPORT_TYPES;

/**
 * Filtrer les groupes pour ne garder que les matchs live ou imminent.
 * Un match est considéré "visible live" si :
 *   - status === 'live' (en cours)
 *   - badge.label === 'Imminent' (début dans < 30 min)
 */
function onlyLive(groups: TopLeague[]): TopLeague[] {
  return groups
    .map((g) => ({
      ...g,
      matches: g.matches.filter(
        (m) =>
          m.status === 'live' ||
          m.badge?.label === 'Imminent' ||
          isImminent(m.kickoff, m.status),
      ),
    }))
    .filter((g) => g.matches.length > 0);
}

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
    sports.map((s) => adapters[s]?.fetch(limit, timeframe) ?? Promise.resolve([])),
  );
  let groups: TopLeague[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') groups.push(...r.value);
  }
  // Si timeframe=live, filtrer côté serveur pour ne garder que les matchs live
  if (timeframe === 'live') {
    groups = onlyLive(groups);
  }
  return groups;
}
