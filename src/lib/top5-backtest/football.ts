/**
 * Moteur de backtest du Top 5 football (9 stratégies).
 *
 * Deux modes :
 *  - REPLAY walk-forward (backfill historique) : pour chaque jour D du passé,
 *    le top 5 est recalculé avec UNIQUEMENT les matchs finis strictement avant
 *    D (forme L5 BSD + cotes pré-match embarquées). Les enrichissements
 *    soccerstats/BetMines sont désactivés dans ce mode : leurs tables ne sont
 *    pas archivées point-dans-le-temps, les utiliser biaiserait le backtest
 *    (lookahead). Le replay mesure donc le moteur de forme BSD, cœur du
 *    classement.
 *  - SNAPSHOT prospectif (cron quotidien) : capture exacte de ce que voit
 *    l'UI aujourd'hui (enrichissements inclus), settle le lendemain.
 *
 * Settlement (règles validées) :
 *   bestTeam/bestTeam1x2 → victoire sèche du pick · doubleChance → non-défaite
 *   bestDefense → pick encaisse ≤1 · bestAttack → ≥3 buts (proxy over 2.5)
 *   over15/under35/bttsYes → marché direct · over65Corners → ≥7 corners réels.
 */

import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";
import {
  computeStrategyTop5Matches,
  STRATEGY_TOP5_KEYS,
  type StrategyMatchEntry,
  type StrategyTop5Key,
} from "@/lib/football-strategy-top5";
import type { Top5BacktestEntry } from "./types";

const BSD_ROOT = "https://sports.bzzoiro.com/api";
const PAGE_LIMIT = 200;
const MAX_PAGES_PER_DAY = 4;
const FORM_POOL_SIZE = 500;
const REQUEST_DELAY_MS = 120;

/* ------------------------------------------------------------------ */
/* Accès BSD                                                           */
/* ------------------------------------------------------------------ */

async function bsdFetch<T>(endpoint: string): Promise<T> {
  const key = process.env.BSD_API_KEY;
  if (!key) throw new Error("BSD_API_KEY not configured");
  const res = await fetch(`${BSD_ROOT}${endpoint}`, {
    headers: { Authorization: `Token ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 402) throw new Error("BSD Sports Addon required (402)");
  if (res.status === 429) throw new Error("BSD rate limited (429)");
  if (!res.ok) throw new Error(`BSD HTTP ${res.status}`);
  return (await res.json()) as T;
}

function unpackList<T>(raw: T[] | { results?: T[] } | null | undefined): T[] {
  if (Array.isArray(raw)) return raw as T[];
  return raw?.results ?? [];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, n: number): Date {
  return new Date(base.getTime() + n * 24 * 3600 * 1000);
}

/** Matchs finis d'une journée (paginé offset — une journée mondiale > 200 matchs). */
async function fetchFinishedDay(dayISO: string): Promise<BSDFootballMatch[]> {
  const out: BSDFootballMatch[] = [];
  for (let page = 0; page < MAX_PAGES_PER_DAY; page++) {
    const raw = await bsdFetch<BSDFootballMatch[] | { results?: BSDFootballMatch[] }>(
      `/matches/?status=finished&date_from=${dayISO}&date_to=${dayISO}&limit=${PAGE_LIMIT}&offset=${page * PAGE_LIMIT}`,
    );
    const batch = unpackList(raw);
    out.push(...batch);
    if (batch.length < PAGE_LIMIT) break;
    await sleep(REQUEST_DELAY_MS);
  }
  return out;
}

/** Matchs à venir (prochaines 100, comme la route prod) filtrés sur un jour ISO. */
async function fetchUpcomingOfDay(dayISO: string): Promise<BSDFootballMatch[]> {
  const raw = await bsdFetch<BSDFootballMatch[] | { results?: BSDFootballMatch[] }>(
    `/matches/?status=notstarted&limit=100&offset=0`,
  );
  return unpackList(raw).filter((m) => typeof m.event_date === "string" && m.event_date.slice(0, 10) === dayISO);
}

/* ------------------------------------------------------------------ */
/* Replay / settlement                                                 */
/* ------------------------------------------------------------------ */

/**
 * Copie « fixture rejouable » : statut notstarted (exigé par le moteur) et
 * league.id neutralisé → désactive soccerstats/BetMines (non archivés).
 */
function toReplayFixture(m: BSDFootballMatch): BSDFootballMatch {
  return { ...m, status: "notstarted", league: { ...m.league, id: -1 } };
}

const num = (v: number | null | undefined): number => (v != null && Number.isFinite(v) ? v : 0);

type Settled = { status: "won" | "lost" | "void"; odds: number | null; closingOdds: number | null; score?: string };

/** Règle de réussite par stratégie contre le résultat réel. */
export function settleFootballPick(
  key: StrategyTop5Key,
  pick: "home" | "away" | null,
  m: BSDFootballMatch,
): Settled {
  if (m.home_score == null || m.away_score == null) return { status: "void", odds: null, closingOdds: null };
  const hs = m.home_score;
  const as = m.away_score;
  const total = hs + as;

  switch (key) {
    case "bestTeam":
    case "bestTeam1x2": {
      if (!pick) return { status: "void", odds: null, closingOdds: null };
      const won = pick === "home" ? hs > as : as > hs;
      const clo = pick === "home" ? m.odds_home : m.odds_away;
      return { status: won ? "won" : "lost", odds: clo ?? null, closingOdds: clo ?? null, score: `${hs}-${as}` };
    }
    case "doubleChance": {
      if (!pick) return { status: "void", odds: null, closingOdds: null };
      const won = pick === "home" ? hs >= as : as >= hs;
      return { status: won ? "won" : "lost", odds: null, closingOdds: null, score: `${hs}-${as}` };
    }
    case "bestDefense": {
      if (!pick) return { status: "void", odds: null, closingOdds: null };
      const conceded = pick === "home" ? as : hs;
      return { status: conceded <= 1 ? "won" : "lost", odds: null, closingOdds: null, score: `${hs}-${as}` };
    }
    case "bestAttack":
      return { status: total >= 3 ? "won" : "lost", odds: null, closingOdds: null, score: `${hs}-${as}` };
    case "over15":
      return { status: total >= 2 ? "won" : "lost", odds: m.odds_over_15 ?? null, closingOdds: m.odds_over_15 ?? null, score: `${hs}-${as}` };
    case "under35":
      return { status: total <= 3 ? "won" : "lost", odds: m.odds_under_35 ?? null, closingOdds: m.odds_under_35 ?? null, score: `${hs}-${as}` };
    case "bttsYes":
      return { status: hs > 0 && as > 0 ? "won" : "lost", odds: m.odds_btts_yes ?? null, closingOdds: m.odds_btts_yes ?? null, score: `${hs}-${as}` };
    case "over65Corners": {
      const lsH = m.live_stats?.home?.corner_kicks;
      const lsA = m.live_stats?.away?.corner_kicks;
      if (lsH == null && lsA == null) return { status: "void", odds: null, closingOdds: null };
      const corners = num(lsH) + num(lsA);
      return { status: corners >= 7 ? "won" : "lost", odds: null, closingOdds: null, score: `${corners} cor` };
    }
    case "edge1x2Home": {
      // Pick = home → home win = won.
      const won = hs > as;
      return { status: won ? "won" : "lost", odds: m.odds_home ?? null, closingOdds: m.odds_home ?? null, score: `${hs}-${as}` };
    }
    case "drawValueLigue": {
      // Pick = draw → draw = won.
      const won = hs === as;
      return { status: won ? "won" : "lost", odds: m.odds_draw ?? null, closingOdds: m.odds_draw ?? null, score: `${hs}-${as}` };
    }
    case "edgeOU25": {
      // pick "home" = over 2.5, pick "away" = under 2.5.
      if (!pick) return { status: "void", odds: null, closingOdds: null };
      const isOver = pick === "home";
      const won = isOver ? total > 2.5 : total <= 2.5;
      const clo = isOver ? m.odds_over_25 : m.odds_under_25;
      return { status: won ? "won" : "lost", odds: clo ?? null, closingOdds: clo ?? null, score: `${hs}-${as}` };
    }
  }
}

function pickDesc(key: StrategyTop5Key, e: StrategyMatchEntry): string {
  const sideTeam = e.pick === "home" ? e.home.teamName : e.away.teamName;
  switch (key) {
    case "bestTeam":
    case "bestTeam1x2":
      return sideTeam ?? "?";
    case "doubleChance":
      return `DC ${sideTeam ?? "?"}`;
    case "bestDefense":
      return `${sideTeam ?? "?"} ≤1 enc`;
    case "bestAttack":
      return "Over 2,5 buts";
    case "over15":
      return "Over 1,5";
    case "under35":
      return "Under 3,5";
    case "bttsYes":
      return "BTTS oui";
    case "over65Corners":
      return "Over 6,5 corners";
    case "edge1x2Home":
      return `${e.home.teamName} (edge home)`;
    case "drawValueLigue":
      return "Draw (valeur ligue)";
    case "edgeOU25":
      return e.pick === "home" ? "Over 2,5" : "Under 2,5";
  }
}

/** Transforme un top 5 calculé en entrées de store, settlées via resultMap. */
function buildEntries(
  top5: ReturnType<typeof computeStrategyTop5Matches>,
  resultMap: Map<string, BSDFootballMatch>,
): Top5BacktestEntry[] {
  const entries: Top5BacktestEntry[] = [];
  for (const key of STRATEGY_TOP5_KEYS) {
    for (const e of top5.strategies[key]) {
      const real = resultMap.get(e.matchId);
      const settled = real
        ? settleFootballPick(key, e.pick, real)
        : { status: "pending" as const, odds: null, closingOdds: null, score: undefined };
      entries.push({
        id: `football:${key}:${e.matchId}`,
        sport: "football",
        strategyKey: key,
        matchId: e.matchId,
        league: e.league,
        kickoff: e.kickoff,
        pickDesc: pickDesc(key, e),
        pick: e.pick,
        value: e.value,
        odds: settled.odds != null && settled.odds > 1 ? settled.odds : null,
        status: settled.status,
        settledAt: settled.status !== "pending" ? new Date().toISOString() : undefined,
        score: settled.score,
        closingOdds: settled.closingOdds ?? null,
        clvPct: null,
      });
    }
  }
  return entries;
}

function byKickoffDesc(a: BSDFootballMatch, b: BSDFootballMatch): number {
  return String(b.event_date).localeCompare(String(a.event_date));
}

export type ReplayProgress = { dayIndex: number; totalDays: number; dayISO: string; nPicks: number };

/**
 * Rejoue les `days` derniers jours et retourne toutes les entrées settlées.
 * Le pool de forme est alimenté au fil de l'eau (jamais le jour D lui-même).
 */
export async function replayFootballDays(
  days: number,
  onProgress?: (p: ReplayProgress) => void,
): Promise<Top5BacktestEntry[]> {
  const today = new Date();
  const all: Top5BacktestEntry[] = [];
  const seen = new Set<number>();
  let pool: BSDFootballMatch[] = [];

  for (let i = days; i >= 1; i--) {
    const dayISO = ymd(addDays(today, -i));
    let dayMatches: BSDFootballMatch[] = [];
    try {
      dayMatches = await fetchFinishedDay(dayISO);
    } catch (err) {
      console.warn(`[top5-backtest] ${dayISO}: ${(err as Error).message} — journée ignorée`);
      continue;
    }

    const fresh = dayMatches.filter((m) => !seen.has(m.id));
    for (const m of fresh) seen.add(m.id);

    if (fresh.length > 0) {
      // Forme = pool STRICTEMENT antérieur à D (trié desc pour slice L5 correct).
      pool.sort(byKickoffDesc);
      const formPool = pool.slice(0, FORM_POOL_SIZE);
      const top5 = computeStrategyTop5Matches(formPool, fresh.map(toReplayFixture));
      const resultMap = new Map(fresh.map((m) => [String(m.id), m]));
      const entries = buildEntries(top5, resultMap);
      all.push(...entries);
      if (onProgress) onProgress({ dayIndex: days - i + 1, totalDays: days, dayISO, nPicks: entries.length });
      for (const m of fresh) {
        if (m.home_score != null && m.away_score != null) pool.push(m);
      }
    }

    await sleep(REQUEST_DELAY_MS);
  }
  return all;
}

export type DailyRunResult = { settled: number; snapshotted: number };

/**
 * Run quotidien (cron) :
 *  1. settle les pendings dont la date est passée ;
 *  2. snapshot du top 5 DU JOUR tel que rendu par le moteur prod (enrichissements inclus).
 */
export async function runFootballDaily(): Promise<DailyRunResult> {
  const { loadTop5Entries, upsertTop5Entries } = await import("./store");
  const todayISO = ymd(new Date());

  // ── 1. Settlement des pendings échues ──
  const pending = loadTop5Entries("football").filter((e) => e.status === "pending");
  const dueDates = Array.from(
    new Set(pending.filter((e) => e.kickoff.slice(0, 10) < todayISO).map((e) => e.kickoff.slice(0, 10))),
  ).sort();

  let settled = 0;
  if (dueDates.length > 0) {
    const results = new Map<string, BSDFootballMatch>();
    for (const d of dueDates.slice(-7)) {
      // Au-delà d'une semaine d'échus non settlés (serveur arrêté…), on rattrape quand même.
      try {
        for (const m of await fetchFinishedDay(d)) results.set(String(m.id), m);
        await sleep(REQUEST_DELAY_MS);
      } catch (err) {
        console.warn(`[top5-backtest] settle ${d}: ${(err as Error).message}`);
      }
    }
    if (results.size > 0) {
      const updates = pending
        .map((e): Top5BacktestEntry | null => {
          const real = results.get(e.matchId);
          if (!real) return null;
          const s = settleFootballPick(e.strategyKey as StrategyTop5Key, (e.pick as "home" | "away" | null) ?? null, real);
          // CLV : comparer cote pick (capture snapshot) vs cote finale (closing)
          const closingOdds = s.closingOdds;
          const pickOdds = e.odds;
          let clvPct: number | null = null;
          if (closingOdds != null && pickOdds != null && pickOdds > 1 && closingOdds > 1) {
            clvPct = ((closingOdds - pickOdds) / pickOdds) * 100;
            clvPct = Math.round(clvPct * 100) / 100;
          }
          return { ...e, ...s, closingOdds, clvPct, settledAt: new Date().toISOString() };
        })
        .filter((e): e is Top5BacktestEntry => e !== null);
      if (updates.length > 0) {
        const res = await upsertTop5Entries("football", updates);
        settled = res.updated + res.added;
      }
    }
  }

  // ── 2. Snapshot du jour (moteur prod complet, overlays inclus) ──
  let snapshotted = 0;
  try {
    const [finRaw, fixtures] = await Promise.all([
      bsdFetch<BSDFootballMatch[] | { results?: BSDFootballMatch[] }>(
        `/matches/?status=finished&date_from=${ymd(addDays(new Date(), -3))}&date_to=${todayISO}&limit=${PAGE_LIMIT}`,
      ),
      fetchUpcomingOfDay(todayISO),
    ]);
    const finished = unpackList(finRaw).sort(byKickoffDesc).slice(0, FORM_POOL_SIZE);
    if (fixtures.length > 0 && finished.length > 0) {
      const top5 = computeStrategyTop5Matches(finished, fixtures);
      const pendingEntries = buildPending(top5);
      snapshotted = pendingEntries.length;
      await upsertTop5Entries("football", pendingEntries);
    }
  } catch (err) {
    console.warn(`[top5-backtest] snapshot: ${(err as Error).message}`);
  }

  return { settled, snapshotted };
}

/** Entrées pending (snapshot prospectif — settlement au run suivant). */
function buildPending(top5: ReturnType<typeof computeStrategyTop5Matches>): Top5BacktestEntry[] {
  return buildEntries(top5, new Map()).map((e) => ({ ...e, status: "pending" as const }));
}
