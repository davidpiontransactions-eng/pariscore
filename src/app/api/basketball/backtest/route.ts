/**
 * API route — Backtest basket (sous-onglet « Backtest »).
 * GET /api/basketball/backtest?leagues=NBA,WNBA&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Walk-forward SANS fuite : chaque prédiction n'utilise que les stats des N
 * matchs PRÉCÉDENTS de chaque équipe (fenêtre glissante), puis est évaluée sur
 * le match suivant. Stratégies :
 *   1. home-win   : victoire domicile systématique (référence home advantage)
 *   2. ppg-best   : l'équipe avec le meilleur PPG (fenêtre) gagne
 *   3. ppg-edge   : pari domicile si PPG_home - PPG_away ≥ 3 (avantage marqué)
 *   4. over-reg   : Over 215.5 points totaux si moyenne des totaux des 2 équipes (fenêtre) ≥ 220
 *
 * ROI à cote fixe 1.91 (marge bookmaker standard).
 */

import { NextRequest, NextResponse } from "next/server";

type Entry = { data: unknown; at: number };
const g = globalThis as unknown as { __bbBacktestCache?: Map<string, Entry> };
const cacheMap = (g.__bbBacktestCache ??= new Map<string, Entry>());
const CACHE_TTL = 30 * 60_000;

const VALID = new Set(["NBA", "WNBA", "EuroLeague", "EuroCup"]);
const WINDOW = 10;
const ODDS = 1.91;

type Row = {
  league: string; date: string; time_utc: string | null;
  home_key: string; away_key: string;
  home_score: number; away_score: number;
  home_quarters: string | null; away_quarters: string | null;
};

type StratResult = {
  key: string; label: string; description: string;
  bets: number; wins: number; winRate: number; roi: number; profitUnits: number;
};

function runBacktest(rows: Row[]): {
  perLeague: { league: string; matches: number; strategies: StratResult[] }[];
  overall: StratResult[];
  windowSize: number;
} {
  const leagues = [...new Set(rows.map((r) => r.league))].sort();
  const perLeague = leagues.map((lg) => {
    const lgRows = rows.filter((r) => r.league === lg).sort((a, b) => (a.date + (a.time_utc ?? "")).localeCompare(b.date + (b.time_utc ?? "")));
    // état par équipe : historique glissant des scores marqués/encaissés + totaux
    const state = new Map<string, { pf: number[]; pa: number[]; totals: number[] }>();
    const acc: Record<string, { n: number; w: number }> = {};
    const add = (k: string, ok: boolean) => {
      acc[k] ??= { n: 0, w: 0 };
      acc[k].n++;
      if (ok) acc[k].w++;
    };

    for (const r of lgRows) {
      const A = state.get(r.home_key) ?? { pf: [], pa: [], totals: [] };
      const B = state.get(r.away_key) ?? { pf: [], pa: [], totals: [] };
      const total = r.home_score + r.away_score;

      if (A.pf.length >= WINDOW && B.pf.length >= WINDOW) {
        const ppgA = A.pf.slice(-WINDOW).reduce((s, x) => s + x, 0) / WINDOW;
        const ppgB = B.pf.slice(-WINDOW).reduce((s, x) => s + x, 0) / WINDOW;
        const avgTotal = ((A.totals.slice(-WINDOW).reduce((s, x) => s + x, 0) + B.totals.slice(-WINDOW).reduce((s, x) => s + x, 0)) / (2 * WINDOW));
        const homeWin = r.home_score > r.away_score;
        add("home-win", homeWin);
        add("ppg-best", ppgA >= ppgB ? homeWin : !homeWin);
        if (ppgA - ppgB >= 3) add("ppg-edge", homeWin);
        if (avgTotal >= 220) add("over-reg", total > 215.5);
      }

      // mise à jour APRÈS évaluation (anti-fuite)
      A.pf.push(r.home_score); A.pa.push(r.away_score); A.totals.push(total);
      B.pf.push(r.away_score); B.pa.push(r.home_score); B.totals.push(total);
      state.set(r.home_key, A);
      state.set(r.away_key, B);
    }

    const strat = (key: string, label: string, description: string): StratResult => {
      const a = acc[key] ?? { n: 0, w: 0 };
      const profit = a.w * (ODDS - 1) - (a.n - a.w);
      return {
        key, label, description,
        bets: a.n, wins: a.w,
        winRate: a.n ? Math.round((100 * a.w) / a.n * 10) / 10 : 0,
        roi: a.n ? Math.round((profit / a.n) * 1000) / 10 : 0,
        profitUnits: Math.round(profit * 10) / 10,
      };
    };
    return {
      league: lg,
      matches: lgRows.length,
      strategies: [
        strat("home-win", "Victoire domicile", "Pari systématique sur l'équipe à domicile (référence home advantage)"),
        strat("ppg-best", "Meilleur PPG", "Pari sur l'équipe au meilleur PPG des 10 derniers matchs"),
        strat("ppg-edge", "Avantage PPG ≥ 3", "Pari domicile uniquement si PPG dom − PPG ext ≥ 3 sur la fenêtre"),
        strat("over-reg", "Over 215.5 régulier", "Over 215.5 si moyenne des totaux (fenêtre) des 2 équipes ≥ 220"),
      ],
    };
  });

  // Global : somme pondérée des stratégies par clé
  const overall: StratResult[] = ["home-win", "ppg-best", "ppg-edge", "over-reg"].map((key) => {
    const all = perLeague.flatMap((l) => l.strategies.filter((s) => s.key === key));
    const n = all.reduce((s, x) => s + x.bets, 0);
    const w = all.reduce((s, x) => s + x.wins, 0);
    const profit = all.reduce((s, x) => s + x.profitUnits, 0);
    return {
      key,
      label: all[0]?.label ?? key,
      description: all[0]?.description ?? "",
      bets: n, wins: w,
      winRate: n ? Math.round((100 * w) / n * 10) / 10 : 0,
      roi: n ? Math.round((profit / n) * 1000) / 10 : 0,
      profitUnits: Math.round(profit * 10) / 10,
    };
  });

  return { perLeague, overall, windowSize: WINDOW };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leaguesParam = searchParams.get("leagues") || "NBA,WNBA";
  const leagues = leaguesParam.split(",").map((s) => s.trim()).filter((s) => VALID.has(s));
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  if (leagues.length === 0) {
    return NextResponse.json({ error: "paramètre leagues invalide", details: `leagues⊆{${[...VALID].join(",")}}` }, { status: 400 });
  }
  for (const [k, v] of Object.entries({ from, to })) {
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return NextResponse.json({ error: `Invalid ${k} date (YYYY-MM-DD)` }, { status: 400 });
    }
  }

  const cacheKey = JSON.stringify([leagues, from, to]);
  const cached = cacheMap.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    // Table historique (entry 100) — lecture directe bun:sqlite (runtime pm2 = bun).
    const { Database } = require("bun:sqlite") as { Database: new (f: string, o?: object) => { prepare: (s: string) => { all: (...p: unknown[]) => unknown[]; get: (...p: unknown[]) => unknown } } };
    const path = require("node:path") as typeof import("node:path");
    const cwd = process.cwd();
    const candidates = [
      process.env.DATABASE_PATH,
      path.join(cwd, "pariscore.db"),
      path.join(cwd, "..", "pariscore.db"),
    ].filter(Boolean) as string[];
    let db: ReturnType<Parameters<typeof Object>[0]> | null = null;
    for (const file of candidates) {
      try {
        const d = new Database(file, { readonly: true });
        const ok = d.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='basketball_match_history' LIMIT 1").get();
        if (ok) { db = d; break; }
      } catch { /* suivant */ }
    }
    if (!db) {
      return NextResponse.json({ error: "base indisponible", details: "basketball_match_history introuvable" }, { status: 503 });
    }
    const conds = [`league IN (${leagues.map(() => "?").join(",")})`];
    const params: unknown[] = [...leagues];
    if (from) { conds.push("date >= ?"); params.push(from); }
    if (to) { conds.push("date <= ?"); params.push(to); }
    const rows = db.prepare(
      `SELECT league, date, time_utc, home_key, away_key, home_score, away_score FROM basketball_match_history WHERE ${conds.join(" AND ")} ORDER BY date ASC`
    ).all(...params) as Row[];

    const result = {
      ...runBacktest(rows),
      range: { from: from ?? null, to: to ?? null },
      leagues,
      matches: rows.length,
      oddsFixed: ODDS,
      generatedAt: new Date().toISOString(),
    };
    cacheMap.set(cacheKey, { data: result, at: Date.now() });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: "backtest indisponible", details: (err as Error).message }, { status: 503 });
  }
}
