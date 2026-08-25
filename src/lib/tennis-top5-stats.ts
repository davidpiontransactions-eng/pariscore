import path from "node:path";
import { normPlayerName } from "@/lib/tennis-top5";
import type { Top5Period, Top5Surface } from "@/lib/tennis-top5";
import { isDecidingSetMatch, parseTiebreaks } from "@/lib/tennis-stats/leaderboard";

/**
 * Agrégation dédiée Top 5 tennis — lit tennis_matches_internal (pariscore.db
 * readonly) et produit par joueur les métriques composites de Dryja/Sipko :
 *   SRV_PTS_WON%  ≈ moyenne de [1stIn%×1stWon% + (100−1stIn%)×2ndWon%]/100
 *   RET_PTS_WON%  = moyenne return_points_won_pct
 *   TB% / sets décisifs depuis score+sets (parseTiebreaks / isDecidingSetMatch)
 *
 * Pourquoi pas getStatsLeaderboard ? Les colonnes canoniques comptables
 * (w_svpt/w_SvGms…) exigent un dénominateur absolu que le payload détail BSD
 * n'expose pas — le backfill stocke donc des POURCENTAGES par match
 * (tools/backfill-tennis-detail-pcts.js) agrégés ici en moyenne simple.
 */

export interface Top5MetricRow {
  servicePointsWonPct: number | null;
  returnPointsWonPct: number | null;
  tiebreaksWonPct: number | null;
  decidingSetsWonPct: number | null;
  matches: number;
}

export interface Top5StatsResult {
  byPlayer: Map<string, Top5MetricRow>;
  players: number;
  unavailable: boolean;
}

type SqliteLike = {
  prepare: (sql: string) => { all: (...params: unknown[]) => unknown[] };
};

let _db: SqliteLike | null = null;
let _dbUnavailable = false;

function getDb(): SqliteLike | null {
  if (_dbUnavailable) return null;
  if (_db) return _db;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3") as unknown as {
      new (file: string, opts?: { readonly?: boolean; fileMustExist?: boolean }): SqliteLike;
    };
    _db = new Database(
      process.env.DATABASE_PATH || path.join(process.cwd(), "pariscore.db"),
      { readonly: true, fileMustExist: true },
    );
    return _db;
  } catch {
    _dbUnavailable = true;
    return null;
  }
}

const SURFACE_SQL: Record<Top5Surface, string[]> = {
  all: ["Hard", "Clay", "Grass", "Carpet"],
  hard: ["Hard"],
  clay: ["Clay"],
  grass: ["Grass"],
};

function periodCutoff(period: Top5Period): number | null {
  const now = Date.now();
  if (period === "52w") return now - 365 * 86_400_000;
  if (period === "ytd") {
    const d = new Date();
    return Date.UTC(d.getUTCFullYear(), 0, 1);
  }
  return null;
}

interface SideRow {
  player: string | null;
  match_date: number | null;
  surface: string | null;
  score: string | null;
  best_of: number | null;
  sets_won: number | null;
  sets_lost: number | null;
  fi: number | null;
  fw: number | null;
  sw: number | null;
  rp: number | null;
}

function sideSelect(side: "w" | "l", surfaces: string[], cutoff: number | null): string {
  const o = side === "w" ? "l" : "w";
  const where = [
    `${side === "w" ? "winner_name" : "loser_name"} IS NOT NULL`,
    `(${side}_1st_in_pct IS NOT NULL OR ${side}_ret_pts_won_pct IS NOT NULL)`,
    `surface IN (${surfaces.map(() => "?").join(",")})`,
    cutoff != null ? `match_date >= ${cutoff}` : "1=1",
    `(status IS NULL OR LOWER(status) NOT LIKE '%walk%')`,
  ].join(" AND ");
  return `
    SELECT
      ${side === "w" ? "winner_name" : "loser_name"} AS player,
      match_date, surface, score, best_of,
      ${side === "w" ? "sets_winner" : "sets_loser"} AS sets_won,
      ${side === "w" ? "sets_loser" : "sets_winner"} AS sets_lost,
      ${side}_1st_in_pct AS fi, ${side}_1st_won_pct AS fw,
      ${side}_2nd_won_pct AS sw, ${side}_ret_pts_won_pct AS rp
    FROM tennis_matches_internal
    WHERE ${where}`;
}

export function getTop5PlayerStats(
  surface: Top5Surface,
  period: Top5Period,
  minMatches = 5,
): Top5StatsResult {
  const db = getDb();
  if (!db) return { byPlayer: new Map(), players: 0, unavailable: true };

  const surfaces = SURFACE_SQL[surface];
  const cutoff = periodCutoff(period);
  let rows: SideRow[];
  try {
    const sql = `${sideSelect("w", surfaces, cutoff)}
      UNION ALL
      ${sideSelect("l", surfaces, cutoff)}`;
    rows = db.prepare(sql).all(...surfaces, ...surfaces) as unknown as SideRow[];
  } catch {
    return { byPlayer: new Map(), players: 0, unavailable: true };
  }

  interface Acc {
    matches: number;
    srvSum: number;
    srvN: number;
    retSum: number;
    retN: number;
    tbWon: number;
    tbLost: number;
    decWon: number;
    decTotal: number;
  }
  const acc = new Map<string, Acc>();

  for (const r of rows) {
    if (!r.player) continue;
    const key = normPlayerName(r.player);
    if (!key) continue;
    let a = acc.get(key);
    if (!a) {
      a = {
        matches: 0,
        srvSum: 0,
        srvN: 0,
        retSum: 0,
        retN: 0,
        tbWon: 0,
        tbLost: 0,
        decWon: 0,
        decTotal: 0,
      };
      acc.set(key, a);
    }
    a.matches += 1;

    // SRV_PTS_WON du match : pondération intra-match 1re/2e balle
    if (r.fi != null && r.fw != null && r.sw != null && Number.isFinite(r.fi)) {
      const fi = Math.min(100, Math.max(0, r.fi));
      a.srvSum += (fi * r.fw + (100 - fi) * r.sw) / 100;
      a.srvN += 1;
    }
    if (r.rp != null) {
      a.retSum += r.rp;
      a.retN += 1;
    }
    // Tie-breaks depuis le score (perspective gagnant/perdant de la ligne)
    const wonMatch = r.sets_won != null && r.sets_lost != null && r.sets_won > r.sets_lost;
    const parsed = parseTiebreaks(r.score ?? "", wonMatch);
    a.tbWon += parsed.tbWon;
    a.tbLost += parsed.tbLost;

    if (
      r.best_of != null &&
      r.sets_won != null &&
      r.sets_lost != null &&
      isDecidingSetMatch(r.best_of, r.sets_won, r.sets_lost)
    ) {
      a.decTotal += 1;
      if (wonMatch) a.decWon += 1;
    }
  }

  const out = new Map<string, Top5MetricRow>();
  for (const [key, a] of acc) {
    if (a.matches < minMatches) continue;
    const pctOrNull = (s: number, n: number) =>
      n > 0 ? Math.round((s / n) * 10) / 10 : null;
    out.set(key, {
      matches: a.matches,
      servicePointsWonPct: pctOrNull(a.srvSum, a.srvN),
      returnPointsWonPct: pctOrNull(a.retSum, a.retN),
      tiebreaksWonPct:
        a.tbWon + a.tbLost > 0
          ? Math.round((100 * a.tbWon) / (a.tbWon + a.tbLost) * 10) / 10
          : null,
      decidingSetsWonPct:
        a.decTotal > 0 ? Math.round((100 * a.decWon) / a.decTotal * 10) / 10 : null,
    });
  }
  return { byPlayer: out, players: out.size, unavailable: false };
}

