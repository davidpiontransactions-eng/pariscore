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
  oddspedia: "hockey_prematch_oddspedia.json",
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

// Clé de match : ids source + fallback noms normalisés (ids divergents entre sources)
function matchKeys(m: MatchPrematch): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return [
    `${m.team1Id}-${m.team2Id}`,
    `n:${norm(m.team1Name)}|${norm(m.team2Name)}`,
  ];
}

// Union — prixA prioritaire (BetExplorer > Annabet > Oddspedia)
export function mergePayloads(
  prixA: PrematchPayload | null,
  prixB: PrematchPayload | null
): PrematchPayload | null {
  if (!prixA && !prixB) return null;
  const leagues: PrematchPayload["leagues"] = {};
  const keys = new Set([
    ...Object.keys(prixA?.leagues ?? {}),
    ...Object.keys(prixB?.leagues ?? {}),
  ]);
  for (const key of keys) {
    const aM = prixA?.leagues[key]?.matches ?? [];
    const bM = prixB?.leagues[key]?.matches ?? [];
    const seen = new Map<string, MatchPrematch>();
    const index = (m: MatchPrematch, map: Map<string, MatchPrematch>) => {
      for (const k of matchKeys(m)) map.set(k, m);
    };
    for (const m of bM) index(m, seen);
    for (const m of aM) {
      const prev = matchKeys(m).map((k) => seen.get(k)).find(Boolean);
      const merged: MatchPrematch = prev ? {
        ...prev,
        ...m,
        odds1X2: m.odds1X2 ?? prev.odds1X2,
        h2h: m.h2h ?? prev.h2h,
        summary: m.summary ?? prev.summary,
      } : m;
      index(merged, seen);
    }
    // Set de références : chaque match indexé sous 2 clés → valeurs uniques seulement
    const uniq = [...new Set(seen.values())];
    const error = prixA?.leagues[key]?.error ?? prixB?.leagues[key]?.error;
    leagues[key] = error ? { matches: uniq, error } : { matches: uniq };
  }
  return { updatedAt: new Date().toISOString(), source: "betexplorer+annabet+oddspedia", leagues };
}

export function loadMergedPrematch(): PrematchPayload | null {
  return mergePayloads(
    mergePayloads(loadSource("betexplorer"), loadSource("annabet")),
    loadSource("oddspedia")
  );
}
