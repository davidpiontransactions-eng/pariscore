import { NextResponse } from "next/server";
import path from "path";

const CACHE_TTL = 30 * 60_000;
let cache: { data: unknown; at: number } | null = null;

function loadF1Service() {
  const cwd = process.cwd();
  const tryPaths = [
    path.join(cwd, "services", "f1Service"),
    path.join(cwd, "..", "services", "f1Service"),
    path.join(__dirname, "..", "..", "..", "..", "..", "..", "services", "f1Service"),
  ];
  for (const p of tryPaths) {
    try { return require(p); } catch {}
  }
  throw new Error("Cannot find f1Service — tried all known paths");
}

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const f1Service = loadF1Service();
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
