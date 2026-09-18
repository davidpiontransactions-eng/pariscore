import { NextResponse, type NextRequest } from "next/server";
import { computeRugbyTopStrategies, type RugbyStrategyKey } from "@/lib/rugby-strategy-top";
import { COMPETITION_BY_SLUG } from "@/lib/rugby/competitions";
import { getPredictionsPayload } from "@/lib/rugby/provider";
import type { PredictedMatch } from "@/lib/rugby/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_STRATEGIES = new Set<RugbyStrategyKey>([
  "homeWin",
  "awayWin",
  "over415",
  "under515",
  "handicapHome",
  "handicapAway",
  "bttsYes",
  "marginBand",
  "bestAttack",
  "bestDefense",
]);

/** Cache en mémoire (TTL 10 min). */
let cache: { at: number; data: unknown } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const strategy = (searchParams.get("strategy") ?? "homeWin") as RugbyStrategyKey;
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 10), 1), 20);

  if (!VALID_STRATEGIES.has(strategy)) {
    return NextResponse.json(
      { error: `Stratégie invalide. Valides : ${[...VALID_STRATEGIES].join(", ")}` },
      { status: 400 },
    );
  }

  // Cache hit
  if (cache && Date.now() - cache.at < CACHE_TTL) {
    const data = cache.data as Record<string, unknown>;
    return NextResponse.json({ matches: (data[strategy] as unknown[]) ?? [], strategy, limit });
  }

  try {
    // Récupère les prédictions de toutes les compétitions
    const slugs = [...COMPETITION_BY_SLUG.keys()];
    const allMatches = await Promise.allSettled(
      slugs.map(async (slug) => {
        const payload = await getPredictionsPayload(slug);
        if (!payload) return [];
        return (payload.matches ?? []) as { match: unknown; prediction: unknown }[];
      }),
    );

    const flatMatches = allMatches
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => (r as PromiseFulfilledResult<PredictedMatch[]>).value);

    // Calcule toutes les stratégies en une passe
    const allStrategies: Record<string, unknown> = {};
    for (const key of VALID_STRATEGIES) {
      allStrategies[key] = computeRugbyTopStrategies(flatMatches, key, limit);
    }

    cache = { at: Date.now(), data: allStrategies };

    return NextResponse.json({ matches: allStrategies[strategy] ?? [], strategy, limit });
  } catch (err) {
    console.error("[rugby/top-strategies]", err);
    return NextResponse.json({ matches: [], strategy, limit, error: "Erreur serveur" }, { status: 500 });
  }
}
