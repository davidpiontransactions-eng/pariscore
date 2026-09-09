// Connecteur API-Football v3 (fallback gratuit) pour les stats d'un match foot.
// Consommé par la route /api/football/matches/[id]/stats quand BSD ET ESPN sont
// indisponibles (ex. Veikkausliiga : couverture BSD faible, ESPN sans fin.1).
// Défensif : jamais de throw — null en cas d'échec, la route retombe en 200 dégradé.
// Pattern afFetch/KvStore repris de src/lib/bet-manager/auto-settle.ts.

import { prisma } from "@/lib/prisma";
import { namesMatch } from "@/lib/espn-soccer-fetcher";
import type { TimelineTotals } from "@/lib/football-timeline";

const AF_BASE = "https://v3.football.api-sports.io";
const FIXTURES_TTL_MS = 5 * 60_000;
const STATS_TTL_MS = 10 * 60_000;

/** Statistique unitaire du payload /fixtures/statistics. */
interface AfStat {
  type: string;
  value: string | number | null;
}

/** Bloc équipe du payload /fixtures/statistics. */
interface AfTeamStats {
  team: { name: string };
  statistics: AfStat[];
}

/** Fixture minimale consommée (payload /fixtures). */
interface AfFixture {
  fixture: { id: number; date: string; status?: { short?: string } };
  teams: { home: { name: string }; away: { name: string } };
}

/** Statuts API-Football exploitables (en cours ou terminé). */
const LIVE_OR_DONE = new Set(["1H", "HT", "2H", "ET", "P", "FT"]);

async function afFetch<T>(path: string): Promise<T[] | null> {
  const key = process.env.API_FOOTBALL_KEY;
  // Pas de clé configurée → fallback silencieux (la route reste dégradée).
  if (!key) return null;
  try {
    const res = await fetch(`${AF_BASE}${path}`, {
      headers: { "x-apisports-key": key },
      signal: AbortSignal.timeout(8000),
    });
    // 429 = quota free plan atteint → null (jamais de throw).
    if (res.status === 429 || !res.ok) return null;
    const json: unknown = await res.json();
    const response = (json as { response?: unknown })?.response;
    return Array.isArray(response) ? (response as T[]) : [];
  } catch {
    return null;
  }
}

/** Cache KvStore JSON générique avec TTL — même pattern que auto-settle. */
async function kvCache<T>(
  key: string,
  ttlMs: number,
  refill: () => Promise<T[] | null>,
): Promise<T[] | null> {
  try {
    const cached = await prisma.kvStore.findUnique({ where: { key } });
    if (cached) {
      const parsed = JSON.parse(cached.value) as { at: string; payload: T[] };
      if (Date.now() - new Date(parsed.at).getTime() < ttlMs) return parsed.payload;
    }
  } catch {
    /* cache corrompu / DB indisponible → refetch */
  }
  const payload = await refill();
  if (payload && payload.length) {
    try {
      const value = JSON.stringify({ at: new Date().toISOString(), payload });
      await prisma.kvStore.upsert({ where: { key }, create: { key, value }, update: { value } });
    } catch {
      /* best-effort silencieux */
    }
  }
  return payload;
}

/** Fixtures d'une date (cache 5 min). */
async function fixturesForDate(date: string): Promise<AfFixture[] | null> {
  return kvCache<AfFixture>(`fstats:af:fixtures:${date}`, FIXTURES_TTL_MS, () =>
    afFetch<AfFixture>(`/fixtures?date=${date}`),
  );
}

/** Trouve la fixture (statut live ou terminé) home/away parmi celles du jour. */
function findFixture(fixtures: AfFixture[], homeTeam: string, awayTeam: string): AfFixture | null {
  for (const f of fixtures) {
    const short = f?.fixture?.status?.short ?? "";
    if (!LIVE_OR_DONE.has(short)) continue;
    if (namesMatch(homeTeam, f?.teams?.home?.name) && namesMatch(awayTeam, f?.teams?.away?.name)) {
      return f;
    }
  }
  return null;
}

/** Coercition numérique défensive ("55%", 55, "3" → number|null). */
function toNumber(v: string | number | null): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

/** Statistiques boxscore d'un match (fallback BSD/ESPN pour la route stats). */
export interface ApiFootballMatchStats {
  totals: TimelineTotals;
  homeXg: number | null;
  awayXg: number | null;
}

export async function fetchApiFootballMatchStats(args: {
  homeTeam: string;
  awayTeam: string;
  /** Date du match (ISO) — sinon aujourd'hui. */
  date?: string;
}): Promise<ApiFootballMatchStats | null> {
  const homeTeam = String(args.homeTeam ?? "").trim();
  const awayTeam = String(args.awayTeam ?? "").trim();
  if (!homeTeam || !awayTeam) return null;

  // Fenêtre J puis J-1 (fuseaux horaires) — max 2 appels /fixtures?date.
  const baseDate = args.date ? String(args.date).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const prevDate = new Date(new Date(`${baseDate}T00:00:00Z`).getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);

  let fixture: AfFixture | null = null;
  for (const date of [baseDate, prevDate]) {
    const fixtures = await fixturesForDate(date);
    if (!fixtures?.length) continue;
    fixture = findFixture(fixtures, homeTeam, awayTeam);
    if (fixture) break;
  }
  if (!fixture) return null;
  const fixtureId = fixture.fixture.id;

  // Boxscore par équipe (cache 10 min par fixture).
  const teamStats = await kvCache<AfTeamStats>(`fstats:af:fixture:${fixtureId}`, STATS_TTL_MS, () =>
    afFetch<AfTeamStats>(`/fixtures/statistics?fixture=${fixtureId}`),
  );
  if (!teamStats?.length) return null;

  const homeBlock = teamStats.find((b) => namesMatch(homeTeam, b?.team?.name));
  const awayBlock = teamStats.find((b) => namesMatch(awayTeam, b?.team?.name));
  if (!homeBlock?.statistics?.length || !awayBlock?.statistics?.length) return null;

  const read = (block: AfTeamStats, type: string): number | null =>
    toNumber(block.statistics.find((s) => s?.type === type)?.value ?? null);

  const homePoss = read(homeBlock, "Ball Possession");
  const awayPoss = read(awayBlock, "Ball Possession");
  const homeShots = read(homeBlock, "Total Shots");
  const awayShots = read(awayBlock, "Total Shots");
  const homeSot = read(homeBlock, "Shots on Goal");
  const awaySot = read(awayBlock, "Shots on Goal");
  const homeCorners = read(homeBlock, "Corner Kicks");
  const awayCorners = read(awayBlock, "Corner Kicks");

  // Boxscore vide (ni possession ni tirs) → null, la route garde son dégradé.
  if (homePoss == null && homeShots == null) return null;

  // xG : type "expected_goals" selon plan — absent en free → null honnête.
  const homeXg = read(homeBlock, "expected_goals");
  const awayXg = read(awayBlock, "expected_goals");

  return {
    totals: {
      possession: { home: homePoss ?? 50, away: awayPoss ?? 100 - (homePoss ?? 50) },
      corners: { home: homeCorners ?? 0, away: awayCorners ?? 0 },
      shots: { home: homeShots ?? 0, away: awayShots ?? 0 },
      sot: { home: homeSot ?? 0, away: awaySot ?? 0 },
    },
    homeXg,
    awayXg,
  };
}
