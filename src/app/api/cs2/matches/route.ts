import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import {
  warmMatchesLogos,
  resolveLogoForPayload,
  flushLogoQueue,
} from "@/lib/cs2/cs2-team-logo-engine";

const CACHE_TTL = 5 * 60_000;
const CACHE_TTL_LIVE = 30_000; // match en cours → rafraîchi vite (score/maps)
// createTtlCache already wraps in { data, at }, so we store only the payload.
const cache = createTtlCache<unknown>("__cs2Cache");

export async function GET() {
  const now = Date.now();
  const cached = cache.getEntry();
  // TTL dynamique : si le payload en cache contient un match live, on le
  // considère périmé au bout de 30 s (le service BSD a lui-même un TTL 30 s).
  const cachedMatches = (cached?.data as { matches?: { is_live?: boolean }[] } | undefined)?.matches;
  const hasLive = (cachedMatches ?? []).some((m) => m.is_live);
  const ttl = hasLive ? CACHE_TTL_LIVE : CACHE_TTL;
  if (cached && isFresh(cached, ttl)) {
    return NextResponse.json(cached.data);
  }

  try {
    const cs2Service = require("../../../../../services/cs2Service");
    const key = process.env.BSD_API_KEY;
    if (!key) throw new Error("BSD_API_KEY not configured");

    const matches = await cs2Service.getCs2Matches(key);

    // Moteur logos : hits cache → URL locale immédiate ; misses → file de fond.
    const teamSpecs: { name: string; remoteUrl?: string | null }[] = [];
    for (const m of matches as { team1?: unknown; team2?: unknown }[]) {
      const t1 = m.team1 as { name?: string; logo?: string | null } | undefined;
      const t2 = m.team2 as { name?: string; logo?: string | null } | undefined;
      if (t1?.name) teamSpecs.push({ name: t1.name, remoteUrl: t1.logo });
      if (t2?.name) teamSpecs.push({ name: t2.name, remoteUrl: t2.logo });
    }
    warmMatchesLogos(teamSpecs);

    for (const m of matches as {
      team1?: { name?: string; logo?: string | null; logo_local?: string | null };
      team2?: { name?: string; logo?: string | null; logo_local?: string | null };
    }[]) {
      if (m.team1?.name) {
        m.team1.logo_local = resolveLogoForPayload(m.team1.name, m.team1.logo);
        if (m.team1.logo_local) m.team1.logo = m.team1.logo_local;
      }
      if (m.team2?.name) {
        m.team2.logo_local = resolveLogoForPayload(m.team2.name, m.team2.logo);
        if (m.team2.logo_local) m.team2.logo = m.team2.logo_local;
      }
    }
    // Les misses lancés en tâche de fond s'écrivent peu après la réponse — la
    // série de polling suivante (/api/cs2/matches toutes les 2 min) les servira.
    void flushLogoQueue();

    const payload = { matches, source: "bsd", cache: cs2Service._getCacheStatus?.() ?? "unknown" };
    cache.set(payload);
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: "cs2 data unavailable", details: (err as Error).message },
      { status: 503 }
    );
  }
}
