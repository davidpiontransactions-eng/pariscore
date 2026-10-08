/**
 * API route — opportunités basket (EV > 0, ligues calibrées).
 * GET /api/basketball/opportunities[?top=10][&league=Euroleague]
 *
 * ⚠️ Lecture SQLite **côté serveur uniquement** : `bun:sqlite` n'existe pas
 * dans le navigateur. C'est le motif de cette route — le composant client ne
 * peut pas appeler `basketballOpportunities()` directement.
 *
 * Contrat d'intégrité repris de la fonction :
 *  - EV strictement > 0 (règle P4) : un EV = 0 n'est pas une opportunité ;
 *  - **ligue calibrée obligatoire** : `basketCalibration()` est le garde — sans
 *    σ mesuré de la ligue, aucun jugement n'est possible ;
 *  - `strongDisagreement` porté par le serveur (écart modèle/cote > 12 pp),
 *    le client ne recalcule pas le seuil — une règle métier dupliquée dérive ;
 *  - table absente → 503 + `predictionsAvailable: false`, jamais `[]` nu.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  basketballOpportunities,
  loadBasketballFixtures,
  STRONG_DISAGREEMENT_PP,
} from "@/lib/basketball-fixtures-db";
import { basketCalibration } from "@/lib/basketball-calibration";

type Entry = { data: unknown; at: number };
const g = globalThis as unknown as { __bbOppCache?: Map<string, Entry> };
const cacheMap = (g.__bbOppCache ??= new Map<string, Entry>());
// SQLite local : TTL court, assez pour suivre le cron sans re-lire à chaque
// rendu de composant.
const CACHE_TTL = 60_000;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const top = Number(sp.get("top") ?? 10);
  const league = sp.get("league");

  const safeTop = Number.isFinite(top) && top > 0 ? Math.min(Math.floor(top), 50) : 10;
  const key = `${safeTop}|${league ?? ""}`;

  const hit = cacheMap.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return NextResponse.json(hit.data);

  try {
    const fixtures = loadBasketballFixtures({ limit: 500 });
    if (!fixtures.length) {
      // Table absente ou vide ≠ « aucune opportunité ». L'UI doit afficher
      // « données indisponibles », pas un Top 10 vide qui se lirait comme
      // « le marché est propre aujourd'hui ».
      return NextResponse.json(
        {
          error: "base basket indisponible",
          details:
            "Table basketball_fixtures vide ou absente. Lancer " +
            "scripts/ingest-basketball-fixtures.ts (et le cron avant).",
          predictionsAvailable: false,
          opportunities: [],
        },
        { status: 503 },
      );
    }

    let opps = basketballOpportunities();
    if (league) opps = opps.filter((o) => o.league === league);
    const top10 = opps.slice(0, safeTop);

    const payload = {
      source: "basketball_fixtures",
      /** Règle appliquée, écrite dans le payload : le client n'a pas à la deviner. */
      rule: {
        minEvExclusive: 0,
        strongDisagreementPp: STRONG_DISAGREEMENT_PP,
        requiresCalibratedLeague: true,
      },
      opportunities: top10,
      counts: {
        opportunities: top10.length,
        totalOppo: opps.length,
        strongDisagreement: top10.filter((o) => o.strongDisagreement).length,
        /** Détail : combien de fixtures ont une prédiction exploitable. */
        fixtures: fixtures.length,
        modeled: fixtures.filter((f) => f.probHome != null).length,
      },
      /** Ligues calibrées servies — pour que le filtre client soit honnête. */
      calibratedLeagues: ["NBA", "WNBA", "EuroLeague", "EuroCup"].filter((l) =>
        Boolean(basketCalibration(l)),
      ),
      predictionsAvailable: true,
      generatedAt: new Date().toISOString(),
    };

    cacheMap.set(key, { data: payload, at: Date.now() });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      {
        error: "opportunités indisponibles",
        details: (err as Error).message,
        predictionsAvailable: false,
        opportunities: [],
      },
      { status: 503 },
    );
  }
}