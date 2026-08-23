import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";
import { formKey } from "@/lib/football-form";

/**
 * Données BetMines (scrapées par scripts/scrape_betmines.py →
 * public/data/betmines/{leagueId}.json).
 *
 * Valeur unique : les COTES CORNERS réelles par fixture à venir
 * (Over/Under 7.5 → 10.5) que aucune autre source gratuite n'expose.
 * On dé-vigue chaque paire O/U puis on inverse la loi de Poisson pour
 * retrouver λ (corners attendus) et en déduire n'importe quelle ligne,
 * notamment l'Over 6.5 absent du marché BetMines.
 */

/** slug interne → ID de ligue BetMines (= ID SportMonks). */
export const BETMINES_LEAGUE_MAP: Record<string, number> = {
  epl: 8,
  championship: 9,
  ligue1: 301,
  ligue2: 304,
  laliga: 564,
  laliga2: 567,
  bundesliga: 82,
  bundesliga2: 85,
  seriea: 384,
  serieb: 387,
  eredivisie: 72,
  primeira_liga: 462,
  jupiler: 208,
  super_lig: 600,
  superleague_greece: 325,
  scot_prem: 501,
};

type BetminesFixture = {
  id: number | null;
  dateTime: string | null;
  home: { id: number | null; name: string | null } | null;
  away: { id: number | null; name: string | null } | null;
  bestOddProbability?: number | null;
  odds?: Record<string, string | number | undefined>;
};

type BetminesFile = {
  leagueId: number;
  name: string | null;
  country: string | null;
  seasonId: number | null;
  nFixtures: number;
  fixtures: BetminesFixture[];
  scrapedAt?: string;
};

const DIR = join(process.cwd(), "public", "data", "betmines");
const cache = new Map<number, BetminesFile | null>();

function readLeague(id: number): BetminesFile | null {
  if (cache.has(id)) return cache.get(id) ?? null;
  let data: BetminesFile | null = null;
  try {
    const file = join(DIR, `${id}.json`);
    if (existsSync(file)) data = JSON.parse(readFileSync(file, "utf-8")) as BetminesFile;
  } catch {
    data = null;
  }
  cache.set(id, data);
  return data;
}

/** Dé-vig une paire de cotes décimales → probabilités justes [0..1]. */
function fairPair(over: unknown, under: unknown): { pOver: number } | null {
  const o = Number(over);
  const u = Number(under);
  if (!Number.isFinite(o) || !Number.isFinite(u) || o <= 1 || u <= 1) return null;
  const io = 1 / o;
  const iu = 1 / u;
  const vig = io + iu;
  if (vig <= 0) return null;
  return { pOver: io / vig };
}

function poissonTail(lambda: number, k: number): number {
  let cdf = 0;
  let pmf = Math.exp(-lambda);
  for (let i = 0; i < k; i++) {
    cdf += pmf;
    pmf *= lambda / (i + 1);
  }
  return Math.min(1, Math.max(0, 1 - cdf));
}

/** Inverse P(X ≥ k) = p pour retrouver λ (dichotomie — tail croissant en λ). */
function invertLambda(p: number, k: number): number | null {
  if (!(p > 0 && p < 1)) return null;
  let lo = 1;
  let hi = 30;
  for (let i = 0; i < 45; i++) {
    const mid = (lo + hi) / 2;
    if (poissonTail(mid, k) > p) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export type BetminesCorners = {
  /** λ corners attendus du match, dérivés des cotes dé-vigées. */
  lambdaCorners: number;
  /** Probabilités justes (%) par ligne de marché. */
  pOver65: number;
  pOver75: number;
  pOver85: number;
  pOver95: number;
  /** Proba du modèle BetMines sur son meilleur marché (%). */
  bestOddProbability: number | null;
};

/**
 * Marché corners réel d'une fixture à venir depuis les cotes BetMines.
 * Retourne null si la ligue n'est pas couverte, le fichier absent, ou la
 * fixture introuvable (nom d'équipe non apparié / pas de cotes corners).
 */
export function betminesCornerMarket(
  leagueSlug: string | undefined,
  match: BSDFootballMatch,
): BetminesCorners | null {
  const id = leagueSlug ? BETMINES_LEAGUE_MAP[leagueSlug] : undefined;
  if (!id) return null;
  const file = readLeague(id);
  if (!file?.fixtures?.length) return null;

  const hk = formKey(match.home_team_obj?.name ?? match.home_team);
  const ak = formKey(match.away_team_obj?.name ?? match.away_team);
  if (!hk || !ak) return null;

  const fixture = file.fixtures.find((f) => {
    const fh = f.home?.name ? formKey(f.home.name) : "";
    const fa = f.away?.name ? formKey(f.away.name) : "";
    return fh === hk && fa === ak;
  });
  if (!fixture?.odds) return null;

  // λ estimé par ligne disponible, puis moyenne robuste.
  const lambdas: number[] = [];
  const lines: [number, string][] = [
    [8, "cornerOver75"],
    [9, "cornerOver85"],
    [10, "cornerOver95"],
    [11, "cornerOver105"],
  ];
  for (const [k, key] of lines) {
    const pair = fairPair(fixture.odds[key], fixture.odds[key.replace("Over", "Under")]);
    if (!pair) continue;
    const lambda = invertLambda(pair.pOver, k);
    if (lambda != null) lambdas.push(lambda);
  }
  if (!lambdas.length) return null;

  lambdas.sort((a, b) => a - b);
  const lambda =
    lambdas.length % 2 === 1
      ? lambdas[(lambdas.length - 1) / 2]
      : (lambdas[lambdas.length / 2 - 1] + lambdas[lambdas.length / 2]) / 2;

  const r2 = (v: number) => Math.round(v * 100) / 100;
  const pct = (v: number) => Math.round(v * 1000) / 10;
  return {
    lambdaCorners: r2(lambda),
    pOver65: pct(poissonTail(lambda, 7)),
    pOver75: pct(poissonTail(lambda, 8)),
    pOver85: pct(poissonTail(lambda, 9)),
    pOver95: pct(poissonTail(lambda, 10)),
    bestOddProbability: fixture.bestOddProbability ?? null,
  };
}
