/**
 * Pipeline Baseball unifié — orchestration data + cache mémoire.
 *
 * - MLB : StatsAPI live (adaptateur mlb-statsapi.ts), stats lanceurs réelles.
 * - KBO : registre curé déterministe (kbo-provider.ts).
 * - Cache mémoire TTL 60 s (slates) + cache prédictions par inputHash
 *   (Map persistante process — aucun re-calcul inutile au sein d'une même vie
 *   serveur ; recalcule au redémarrage, c'est le compromis MVP retenu en
 *   attendant une éventuelle persistance Prisma).
 */

import { buildKboSlate } from "./kbo-provider";
import { buildLiveMlbPitcher, fetchMlbPitcherStats, fetchMlbSlate } from "./mlb-statsapi";
import {
  ALL_TEAM_RECORDS,
  KBO_PITCHER_SEEDS,
  MLB_ID_TO_CODE,
  pitcherSeedToRecord,
} from "@/lib/baseball/registry";
import {
  FULL_ITERATIONS,
  QUICK_ITERATIONS,
  buildPrediction,
  predictionInputHash,
} from "@/lib/baseball/engine/baseball-predictive-engine";
import type {
  BaseballGameRecord,
  BaseballMatch,
  BaseballMatchDetail,
  BaseballPrediction,
  League,
  LeagueFilter,
  MatchupContext,
  PitcherRecord,
  QuickPrediction,
  SchedulePayload,
  TeamRecord,
} from "@/lib/baseball/types";
import { round1 } from "@/lib/baseball/format";

const SLATE_CACHE_TTL_MS = 60_000;

type GlobalPipeline = typeof globalThis & {
  __slateCache?: Map<string, { at: number; payload: SchedulePayload }>;
  __predictionCache?: Map<string, { inputHash: string; payload: BaseballPrediction; at: number }>;
  __gameStore?: Map<string, BaseballGameRecord>;
  __pitcherStore?: Map<string, PitcherRecord>;
  __baseballSeeded?: boolean;
};

const globalForPipeline = globalThis as GlobalPipeline;

const slateCache: Map<string, { at: number; payload: SchedulePayload }> =
  globalForPipeline.__slateCache ?? new Map();
if (!globalForPipeline.__slateCache) globalForPipeline.__slateCache = slateCache;

// Cache prédictions persisté process (vit jusqu'au redémarrage du serveur).
// Clé: gameId ; valeur: { inputHash, payload }. Invalide si inputHash change.
const predictionCache: Map<string, { inputHash: string; payload: BaseballPrediction; at: number }> =
  globalForPipeline.__predictionCache ?? new Map();
if (!globalForPipeline.__predictionCache) globalForPipeline.__predictionCache = predictionCache;

// Stores en mémoire (équivalents des upsert DB / read DB).
const gameStore: Map<string, BaseballGameRecord> =
  globalForPipeline.__gameStore ?? new Map();
if (!globalForPipeline.__gameStore) globalForPipeline.__gameStore = gameStore;

const pitcherStore: Map<string, PitcherRecord> =
  globalForPipeline.__pitcherStore ?? new Map();
if (!globalForPipeline.__pitcherStore) globalForPipeline.__pitcherStore = pitcherStore;

/** Seed idempotent des lanceurs KBO curés dans le store mémoire. */
function ensureSeeded(): void {
  if (globalForPipeline.__baseballSeeded) return;
  for (const seed of KBO_PITCHER_SEEDS) {
    if (!pitcherStore.has(seed.id)) {
      pitcherStore.set(seed.id, pitcherSeedToRecord(seed, "curated"));
    }
  }
  globalForPipeline.__baseballSeeded = true;
}

function upsertGame(game: BaseballGameRecord): void {
  gameStore.set(game.id, game);
}

function upsertPitcher(pitcher: PitcherRecord): void {
  pitcherStore.set(pitcher.id, pitcher);
}

function cachedPrediction(
  gameId: string,
  inputHash: string,
  compute: () => BaseballPrediction,
): BaseballPrediction {
  const existing = predictionCache.get(gameId);
  if (existing && existing.inputHash === inputHash) {
    return existing.payload;
  }
  const payload = compute();
  predictionCache.set(gameId, { inputHash, payload, at: Date.now() });
  return payload;
}

function toQuick(prediction: BaseballPrediction): QuickPrediction {
  return {
    totalLine: prediction.total.line,
    overProb: prediction.total.overProb,
    underProb: prediction.total.underProb,
    confidence: prediction.total.confidence,
    recommendation: prediction.total.recommendation,
    expectedTotal: prediction.total.expectedTotal,
    homeWinProb: prediction.moneyline.homeProb,
  };
}

function computeQuickForMatch(match: BaseballMatch): BaseballMatch {
  const { homePitcher, awayPitcher, homeTeam, awayTeam } = match;
  if (!homePitcher || !awayPitcher) return match;
  const input = {
    gameId: match.game.id,
    league: match.game.league,
    homeTeam,
    awayTeam,
    homePitcher,
    awayPitcher,
    iterations: QUICK_ITERATIONS,
  };
  const hash = predictionInputHash(input);
  const prediction = cachedPrediction(match.game.id, hash, () => buildPrediction(input));
  return { ...match, quick: toQuick(prediction) };
}

/** Slate MLB live (avec stats lanceurs réelles dédupliquées). */
async function fetchMlbMatches(date: string): Promise<{
  matches: BaseballMatch[];
  degraded: boolean;
}> {
  const { games, degraded } = await fetchMlbSlate(date);
  if (games.length === 0) return { matches: [], degraded };

  // Dédoublonnage des partants puis fetch stats en parallèle (batch unique)
  const pitcherIds = new Map<number, { fullName: string }>();
  for (const g of games) {
    if (g.homePitcher) pitcherIds.set(g.homePitcher.id, { fullName: g.homePitcher.fullName });
    if (g.awayPitcher) pitcherIds.set(g.awayPitcher.id, { fullName: g.awayPitcher.fullName });
  }
  const statsEntries = await Promise.all(
    [...pitcherIds.entries()].map(async ([id]) => {
      const stats = await fetchMlbPitcherStats(id);
      return [id, stats] as const;
    }),
  );
  const statsById = new Map(statsEntries);

  const matches: BaseballMatch[] = [];
  for (const g of games) {
    const homeCode = MLB_ID_TO_CODE.get(g.homeTeamMlbId);
    const awayCode = MLB_ID_TO_CODE.get(g.awayTeamMlbId);
    if (!homeCode || !awayCode) continue;
    const homeTeam = ALL_TEAM_RECORDS.find((t) => t.id === `MLB:${homeCode}`);
    const awayTeam = ALL_TEAM_RECORDS.find((t) => t.id === `MLB:${awayCode}`);
    if (!homeTeam || !awayTeam) continue;

    const homePitcher = g.homePitcher
      ? buildLiveMlbPitcher(
          homeCode,
          g.homePitcher.id,
          g.homePitcher.fullName,
          statsById.get(g.homePitcher.id) ?? null,
        )
      : null;
    const awayPitcher = g.awayPitcher
      ? buildLiveMlbPitcher(
          awayCode,
          g.awayPitcher.id,
          g.awayPitcher.fullName,
          statsById.get(g.awayPitcher.id) ?? null,
        )
      : null;

    const game: BaseballGameRecord = {
      id: `MLB:${g.gamePk}`,
      league: "MLB",
      gamePk: g.gamePk,
      gameDateIso: g.gameDateIso,
      venueName: g.venueName,
      dayNight: g.dayNight,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homePitcherId: homePitcher?.id ?? null,
      awayPitcherId: awayPitcher?.id ?? null,
      status: g.status,
      homeRuns: g.homeRuns,
      awayRuns: g.awayRuns,
    };
    upsertGame(game);
    if (homePitcher) upsertPitcher(homePitcher);
    if (awayPitcher) upsertPitcher(awayPitcher);

    matches.push({ game, homeTeam, awayTeam, homePitcher, awayPitcher, quick: null });
  }
  return { matches, degraded };
}

/** Point d'entrée du calendrier. */
export async function getSchedulePayload(
  date: string,
  league: LeagueFilter,
): Promise<SchedulePayload> {
  ensureSeeded();
  const key = `${date}:${league}`;
  const cached = slateCache.get(key);
  if (cached && Date.now() - cached.at < SLATE_CACHE_TTL_MS) {
    return cached.payload;
  }

  let matches: BaseballMatch[] = [];
  let degraded = false;

  if (league === "ALL" || league === "MLB") {
    const mlb = await fetchMlbMatches(date);
    matches = matches.concat(mlb.matches);
    degraded = degraded || mlb.degraded;
  }
  if (league === "ALL" || league === "KBO") {
    const kbo = buildKboSlate(date);
    for (const m of kbo) {
      upsertGame(m.game);
    }
    matches = matches.concat(kbo);
  }

  matches.sort(
    (a, b) =>
      new Date(a.game.gameDateIso).getTime() - new Date(b.game.gameDateIso).getTime(),
  );

  const withQuick = matches.map(computeQuickForMatch);

  const payload: SchedulePayload = {
    date,
    league,
    matches: withQuick,
    degraded,
    fetchedAt: new Date().toISOString(),
  };
  slateCache.set(key, { at: Date.now(), payload });
  return payload;
}

function parkLabel(parkFactor: number): MatchupContext["homeParkLabel"] {
  if (parkFactor >= 104) return "favorable over";
  if (parkFactor <= 96) return "favorable under";
  return "neutre";
}

/** Feuille de match complète + moteur 10 000 itérations (cache mémoire). */
export async function getMatchDetailPayload(id: string): Promise<BaseballMatchDetail | null> {
  ensureSeeded();
  const gameRow = gameStore.get(id);
  if (!gameRow) return null;

  const homeTeam = ALL_TEAM_RECORDS.find((t) => t.id === gameRow.homeTeamId);
  const awayTeam = ALL_TEAM_RECORDS.find((t) => t.id === gameRow.awayTeamId);
  if (!homeTeam || !awayTeam) return null;

  let homePitcher: PitcherRecord | null = gameRow.homePitcherId
    ? pitcherStore.get(gameRow.homePitcherId) ?? null
    : null;
  let awayPitcher: PitcherRecord | null = gameRow.awayPitcherId
    ? pitcherStore.get(gameRow.awayPitcherId) ?? null
    : null;

  const game: BaseballGameRecord = gameRow;

  const matchupContext: MatchupContext = {
    homeParkFactor: homeTeam.parkFactor,
    homeParkLabel: parkLabel(homeTeam.parkFactor),
    homePlatoon: {
      opsVsStarterHand: awayPitcher
        ? awayPitcher.throws === "LHP"
          ? homeTeam.opsVsLhp
          : homeTeam.opsVsRhp
        : homeTeam.opsVsRhp,
      opsVsLhp: homeTeam.opsVsLhp,
      opsVsRhp: homeTeam.opsVsRhp,
    },
    awayPlatoon: {
      opsVsStarterHand: homePitcher
        ? homePitcher.throws === "LHP"
          ? awayTeam.opsVsLhp
          : awayTeam.opsVsRhp
        : awayTeam.opsVsRhp,
      opsVsLhp: awayTeam.opsVsLhp,
      opsVsRhp: awayTeam.opsVsRhp,
    },
    homeBullpen: {
      era: homeTeam.bullpenEra,
      ipLast3: homeTeam.bullpenIpLast3,
      fatigueIndex: round1(
        homeTeam.bullpenIpLast3 / 12.0 + (homeTeam.bullpenEra - 3.9) * 0.5,
      ),
    },
    awayBullpen: {
      era: awayTeam.bullpenEra,
      ipLast3: awayTeam.bullpenIpLast3,
      fatigueIndex: round1(
        awayTeam.bullpenIpLast3 / 12.0 + (awayTeam.bullpenEra - 3.9) * 0.5,
      ),
    },
  };

  let prediction: BaseballPrediction | null = null;
  let predictionBlockedReason: string | null = null;

  if (homePitcher && awayPitcher && game.status !== "final") {
    const input = {
      gameId: game.id,
      league: game.league,
      homeTeam,
      awayTeam,
      homePitcher,
      awayPitcher,
      iterations: FULL_ITERATIONS,
    };
    const hash = predictionInputHash(input);
    prediction = cachedPrediction(game.id, hash, () => buildPrediction(input));
  } else if (game.status === "final") {
    predictionBlockedReason =
      "Match terminé — le moteur ne prédit que les matchs à venir.";
  } else {
    predictionBlockedReason =
      "Un des lanceurs partants n'est pas encore annoncé — le moteur attend la confirmation des deux partants.";
  }

  const dataSources = {
    schedule: game.league === "MLB" ? ("mlb-statsapi-live" as const) : ("curated" as const),
    pitchers:
      game.league === "MLB"
        ? homePitcher?.source ?? ("curated" as const)
        : ("curated" as const),
    teams: "curated" as const,
  };

  return {
    game,
    homeTeam,
    awayTeam,
    homePitcher,
    awayPitcher,
    matchupContext,
    prediction,
    predictionBlockedReason,
    dataSources,
    cachedAt: new Date().toISOString(),
  };
}