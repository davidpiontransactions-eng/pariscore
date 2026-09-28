// GET /api/tennis/backtest-matrix?window=full|d30
//
// Matrice de backtest tennis — 9 marchés (offre 1xbet) × 4 dimensions de
// filtre (surface, homme/femme, type de tournoi, bande de cote favori).
//
// Calcul LIVE sur `tennis_matches_internal` : ~0,1 s de lecture (double
// driver bun:sqlite) + ~0,4 s de calcul (16,4 k lignes × 9 marchés), au plus
// une fois toutes les 15 min (cache TTL ; les deux fenêtres sont calculées
// d'un coup → le toggle full↔d30 ne recalcule pas). La base absente est
// mise en cache négatif 60 s pour ne pas re-ouvrir/re-logger à chaque
// requête (probe 30 s). Contrairement au handball, pas de fichier pré-calculé
// : la sélection ne dépend d'aucune variable post-match (anti-lookahead).

import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";
import {
  computeTennisBacktestMatrix,
  loadTennisBtRows,
  type TennisBtResult,
  type TennisBtWindow,
} from "@/lib/tennis-backtest-matrix";

const TTL = 15 * 60_000;
/** Cache négatif : une base en panne ne doit pas être re-testée à chaque hit. */
const FAIL_TTL = 60_000;

type CacheEntry = { full: TennisBtResult; d30: TennisBtResult };

const cache = createTtlCache<CacheEntry>("__tennisBacktestMatrixCache");
let lastFailAt = 0;

function computeBoth(): CacheEntry | null {
  const rows = loadTennisBtRows();
  if (rows.length === 0) return null;
  return {
    full: computeTennisBacktestMatrix(rows, "full"),
    d30: computeTennisBacktestMatrix(rows, "d30"),
  };
}

function unavailable() {
  return NextResponse.json(
    {
      ok: false,
      error: "Base tennis indisponible (tennis_matches_internal vide ou illisible).",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const win: TennisBtWindow = searchParams.get("window") === "d30" ? "d30" : "full";

    const entry = cache.getEntry();
    let data = isFresh(entry, TTL) ? entry!.data : null;
    if (!data) {
      if (Date.now() - lastFailAt < FAIL_TTL) return unavailable();
      data = computeBoth();
      if (!data) {
        lastFailAt = Date.now();
        return unavailable();
      }
      cache.set(data);
    }

    return NextResponse.json(
      { window: win, matrix: data[win] },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=900" } },
    );
  } catch (err) {
    return apiErrorHandler(err, "tennis/backtest-matrix");
  }
}
