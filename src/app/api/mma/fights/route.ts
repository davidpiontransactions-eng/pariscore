import { NextResponse } from "next/server";

const CACHE_TTL = 5 * 60_000;
let cache: { data: unknown; at: number } | null = null;

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const mmaService = require("../../../../../services/mmaService");
    const fights = await mmaService.getMMAFights(process.env.ODDS_API_KEY);

    const enriched = await Promise.all(
      (fights as Array<{ event_date: string; event_name: string; fights: Array<Record<string, unknown>> }>).map(async (ev) => {
        const enrichedFights = await Promise.all(
          ev.fights.map(async (f) => {
            const nameA = f.fighter_a as string;
            const nameB = f.fighter_b as string;
            const [photoA, photoB] = await Promise.all([
              mmaService.getFighterPhoto(nameA).catch(() => null),
              mmaService.getFighterPhoto(nameB).catch(() => null),
            ]);
            return { ...f, photo_a: photoA, photo_b: photoB };
          })
        );
        return { ...ev, fights: enrichedFights };
      })
    );

    cache = { data: enriched, at: now };
    return NextResponse.json({ fights: enriched, source: "odds-api+ml" });
  } catch (err) {
    return NextResponse.json(
      { error: "mma data unavailable", details: (err as Error).message },
      { status: 503 }
    );
  }
}
