import { NextResponse } from "next/server";
import { loadRecentResults, type SnookerRecentResult } from "@/lib/snooker/snooker-history-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/snooker/results?days=7
 *
 * Résultats des N derniers jours depuis l'historique (126k matchs), pour le
 * sous-onglet « Résultats ».
 *
 * ⚠️ Ne lit PAS /api/v1/snooker/matches : les fixtures sont un snapshot
 * quotidien (une seule date, vérifié le 2026-10-02) et cette route écarte en
 * plus les matchs antérieurs à hier. Une fenêtre de 7 jours serait donc
 * structurellement vide — d'où cette lecture directe sur data/snooker_history.db.
 *
 * Le vainqueur vient de `winner_url` et non d'une comparaison de scores
 * (le vainqueur est en slot 1 dans 96,7 % des lignes).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const daysRaw = Number.parseInt(url.searchParams.get("days") ?? "7", 10);
    const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 90) : 7;

    const results = loadRecentResults(days);

    return NextResponse.json(
      {
        results,
        total: results.length,
        days,
        // La base ne couvre pas forcément toute la fenêtre : l'UI peut afficher
        // « sur les N derniers jours » quand `coverageDays` < `days`.
        earliestDate: results.length ? results[results.length - 1]?.scheduled_at ?? null : null,
        source: "snooker_history.db",
      },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (err) {
    // Le composant tombe sur son état vide plutôt que sur une page cassée.
    return NextResponse.json(
      { results: [] as SnookerRecentResult[], total: 0, error: (err as Error).message },
      { status: 200 },
    );
  }
}