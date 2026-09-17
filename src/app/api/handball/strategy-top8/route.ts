import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";

type CachePayload = {
  strategies: Record<string, unknown[]>;
  computedAt: string;
  window: string;
};

const cache = createTtlCache<CachePayload>("__handballStrategyCache");

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

    const [fixtures, live] = await Promise.all([
      fetchHandballFixtures().catch(() => []),
      fetchHandballLive().catch(() => []),
    ]);

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
