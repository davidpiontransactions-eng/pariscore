/**
 * Moteur de backtest du Top 5 tennis (7 métriques joueur).
 *
 * Replay walk-forward : pour chaque jour D, les métriques des joueurs sont
 * recalculées UNIQUEMENT depuis tennis_matches_internal avec
 * match_date < début de D (pass incrémental chronologique) :
 *   - surfaceElo / eloGlobal : Elo interne propriétaire (K=32, base 1500),
 *     réplique walk-forward — diverge de l'Élo TennisAbstract du payload live
 *     (non rejouable historiquement) ; divergence assumée et documentée ;
 *   - momentum : repli « forme W/L » du moteur prod (les N derniers résultats) ;
 *   - serveDominance / returnEfficiency / completeness / pressure : agrégats
 *     identiques à getTop5PlayerStats (pct par match stockés par le backfill
 *     détail BSD ; les matchs sans pct sont exclus, comme en prod).
 *
 * Settlement : victoire du côté pické (winner_id) · ROI flat 1u sur la cote
 * pré-match BSD (odds_player1/2) quand elle existe.
 */

import path from "path";
import { normPlayerName, TENNIS_TOP5_METRICS } from "@/lib/tennis-top5";
import type { Top5BacktestEntry } from "./types";

const BSD_TENNIS_BASE = "https://sports.bzzoiro.com/tennis";
const PAGE_LIMIT = 200;
const MIN_MATCHES = 3;
const FORM_LEN = 10;
const ELO_K = 32;
const ELO_BASE = 1500;

export const TENNIS_BACKTEST_KEYS = [
  ...TENNIS_TOP5_METRICS.map((d) => d.key),
  "edgeEloMarche",
  "fatigueAdversaire",
  "serveMismatch",
] as const;

/* ------------------------------------------------------------------ */
/* Accès DB — double driver bun:sqlite / better-sqlite3                */
/* ------------------------------------------------------------------ */

interface Stmt {
  all: (...p: unknown[]) => unknown[];
  run: (...p: unknown[]) => unknown;
}
interface DbLike {
  prepare: (sql: string) => Stmt;
}

let dbPromise: Promise<DbLike | null> | null = null;

async function getDb(): Promise<DbLike | null> {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const { Database } = await import("bun:sqlite");
        return new Database(
          process.env.DATABASE_PATH || path.join(process.cwd(), "pariscore.db"),
          { readonly: true },
        ) as unknown as DbLike;
      } catch {
        // Runtime Node (hors bun) : mieux-sqlite3 natif.
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const Database = require("better-sqlite3");
          return new Database(
            process.env.DATABASE_PATH || path.join(process.cwd(), "pariscore.db"),
            { readonly: true, fileMustExist: true },
          ) as unknown as DbLike;
        } catch {
          return null;
        }
      }
    })();
  }
  return dbPromise;
}

interface HistRow {
  source_id: string;
  surface: string | null;
  match_date: number | null;
  winner_name: string | null;
  loser_name: string | null;
  score: string | null;
  sets_winner: number | null;
  sets_loser: number | null;
  odds_player1: number | null;
  odds_player2: number | null;
  w_fi: number | null;
  w_fw: number | null;
  w_sw: number | null;
  w_rp: number | null;
  l_fi: number | null;
  l_fw: number | null;
  l_sw: number | null;
  l_rp: number | null;
}

const HIST_SQL = `
  SELECT source_id, surface, match_date, winner_name, loser_name,
         score, sets_winner, sets_loser, odds_player1, odds_player2,
         w_1st_in_pct AS w_fi, w_1st_won_pct AS w_fw, w_2nd_won_pct AS w_sw, w_ret_pts_won_pct AS w_rp,
         l_1st_in_pct AS l_fi, l_1st_won_pct AS l_fw, l_2nd_won_pct AS l_sw, l_ret_pts_won_pct AS l_rp
  FROM tennis_matches_internal
  WHERE match_date IS NOT NULL AND winner_name IS NOT NULL AND loser_name IS NOT NULL
  ORDER BY match_date ASC`;

/* ------------------------------------------------------------------ */
/* État incrémental                                                    */
/* ------------------------------------------------------------------ */

interface PlayerAgg {
  form: ("W" | "L")[];
  elo: number;
  /** Élos par surface (clé = surface normalisée). */
  eloBySurface: Map<string, number>;
  nSrv: number;
  sumSrv: number;
  nRet: number;
  sumRet: number;
  tbWon: number;
  tbPlayed: number;
  dsWon: number;
  dsPlayed: number;
  /** Derniers matchs joués (buffer circulaire, max 10) — pour fatigue tracking. */
  recentMatches: { dateMs: number; totalSets: number }[];
}

function newAgg(): PlayerAgg {
  return {
    form: [],
    elo: ELO_BASE,
    eloBySurface: new Map(),
    nSrv: 0,
    sumSrv: 0,
    nRet: 0,
    sumRet: 0,
    tbWon: 0,
    tbPlayed: 0,
    dsWon: 0,
    dsPlayed: 0,
    recentMatches: [],
  };
}

/** Tie-breaks joués/gagnés depuis la chaîne score (« 7-6 3-6 7-6(5) »). */
function parseTbs(score: string | null): { played: number; winnerWon: number } {
  if (!score) return { played: 0, winnerWon: 0 };
  let played = 0;
  for (const set of score.split(/\s+/)) {
    const m = /^(\d+)-(\d+)/.exec(set);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if ((a === 7 && b === 6) || (a === 6 && b === 7)) played++;
  }
  return { played, winnerWon: played }; // le gagnant du set 7-6 a gagné le TB
}

class TennisState {
  players = new Map<string, PlayerAgg>();

  private agg(key: string): PlayerAgg {
    let a = this.players.get(key);
    if (!a) {
      a = newAgg();
      this.players.set(key, a);
    }
    return a;
  }

  /** Applique un match au état (chronologique strictement avant le jour rejoué). */
  apply(row: HistRow): void {
    const wk = normPlayerName(row.winner_name ?? "");
    const lk = normPlayerName(row.loser_name ?? "");
    if (!wk || !lk) return;
    const W = this.agg(wk);
    const L = this.agg(lk);
    const surf = (row.surface ?? "").toLowerCase();

    // Elo global + surface (expectation standard).
    const eW = W.elo;
    const eL = L.elo;
    const expW = 1 / (1 + Math.pow(10, (eL - eW) / 400));
    W.elo = eW + ELO_K * (1 - expW);
    L.elo = eL + ELO_K * (0 - expW);
    const sW = W.eloBySurface.get(surf) ?? ELO_BASE;
    const sL = L.eloBySurface.get(surf) ?? ELO_BASE;
    const expSW = 1 / (1 + Math.pow(10, (sL - sW) / 400));
    W.eloBySurface.set(surf, sW + ELO_K * (1 - expSW));
    L.eloBySurface.set(surf, sL + ELO_K * (0 - expSW));

    // Forme récente.
    W.form.push("W");
    L.form.push("L");
    if (W.form.length > FORM_LEN) W.form.shift();
    if (L.form.length > FORM_LEN) L.form.shift();

    // Stats service/retour (% par match — convention du backfill détail).
    const srv = (fi: number | null, fw: number | null, sw: number | null): boolean => {
      if (fi == null || fw == null || sw == null) return false;
      return true;
    };
    if (srv(row.w_fi, row.w_fw, row.w_sw)) {
      W.nSrv++;
      W.sumSrv += ((row.w_fi ?? 0) * (row.w_fw ?? 0) + (100 - (row.w_fi ?? 0)) * (row.w_sw ?? 0)) / 100;
    }
    if (srv(row.l_fi, row.l_fw, row.l_sw)) {
      L.nSrv++;
      L.sumSrv += ((row.l_fi ?? 0) * (row.l_fw ?? 0) + (100 - (row.l_fi ?? 0)) * (row.l_sw ?? 0)) / 100;
    }
    if (row.w_rp != null) {
      W.nRet++;
      W.sumRet += row.w_rp;
    }
    if (row.l_rp != null) {
      L.nRet++;
      L.sumRet += row.l_rp;
    }

    // Pression : tie-breaks + set décisif (atteint 1-1).
    const tb = parseTbs(row.score);
    W.tbWon += tb.winnerWon;
    W.tbPlayed += tb.played;
    L.tbPlayed += tb.played;
    const sw = row.sets_winner ?? 0;
    const sl = row.sets_loser ?? 0;
    if (sw + sl >= 3) {
      W.dsWon += 1;
      W.dsPlayed += 1;
      L.dsPlayed += 1;
    }

    // Fatigue tracking : buffer circulaire des 10 derniers matchs.
    const dateMs = row.match_date ?? 0;
    const totalSets = sw + sl;
    if (dateMs > 0 && totalSets > 0) {
      W.recentMatches.push({ dateMs, totalSets });
      L.recentMatches.push({ dateMs, totalSets });
      if (W.recentMatches.length > 10) W.recentMatches.shift();
      if (L.recentMatches.length > 10) L.recentMatches.shift();
    }
  }

  /** Accès brut à l'agrégat d'un joueur (pour calculs cross-player comme edgeEloMarche). */
  get(key: string): PlayerAgg | undefined {
    return this.players.get(key);
  }

  /** Valeur d'une métrique pour un joueur, null si insuffisante. */
  value(key: string, metric: string, surfaceRaw: string | null): number | null {
    const a = this.players.get(key);
    if (!a) return null;
    switch (metric) {
      case "surfaceElo": {
        const s = this.eloSurf(a, surfaceRaw);
        return s ?? (a.form.length >= MIN_MATCHES ? a.elo : null);
      }
      case "eloGlobal":
        return a.form.length >= MIN_MATCHES ? a.elo : null;
      case "momentum":
        return a.form.length > 0 ? Math.round((a.form.filter((f) => f === "W").length / a.form.length) * 100) : null;
      case "serveDominance":
        return a.nSrv >= MIN_MATCHES ? a.sumSrv / a.nSrv : null;
      case "returnEfficiency":
        return a.nRet >= MIN_MATCHES ? a.sumRet / a.nRet : null;
      case "completeness": {
        if (a.nSrv < MIN_MATCHES || a.nRet < MIN_MATCHES) return null;
        return ((a.sumSrv / a.nSrv) * (a.sumRet / a.nRet)) / 100;
      }
      case "pressure": {
        const tb = a.tbPlayed >= 3 ? (a.tbWon / a.tbPlayed) * 100 : null;
        const dec = a.dsPlayed >= 3 ? (a.dsWon / a.dsPlayed) * 100 : null;
        if (tb == null && dec == null) return null;
        if (tb == null) return dec!;
        if (dec == null) return tb;
        return (tb + dec) / 2;
      }
      /** Fatigue : score de fraîcheur 0-100 (100 = parfaitement reposé). */
      case "fatigueAdversaire": {
        if (a.recentMatches.length === 0) return 50; // pas de données → neutre
        const now = Date.now();
        const MS_48H = 48 * 3600_000;
        const MS_7D = 7 * 86_400_000;
        let score = 100;
        for (const rm of a.recentMatches) {
          const age = now - rm.dateMs;
          if (age < MS_7D) score -= 12; // -12 par match joué <7 j
          if (age < MS_48H && rm.totalSets >= 3) score -= 15; // -15 bonus si 3 sets <48 h
        }
        return Math.max(0, Math.min(100, score));
      }
      /** Service mismatch : domination service sur la surface (hold % proxy). */
      case "serveMismatch": {
        return a.nSrv >= MIN_MATCHES ? a.sumSrv / a.nSrv : null;
      }
      default:
        return null;
    }
  }

  private eloSurf(a: PlayerAgg, surfaceRaw: string | null): number | null {
    const s = (surfaceRaw ?? "").toLowerCase();
    const v = a.eloBySurface.get(s);
    return v != null ? v : null;
  }
}

/* ------------------------------------------------------------------ */
/* Fixtures BSD                                                        */
/* ------------------------------------------------------------------ */

interface TFixture {
  id: number;
  tournament?: { id?: number; circuit?: string; category?: string; surface?: string; name?: string };
  player1?: { id: number; name: string } | null;
  player2?: { id: number; name: string } | null;
  match_date?: string | null;
  round_name?: string | null;
  player1_sets?: number | null;
  player2_sets?: number | null;
  winner_id?: number | null;
  odds_player1?: number | null;
  odds_player2?: number | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function bsdList(status: "finished" | "notstarted", dayISO: string): Promise<TFixture[]> {
  const env = process.env.BSD_API_KEY;
  if (!env) throw new Error("BSD_API_KEY manquante");
  const out: TFixture[] = [];
  for (let page = 0; page < 8; page++) {
    const res = await fetch(
      `${BSD_TENNIS_BASE}/api/v2/matches/?status=${status}&date_from=${dayISO}&date_to=${dayISO}&limit=${PAGE_LIMIT}&page=${page}`,
      { headers: { Authorization: `Token ${env}`, Accept: "application/json" }, signal: AbortSignal.timeout(20_000) },
    );
    if (!res.ok) throw new Error(`BSD HTTP ${res.status}`);
    const j = (await res.json()) as TMatchList;
    const batch = Array.isArray(j) ? j : (j.results ?? []);
    out.push(...batch);
    if (batch.length < PAGE_LIMIT) break;
    await sleep(80);
  }
  return out;
}

interface TMatchList {
  results?: TFixture[];
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (b: Date, n: number) => new Date(b.getTime() + n * 86_400_000);
const startOfDayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * Probabilité Élo→victoire (logistique standard, K=32, base 1500).
 * Retourne P(A) en % (0-100).
 */
function eloWinProb(eloA: number, eloB: number): number {
  return 100 / (1 + 10 ** ((eloB - eloA) / 400));
}

/**
 * Dé-vig multiplicative : retourne probabilités « justes » (%)
 * pour une marché 1x2, ou null si les cotes sont absentes.
 */
function deVig1x2(
  oddsH: number | null,
  oddsD: number | null,
  oddsA: number | null,
): { home: number; draw: number; away: number } | null {
  if (oddsH == null || oddsD == null || oddsA == null) return null;
  if (oddsH < 1 || oddsD < 1 || oddsA < 1) return null;
  const rawH = 1 / oddsH;
  const rawD = 1 / oddsD;
  const rawA = 1 / oddsA;
  const vig = rawH + rawD + rawA;
  if (vig <= 0) return null;
  return { home: (rawH / vig) * 100, draw: (rawD / vig) * 100, away: (rawA / vig) * 100 };
}

/**
 * Edge Élo vs Marché : compare la probabilité Élo du modèle aux probabilités
 * marché dé-viggées. Retourne l'edge (%) du côté favori Élo, ou null si
 * pas de cotes ou edge insuffisant (< 5 points).
 *
 * Convention : si le modèle favorise A (P(A) > P(marché)), on retourne
 * l'edge positif pour A. Si l'edge est négatif ou < 5, on retourne null
 * (pas de valeur détectée).
 */
function computeEdgeEloMarche(
  eloA: number,
  eloB: number,
  oddsP1: number | null,
  oddsP2: number | null,
): { pick: "A" | "B"; edge: number } | null {
  if (oddsP1 == null || oddsP2 == null) return null;
  const pModelA = eloWinProb(eloA, eloB);
  // P(marché) ≈ 100/odds (approximation simple, pas de dé-vig car c'est 2-way)
  const pMktA = 100 / oddsP1;
  const pMktB = 100 / oddsP2;
  // Le fav Élo est le côté avec la plus grande probabilité modèle
  const favorA = pModelA >= 50;
  if (favorA) {
    const edge = pModelA - pMktA;
    return edge >= 5 ? { pick: "A", edge } : null;
  } else {
    const pModelB = 100 - pModelA;
    const edge = pModelB - pMktB;
    return edge >= 5 ? { pick: "B", edge } : null;
  }
}

/* ------------------------------------------------------------------ */
/* Replay                                                              */
/* ------------------------------------------------------------------ */

function buildEntriesForDay(
  state: TennisState,
  fixtures: TFixture[],
  metricKeys: readonly string[],
): Top5BacktestEntry[] {
  const entries: Top5BacktestEntry[] = [];
  for (const f of fixtures) {
    if (!f.player1?.name || !f.player2?.name) continue;
    const kA = normPlayerName(f.player1.name);
    const kB = normPlayerName(f.player2.name);
    const surf = f.tournament?.surface ?? null;
    for (const metric of metricKeys) {
      // edgeEloMarche : cas spécial — nécessite odds + ambos Élos
      if (metric === "edgeEloMarche") {
        const aggA = state.get(kA);
        const aggB = state.get(kB);
        if (!aggA || !aggB) continue;
        const edge = computeEdgeEloMarche(aggA.elo, aggB.elo, f.odds_player1 ?? null, f.odds_player2 ?? null);
        if (!edge) continue;
        const won = f.winner_id != null && f.winner_id === (edge.pick === "A" ? f.player1.id : f.player2.id);
        const settled = f.winner_id != null;
        const odds = edge.pick === "A" ? f.odds_player1 : (f.odds_player2 ?? null);
        entries.push({
          id: `tennis:${metric}:${f.id}`,
          sport: "tennis",
          strategyKey: metric,
          matchId: String(f.id),
          league: f.tournament?.name ?? "",
          kickoff: f.match_date ?? "",
          pickDesc: (edge.pick === "A" ? f.player1.name : f.player2.name) ?? "?",
          pick: edge.pick,
          value: Math.round(edge.edge * 100) / 100,
          odds: settled && odds != null && odds > 1 ? odds : null,
          status: settled ? (won ? "won" : "lost") : "pending",
          settledAt: settled ? new Date().toISOString() : undefined,
          score: f.player1_sets != null && f.player2_sets != null ? `${f.player1_sets}-${f.player2_sets}` : undefined,
          closingOdds: null,
          clvPct: null,
        });
        continue;
      }
      const va = state.value(kA, metric, surf);
      const vb = state.value(kB, metric, surf);
      if (va == null || vb == null || !Number.isFinite(va) || !Number.isFinite(vb)) continue;
      const pick: "A" | "B" | null = Math.abs(va - vb) < Number.EPSILON ? null : va > vb ? "A" : "B";
      if (!pick) continue;
      const won = f.winner_id != null && f.winner_id === (pick === "A" ? f.player1.id : f.player2.id);
      const settled = f.winner_id != null;
      const odds = pick === "A" ? f.odds_player1 : (f.odds_player2 ?? null);
      entries.push({
        id: `tennis:${metric}:${f.id}`,
        sport: "tennis",
        strategyKey: metric,
        matchId: String(f.id),
        league: f.tournament?.name ?? "",
        kickoff: f.match_date ?? "",
        pickDesc: (pick === "A" ? f.player1.name : f.player2.name) ?? "?",
        pick,
        value: Math.round((pick === "A" ? va : vb) * 100) / 100,
        odds: settled && odds != null && odds > 1 ? odds : null,
        status: settled ? (won ? "won" : "lost") : "pending",
        settledAt: settled ? new Date().toISOString() : undefined,
        score: f.player1_sets != null && f.player2_sets != null ? `${f.player1_sets}-${f.player2_sets}` : undefined,
        closingOdds: null,
        clvPct: null,
      });
    }
  }
  // Par métrique : tri valeur desc, top 5 (comme le moteur prod).
  const top: Top5BacktestEntry[] = [];
  for (const metric of metricKeys) {
    const list = entries
      .filter((e) => e.strategyKey === metric)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    top.push(...list);
  }
  return top;
}

export type ReplayProgress = { dayIndex: number; totalDays: number; dayISO: string; nPicks: number };

/** Rejoue les `days` derniers jours (état reconstruit incrémentalement). */
export async function replayTennisDays(
  days: number,
  onProgress?: (p: ReplayProgress) => void,
): Promise<Top5BacktestEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("pariscore.db indisponible");
  const hist = db.prepare(HIST_SQL).all() as unknown as HistRow[];

  const all: Top5BacktestEntry[] = [];
  const state = new TennisState();
  let idx = 0;

  for (let i = days; i >= 1; i--) {
    const day = addDays(new Date(), -i);
    const cutoff = startOfDayMs(day);
    while (idx < hist.length && (hist[idx].match_date ?? 0) < cutoff) {
      state.apply(hist[idx]);
      idx++;
    }
    const dayISO = ymd(day);
    let fixtures: TFixture[] = [];
    try {
      fixtures = await bsdList("finished", dayISO);
    } catch (e) {
      console.warn(`[tennis-replay] ${dayISO}: ${(e as Error).message} — journée ignorée`);
      continue;
    }
    const picks = buildEntriesForDay(state, fixtures, TENNIS_BACKTEST_KEYS);
    all.push(...picks);
    if (onProgress) onProgress({ dayIndex: days - i + 1, totalDays: days, dayISO, nPicks: picks.length });
    await sleep(60);
  }
  return all;
}

export type DailyRunResult = { settled: number; snapshotted: number };

/**
 * Run quotidien : settle les pendings échues + snapshot du top 5 du jour
 * (état = tout l'historique disponible à l'instant du run).
 */
export async function runTennisDaily(): Promise<DailyRunResult> {
  const { loadTop5Entries, upsertTop5Entries } = await import("./store");
  const todayISO = ymd(new Date());

  // ── 1. Settlement des pendings échues ──
  const pending = loadTop5Entries("tennis").filter((e) => e.status === "pending");
  const dueDates = Array.from(
    new Set(pending.filter((e) => e.kickoff.slice(0, 10) < todayISO).map((e) => e.kickoff.slice(0, 10))),
  ).sort();

  let settled = 0;
  if (dueDates.length > 0) {
    const results = new Map<string, TFixture>();
    for (const d of dueDates.slice(-7)) {
      try {
        for (const m of await bsdList("finished", d)) results.set(String(m.id), m);
        await sleep(60);
      } catch (e) {
        console.warn(`[tennis-daily] settle ${d}: ${(e as Error).message}`);
      }
    }
    if (results.size > 0) {
      const updates = pending
        .map((e): Top5BacktestEntry | null => {
          const f = results.get(e.matchId);
          if (!f || f.winner_id == null || !f.player1 || !f.player2) return null;
          const pickIsP1 = e.pick === "A";
          const won = f.winner_id === (pickIsP1 ? f.player1.id : f.player2.id);
          const closingOdds = pickIsP1 ? (f.odds_player1 ?? null) : (f.odds_player2 ?? null);
          // CLV : comparer cote pick (capture snapshot) vs cote finale (closing)
          const pickOdds = e.odds;
          let clvPct: number | null = null;
          if (closingOdds != null && pickOdds != null && pickOdds > 1 && closingOdds > 1) {
            clvPct = ((closingOdds - pickOdds) / pickOdds) * 100;
            clvPct = Math.round(clvPct * 100) / 100;
          }
          return {
            ...e,
            status: won ? "won" : "lost",
            odds: closingOdds != null && closingOdds > 1 ? closingOdds : e.odds,
            closingOdds,
            clvPct,
            settledAt: new Date().toISOString(),
            score: f.player1_sets != null && f.player2_sets != null ? `${f.player1_sets}-${f.player2_sets}` : e.score,
          };
        })
        .filter((e): e is Top5BacktestEntry => e !== null);
      if (updates.length > 0) {
        const res = await upsertTop5Entries("tennis", updates);
        settled = res.updated + res.added;
      }
    }
  }

  // ── 2. Snapshot du jour ──
  let snapshotted = 0;
  try {
    const db = await getDb();
    if (!db) throw new Error("pariscore.db indisponible");
    const hist = db.prepare(HIST_SQL).all() as unknown as HistRow[];
    const state = new TennisState();
    const tomorrowStart = startOfDayMs(addDays(new Date(), 1));
    for (const row of hist) {
      if ((row.match_date ?? 0) < tomorrowStart) state.apply(row);
    }
    const fixtures = (await bsdList("notstarted", todayISO)).filter(
      (m) => typeof m.match_date === "string" && m.match_date.slice(0, 10) === todayISO,
    );
    const pendingEntries = buildEntriesForDay(state, fixtures, TENNIS_BACKTEST_KEYS).map((e) => ({
      ...e,
      status: "pending" as const,
    }));
    snapshotted = pendingEntries.length;
    if (pendingEntries.length > 0) await upsertTop5Entries("tennis", pendingEntries);
  } catch (e) {
    console.warn(`[tennis-daily] snapshot: ${(e as Error).message}`);
  }

  return { settled, snapshotted };
}
