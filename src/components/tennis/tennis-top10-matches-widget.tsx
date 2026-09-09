"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TENNIS_STRATEGY_DEFS,
  type TennisStrategyKey,
  type TennisStrategyEntry,
  type TennisStrategyTop10Result,
} from "@/lib/tennis-strategy-top10";
import {
  TopStrategiesTable,
  type StrategyTableRow,
} from "@/components/football/top-strategies-table";

/* Teintes FotMob clair — identiques au calendrier */
const C = {
  card: "#ffffff",
  cardBorder: "#f0f0f0",
  headerText: "#000000",
  time: "#717171",
  accent: "#00985f",
} as const;

type WinKey = "all" | "today" | "tomorrow";

/** Convertit les entrées tennis en lignes StrategyTableRow. */
function toTableRows(entries: TennisStrategyEntry[]): StrategyTableRow[] {
  return entries.map((e) => {
    const def = TENNIS_STRATEGY_DEFS.find((d) => d.key === d.key);
    return {
      matchId: e.matchId,
      league: e.tournament,
      leagueLogo: null,
      kickoff: e.scheduledAt,
      home: { teamName: e.playerA.name, logo: undefined },
      away: { teamName: e.playerB.name, logo: undefined },
      value: e.value,
      display: def?.format(e.value) ?? `${e.value}`,
      probPct: e.probPick,
      odds: null,
      oddsLabel: e.pick === "A" ? "1" : e.pick === "B" ? "2" : null,
      sourceLabel: null,
      trend: "flat" as const,
      muted: false,
    };
  });
}


export function TennisTop10MatchesWidget() {
  const [strat, setStrat] = useState<TennisStrategyKey>("surfaceEloGap");
  const [win, setWin] = useState<WinKey>("all");
  const [data, setData] = useState<TennisStrategyTop10Result | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setIsLoading(true);
    setError(null);
    const qs = new URLSearchParams({ strat, win });
    fetch(`/api/tennis/strategy-top10?${qs.toString()}`, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<TennisStrategyTop10Result>;
      })
      .then((d) => setData(d))
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError(err as Error);
      })
      .finally(() => setIsLoading(false));
    return () => ac.abort();
  }, [strat, win]);

  const activeDef = useMemo(
    () => TENNIS_STRATEGY_DEFS.find((d) => d.key === strat)!,
    [strat],
  );

  const rows = useMemo(() => {
    if (!data?.strategies) return [];
    const entries = data.strategies[strat] ?? [];
    return toTableRows(entries);
  }, [data, strat]);

  return (
    <section
      className="rounded-2xl"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}
      aria-label="Top 10 matchs tennis par stratégie"
    >
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[15px] font-semibold" style={{ color: C.headerText }}>
          Top 10 matchs par stratégie
        </h2>
        <div className="flex items-center gap-2">
          <Select value={strat} onValueChange={(v) => setStrat(v as TennisStrategyKey)}>
            <SelectTrigger className="h-9 w-[200px] text-xs">
              <SelectValue placeholder="Stratégie" />
            </SelectTrigger>
            <SelectContent>
              {TENNIS_STRATEGY_DEFS.map((d) => (
                <SelectItem key={d.key} value={d.key} className="text-xs">
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div
            className="flex overflow-hidden rounded"
            style={{ border: `1px solid ${C.cardBorder}` }}
            role="group"
            aria-label="Fenêtre"
          >
            {(["all", "today", "tomorrow"] as WinKey[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWin(w)}
                aria-pressed={win === w}
                className="min-h-[44px] px-3 font-mono text-[10px] font-bold uppercase transition-colors sm:min-h-0 sm:px-2 sm:py-0.5"
                style={{
                  background: win === w ? `${C.accent}10` : "transparent",
                  color: win === w ? C.accent : C.time,
                }}
              >
                {w === "all" ? "Tout" : w === "today" ? "Auj." : "Demain"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t px-4 py-3" style={{ borderColor: C.cardBorder }}>
        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 py-3 text-xs"
            style={{ color: C.accent }}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Calcul du Top 10…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 py-3 text-xs text-[#EF4444]">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            Top 10 indisponible ({(error as Error).message})
          </div>
        ) : rows.length === 0 ? (
          <p className="py-3 text-xs" style={{ color: C.time }}>
            Aucun match qualifié pour « {activeDef?.label} » ({win === "all" ? "toutes dates" : win === "today" ? "aujourd'hui" : "demain"}).
          </p>
        ) : (
          <TopStrategiesTable
            rows={rows}
            strategy={strat as unknown as Parameters<typeof TopStrategiesTable>[0]["strategy"]}
          />
        )}
      </div>
    </section>
  );
}
