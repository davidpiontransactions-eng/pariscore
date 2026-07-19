"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Trophy, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFootballMatches } from "@/hooks/use-football-matches";
import type { FootballMatch } from "@/lib/football-data";
import { FootballLeagueBar } from "./football-filters";
import { FootballMatchCard, FootballMatchCardSkeleton } from "./football-match-card";
import { FootballLiveCard } from "./football-live-card";

type FootFilter = "all" | "value" | "today";

export function FootballTabContent() {
  const t = useTranslations("common");
  const { data, error, isLoading, isValidating, mutate } = useFootballMatches();

  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [filter, setFilter] = useState<FootFilter>("all");

  const matches: FootballMatch[] = data?.matches ?? [];

  const liveMatches = useMemo(
    () => matches.filter((m) => m.live && (m.live.status === "LIVE" || m.live.status === "HT")),
    [matches],
  );

  const prematchMatches = useMemo(() => {
    let list = matches.filter((m) => !m.live || m.live.status === "FT" || m.live.status === "PEN");
    if (selectedLeague) list = list.filter((m) => m.league.id === selectedLeague);
    if (filter === "today") {
      const today = new Date().toDateString();
      list = list.filter((m) => new Date(m.scheduledAt).toDateString() === today);
    }
    if (filter === "value") {
      list = list.filter((m) => {
        const diff = Math.abs(m.prediction.homeProb - (m.odds ? 1 / m.odds.home * 100 : 50));
        return diff > 5;
      });
    }
    return list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [matches, selectedLeague, filter]);

  const FILTERS: { key: FootFilter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "today", label: "Aujourd'hui" },
    { key: "value", label: "Value Bets" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      {/* Live Section */}
      {liveMatches.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              EN DIRECT ({liveMatches.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liveMatches.map((m) => (
              <FootballLiveCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{t("errorTitle")}</p>
            <p className="mt-0.5 text-xs">{t("errorBody")}</p>
          </div>
        </div>
      )}

      {/* League filters */}
      {!isLoading && prematchMatches.length > 0 && (
        <div className="mb-4">
          <FootballLeagueBar
            matches={prematchMatches}
            selectedLeague={selectedLeague}
            onSelectLeague={setSelectedLeague}
          />
        </div>
      )}

      {/* Sub-filters */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === f.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => mutate()}
          disabled={isValidating}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", isValidating && "animate-spin")} />
          Actualiser
        </button>
      </div>

      {/* Match grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <FootballMatchCardSkeleton key={i} />
          ))}
        </div>
      ) : prematchMatches.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {prematchMatches.map((m, idx) => (
            <FootballMatchCard key={m.id} match={m} priority={idx < 2} />
          ))}
        </div>
      ) : (
        <div className="mt-16 flex flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Trophy className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Aucun match trouvé</p>
          <p className="text-xs text-muted-foreground">
            {filter === "today"
              ? "Aucun match programmé aujourd'hui pour cette ligue"
              : "Aucun match ne correspond aux filtres sélectionnés"}
          </p>
        </div>
      )}
    </div>
  );
}
