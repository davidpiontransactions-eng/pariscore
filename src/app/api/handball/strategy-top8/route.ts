import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

type CachePayload = {
  strategies: Record<string, unknown[]>;
  computedAt: string;
  window: string;
};

const cache = createTtlCache<CachePayload>("__handballStrategyCache");

type FlashscoreMatch = {
  id?: string;
  time?: string;
  home: string;
  away: string;
  score?: string | null;
  isLive?: boolean;
  isFinished?: boolean;
  league?: string;
  country?: string;
  odds?: number[];
  homeHalf?: number;
  awayHalf?: number;
  minute?: number;
};

function loadFlashscoreHandball() {
  try {
    const filePath = join(process.cwd(), "data", "flashscore_handball.json");
    if (!existsSync(filePath)) return [] as FlashscoreMatch[];
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    return (data.matches || []) as FlashscoreMatch[];
  } catch {
    return [] as FlashscoreMatch[];
  }
}

function toHandballMatch(m: FlashscoreMatch, idx: number) {
  let score: { home: number; away: number; homeHalf?: number; awayHalf?: number } | undefined;
  if (m.score && m.score !== "- - -") {
    const parts = m.score.split(/\s*-\s*/);
    if (parts.length >= 2) {
      const home = parseInt(parts[0]) || 0;
      const away = parseInt(parts[1]) || 0;
      if (home > 0 || away > 0) {
        score = { home, away };
        if (m.homeHalf != null) score.homeHalf = m.homeHalf;
        if (m.awayHalf != null) score.awayHalf = m.awayHalf;
      }
    }
  }

  let status: "live" | "finished" | "not_started" = "not_started";
  if (m.isLive) status = "live";
  else if (m.isFinished) status = "finished";

  let odds: { home?: number; draw?: number; away?: number } | undefined;
  if (m.odds && m.odds.length >= 2) {
    odds = { home: m.odds[0], away: m.odds[m.odds.length >= 3 ? 2 : 1] };
    if (m.odds.length >= 3) odds.draw = m.odds[1];
  }

  return {
    id: idx,
    league: { id: 0, name: m.league || "Handball", country: m.country || "", countryCode: "" },
    home: { id: 0, name: m.home || "" },
    away: { id: 0, name: m.away || "" },
    kickoff: m.time || new Date().toISOString(),
    status,
    score,
    minute: m.minute,
    odds,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const strat = searchParams.get("strat") || "all";

    const entry = cache.getEntry();
    if (isFresh(entry, 5 * 60_000)) {
      const data = entry!.data;
      if (strat === "all") return NextResponse.json(data);
      return NextResponse.json({ ...data, strategies: { [strat]: data.strategies[strat] ?? [] } });
    }

    const { computeHandballStrategyTop8 } = await import("@/lib/handball-strategy-top8");

    // Charger les données Flashscore (source principale)
    const rawMatches = loadFlashscoreHandball();
    const allMatches = rawMatches.map((m, i) => toHandballMatch(m, i));

    const finished = allMatches.filter((m) => m.status === "finished");
    const upcoming = allMatches.filter((m) => m.status === "not_started" || m.status === "live");

    // Fallback API-Sports si Flashscore vide
    if (finished.length === 0 && upcoming.length === 0) {
      try {
        const { fetchHandballFixtures, fetchHandballLive } = await import("@/lib/handball-api");
        const [fixtures, live] = await Promise.all([
          fetchHandballFixtures().catch(() => []),
          fetchHandballLive().catch(() => []),
        ]);
        const fFinished = fixtures.filter((m) => m.status === "finished");
        const fUpcoming = [...fixtures.filter((m) => m.status === "not_started"), ...live];
        const result = computeHandballStrategyTop8(fFinished, fUpcoming);
        cache.set(result);
        if (strat === "all") return NextResponse.json(result);
        return NextResponse.json({ ...result, strategies: { [strat]: result.strategies[strat as keyof typeof result.strategies] ?? [] } });
      } catch {
        // API-Sports indisponible
      }
    }

    const result = computeHandballStrategyTop8(finished, upcoming);
    cache.set(result);

    if (strat === "all") return NextResponse.json(result);
    return NextResponse.json({ ...result, strategies: { [strat]: result.strategies[strat as keyof typeof result.strategies] ?? [] } });
  } catch (err) {
    return apiErrorHandler(err, "handball/strategy-top8");
  }
}
