// GET /api/handball/backtest-matrix?window=full|d30&league=…&country=…
//
// Matrice de backtest 8 marchés × N championnats (source :
// handball_match_history). Le fichier JSON est produit par le cron hebdo
// scripts/backtest-handball-matrix.ts (walk-forward sur 7 mois ≈ 5-8 min
// → ICI PAS de calcul live : lecture seule + cache 15 min sur le FICHIER
// entier, les toggles full↔d30 ne relisent donc pas le disque).
//
// `league` (+ `country` pour départager les suffixes dupliqués) filtre une
// ligue pour le popup — accepte « Bundesliga » comme « Germany: Bundesliga ».

import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { resolveHandballDataFile } from "@/lib/handball-flashscore";
import {
  filterMatrixByLeague,
  type BacktestMatrixResult,
} from "@/lib/handball-backtest-matrix";

type MatrixFile = {
  generatedAt: string;
  full: BacktestMatrixResult;
  d30: BacktestMatrixResult;
};

const cache = createTtlCache<MatrixFile>("__handballBacktestMatrixCache");

function loadFile(): MatrixFile | null {
  try {
    const p = resolveHandballDataFile("handball_backtest_matrix.json");
    if (!p) return null;
    const d = JSON.parse(readFileSync(p, "utf-8")) as MatrixFile;
    // Validation minimale : un fichier corrompu ferait crasher le widget →
    // et via HandballErrorBoundary, tout l'onglet handball.
    if (!d || !Array.isArray(d.full?.markets) || !Array.isArray(d.d30?.markets)) return null;
    return d;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const window = searchParams.get("window") === "d30" ? "d30" : "full";
    const league = (searchParams.get("league") ?? "").slice(0, 160);
    const country = (searchParams.get("country") ?? "").slice(0, 80);

    const entry = cache.getEntry();
    const file = isFresh(entry, 15 * 60_000) ? entry!.data : loadFile();
    if (!file) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Matrice de backtest absente — lance scripts/backtest-handball-matrix.ts (cron lundi 04:40).",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!isFresh(entry, 15 * 60_000)) cache.set(file);

    const matrix = window === "d30" ? file.d30 : file.full;
    return NextResponse.json(
      {
        window,
        generatedAt: file.generatedAt,
        matrix,
        league: league ? filterMatrixByLeague(matrix, league, country) : null,
      },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=900" } }
    );
  } catch (err) {
    return apiErrorHandler(err, "handball/backtest-matrix");
  }
}
