import { NextResponse } from "next/server";

const CACHE_TTL = 30 * 60_000;
let cache: { data: unknown; at: number } | null = null;

const getF1Drivers: () => Promise<{ season: string; round: number; race: string; drivers: unknown[]; bets: unknown[]; model: string; calibrated: boolean; note: string; sims: unknown }>
  = require("pariscore-services").getF1Drivers;
const getF1Races: () => Promise<{ next: string; races: unknown[] }>
  = require("pariscore-services").getF1Races;

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const [driversData, racesData] = await Promise.all([
      getF1Drivers(),
      getF1Races(),
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
