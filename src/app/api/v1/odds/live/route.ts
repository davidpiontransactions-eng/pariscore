import { NextRequest, NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { resolveOnexOdds } from "@/lib/onexbet-service";

/**
 * POST /api/v1/odds/live
 *
 * Cotes live « vainqueur » (P1/P2) depuis 1xBet pour un batch de duels.
 * Contrat : { matches: [{ matchId, playerA, playerB }] } → { ok, source, odds }.
 *
 * Best-effort par design (cf. onexbet-service.ts) : la source 1xBet n'est pas
 * garantie (endpoints internes, anti-bot). `source` documente l'état :
 *   - "disabled" → flag ONEXBET_ENABLED off (le client retombe sur BSD) ;
 *   - "onex"     → cotes 1xBet résolues (peut être partiel) ;
 *   - "down"     → 1xBet injoignable/cassé (le client retombe sur BSD).
 * La route renvoie TOUJOURS 200 : l'absence de cote n'est pas une erreur.
 */

const CACHE_TTL_MS = 10_000;
const MAX_MATCHES = 50;

type RequestBody = {
  matches?: Array<{ matchId?: unknown; playerA?: unknown; playerB?: unknown }>;
};

type OddsValue = { oddA: number; oddB: number; updatedAt: number };
type OddsBatch = Record<string, OddsValue>;

const cache = createTtlCache<Record<string, OddsBatch>>("__onexBetOddsLive");

function keyOf(matches: RequestBody["matches"]): string {
  return (matches ?? [])
    .map((m) => `${String(m?.matchId)}|${String(m?.playerA)}|${String(m?.playerB)}`)
    .join(";");
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const matches = (body.matches ?? []).slice(0, MAX_MATCHES);
  if (
    matches.length === 0 ||
    matches.some(
      (m) =>
        !m?.matchId ||
        typeof m.matchId !== "string" ||
        !m.playerA ||
        typeof m.playerA !== "string" ||
        !m.playerB ||
        typeof m.playerB !== "string" ||
        m.playerA.length > 100 ||
        m.playerB.length > 100,
    )
  ) {
    return NextResponse.json(
      { ok: false, error: "matches: [{matchId, playerA, playerB}] requis" },
      { status: 400 },
    );
  }

  if (process.env.ONEXBET_ENABLED !== "true") {
    return NextResponse.json({ ok: true, source: "disabled", odds: {} });
  }

  const key = keyOf(matches);
  const cached = cache.getEntry();
  if (cached && isFresh(cached, CACHE_TTL_MS) && cached.data[key]) {
    return NextResponse.json({
      ok: true,
      source: "onex",
      cached: true,
      fetchedAt: new Date(cached.at).toISOString(),
      odds: cached.data[key],
    });
  }

  try {
    const wants = matches.map((m) => ({
      matchId: m.matchId as string,
      playerA: m.playerA as string,
      playerB: m.playerB as string,
    }));
    const odds = await resolveOnexOdds(wants);
    const prev = cache.get();
    cache.set({ ...prev, ...(odds ? { [key]: odds } : {}) });
    return NextResponse.json({
      ok: true,
      source: "onex",
      cached: false,
      fetchedAt: new Date().toISOString(),
      odds,
    });
  } catch {
    return NextResponse.json({ ok: false, source: "down", odds: {} });
  }
}
