/**
 * API route — flux 1xBet Basketball (Vitibet + BSD).
 * GET /api/basketball/vitibet?leagues=nba,wnba,euroleague&predictionsOnly=1
 *
 * ⚠️ Périmètre volontairement RESTREINT aux ligues CALIBRÉES. Une ligue sans
 * base mesurée n'a pas de marchés calculables : la servir ici exposerait des
 * pace/total hérités d'une autre ligue, exactement le bug du backtest NBA.
 * Le refus est visible dans `skippedLeagues`, pas silencieux.
 *
 * Contrat d'intégrité : `predictionsAvailable` est porté PAR MATCH. Un match
 * sans proba publiée rend `predictionsUnavailableReason` non vide et tous les
 * champs financiers (`index`, `probHome`, `probAway`, `tip`, `predictedScore`)
 * à `null`. L'UI masque alors EV / Kelly / Value sur ce match.
 *
 * Dump absent ou illisible → 503 + `predictionsAvailable: false`, PAS une
 * liste vide : « pas de donnée » et « zéro donnée » sont deux faits différents.
 */

import { NextRequest, NextResponse } from "next/server";

import { calibratedBasketballLeagues } from "@/lib/basketball-vitibet-league";
import { loadVitibetSnapshot } from "@/lib/basketball-vitibet-data";
import type { BasketballLeagueId } from "@/lib/basketball-data";

type Entry = { data: unknown; at: number };
const g = globalThis as unknown as { __bbVitibetCache?: Map<string, Entry> };
const cacheMap = (g.__bbVitibetCache ??= new Map<string, Entry>());
const CACHE_TTL = 5 * 60_000;

/**
 * Ligues demandées, filtrées sur celles qui ont une base mesurée.
 *
 * Pas de `null` : le pire cas est un tableau VIDE, traité en 400 plus bas avec
 * la liste des ligues disponibles. Un type `| null` aurait laissé chaque appelant
 * à vérifier une branche qui n'existe pas.
 */
function parseLeagues(raw: string | null): BasketballLeagueId[] {
  if (!raw) return calibratedBasketballLeagues();
  const asked = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const valid = new Set<string>(calibratedBasketballLeagues());
  // Filtre strict : une ligue demandée mais non calibrée est IGNORÉE, pas
  // servie. Le client ne peut pas contourner la règle en forcant l'URL.
  // Le `filter` sur `string[]` est le point de narrowing : l'appartenance au
  // Set<string> ne suffit pas au compilateur pour resserrer en BasketballLeagueId,
  // d'où le cast explicite. Une garde de type ne remplace pas la valeur runtime.
  return asked.filter((l): l is BasketballLeagueId => valid.has(l));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const leagues = parseLeagues(sp.get("leagues"));
  const predictionsOnly = sp.get("predictionsOnly") === "1";

  const cacheKey = `${leagues.join(",")}|${predictionsOnly}`;
  const hit = cacheMap.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return NextResponse.json(hit.data);
  }

  if (leagues.length === 0) {
    return NextResponse.json(
      {
        error: "aucune ligue calibrée demandée",
        details:
          "Ligues avec base mesurée : nba, wnba, euroleague, eurocup. " +
          "Les autres n'ont aucune base de calibration — les demander ne les rend pas disponibles.",
        predictionsAvailable: false,
        availableLeagues: calibratedBasketballLeagues(),
      },
      { status: 400 },
    );
  }

  try {
    const snapshot = loadVitibetSnapshot(leagues);
    if (!snapshot) {
      return NextResponse.json(
        {
          error: "dump 1xBet indisponible",
          details:
            "data/basketball_vitibet_bsd.json absent ou illisible. " +
            "Lancer scripts/pipeline-basketball-vitibet-bsd.ts.",
          predictionsAvailable: false,
          leagues,
        },
        { status: 503 },
      );
    }

    const rows = predictionsOnly
      ? snapshot.matches.filter((m) => m.predictionsAvailable)
      : snapshot.matches;

    const payload = {
      source: "vitibet+bsd",
      scrapedAt: snapshot.scrapedAt,
      leagues,
      /** Ligues calibrées en échec de calibration — visible, pas silencieux. */
      leaguesWithoutBase: [
        ...new Set(
          snapshot.skippedLeagues
            .filter((s) => s.reason.startsWith("ligue "))
            .map((s) => s.reason.replace("ligue ", "").split(" ")[0]),
        ),
      ],
      matches: rows,
      counts: {
        sourceLeagues: snapshot.sourceLeagues,
        matchesInSource: snapshot.matchesInSource,
        served: rows.length,
        withPredictions: rows.filter((m) => m.predictionsAvailable).length,
        /** Matchs rendus SANS signal financier, avec motif par match. */
        withoutPredictions: rows.filter((m) => !m.predictionsAvailable).length,
      },
      /** Ligues écartées et pourquoi — l'audit du refus est exposé. */
      skippedLeagues: snapshot.skippedLeagues,
      predictionsAvailable: true,
      generatedAt: new Date().toISOString(),
    };

    cacheMap.set(cacheKey, { data: payload, at: Date.now() });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      {
        error: "flux 1xBet indisponible",
        details: (err as Error).message,
        predictionsAvailable: false,
      },
      { status: 503 },
    );
  }
}
