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

// Charger les données Flashscore pour le fallback
function loadFlashscoreHandball(): Array<{
  id: string;
  league: { name: string; country: string };
  home: { name: string };
  away: { name: string };
  kickoff: string;
  status: string;
  score?: { home: number; away: number };
  minute?: number;
}> {
  try {
    const filePath = join(process.cwd(), "..", "..", "data", "flashscore_handball.json");
    if (!existsSync(filePath)) return [];
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    const matches = (data.matches || []) as Array<{
      id?: string;
      time?: string;
      home?: string;
      away?: string;
      score?: string | null;
      isLive?: boolean;
      isFinished?: boolean;
      league?: string;
      country?: string;
    }>;
    return matches
      .filter((m) => m.home && m.away)
      .map((m) => {
        let scoreObj: { home: number; away: number } | undefined;
        if (m.score && m.score !== "- - -") {
          const parts = m.score.split(/\s*-\s*/);
          if (parts.length >= 2) {
            const home = parseInt(parts[0]) || 0;
            const away = parseInt(parts[1]) || 0;
            if (home > 0 || away > 0) scoreObj = { home, away };
          }
        }
        let minute: number | undefined;
        if (m.time) {
          const minuteMatch = m.time.match(/(\d+)/);
          if (minuteMatch) minute = parseInt(minuteMatch[1]);
        }
        let status: "live" | "finished" | "not_started" = "not_started";
        if (m.isLive) status = "live";
        else if (m.isFinished) status = "finished";
        const now = new Date();
        let kickoff = now.toISOString();
        if (m.time && m.time.includes(":")) {
          const [hours, mins] = m.time.split(":").map(Number);
          if (!isNaN(hours) && !isNaN(mins)) {
            const ko = new Date(now);
            ko.setHours(hours, mins, 0, 0);
            kickoff = ko.toISOString();
          }
        }
        return {
          id: m.id || `fs-${m.home}-${m.away}`.replace(/\s+/g, "-").toLowerCase(),
          league: { name: m.league || "Flashscore Handball", country: m.country || "" },
          home: { name: m.home || "Dom." },
          away: { name: m.away || "Ext." },
          kickoff,
          status,
          score: scoreObj,
          minute,
        };
      });
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const strat = searchParams.get("strat") || "all";
    const win = searchParams.get("win") || "all";

    const entry = cache.getEntry();
    if (isFresh(entry, 5 * 60_000)) {
      const data = entry!.data;
      if (strat === "all") return NextResponse.json(data);
      return NextResponse.json({ ...data, strategies: { [strat]: data.strategies[strat] ?? [] } });
    }

    const { computeHandballStrategyTop8 } = await import("@/lib/handball-strategy-top8");
    const { fetchHandballFixtures, fetchHandballLive } = await import("@/lib/handball-api");

    let fixtures: any[] = [];
    let live: any[] = [];

    try {
      [fixtures, live] = await Promise.all([
        fetchHandballFixtures().catch(() => []),
        fetchHandballLive().catch(() => []),
      ]);
    } catch {
      // API-Sports indisponible
    }

    // Si API-Sports ne retourne rien, utiliser Flashscore
    if (fixtures.length === 0 && live.length === 0) {
      const flashscoreMatches = loadFlashscoreHandball();
      if (flashscoreMatches.length > 0) {
        fixtures = flashscoreMatches.filter((m) => m.status === "finished");
        live = flashscoreMatches.filter((m) => m.status === "live");
        // Les matchs "not_started" sont considérés comme upcoming
        const upcoming = flashscoreMatches.filter((m) => m.status === "not_started");
        fixtures = [...fixtures, ...upcoming];
      }
    }

    const finished = fixtures.filter(m => m.status === "finished");
    const upcoming = [...fixtures.filter(m => m.status === "not_started"), ...live];

    const result = computeHandballStrategyTop8(finished, upcoming);
    cache.set(result);

    if (strat === "all") return NextResponse.json(result);
    return NextResponse.json({ ...result, strategies: { [strat]: result.strategies[strat as keyof typeof result.strategies] ?? [] } });
  } catch (err) {
    return apiErrorHandler(err, "handball/strategy-top8");
  }
}
