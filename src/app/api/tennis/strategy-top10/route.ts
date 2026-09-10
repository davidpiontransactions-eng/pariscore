import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { apiErrorHandler } from "@/lib/api-error-handler";
import type { TennisMatch } from "@/lib/tennis-data";
import {
  TENNIS_STRATEGY_DEFS,
  buildTennisStrategyTop10,
  normalizeExternalMatch,
  type TennisStrategyKey,
  type TennisStrategyTop10Result,
} from "@/lib/tennis-strategy-top10";
import { normPlayerName, type TennisTop5MetricRow } from "@/lib/tennis-top5";
import { findPlayerElo, extractFormFromHistory } from "@/lib/player-matcher";
import { getStatsLeaderboard, type LeaderboardRow } from "@/lib/tennis-stats/leaderboard";
import { getOfficialLeaderboard } from "@/lib/tennis-stats/official-leaderboard";
import { createTtlCache, isFresh } from "@/lib/cached-route";

/**
 * Top 10 matchs tennis par stratégie de pari — agrège les fixtures BSD
 * (cotes moneyline + stats joueurs leaderboard) via la lib pure
 * `tennis-strategy-top10.ts` (T1).
 *
 * Query params :
 *   - strat : clé stratégie (surfaceEloGap, momentum, serveHold,
 *            returnEfficacy, fatigue, underdogValue, over215,
 *            under215, favorite20). Défaut : "surfaceEloGap".
 *   - win   : fenêtre ("today" | "tomorrow" | "all"). Défaut : "all".
 *
 * Cache mémoire : 5 min (mêmes clés que les routes top5/top10).
 */

const CACHE_TTL_MS = 5 * 60_000;
const PREMATCH_TTL_MS = 5 * 60_000;

type CachedPrematch = { matches: TennisMatch[]; source: string };
type StrategyPayload = {
  strategies: Partial<Record<TennisStrategyKey, TennisStrategyTop10Result["strategies"][TennisStrategyKey]>>;
  matchesConsidered: number;
  computedAt: string;
  strategy: TennisStrategyKey | "all";
  window: string;
  availableStrategies: TennisStrategyKey[];
  /** Tous les matchs considérés (calendrier FotMob). */
  matches: TennisStrategyTop10Result["matches"];
};
type StrategyCacheEntry = { strat: string; win: string; payload: StrategyPayload };

const prematchCache = createTtlCache<CachedPrematch>("__tennisStrategyTop10PrematchCache");
/** Cache dédié Odds API : 2 crédits/appel sur 500/mois → 6h max (~8 crédits/j). */
const oddsCache = createTtlCache<{ matches: TennisMatch[] }>("__tennisStrategyOddsCache");
const ODDS_TTL_MS = 6 * 3600_000;
/** Données MCP lentes (last52) : TTL 8 j. */
const TA_TTL_MS = 8 * 24 * 3600_000;
const strategyCache = createTtlCache<StrategyCacheEntry>("__tennisStrategyTop10Cache");

function isStratKey(v: string | null): v is TennisStrategyKey {
  return !!v && TENNIS_STRATEGY_DEFS.some((d) => d.key === v);
}

/** Tokens significatifs d'un nom (initiales ignorées) : "Tiafoe F." → {tiafoe}. */
function nameTokens(name: string | undefined): Set<string> {
  const set = new Set<string>();
  if (!name) return set;
  for (const p of name.toLowerCase().replace(/[^a-zà-ÿ\s-]/gi, " ").split(/\s+/)) {
    if (p.length > 1) set.add(p);
  }
  return set;
}

/** Doubles (noms avec "/") — le calendrier/predictions sont simples uniquement. */
function isDoubles(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "").includes("/") || (b ?? "").includes("/");
}

/**
 * Greffe les signaux BSD (Élo/forme/SPS + alias leaderboard) sur les matchs
 * externes (noms courts "Tiafoe F.") pour les intégrer au Top10 par stratégie.
 * `insufficientData` ne tombe que si les deux côtés sont résolus.
 */
function graftExternalSignals(
  matches: TennisMatch[],
  lbByPlayer: Map<string, TennisTop5MetricRow>,
): void {
  const idx: Array<{ toks: Set<string>; name: string }> = [];
  for (const m of matches) {
    if ((m as { model?: string }).model === "external") continue;
    for (const p of [m.playerA, m.playerB]) {
      if (p?.name) idx.push({ toks: nameTokens(p.name), name: p.name });
    }
  }
  const findBsdName = (short: string | undefined): string | null => {
    const t = nameTokens(short);
    if (t.size === 0) return null;
    for (const e of idx) {
      for (const tok of t) if (e.toks.has(tok)) return e.name;
    }
    return null;
  };
  const byName = new Map<string, TennisMatch["playerA"]>();
  for (const m of matches) {
    if ((m as { model?: string }).model === "external") continue;
    for (const p of [m.playerA, m.playerB]) {
      if (p?.name && !byName.has(p.name)) byName.set(p.name, p);
    }
  }
  for (const m of matches) {
    if ((m as { model?: string }).model !== "external") continue;
    let ok = true;
    for (const side of ["playerA", "playerB"] as const) {
      const p = m[side];
      const full = findBsdName(p?.name);
      const src = full ? byName.get(full) : undefined;
      if (src) {
        p.surfaceElo = src.surfaceElo ?? src.elo;
        p.elo = src.elo;
        p.eloKnown = true;
        p.rank = src.rank;
        p.form = src.form;
        p.sps = src.sps;
        // Alias leaderboard (serve/retour) sous le nom court.
        const shortKey = normPlayerName(p.name);
        if (shortKey) {
          for (const [lbKey, row] of lbByPlayer) {
            if (lbKey === shortKey) continue;
            const lbToks = nameTokens(lbKey.replace(/_/g, " "));
            let hit = false;
            for (const tok of nameTokens(p.name)) {
              if (lbToks.has(tok)) { hit = true; break; }
            }
            if (hit && !lbByPlayer.has(shortKey)) lbByPlayer.set(shortKey, row);
            if (hit) break;
          }
        }
      } else {
        // Repli : elo-data.json (fuzzy "Sabalenka A." → Sabalenka : Élo + forme).
        const hit = findPlayerElo(p?.name ?? "");
        if (hit) {
          p.surfaceElo = hit.surfaceElo;
          p.elo = hit.elo;
          p.eloKnown = true;
          p.form = extractFormFromHistory(hit.history, 5);
        } else {
          ok = false;
        }
      }
    }
    if (ok) (m as { insufficientData?: boolean }).insufficientData = false;
  }
}

/**
 * Normalise un match Flashscore (DTO scraper) en TennisMatch : `id` requis
 * par le builder (entries, calendrier, pills), `insufficientData` pour que
 * les stratégies à seuils l'ignorent sans crasher. Retourne null si inexploitable.
 * (Implémentation : normalizeExternalMatch dans tennis-strategy-top10.)
 */

/** Extra Flashscore (routine matinale data/flashscore-tennis.json, <26h). */
function loadFlashscoreExtra(): TennisMatch[] {
  try {
    const file = path.join(process.cwd(), "data", "flashscore-tennis.json");
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      updatedAt?: string;
      matches?: TennisMatch[];
    };
    if (!Array.isArray(raw.matches) || raw.matches.length === 0) return [];
    const age = Date.now() - new Date(raw.updatedAt ?? 0).getTime();
    if (!Number.isFinite(age) || age > 26 * 3600_000) return [];
    return raw.matches.filter((m) => m?.playerA?.name && m?.playerB?.name);
  } catch {
    return [];
  }
}

/** Extra Odds API (ATP+WTA, horizon multi-jours) — 6h TTL, stale en repli. */
async function loadOddsExtra(): Promise<TennisMatch[]> {
  const oddsKey = process.env.ODDS_API_KEY;
  if (!oddsKey) return [];
  const cached = oddsCache.getEntry();
  if (cached && isFresh(cached, ODDS_TTL_MS)) return cached.data.matches;
  try {
    const { fetchRealMatches } = await import("@/lib/real-matches");
    const matches = await fetchRealMatches(oddsKey);
    oddsCache.set({ matches });
    return matches;
  } catch (err) {
    console.warn("[tennis-strategy-top10] odds-extra failed:", (err as Error).message);
    return cached?.data.matches ?? [];
  }
}

async function loadPrematchMatches(): Promise<{ matches: TennisMatch[]; source: string }> {  const cached = prematchCache.getEntry();
  if (cached && isFresh(cached, PREMATCH_TTL_MS)) return cached.data;
  const bsdKey = process.env.BSD_API_KEY;
  const bsdEnabled = process.env.BSD_TENNIS_ENABLED === "true";
  if (!bsdKey || !bsdEnabled) return { matches: [], source: "empty" };
  try {
    const { fetchBSDMatches } = await import("@/lib/bsd-fetcher");
    // Enrichissement jours suivants : l'Odds API couvre ATP+WTA sur plusieurs
    // jours (au-delà des ~2 j BSD). Fusion dédupliquée par paire de joueurs.
    const [bsdMatches, oddsMatches] = await Promise.all([
      fetchBSDMatches(),
      loadOddsExtra(),
    ]);
    // Paires acceptées (tokens) pour la dédupe inter-sources.
    const acceptedPairs: Array<[Set<string>, Set<string>]> = bsdMatches.map((m: TennisMatch) => [
      nameTokens(m.playerA?.name),
      nameTokens(m.playerB?.name),
    ]);
    const isDupPair = (a: string | undefined, b: string | undefined): boolean =>
      acceptedPairs.some(
        ([pa, pb]) =>
          ([...pa].some((t) => nameTokens(a).has(t)) && [...pb].some((t) => nameTokens(b).has(t))) ||
          ([...pa].some((t) => nameTokens(b).has(t)) && [...pb].some((t) => nameTokens(a).has(t))),
      );
    const acceptPair = (a: string | undefined, b: string | undefined): void => {
      acceptedPairs.push([nameTokens(a), nameTokens(b)]);
    };
    const cutoff = Date.now() - 30 * 60_000;
    const extra = oddsMatches.filter((m: TennisMatch) => {
      if (!m?.playerA?.name || !m?.playerB?.name) return false;
      if (isDoubles(m.playerA.name, m.playerB.name)) return false;
      if (Number.isFinite(Date.parse(m.scheduledAt)) && Date.parse(m.scheduledAt) < cutoff) return false;
      if (isDupPair(m.playerA.name, m.playerB.name)) return false;
      acceptPair(m.playerA.name, m.playerB.name);
      return true;
    });
    const matches = [...bsdMatches, ...extra];
    // Routine matinale Flashscore (fichier JSON) — normalisée puis
    // dédupliquée par chevauchement de tokens (noms courts "Tiafoe F.").
    const fsExtra = loadFlashscoreExtra()
      .map(normalizeExternalMatch)
      .filter((m): m is TennisMatch => m !== null)
      .filter((m: TennisMatch) => {
      if (!Number.isFinite(Date.parse(m.scheduledAt)) || Date.parse(m.scheduledAt) < cutoff) return false;
      if (isDoubles(m.playerA?.name, m.playerB?.name)) return false;
      if (isDupPair(m.playerA?.name, m.playerB?.name)) return false;
      acceptPair(m.playerA?.name, m.playerB?.name);
      return true;
    });
    const allMatches = [...matches, ...fsExtra];
    if (extra.length > 0 || fsExtra.length > 0 || bsdMatches.length === 0) {
      console.log(
        `[tennis-strategy-top10] prematch: bsd=${bsdMatches.length} odds-extra=${extra.length} flashscore-extra=${fsExtra.length}`,
      );
    }
    const data = {
      matches: allMatches,
      source:
        fsExtra.length > 0 ? "bsd+odds+flashscore" : extra.length > 0 ? "bsd+odds" : "bsd",
    };
    prematchCache.set(data);
    return data;
  } catch (err) {
    console.error("[tennis-strategy-top10] BSD failed:", (err as Error).message);
    return { matches: [], source: "empty" };
  }
}

function mergedLeaderboard(): { byPlayer: Map<string, TennisTop5MetricRow>; players: number; unavailable: boolean } {
  const byPlayer = new Map<string, TennisTop5MetricRow>();
  let players = 0;
  let unavailable = true;

  const mergeRows = (rows: { player: string }[]) => {
    for (const row of rows) {
      const key = normPlayerName(row.player);
      if (!key) continue;
      const prev = byPlayer.get(key);
      if (!prev) {
        byPlayer.set(key, { ...(row as unknown as TennisTop5MetricRow) });
        continue;
      }
      for (const k of Object.keys(row) as string[]) {
        if ((prev as Record<string, unknown>)[k] == null && (row as Record<string, unknown>)[k] != null) {
          (prev as Record<string, unknown>)[k] = (row as Record<string, unknown>)[k];
        }
      }
    }
  };

  const paramsOf = (tour: "atp" | "wta", board: "serve" | "return" | "pressure") => ({
    board,
    tour,
    surface: "all" as const,
    period: "52w" as const,
    vsRank: "all" as const,
    minMatches: 5,
  });

  for (const tour of ["atp", "wta"] as const) {
    for (const board of ["serve", "return", "pressure"] as const) {
      let res = getStatsLeaderboard(paramsOf(tour, board));
      if (res.rows.length === 0) {
        const official = getOfficialLeaderboard(paramsOf(tour, board));
        if (official) {
          res = {
            rows: official.rows as unknown as LeaderboardRow[],
            meta: {
              board,
              tour,
              surface: "all" as const,
              period: "52w" as const,
              vsRank: "all" as const,
              minMatches: 5,
              players: official.rows.length,
              generatedAt: new Date().toISOString(),
              dataUnavailable: false,
              source: official.source,
              coverage: official.coverage,
            },
          };
        }
      }
      if (!res.meta.dataUnavailable && res.rows.length > 0) unavailable = false;
      if (res.rows.length > 0) players += res.meta.players;
      mergeRows(res.rows);
    }
  }
  return { byPlayer, players, unavailable };
}

function applyWindow(matches: TennisMatch[], win: string): TennisMatch[] {
  if (win === "all") return matches;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 3600 * 1000;
  const winStart = startOfDay + (win === "tomorrow" ? dayMs : 0);
  const winEnd = winStart + dayMs;
  return matches.filter((m) => {
    const t = new Date(m.scheduledAt).getTime();
    return Number.isFinite(t) && t >= winStart && t < winEnd;
  });
}


export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const stratParam = sp.get("strat");
    // strat=all : les 9 stratégies (pills calendrier). Sinon une seule.
    const stratAll = stratParam === "all";
    const strat: TennisStrategyKey = isStratKey(stratParam) ? stratParam : "surfaceEloGap";
    const win = sp.get("win") ?? "all";

    // Cache check (la clé inclut le mode all : payloads mono/multi incompatibles)
    const cacheStrat = stratAll ? "all" : strat;
    const cached = strategyCache.getEntry();
    if (
      cached &&
      isFresh(cached, CACHE_TTL_MS) &&
      cached.data.strat === cacheStrat &&
      cached.data.win === win
    ) {
      return NextResponse.json({ ...cached.data.payload, cached: true });
    }

    // 1) Fixtures BSD + filtrage fenêtre
    const { matches: allMatches } = await loadPrematchMatches();
    const windowed = applyWindow(allMatches, win);

    // 2) Leaderboard fusionné (serve/return/pressure ATP+WTA)
    const { byPlayer: lbByPlayer } = mergedLeaderboard();

    // 2b) Fallback Tennis Abstract MCP (serve/retour dérivés, routine
    // quotidienne data/ta-mcp.json) pour les clés absentes uniquement.
    try {
      const taFile = path.join(process.cwd(), "data", "ta-mcp.json");
      const taRaw = JSON.parse(fs.readFileSync(taFile, "utf8")) as {
        updatedAt?: string;
        players?: Record<string, { serve?: number; return?: number }>;
      };
      const taAge = Date.now() - new Date(taRaw.updatedAt ?? 0).getTime();
      if (taRaw.players && Number.isFinite(taAge) && taAge < TA_TTL_MS) {
        let added = 0;
        for (const [key, v] of Object.entries(taRaw.players)) {
          if (lbByPlayer.has(key)) continue;
          if (v.serve == null && v.return == null) continue;
          lbByPlayer.set(key, {
            servicePointsWonPct: v.serve ?? null,
            returnPointsWonPct: v.return ?? null,
          });
          added += 1;
        }
        if (added > 0) console.log(`[tennis-strategy-top10] ta-mcp: +${added} joueurs`);
      }
    } catch {
      /* optionnel : moteur inchangé sans le fichier */
    }

    // 2b) Matchs externes → signaux BSD (intégration au Top10)
    graftExternalSignals(windowed, lbByPlayer);

    // 3) Score via la lib pure (T1)
    const result = buildTennisStrategyTop10(windowed, lbByPlayer);

    // 4) Stratégie(s) demandée(s) + méta + matchs calendrier
    const payload: StrategyPayload = {
      strategies: (stratAll
        ? result.strategies
        : { [strat]: result.strategies[strat] }) as Partial<
        Record<TennisStrategyKey, TennisStrategyTop10Result["strategies"][TennisStrategyKey]>
      >,
      matchesConsidered: result.matchesConsidered,
      computedAt: result.computedAt,
      strategy: stratAll ? "all" : strat,
      window: win,
      availableStrategies: TENNIS_STRATEGY_DEFS.map((d) => d.key),
      matches: result.matches,
    };

    strategyCache.set({ strat: cacheStrat, win, payload });
    return NextResponse.json(payload);
  } catch (err) {
    return apiErrorHandler(err, "tennis/strategy-top10");
  }
}
