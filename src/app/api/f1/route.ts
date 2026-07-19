import { NextResponse } from "next/server";
import { createRequire } from "module";
import path from "path";

const CACHE_TTL = 30 * 60_000;
let cache: { data: unknown; at: number } | null = null;

const _require = createRequire(import.meta.url);

function resolveService(name: string): unknown {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "services", name),
    path.join(cwd, "..", "services", name),
  ];
  for (const p of candidates) {
    try { return _require(p); } catch {}
  }
  return _require(path.join(cwd, "services", name));
}

const f1Service: { getF1Drivers: () => Promise<unknown>; getF1Races: () => Promise<unknown> } | null = (() => {
  try { return resolveService("f1Service") as any; } catch { return null; }
})();

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  if (!f1Service) {
    return NextResponse.json({ error: "f1 module not loaded" }, { status: 503 });
  }

  try {
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
