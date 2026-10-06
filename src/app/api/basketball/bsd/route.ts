/**
 * API route — cache 1xBet BSD Basketball (pré-chargé par cron).
 * GET /api/basketball/bsd?league=6&eventId=7160&withOdds=1
 *
 * ⚠️ AUCUN PAS-THROUGH. Cette route ne contacte jamais BSD : elle ne lit que
 * `data/basketball_bsd_cache.json`, écrit par `scripts/fetch-basketball-bsd.ts`.
 * C'est ce qui garantit un popup sans latence réseau et un quota déterministe,
 * indépendant du nombre de clics.
 *
 * Contrat d'intégrité :
 *  - `prob_over_205/215/225` sont ABSENTS du payload (filtrés à l'écriture du
 *    cache, voir `sanitizeBasketballPrediction`) : seuils calibrés NBA, faux
 *    sur un match EuroCup à ~160 pts.
 *  - `logo.available: false` ⇒ `logo.url: null`. Jamais d'URL qui répond 204.
 *  - Cache absent ⇒ 503 + `predictionsAvailable: false`, jamais une liste vide.
 *  - `stale` exposé : le popup doit dire « données de HH:MM », pas faire croire
 *    à du temps réel.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  cacheAgeMinutes,
  isCacheStale,
  loadBsdCache,
} from "@/lib/basketball-bsd-cache";

type Entry = { data: unknown; at: number };
const g = globalThis as unknown as { __bbBsdCache?: Map<string, Entry> };
const cacheMap = (g.__bbBsdCache ??= new Map<string, Entry>());
// Le cache local est déjà frais à ~5 min près (cron) : on garde TTL court pour
// ne pas servir une image de fixture après une mise à jour du cron.
const CACHE_TTL = 60_000;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const league = sp.get("league");
  const eventId = sp.get("eventId");
  const withOdds = sp.get("withOdds") !== "0";

  const cacheKey = `${league ?? ""}|${eventId ?? ""}|${withOdds}`;
  const hit = cacheMap.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return NextResponse.json(hit.data);
  }

  const cache = loadBsdCache();
  if (!cache) {
    return NextResponse.json(
      {
        error: "cache BSD absent",
        details:
          "data/basketball_bsd_cache.json introuvable. Lancer " +
          "scripts/fetch-basketball-bsd.ts (cron) — la route ne contacte jamais BSD.",
        predictionsAvailable: false,
      },
      { status: 503 },
    );
  }

  let fixtures = cache.fixtures;
  if (league) {
    const wanted = Number(league);
    if (!Number.isFinite(wanted)) {
      return NextResponse.json(
        { error: "paramètre `league` invalide", details: league, predictionsAvailable: false },
        { status: 400 },
      );
    }
    fixtures = fixtures.filter((f) => f.leagueBsdId === wanted);
  }
  if (eventId) {
    const wanted = Number(eventId);
    if (!Number.isFinite(wanted)) {
      return NextResponse.json(
        { error: "paramètre `eventId` invalide", details: eventId, predictionsAvailable: false },
        { status: 400 },
      );
    }
    fixtures = fixtures.filter((f) => f.bsdEventId === wanted);
  }

  const stale = isCacheStale(cache.fetchedAt, cache.staleAfterMinutes);
  const payload = {
    source: "bsd-cache",
    /** Prochains rafraîchissements : jamais de `Date.now()` côté rendu. */
    fetchedAt: cache.fetchedAt,
    ageMinutes: cacheAgeMinutes(cache.fetchedAt),
    staleAfterMinutes: cache.staleAfterMinutes,
    stale,
    fixtures: fixtures.map((f) => (withOdds ? f : { ...f, odds: [], oddsSource: null })),
    counts: {
      served: fixtures.length,
      withPrediction: fixtures.filter((f) => f.prediction !== null).length,
      withPregame: fixtures.filter((f) => f.pregame !== null).length,
      withOdds: fixtures.filter((f) => f.odds.length > 0).length,
      withHomeLogo: fixtures.filter((f) => f.home.logo.available).length,
    },
    /** Le popup n'appelle jamais BSD : il affiche cette mention. */
    freshnessNote: stale
      ? `Cache ancienne (récupérée il y a ${cacheAgeMinutes(cache.fetchedAt)} min). Les cotes peuvent avoir bougé.`
      : null,
    predictionsAvailable: true,
    generatedAt: new Date().toISOString(),
  };

  cacheMap.set(cacheKey, { data: payload, at: Date.now() });
  return NextResponse.json(payload);
}
