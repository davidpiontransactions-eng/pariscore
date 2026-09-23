import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { toHandballMatch, type FlashscoreMatch } from "@/lib/handball-flashscore";

type CachePayload = {
  strategies: Record<string, unknown[]>;
  computedAt: string;
  window: string;
};

const cache = createTtlCache<CachePayload>("__handballStrategyCache");

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
