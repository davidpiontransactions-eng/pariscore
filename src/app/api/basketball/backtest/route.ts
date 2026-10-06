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
 *   4. over-reg   : Over <ligne médiane de la LIGUE> si la moyenne des totaux
 *                    des 2 équipes (fenêtre) dépasse cette médiane
 *
 * Lignes, σ et avantage terrain sont MESURÉS par ligue sur
 * basketball_match_history (src/lib/basketball-calibration.ts), jamais
 * extrapolés. Une ligue sans calibration n'est pas evaluée : elle sort avec
 * `predictionsAvailable: false` et une raison.
 *
 * ROI à cote fixe 1.91 (marge bookmaker standard).
 */

import { NextRequest, NextResponse } from "next/server";
import { loadBasketballHistory } from "@/lib/basketball-history-db";
import {
  BASKET_LEAGUE_CALIBRATION,
  basketCalibration,
} from "@/lib/basketball-calibration";

type Entry = { data: unknown; at: number };
const g = globalThis as unknown as { __bbBacktestCache?: Map<string, Entry> };
const cacheMap = (g.__bbBacktestCache ??= new Map<string, Entry>());
const CACHE_TTL = 30 * 60_000;

const VALID = new Set(Object.keys(BASKET_LEAGUE_CALIBRATION));
const WINDOW = 10;
const ODDS = 1.91;

/** Marge mesurée entre p45 et p50 : seuil de déclenchement d'un pari de total. */
const TOTAL_EDGE = 2;

type Row = {
  league: string; date: string; timeUtc: string | null;
  homeKey: string; awayKey: string;
  homeScore: number; awayScore: number;
};

type StratResult = {
  key: string; label: string; description: string;
  bets: number; wins: number; winRate: number; roi: number; profitUnits: number;
  /** true quand la stratégie repose sur une mesure, false sinon. */
  measured: boolean;
};

function runBacktest(rows: Row[]): {
  perLeague: {
    league: string;
    matches: number;
    calibrated: boolean;
    strategies: StratResult[];
  }[];
  overall: StratResult[];
  windowSize: number;
} {
  const leagues = [...new Set(rows.map((r) => r.league))].sort();
  const perLeague = leagues.map((lg) => {
    const cal = basketCalibration(lg);
    const lgRows = rows
      .filter((r) => r.league === lg)
      .sort((a, b) => (a.date + (a.timeUtc ?? "")).localeCompare(b.date + (b.timeUtc ?? "")));
    // état par équipe : historique glissant des scores marqués/encaissés + totaux
    const state = new Map<string, { pf: number[]; pa: number[]; totals: number[] }>();
    const acc: Record<string, { n: number; w: number }> = {};
    const add = (k: string, ok: boolean) => {
      acc[k] ??= { n: 0, w: 0 };
      acc[k].n++;
      if (ok) acc[k].w++;
    };

    for (const r of lgRows) {
      const A = state.get(r.homeKey) ?? { pf: [], pa: [], totals: [] };
      const B = state.get(r.awayKey) ?? { pf: [], pa: [], totals: [] };
      const total = r.homeScore + r.awayScore;

      if (A.pf.length >= WINDOW && B.pf.length >= WINDOW) {
        const ppgA = A.pf.slice(-WINDOW).reduce((s, x) => s + x, 0) / WINDOW;
        const ppgB = B.pf.slice(-WINDOW).reduce((s, x) => s + x, 0) / WINDOW;
        const avgTotal = ((A.totals.slice(-WINDOW).reduce((s, x) => s + x, 0) + B.totals.slice(-WINDOW).reduce((s, x) => s + x, 0)) / (2 * WINDOW));
        const homeWin = r.homeScore > r.awayScore;
        add("home-win", homeWin);
        add("ppg-best", ppgA >= ppgB ? homeWin : !homeWin);
        if (ppgA - ppgB >= 3) add("ppg-edge", homeWin);
        // Seuil = médiane MESURÉE de la ligue (et non 220 = constante NBA).
        if (cal && avgTotal >= cal.totalLine + TOTAL_EDGE) add("over-reg", total > cal.totalLine);
      }

      // mise à jour APRÈS évaluation (anti-fuite)
      A.pf.push(r.homeScore); A.pa.push(r.awayScore); A.totals.push(total);
      B.pf.push(r.awayScore); B.pa.push(r.homeScore); B.totals.push(total);
      state.set(r.homeKey, A);
      state.set(r.awayKey, B);
    }

    const strat = (key: string, label: string, description: string, measured = true): StratResult => {
      const a = acc[key] ?? { n: 0, w: 0 };
      const profit = a.w * (ODDS - 1) - (a.n - a.w);
      return {
        key, label, description, measured: measured && a.n > 0,
        bets: a.n, wins: a.w,
        winRate: a.n ? Math.round((100 * a.w) / a.n * 10) / 10 : 0,
        roi: a.n ? Math.round((profit / a.n) * 1000) / 10 : 0,
        profitUnits: Math.round(profit * 10) / 10,
      };
    };
    const line = cal ? `${cal.totalLine}` : "n.c.";
    return {
      league: lg,
      matches: lgRows.length,
      calibrated: cal !== null,
      strategies: [
        strat("home-win", "Victoire domicile", "Pari systématique sur l'équipe à domicile (référence home advantage)"),
        strat("ppg-best", "Meilleur PPG", "Pari sur l'équipe au meilleur PPG des 10 derniers matchs"),
        strat("ppg-edge", "Avantage PPG ≥ 3", "Pari domicile uniquement si PPG dom − PPG ext ≥ 3 sur la fenêtre"),
        cal
          ? strat("over-reg", `Over ${line} (mesuré)`, `Over la médiane totale mesurée de la ligue (${line}) si la moyenne des totaux (fenêtre) des 2 équipes dépasse ${cal.totalLine + TOTAL_EDGE}`)
          : strat("over-reg", "Over (non mesuré)", `Aucune base mesurée pour ${lg} — ligne et seuil non extrapolés`, false),
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
      measured: all.some((s) => s.measured) && n > 0,
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
    // Accès historique partagé : basketball-history-db gère l'ordre des
    // candidats de base (DATABASE_PATH > racine > cwd), la validation de la
    // table et le repli bun:sqlite/better-sqlite3. Une base absente ⇒
    // predictionsAvailable=false avec raison, pas un tableau de zéros.
    const rows: Row[] = [];
    for (const league of leagues) {
      const matches = loadBasketballHistory({
        league,
        from,
        to,
        limit: 5000,
      });
      for (const m of matches) {
        rows.push({
          league,
          date: m.date,
          timeUtc: m.timeUtc,
          homeKey: m.homeKey,
          awayKey: m.awayKey,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
        });
      }
    }

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "historique indisponible",
          details: "basketball_match_history vide ou absente pour les ligues demandées",
          predictionsAvailable: false,
          leagues,
        },
        { status: 503 },
      );
    }

    const result = {
      ...runBacktest(rows),
      range: { from: from ?? null, to: to ?? null },
      leagues,
      matches: rows.length,
      oddsFixed: ODDS,
      predictionsAvailable: true,
      generatedAt: new Date().toISOString(),
    };
    cacheMap.set(cacheKey, { data: result, at: Date.now() });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: "backtest indisponible",
        details: (err as Error).message,
        predictionsAvailable: false,
      },
      { status: 503 },
    );
  }
}
