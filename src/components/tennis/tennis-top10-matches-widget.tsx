"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
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
  extractTournaments,
  filterByTournament,
  filterByTimeWindow,
  TENNIS_TIME_WINDOWS,
  type TennisTimeWindow,
} from "@/lib/tennis-filters";
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
function toTableRows(
  entries: TennisStrategyEntry[],
  strat: TennisStrategyKey,
  overMap: Map<string, number>,
): StrategyTableRow[] {
  const def = TENNIS_STRATEGY_DEFS.find((d) => d.key === strat);
  return entries.map((e) => {
    // Over 21,5 ≥ 60 % (moteur Markov) — meilleur bet total du match.
    const over = overMap.get(e.matchId);
    const overPick =
      over != null && over >= 60 ? `Over 21,5 ${Math.round(over)} %` : null;
    // Meilleur serveur / receveur (hold % / retour %).
    const holdA = e.serveA ?? -1;
    const holdB = e.serveB ?? -1;
    const retA = e.retA ?? -1;
    const retB = e.retB ?? -1;
    const serveEdge =
      holdA < 0 && holdB < 0
        ? null
        : `S ${holdA >= holdB ? e.playerA.shortName : e.playerB.shortName} ${Math.round(Math.max(holdA, holdB))} %`;
    const returnEdge =
      retA < 0 && retB < 0
        ? null
        : `R ${retA >= retB ? e.playerA.shortName : e.playerB.shortName} ${Math.round(Math.max(retA, retB))} %`;
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
      overPick,
      serveEdge: [serveEdge, returnEdge].filter(Boolean).join(" · ") || null,
    };
  });
}


/** Lit strat/win/tournament depuis l'URL pour le deep-link partageable. */
function readInitialParams(): {
  strat: TennisStrategyKey;
  win: WinKey;
  tournament: string | null;
  timeWin: TennisTimeWindow;
} {
  const fallback = {
    strat: "surfaceEloGap" as TennisStrategyKey,
    win: "all" as WinKey,
    tournament: null as string | null,
    timeWin: "all" as TennisTimeWindow,
  };
  if (typeof window === "undefined") return fallback;
  const sp = new URLSearchParams(window.location.search);
  const s = sp.get("strat");
  const w = sp.get("win");
  const t = sp.get("tournament");
  const tw = sp.get("timeWin");
  return {
    strat: TENNIS_STRATEGY_DEFS.some((d) => d.key === s) ? (s as TennisStrategyKey) : fallback.strat,
    win: w === "today" || w === "tomorrow" ? w : "all",
    tournament: t || null,
    timeWin: (["all", "jour", "48h", "semaine"] as string[]).includes(tw ?? "") ? (tw as TennisTimeWindow) : fallback.timeWin,
  };
}

/** Focus externe (clic pill calendrier) : bascule la stratégie + surligne le match. */
export type TopFocus = { matchId: string; strat: TennisStrategyKey; nonce: number };

type Props = {
  /** Remonte les matchs qualifiés + la stratégie active (pills calendrier). */
  onEntries?: (entries: TennisStrategyEntry[], strat: TennisStrategyKey) => void;
  focused?: TopFocus | null;
};

export function TennisTop10MatchesWidget({ onEntries, focused }: Props = {}) {
  const initial = useMemo(() => readInitialParams(), []);
  const [strat, setStrat] = useState<TennisStrategyKey>(initial.strat);
  const [win, setWin] = useState<WinKey>(initial.win);
  const [tournament, setTournament] = useState<string | null>(initial.tournament);
  const [timeWin, setTimeWin] = useState<TennisTimeWindow>(initial.timeWin);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [data, setData] = useState<TennisStrategyTop10Result | null>(null);
  const [overMap, setOverMap] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Focus externe : applique strat + highlight (dernier nonce gagne).
  useEffect(() => {
    if (!focused) return;
    setStrat(focused.strat);
    setHighlightId(focused.matchId);
  }, [focused]);

  useEffect(() => {
    const ac = new AbortController();
    setIsLoading(true);
    setError(null);
    const qs = new URLSearchParams({ strat, win });
    const qsOver = new URLSearchParams({ strat: "over215", win });
    Promise.all([
      fetch(`/api/tennis/strategy-top10?${qs.toString()}`, { signal: ac.signal }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<TennisStrategyTop10Result>;
      }),
      // Over 21,5 (Markov, seuil 60 %) pour le badge Over par match.
      fetch(`/api/tennis/strategy-top10?${qsOver.toString()}`, { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([d, over]) => {
        setData(d);
        const map = new Map<string, number>();
        const list: TennisStrategyEntry[] | undefined = over?.strategies?.over215;
        if (Array.isArray(list)) {
          for (const e of list) {
            if (typeof e.value === "number" && e.value >= 60) map.set(e.matchId, e.value);
          }
        }
        setOverMap(map);
        onEntries?.(d.strategies[strat] ?? [], strat);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError(err as Error);
      })
      .finally(() => setIsLoading(false));
    return () => ac.abort();
  }, [strat, win, onEntries]);

  // Deep-link : reflète strat/win/tournament/timeWin dans l'URL (partageable).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    sp.set("strat", strat);
    sp.set("win", win);
    if (tournament) sp.set("tournament", tournament); else sp.delete("tournament");
    if (timeWin !== "all") sp.set("timeWin", timeWin); else sp.delete("timeWin");
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [strat, win, tournament, timeWin]);

  const activeDef = useMemo(
    () => TENNIS_STRATEGY_DEFS.find((d) => d.key === strat)!,
    [strat],
  );

  // Liste des tournois issue des données API.
  const tournaments = useMemo(() => {
    if (!data?.matches) return [];
    return extractTournaments(data.matches);
  }, [data]);

  // Rows bruts depuis l'API (tous les matchs qualifiés pour la stratégie).
  const rawRows = useMemo(() => {
    if (!data?.strategies) return [];
    const entries = data.strategies[strat] ?? [];
    return toTableRows(entries, strat, overMap);
  }, [data, strat, overMap]);

  // Filtres appliqués côté client : tournoi + fenêtre temporelle.
  const rows = useMemo(() => {
    // D'abord filtrer par tournoi (sur les matchs API pour extraire les scheduledAt).
    let filtered = rawRows;
    if (tournament && data?.matches) {
      const matchScheduled = new Map<string, string>();
      for (const m of data.matches) {
        matchScheduled.set(m.matchId, m.scheduledAt);
      }
      const matchTournament = new Map<string, string>();
      for (const m of data.matches) {
        matchTournament.set(m.matchId, m.tournament);
      }
      filtered = rawRows.filter((r) => {
        const t = matchTournament.get(r.matchId);
        return !t || t === tournament;
      });
    }
    // Ensuite filtrer par fenêtre temporelle.
    if (timeWin !== "all") {
      const matchScheduled = new Map<string, string>();
      if (data?.matches) {
        for (const m of data.matches) {
          matchScheduled.set(m.matchId, m.scheduledAt);
        }
      }
      filtered = filterByTimeWindow(
        filtered.map((r) => ({ ...r, scheduledAt: matchScheduled.get(r.matchId) ?? r.kickoff })),
        timeWin,
      );
    }
    return filtered;
  }, [rawRows, tournament, timeWin, data]);

  const handleTournamentChange = useCallback((v: string) => setTournament(v === "__all__" ? null : v), []);
  const handleStratChange = useCallback((v: string) => {
    setStrat(v as TennisStrategyKey);
    setHighlightId(null);
  }, []);
  const handleTimeWinChange = useCallback((w: TennisTimeWindow) => () => setTimeWin(w), []);

  return (
    <section
      className="rounded-2xl"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}
      aria-label="Top 10 matchs tennis par stratégie"
    >
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-[15px] font-semibold" style={{ color: C.headerText }}>
          Top 10 matchs par stratégie
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* Sélecteur de tournoi */}
          <Select
            value={tournament ?? "__all__"}
            onValueChange={handleTournamentChange}
          >
            <SelectTrigger
              className="h-9 w-[180px] text-xs"
              aria-label="Tournoi du Top 10"
            >
              <SelectValue placeholder="Tous les tournois" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="text-xs">
                Tous les tournois
              </SelectItem>
              {tournaments.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sélecteur de stratégie */}
          <Select
            value={strat}
            onValueChange={handleStratChange}
          >
            <SelectTrigger className="h-9 w-[200px] text-xs">
              <SelectValue placeholder="Stratégie" />
            </SelectTrigger>
            <SelectContent>
              {TENNIS_STRATEGY_DEFS.map((d) => (
                <SelectItem key={d.key} value={d.key} className="text-xs">
                  <span aria-hidden>{d.emoji}</span> {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Fenêtre temporelle (Jour / 48h / Sem / Tout) */}
          <div
            className="flex overflow-hidden rounded"
            style={{ border: `1px solid ${C.cardBorder}` }}
            role="group"
            aria-label="Période des matchs"
          >
            {TENNIS_TIME_WINDOWS.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={handleTimeWinChange(w.key)}
                aria-pressed={timeWin === w.key}
                title={w.title}
                className={cn(
                  "min-h-[44px] px-3 font-mono text-[10px] font-bold uppercase transition-colors sm:min-h-0 sm:px-2 sm:py-0.5",
                  timeWin === w.key
                    ? "bg-[#00985f]/10 text-[#00985f]"
                    : "bg-transparent text-[#717171] hover:text-[#222]",
                )}
              >
                {w.label}
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
            Aucun match qualifié pour « {activeDef?.label} »{tournament ? ` en ${tournament}` : ""}.
          </p>
        ) : (
          <TopStrategiesTable
            rows={rows}
            strategy={strat as unknown as Parameters<typeof TopStrategiesTable>[0]["strategy"]}
            highlightId={highlightId}
          />
        )}
      </div>
    </section>
  );
}
