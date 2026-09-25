import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { readFileSync } from "fs";
import { toHandballMatch, resolveHandballDataFile, type FlashscoreMatch } from "@/lib/handball-flashscore";
import { applyPapiOdds, loadOddsPapiSnapshot } from "@/lib/odds-handball-papi";
import type { HandballStrategyChip, HandballStrategyResult } from "@/lib/handball-strategy-top8";

type CachePayload = HandballStrategyResult & {
  /** Chips « Top stratégies ≥60 % » par matchId (2ᵉ ligne du calendrier). */
  chips: Record<string, HandballStrategyChip[]>;
};

const cache = createTtlCache<CachePayload>("__handballStrategyCache");

function loadFlashscoreHandball() {
  try {
    // resolveHandballDataFile : cwd standalone (.next/standalone) OU racine repo
    const filePath = resolveHandballDataFile("flashscore_handball.json");
    if (!filePath) return [] as FlashscoreMatch[];
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    return (data.matches || []) as FlashscoreMatch[];
  } catch {
    return [] as FlashscoreMatch[];
  }
}

/** Répond TOUJOURS le payload complet (cache ou calcul) — jamais `result` brut :
 *  le cold-path oubliait `chips` (review 2026-09-25). */
function respond(payload: CachePayload, strat: string) {
  if (strat === "all") return NextResponse.json(payload);
  return NextResponse.json({
    ...payload,
    strategies: { [strat]: (payload.strategies as Record<string, unknown[]>)[strat] ?? [] },
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const strat = searchParams.get("strat") || "all";

    const entry = cache.getEntry();
    if (isFresh(entry, 5 * 60_000)) {
      return respond(entry!.data, strat);
    }

    const { computeHandballStrategyPayload } = await import("@/lib/handball-strategy-top8");

    // Charger les données Flashscore (source principale) + cotes 1xbet réelles
    // (applyPapiOdds aligne la route sur /api/handball/matches — sans elles,
    // valueBet calcule son EV contre la cote de repli 1.55 → EV synthétique).
    const rawMatches = loadFlashscoreHandball();
    const allMatches = applyPapiOdds(
      rawMatches.map((m, i) => toHandballMatch(m, i)),
      loadOddsPapiSnapshot()
    );

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
        const payload = computeHandballStrategyPayload(fFinished, fUpcoming);
        cache.set(payload);
        return respond(payload, strat);
      } catch {
        // API-Sports indisponible
      }
    }

    const payload = computeHandballStrategyPayload(finished, upcoming);
    cache.set(payload);
    return respond(payload, strat);
  } catch (err) {
    return apiErrorHandler(err, "handball/strategy-top8");
  }
}
