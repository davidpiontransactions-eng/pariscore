import { NextResponse } from "next/server";
import { createTtlCache } from "@/lib/cached-route";
import {
  loadMergedPrematch,
  type PrematchPayload,
} from "@/lib/hockey/prematch-data";

export const dynamic = "force-dynamic";

const cache = createTtlCache<PrematchPayload>("__hockeyPrematch");

export async function GET() {
  cache.invalidate();

  // Merge BetExplorer (prioritaire) + Annabet (complément)
  const data = loadMergedPrematch();

  if (!data) {
    return NextResponse.json(
      {
        error: "Prematch data not available. Run scrape-betexplorer-hockey.mjs + scrape-annabet-hockey-prematch.mjs first.",
        hint: "Data source: betexplorer + annabet (merge)",
      },
      { status: 503 }
    );
  }

  cache.set(data);
  return NextResponse.json(data);
}
