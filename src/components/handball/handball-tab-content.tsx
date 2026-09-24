"use client";

import { useState, useMemo, useEffect } from "react";
import { useHandballMatches } from "@/hooks/use-handball-matches";
import { HandballMatchCard } from "./handball-match-card";
import { HandballLiveCard } from "./handball-live-card";
import { HandballMatchDetailDialog } from "./handball-match-detail-dialog";
import { HandballFilters } from "./handball-filters";
import { HandballStrategyBar } from "./handball-strategy-bar";
import { HandballTop8Widget } from "./handball-top8-widget";
import { HandballBacktestWidget } from "./handball-backtest-widget";
import { HandballBanker } from "./handball-banker";
import { HandballCalendar } from "./handball-calendar";
import { HandballErrorBoundary } from "./handball-error-boundary";
import type { HandballStrategyKey } from "@/lib/handball-strategy-top8";
import type { HandballMatch } from "@/lib/handball-data";

export function HandballTabContent() {
  const { matches: allMatches, isLoading } = useHandballMatches();
  // Fix debug : useHandballLive retiré (fetch 15s jamais consommé)
  const [mode, setMode] = useState<"live" | "prematch">("prematch");
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<HandballStrategyKey>("bestTeam");
  // Fix wiring UX : dialog détail (composant créé en Phase 6, jamais monté)
  const [detailMatch, setDetailMatch] = useState<HandballMatch | null>(null);

  const isLive = (m: { status: string }) =>
    m.status === "live" || m.status === "halftime";

  const live = useMemo(() => allMatches.filter(isLive), [allMatches]);
  // Fix debug : "À venir" exclut les terminés (statut = not_started seulement)
  const prematch = useMemo(
    () => allMatches.filter((m) => m.status === "not_started"),
    [allMatches],
  );
  const displayed = mode === "live" ? live : prematch;
  // Mémoïsé : la référence doit être stable pour que React.memo du calendrier
  // (G6-9) soit effectif — un filtre recréé à chaque render neutraliserait le memo.
  const filtered = useMemo(
    () =>
      selectedLeague
        ? displayed.filter((m) => m.league.name === selectedLeague)
        : displayed,
    [displayed, selectedLeague],
  );
  // Matchs terminés du snapshot → forme récente + lambdas ajustés du dialog détail.
  const finished = useMemo(
    () => allMatches.filter((m) => m.status === "finished"),
    [allMatches],
  );

  // Auto-switch prematch si aucun live
  useEffect(() => {
    if (mode === "live" && live.length === 0) setMode("prematch");
  }, [mode, live.length]);

  return (
    <HandballErrorBoundary>
    <div className="space-y-6">
      {/* Header live/prematch */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("live")}
          className={
            mode === "live"
              ? "bg-red-500 text-white px-3 py-1.5 rounded"
              : "px-3 py-1.5 rounded border"
          }
        >
          🔴 Live ({live.length})
        </button>
        <button
          onClick={() => setMode("prematch")}
          className={
            mode === "prematch"
              ? "bg-foreground text-background px-3 py-1.5 rounded"
              : "px-3 py-1.5 rounded border"
          }
        >
          📅 À venir
        </button>
      </div>

      {/* Banker du jour */}
      <HandballBanker />

      {/* Stratégie selector + Top 8 */}
      <div className="space-y-3">
        <HandballStrategyBar active={strategy} onChange={setStrategy} />
        <HandballTop8Widget strategy={strategy} />
      </div>

      {/* Backtest ROI visuel (cotes simulées) */}
      <HandballBacktestWidget />

      {/* Filtres ligues */}
      <HandballFilters
        matches={displayed}
        selected={selectedLeague}
        onSelect={setSelectedLeague}
      />

      {/* Calendrier (prematch seulement) — lignes cliquables → popup analyse */}
      {mode === "prematch" && filtered.length > 0 && (
        <HandballCalendar matches={filtered} onSelect={setDetailMatch} />
      )}

      {/* Grille de matchs */}
      {isLoading ? (
        // État async annoncé aux lecteurs d'écran
        <div className="text-center py-8 text-muted-foreground" aria-live="polite">
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground" aria-live="polite">
          Aucun match handball
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((m) =>
            mode === "live" ? (
              <HandballLiveCard key={m.id} match={m} onClick={setDetailMatch} />
            ) : (
              <HandballMatchCard key={m.id} match={m} onClick={setDetailMatch} />
            ),
          )}
        </div>
      )}

      {/* Dialog détail (wiring manquant depuis la Phase 6) */}
      {detailMatch && (
        <HandballMatchDetailDialog
          match={detailMatch}
          finished={finished}
          open
          onOpenChange={(open) => {
            if (!open) setDetailMatch(null);
          }}
        />
      )}
    </div>
    </HandballErrorBoundary>
  );
}
