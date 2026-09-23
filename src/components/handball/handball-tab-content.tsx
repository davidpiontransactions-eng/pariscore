"use client";

import { useState, useMemo, useEffect } from "react";
import { useHandballMatches } from "@/hooks/use-handball-matches";
import { HandballMatchCard } from "./handball-match-card";
import { HandballLiveCard } from "./handball-live-card";
import { HandballMatchDetailDialog } from "./handball-match-detail-dialog";
import { HandballFilters } from "./handball-filters";
import { HandballStrategyBar } from "./handball-strategy-bar";
import { HandballTop8Widget } from "./handball-top8-widget";
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
  const filtered = selectedLeague
    ? displayed.filter((m) => m.league.name === selectedLeague)
    : displayed;

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

      {/* Filtres ligues */}
      <HandballFilters
        matches={displayed}
        selected={selectedLeague}
        onSelect={setSelectedLeague}
      />

      {/* Calendrier (prematch seulement) */}
      {mode === "prematch" && filtered.length > 0 && (
        <HandballCalendar matches={filtered} />
      )}

      {/* Grille de matchs */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Aucun match handball
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((m) =>
            mode === "live" ? (
              <HandballLiveCard key={m.id} match={m} />
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
