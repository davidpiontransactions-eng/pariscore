"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TENNIS_TOP5_METRICS,
  type TennisTop5Def,
  type TennisTop5Entry,
  type TennisTop5Key,
  type Top5Period,
  type Top5Surface,
} from "@/lib/tennis-top5";
import { useTennisTop5 } from "@/hooks/use-tennis-top5";
import { Top5BacktestStrip } from "@/components/football/top5-backtest-strip";
import { isInKickoffWindow, parisDateShort, parisKickoff, type KickoffWindow } from "@/lib/football-time";

/** Filtre temporel des matchs listés (jour / 48 h / semaine). */
const TIME_WINDOWS: { key: KickoffWindow; label: string }[] = [
  { key: "jour", label: "Jour" },
  { key: "48h", label: "48h" },
  { key: "semaine", label: "Sem." },
];

/**
 * Top 5 matchs tennis par métrique joueur — miroir du widget foot
 * (FootballStrategyTop5Widget) : filtres en liste déroulante (métrique,
 * surface, période) + 5 lignes matchs avec le côté favori mis en évidence.
 *
 * Métriques issues de la littérature de prédiction tennis (thèses Dryja VU
 * Amsterdam & Willekes, cf. TENNIS_SIDEBAR_DEBUG.md) : Élo par surface,
 * momentum/service/retour/complétude/pression.
 */

const SURFACES: { key: Top5Surface; label: string }[] = [
  { key: "all", label: "Toutes surfaces" },
  { key: "hard", label: "Dur" },
  { key: "clay", label: "Terre battue" },
  { key: "grass", label: "Gazon" },
];

const PERIODS: { key: Top5Period; label: string }[] = [
  { key: "52w", label: "52 semaines" },
  { key: "ytd", label: "Depuis janv." },
  { key: "all", label: "Tout l'historique" },
];

function PlayerLine({
  side,
  entry,
  def,
}: {
  side: "A" | "B";
  entry: TennisTop5Entry;
  def: TennisTop5Def;
}) {
  const p = side === "A" ? entry.playerA : entry.playerB;
  const isPick = entry.pick === side;
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[10px] font-medium",
          isPick ? "text-emerald-300" : "text-slate-300",
        )}
      >
        {p.shortName}
      </span>
      <span
        title={`${def.label} — ${p.name}`}
        className={cn(
          "shrink-0 rounded px-1 py-px font-mono text-[9px] tabular-nums",
          p.value == null
            ? "bg-slate-800/60 text-slate-600"
            : isPick
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-slate-800 text-slate-400",
        )}
      >
        {p.value == null ? "–" : def.format(p.value)}
      </span>
    </div>
  );
}

function MatchRow({ entry, def }: { entry: TennisTop5Entry; def: TennisTop5Def }) {
  const probPct = entry.probPick != null ? Math.round(entry.probPick) : null;
  return (
    <li>
      <div className="rounded px-0.5 py-1 transition-colors hover:bg-slate-800/60">
        <div className="flex items-center gap-1.5">
          <span className="flex w-9 shrink-0 flex-col items-center font-mono tabular-nums text-slate-500">
            <span className="text-[8px] leading-tight">{parisDateShort(entry.scheduledAt)}</span>
            <span className="text-[9px] leading-tight">{parisKickoff(entry.scheduledAt)}</span>
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <PlayerLine side="A" entry={entry} def={def} />
            <div className="px-1 text-[8px] leading-none text-slate-600">vs</div>
            <PlayerLine side="B" entry={entry} def={def} />
          </div>
          <span
            className={cn(
              "shrink-0 rounded px-1 py-0.5 font-mono text-[9px] tabular-nums",
              entry.pick ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400",
            )}
            title={entry.tournament}
          >
            {entry.pick ? def.format(entry.value) : "="}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between pl-[46px] text-[8.5px] leading-none">
          <span className="truncate text-slate-500" title={`${entry.tournament} · ${entry.round}`}>
            {entry.tournament}
          </span>
          {probPct != null && (
            <span className="ml-2 shrink-0 font-medium tabular-nums text-emerald-400">
              Réussite estimée&nbsp;: {probPct}&nbsp;%
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function TennisStrategyTop5Widget() {
  const [metric, setMetric] = useState<TennisTop5Key>("surfaceElo");
  const [surface, setSurface] = useState<Top5Surface>("all");
  const [period, setPeriod] = useState<Top5Period>("52w");
  const [timeWin, setTimeWin] = useState<KickoffWindow>("semaine");

  const { entries, meta, isLoading, error, isReady } = useTennisTop5(metric, surface, period);

  const def: TennisTop5Def =
    TENNIS_TOP5_METRICS.find((d) => d.key === metric) ?? TENNIS_TOP5_METRICS[0];
  // Filtre temporel : matchs à venir dans la fenêtre choisie.
  const rawCount = entries.length;
  const visibleEntries = entries.filter((e) => isInKickoffWindow(e.scheduledAt, timeWin));
  const hasData = visibleEntries.length > 0;

  const selectCls =
    "h-7 w-full rounded-lg border-slate-700/80 bg-slate-900/90 text-[11px] font-medium text-slate-200 focus:ring-1 focus:ring-emerald-500";

  return (
    <section aria-label="Top 5 matchs tennis par métrique" className="border-b border-slate-800/80 pb-2">
      <div className="flex items-center justify-between pr-2.5">
        <h2 className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Top 5 matchs tennis
        </h2>
        {/* Filtre temporel des matchs listés */}
        <div className="flex shrink-0 overflow-hidden rounded border border-slate-700/60" role="group" aria-label="Période des matchs">
          {TIME_WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setTimeWin(w.key)}
              aria-pressed={timeWin === w.key}
              title={`Matchs ${w.key === "jour" ? "du jour" : w.key === "48h" ? "sous 48 heures" : "de la semaine"}`}
              className={cn(
                "px-1.5 py-px font-mono text-[9px] font-bold uppercase transition-colors",
                timeWin === w.key
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-transparent text-slate-500 hover:text-slate-300",
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 px-2.5 pb-1.5">
        <Select value={metric} onValueChange={(v) => setMetric(v as TennisTop5Key)}>
          <SelectTrigger size="sm" aria-label="Métrique du Top 5 tennis" className={selectCls}>
            <SelectValue placeholder="Choisir une métrique…" />
          </SelectTrigger>
          <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
            {TENNIS_TOP5_METRICS.map((m) => (
              <SelectItem key={m.key} value={m.key} className="text-xs">
                <span aria-hidden>{m.emoji}</span> {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Backtest : réussite / ROI de la métrique active sur l'historique des top 5 */}
        <Top5BacktestStrip sport="tennis" strategyKey={metric} />

        {/* Surface + période côte à côte pour rester compact */}
        <div className="grid grid-cols-2 gap-1">
          <Select value={surface} onValueChange={(v) => setSurface(v as Top5Surface)}>
            <SelectTrigger size="sm" aria-label="Surface" className={selectCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
              {SURFACES.map((s) => (
                <SelectItem key={s.key} value={s.key} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as Top5Period)}>
            <SelectTrigger size="sm" aria-label="Période de forme" className={selectCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
              {PERIODS.map((p) => (
                <SelectItem key={p.key} value={p.key} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description dynamique en vert émeraude (pattern foot) */}
        <p className="truncate pt-0.5 text-[11px] font-medium text-emerald-400" title={def.label} aria-live="polite">
          <span aria-hidden>{def.emoji}</span> {def.label}
        </p>
      </div>

      {isLoading && !isReady ? (
        <div className="flex items-center justify-center gap-1.5 px-2.5 py-4 text-[11px] text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Calcul en cours…
        </div>
      ) : error || !isReady ? (
        <div className="flex items-center gap-1.5 px-2.5 py-3 text-[11px] text-slate-500">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
          Données indisponibles.
        </div>
      ) : hasData ? (
        <>
          <ul className="space-y-0.5 px-2 pb-1">
            {visibleEntries.map((e) => (
              <MatchRow key={e.matchId} entry={e} def={def} />
            ))}
          </ul>
          <p className="px-2.5 pt-1 text-[8px] leading-tight text-slate-600">
            Métriques par surface (Élo surface, service, retour, pression) · côté favori en vert
          </p>
        </>
      ) : rawCount > 0 ? (
        <p className="px-2.5 py-3 text-[11px] text-slate-500">
          Aucun match dans cette période.
        </p>
      ) : (
        <p className="px-2.5 py-3 text-[11px] leading-snug text-slate-500">
          {meta?.dataUnavailable
            ? "Stats joueurs indisponibles."
            : `Aucun duel complet (${meta?.playersInLeaderboard ?? 0} joueurs suivis) — ajuste la surface ou la période.`}
        </p>
      )}
    </section>
  );
}
