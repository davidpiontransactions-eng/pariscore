/**
 * Provider Rugby4Cast — construit les payloads sérialisables pour les routes
 * API et les Server Components. Couche fine au-dessus du moteur (engine).
 *
 * Chaque appel garantit une sync (lazy, dédupliquée, TTL) avant lecture. En
 * cas d'échec ESPN, le payload est `degraded: true` avec l'état en cache.
 */

import { COMPETITION_BY_SLUG, RUGBY_COMPETITIONS } from "./competitions";
import { getBacktestStats } from "./backtest";
import { computePowerScore } from "./models";
import {
  ensureSynced,
  isCompStale,
  isDegraded,
  lastSyncAt,
  readCompState,
  readMatchDetail,
  readUpcoming,
  syncAll,
} from "./engine";
import type {
  BacktestStatsPayload,
  Competition,
  CompetitionsPayload,
  MatchDetailPayload,
  PowerPayload,
  PowerRow,
  PredictionsPayload,
  StandingsPayload,
  SyncResult,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

/** Pool de concurrence pour les syncs initiales (ESPN reste poli avec Akamai). */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Liste des compétitions avec compteurs dynamiques. */
export async function getCompetitionsPayload(): Promise<CompetitionsPayload> {
  let degraded = false;
  const competitions: Competition[] = [];

  // Cache froid : on ne bloque pas le premier chargement sur ~30 s de sync.
  // On lance la resync en arrière-plan (pool 3) et on sert immédiatement
  // l'état courant (vide ou partiel) marqué degraded ; le hook SWR
  // (refreshInterval 60 s) ramène le payload complet une fois la sync finie.
  const staleSlugs = RUGBY_COMPETITIONS.filter((d) => isCompStale(d.slug)).map((d) => d.slug);
  if (staleSlugs.length) {
    void mapLimit(staleSlugs, 3, (slug) => ensureSynced(slug));
  }

  const rows = RUGBY_COMPETITIONS.map((def) => {
    const cs = readCompState(def.slug);
    const stale = isCompStale(def.slug);

    const nowCutoff = Date.now() - 2 * 3600000;
    const upcoming = cs.matches.filter(
      (m) => m.status === "scheduled" && new Date(m.date).getTime() >= nowCutoff
    );
    const next = upcoming.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )[0];

    return {
      def,
      stale,
      upcomingCount: upcoming.length,
      nextFixtureDate: next?.date ?? null,
      lastSyncAt: lastSyncAt(def.slug) ? new Date(lastSyncAt(def.slug)).toISOString() : null,
      degraded: stale || isDegraded(def.slug),
    };
  });

  for (const r of rows) {
    if (r.degraded) degraded = true;
    competitions.push({
      ...r.def,
      upcomingCount: r.upcomingCount,
      nextFixtureDate: r.nextFixtureDate,
      lastSyncAt: r.lastSyncAt,
    });
  }

  competitions.sort((a, b) => a.sortOrder - b.sortOrder);
  return { competitions, fetchedAt: nowIso(), degraded };
}

/** Prédictions d'une compétition. */
export async function getPredictionsPayload(slug: string): Promise<PredictionsPayload | null> {
  const def = COMPETITION_BY_SLUG.get(slug);
  if (!def) return null;
  await ensureSynced(slug);
  const matches = readUpcoming(slug, 60);
  return {
    competition: def,
    matches,
    fetchedAt: nowIso(),
    degraded: isDegraded(slug),
  };
}

/** Classement + chances de titre d'une compétition. */
export async function getStandingsPayload(slug: string): Promise<StandingsPayload | null> {
  const def = COMPETITION_BY_SLUG.get(slug);
  if (!def) return null;
  await ensureSynced(slug);
  const cs = readCompState(slug);
  return {
    competition: def,
    standings: cs.standings,
    simulatedRuns: cs.simulatedRuns,
    fetchedAt: nowIso(),
    degraded: isDegraded(slug),
  };
}

/** Top 10 PowerScore d'une compétition. */
export async function getPowerPayload(slug: string): Promise<PowerPayload | null> {
  const def = COMPETITION_BY_SLUG.get(slug);
  if (!def) return null;
  await ensureSynced(slug);
  const cs = readCompState(slug);
  const teams: PowerRow[] = [...cs.ratings.values()]
    .map((r) => ({
      teamId: r.teamId,
      name: r.name,
      abbreviation: r.abbreviation,
      logo: r.logo,
      color: r.color,
      powerScore: computePowerScore(r),
      elo: Math.round(r.elo),
      attack: Math.round(r.attack * 1000) / 1000,
      defence: Math.round(r.defence * 1000) / 1000,
      gamesPlayed: r.gamesPlayed,
      form: r.form,
    }))
    .sort((a, b) => b.powerScore - a.powerScore)
    .slice(0, 10);
  return { competition: def, teams, fetchedAt: nowIso(), degraded: isDegraded(slug) };
}

/** Stats de couverture du spread (backtest), une compétition ou toutes. */
export async function getBacktestStatsPayload(
  slug: string | null
): Promise<BacktestStatsPayload> {
  return {
    stats: getBacktestStats(slug),
    fetchedAt: nowIso(),
    degraded: slug ? isDegraded(slug) : false,
  };
}

/** Détail d'un match. */
export async function getMatchDetailPayload(
  slug: string,
  matchId: string
): Promise<MatchDetailPayload | null> {
  const def = COMPETITION_BY_SLUG.get(slug);
  if (!def) return null;
  await ensureSynced(slug);
  const detail = readMatchDetail(slug, matchId);
  if (!detail) return null;
  return { detail, fetchedAt: nowIso(), degraded: isDegraded(slug) };
}

/** Sync forcée de toutes les compétitions. */
export async function runFullSync(): Promise<SyncResult> {
  const start = Date.now();
  try {
    const { competitions, matches } = await syncAll();
    let predictions = 0;
    for (const def of RUGBY_COMPETITIONS) {
      predictions += readCompState(def.slug).predictions.size;
    }
    return {
      ok: true,
      competitions,
      matches,
      predictions,
      durationMs: Date.now() - start,
      message: "Synchronisation rugby terminée.",
    };
  } catch (err) {
    return {
      ok: false,
      competitions: 0,
      matches: 0,
      predictions: 0,
      durationMs: Date.now() - start,
      message: `Échec de la synchronisation : ${(err as Error).message}`,
    };
  }
}
