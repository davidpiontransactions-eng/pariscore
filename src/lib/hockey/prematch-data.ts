import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ─── Types prematch hockey ───────────────────────────────────────────────────

export type StatBlock = {
  oneXtwo?: {
    homeWins: number;
    draws: number;
    awayWins: number;
    pcts: number[];
    odds: number[];
  };
  oneTwo?: {
    homeWins: number;
    awayWins: number;
    pcts: number[];
    odds: number[];
  };
  totalGoals?: { line: number; underPct: number; overPct: number };
  goalsFor?: { goals: number; pct: number }[];
  goalsAgainst?: { goals: number; pct: number }[];
  btts?: number;
  goalDiff?: { diff: number; pct: number }[];
  goalAverage?: { home: number; away: number; total: number };
};

export type OverUnderLine = {
  line: number;
  underPct: number;
  overPct: number;
  underOdds: number | null;
  overOdds: number | null;
  underOddsHome: number | null;
  underOddsAway: number | null;
  overOddsHome: number | null;
  overOddsAway: number | null;
  overOddsAll: number | null;
  homeUnderPct: { under: number; over: number } | null;
  awayUnderPct: { under: number; over: number } | null;
  allUnderPct: { under: number; over: number } | null;
  homeOverPct: { under: number; over: number } | null;
  awayOverPct: { under: number; over: number } | null;
  allOverPct: { under: number; over: number } | null;
};

export type MatchPrematch = {
  team1Id: number;
  team1Name: string;
  team2Id: number;
  team2Name: string;
  date?: string;
  odds1X2?: { home: number; draw: number; away: number } | null;
  h2h?: {
    homeTeam: string;
    awayTeam: string;
    date: string;
    summaryHome: StatBlock | null;
    summaryAway: StatBlock | null;
    h2hStats: StatBlock | null;
    standings: {
      rank: number;
      name: string;
      gp: number;
      all: { w: number; otw: number; otl: number; l: number; pts: number };
      home: { w: number; otw: number; otl: number; l: number; pts: number };
      away: { w: number; otw: number; otl: number; l: number; pts: number };
      highlighted: boolean;
    }[];
  } | null;
  summary?: { overUnderLines: OverUnderLine[] } | null;
  error?: string;
};

export type PrematchPayload = {
  updatedAt: string;
  source: string;
  leagues: Record<string, { matches: MatchPrematch[]; error?: string }>;
};

// Chaque source écrit dans SON fichier — merge à la lecture (BetExplorer prioritaire)
const FILES = {
  betexplorer: "hockey_prematch_betexplorer.json",
  annabet: "hockey_prematch_annabet.json",
} as const;

export function loadSource(source: keyof typeof FILES): PrematchPayload | null {
  try {
    const filePath = join(process.cwd(), "data", FILES[source]);
    if (!existsSync(filePath)) return null;
    const data = JSON.parse(readFileSync(filePath, "utf8")) as PrematchPayload;
    return data?.leagues ? data : null;
  } catch {
    return null;
  }
}

// Union par (team1Id, team2Id) — BetExplorer prioritaire (H2H + summary),
// Annabet complète odds1X2 / champs manquants.
export function mergePayloads(
  bx: PrematchPayload | null,
  an: PrematchPayload | null
): PrematchPayload | null {
  if (!bx && !an) return null;
  const leagues: PrematchPayload["leagues"] = {};
  const keys = new Set([
    ...Object.keys(bx?.leagues ?? {}),
    ...Object.keys(an?.leagues ?? {}),
  ]);
  for (const key of keys) {
    const bxM = bx?.leagues[key]?.matches ?? [];
    const anM = an?.leagues[key]?.matches ?? [];
    const seen = new Map<string, MatchPrematch>();
    for (const m of anM) seen.set(`${m.team1Id}-${m.team2Id}`, m);
    for (const m of bxM) {
      const k = `${m.team1Id}-${m.team2Id}`;
      const prev = seen.get(k);
      seen.set(k, prev ? {
        ...prev,
        ...m,
        odds1X2: m.odds1X2 ?? prev.odds1X2,
        h2h: m.h2h ?? prev.h2h,
        summary: m.summary ?? prev.summary,
      } : m);
    }
    const error = bx?.leagues[key]?.error ?? an?.leagues[key]?.error;
    leagues[key] = error ? { matches: [...seen.values()], error } : { matches: [...seen.values()] };
  }
  return { updatedAt: new Date().toISOString(), source: "betexplorer+annabet", leagues };
}

export function loadMergedPrematch(): PrematchPayload | null {
  return mergePayloads(loadSource("betexplorer"), loadSource("annabet"));
}
