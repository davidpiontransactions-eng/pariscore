"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";
import type { StrategyTop5Key, StrategyMatchEntry } from "@/lib/football-strategy-top5";
import type { FootballMatch } from "@/lib/football-data";
import { useFootballTopN } from "@/hooks/use-football-top5";
import { isInKickoffWindow, type KickoffWindow } from "@/lib/football-time";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTop5SelectionStore } from "@/stores/use-top5-selection-store";
import { STRATEGIES, MatchRow, type WindowKey } from "./football-strategy-top5-widget";

const TOP_N = 10;
/** Seuil minimal de probabilité du modèle pour l'inclusion forcée d'un match sélectionné. */
const MIN_PROB_PCT = 60;

const TIME_WINDOWS: { key: KickoffWindow; label: string }[] = [
  { key: "jour", label: "Jour" },
  { key: "48h", label: "48h" },
  { key: "semaine", label: "Sem." },
];

/**
 * Widget central « Top 10 matchs par stratégie » — global (Toutes les ligues)
 * ou par championnat via le sélecteur. Remplace le Top5 sidebar.
 *
 * Règle ≥60 % : un match présent dans la sélection du store dont la stratégie
 * probabiliste vaut ≥ 60 % est forcé en tête du top10 si le championnat
 * (ou le pool global) compte moins de 10 matchs qualifiés.
 */
export function FootballTop10Widget({ matches }: { matches: FootballMatch[] }) {
  // Toutes les ligues = null (top10 global) ; sinon nom de ligue exact.
  const [league, setLeague] = useState<string | null>(null);
  const [active, setActive] = useState<StrategyTop5Key>("bestTeam");
  const [winKey, setWinKey] = useState<WindowKey>("l5");
  const [timeWin, setTimeWin] = useState<KickoffWindow>("semaine");

  const { matchesFor, isLoading, error } = useFootballTopN(TOP_N, league);
  const selectedItems = useTop5SelectionStore((s) => s.items);
  const toggleStore = useTop5SelectionStore((s) => s.toggle);

  const def = STRATEGIES.find((s) => s.key === active) ?? STRATEGIES[0];

  // Championnats disponibles (dérivés des matchs pre-match affichés, triés).
  const leagues = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) {
      if (m.league?.name) set.add(m.league.name);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [matches]);

  const rawRows = matchesFor(active);
  const rows = useMemo(
    () => rawRows.filter((e) => isInKickoffWindow(e.kickoff, timeWin)),
    [rawRows, timeWin],
  );

  // ── Règle ≥60 % : inclusion forcée des matchs sélectionnés ──
  const forced = useMemo(() => {
    if (rows.length >= TOP_N) return [];
    const inRows = new Set(rows.map((r) => r.matchId));
    const out: StrategyMatchEntry[] = [];
    for (const item of Object.values(selectedItems)) {
      const defSel = STRATEGIES.find((s) => s.key === item.strategy);
      if (!defSel?.isProb) continue; // seulement les stratégies probabilistes
      if (item.entry.value < MIN_PROB_PCT) continue; // seuil ≥60 %
      if (inRows.has(item.entry.matchId)) continue; // déjà classé naturellement
      // Vue par championnat : le match doit appartenir à la ligue affichée.
      if (league && item.entry.league !== league) continue;
      out.push(item.entry);
    }
    return out;
  }, [rows, selectedItems, league]);

  const selectedCount = Object.keys(selectedItems).length;

  const toggleSelect = (entry: StrategyMatchEntry) => {
    toggleStore(entry, active);
  };

  return (
    <section
      aria-label="Top 10 matchs par stratégie"
      className="mb-4 rounded-lg border border-slate-800/80 bg-slate-900/40 p-3"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Top 10 matchs
          {selectedCount > 0 && (
            <span
              className="ml-1.5 inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-px align-middle font-mono text-[9px] font-bold text-emerald-300"
              title="Matchs sélectionnés (panneau de droite)"
            >
              {selectedCount}
            </span>
          )}
        </h2>

        {/* Sélecteur de championnat — global « Toutes les ligues » ou une ligue */}
        <Select
          value={league ?? "__all__"}
          onValueChange={(v) => setLeague(v === "__all__" ? null : v)}
        >
          <SelectTrigger
            size="sm"
            aria-label="Championnat du Top 10"
            className="h-7 w-52 rounded-lg border-slate-700/80 bg-slate-900/90 text-xs font-medium text-slate-200 focus:ring-1 focus:ring-emerald-500"
          >
            <SelectValue placeholder="Toutes les ligues" />
          </SelectTrigger>
          <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
            <SelectItem value="__all__" className="text-xs">
              🌍 Toutes les ligues
            </SelectItem>
            {leagues.map((l) => (
              <SelectItem key={l} value={l} className="text-xs">
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sélecteur de stratégie */}
        <Select value={active} onValueChange={(v) => setActive(v as StrategyTop5Key)}>
          <SelectTrigger
            size="sm"
            aria-label="Stratégie du Top 10"
            className="h-7 w-56 rounded-lg border-slate-700/80 bg-slate-900/90 text-xs font-medium text-slate-200 focus:ring-1 focus:ring-emerald-500"
          >
            <SelectValue placeholder="Choisir une stratégie…" />
          </SelectTrigger>
          <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
            {STRATEGIES.map((s) => (
              <SelectItem key={s.key} value={s.key} className="text-xs">
                <span aria-hidden>{s.emoji}</span> {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtre temporel + fenêtre de forme L5/L10 */}
        <div className="flex shrink-0 items-center gap-1">
          <div className="flex overflow-hidden rounded border border-slate-700/60" role="group" aria-label="Période des matchs">
            {TIME_WINDOWS.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={() => setTimeWin(w.key)}
                aria-pressed={timeWin === w.key}
                title={`Matchs ${w.key === "jour" ? "du jour" : w.key === "48h" ? "sous 48 heures" : "de la semaine"}`}
                className={cn(
                  "px-2 py-0.5 font-mono text-[10px] font-bold uppercase transition-colors",
                  timeWin === w.key
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-transparent text-slate-500 hover:text-slate-300",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded border border-slate-700/60" role="group" aria-label="Fenêtre de forme">
            {(["l5", "l10"] as WindowKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setWinKey(k)}
                aria-pressed={winKey === k}
                className={cn(
                  "px-2 py-0.5 font-mono text-[10px] font-bold uppercase transition-colors",
                  winKey === k
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-transparent text-slate-500 hover:text-slate-300",
                )}
              >
                {k.replace("l", "L")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 px-1 py-3 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Calcul du Top 10…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 px-1 py-3 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          Top 10 indisponible ({(error as Error).message})
        </div>
      ) : rows.length === 0 && forced.length === 0 ? (
        <p className="px-1 py-3 text-xs text-slate-500">
          Aucun match qualifié pour cette stratégie{league ? ` en ${league}` : ""}.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 md:grid-cols-2">
          {/* Inclusions forcées (≥60 %, sélection) en tête avec badge */}
          {forced.map((entry) => (
            <MatchRow
              key={`forced-${entry.matchId}`}
              entry={entry}
              def={def}
              winKey={winKey}
              selected
              onToggle={() => toggleSelect(entry)}
              badge="★ Sélection"
            />
          ))}
          {rows.map((entry) => (
            <MatchRow
              key={entry.matchId}
              entry={entry}
              def={def}
              winKey={winKey}
              selected={!!selectedItems[entry.matchId]}
              onToggle={() => toggleSelect(entry)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
