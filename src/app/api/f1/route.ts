import { NextResponse } from "next/server";
import { createRequire } from "module";

const CACHE_TTL = 30 * 60_000;
let cache: { data: unknown; at: number } | null = null;

const _require = createRequire(import.meta.url);

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const f1Service = _require("../../../../../services/f1Service");
    const [driversData, racesData] = await Promise.all([
      f1Service.getF1Drivers(),
      f1Service.getF1Races(),
    ]);

    const payload = {
      ok: true,
      season: driversData.season,
      round: driversData.round,
      race: racesData.next || driversData.race,
      races: racesData.races || [],
      drivers: driversData.drivers || [],
      bets: driversData.bets || [],
      model: driversData.model,
      calibrated: driversData.calibrated,
      note: driversData.note,
      sims: driversData.sims,
      updatedAt: new Date().toISOString(),
    };

    cache = { data: payload, at: now };
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: "f1 data unavailable", details: (err as Error).message },
      { status: 503 }
    );
  }
}
