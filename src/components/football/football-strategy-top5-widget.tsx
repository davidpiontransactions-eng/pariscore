"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";
import type {
  StrategyTop5Key,
  StrategyMatchEntry,
  Side,
  SideFormStats,
} from "@/lib/football-strategy-top5";
import { useFootballTop5 } from "@/hooks/use-football-top5";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StrategyDef = {
  key: StrategyTop5Key;
  label: string;
  emoji: string;
  format: (v: number) => string;
};

const STRATEGIES: StrategyDef[] = [
  { key: "bestTeam", label: "Meilleure équipe (forme)", emoji: "⭐", format: (v) => `${v.toFixed(0)}%` },
  { key: "bestTeam1x2", label: "Meilleure équipe sur le 1X2", emoji: "🎯", format: (v) => `${v.toFixed(0)}%` },
  { key: "bestAttack", label: "Meilleure attaque", emoji: "⚡", format: (v) => `${v.toFixed(1)} buts` },
  { key: "bestDefense", label: "Meilleure défense", emoji: "🧱", format: (v) => `${v.toFixed(1)} enc` },
  { key: "doubleChance", label: "Double chance", emoji: "🛡️", format: (v) => `${v.toFixed(0)}%` },
  { key: "over15", label: "Over 1,5 buts", emoji: "⚽", format: (v) => `${v.toFixed(0)}%` },
  { key: "under35", label: "Under 3,5 buts", emoji: "❄️", format: (v) => `${v.toFixed(0)}%` },
  { key: "bttsYes", label: "BTTS yes", emoji: "🥅", format: (v) => `${v.toFixed(0)}%` },
  { key: "over65Corners", label: "Over 6,5 corners", emoji: "🚩", format: (v) => `${v.toFixed(0)}%` },
];

type WindowKey = "l5" | "l10";

function sideBadge(entry: StrategyMatchEntry, side: Side): { text: string; highlight: boolean } {
  const isPick = entry.pick === side;
  return { text: entry[side].shortName, highlight: isPick };
}

function TeamName({
  side,
  bg,
  highlight,
}: {
  side: StrategyMatchEntry["home"] | StrategyMatchEntry["away"];
  bg: string;
  highlight: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1 truncate text-[10px] font-medium",
        highlight ? "text-emerald-300" : "text-slate-300",
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full object-contain", bg)} aria-hidden>
        {side.logo ? (
          <img
            src={side.logo}
            alt=""
            loading="lazy"
            className="h-2 w-2 rounded-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
      </span>
      <span className="truncate">{side.shortName}</span>
      {highlight ? <span title="côté à jouer">●</span> : null}
    </span>
  );
}

const fmt1 = (v: number) => v.toFixed(2).replace(".", ",");

/** Ligne de stats xG / buts marqués / encaissés — moyenne Home/Away sur la fenêtre. */
function StatsLine({
  entry,
  winKey,
}: {
  entry: StrategyMatchEntry;
  winKey: WindowKey;
}) {
  if (!entry.stats) return null;
  const sides: [Side, SideFormStats | null][] = [
    ["home", entry.stats.home[winKey]],
    ["away", entry.stats.away[winKey]],
  ];
  if (!sides.some(([, s]) => s)) return null;

  const cell = (s: SideFormStats | null, label: string, pick: (v: SideFormStats) => number) =>
    s ? (
      <span title={`${label} (${s.gp} matchs)`} className="tabular-nums">
        <span className="text-slate-500">{label}</span>{" "}
        <span className={cn(s.gp >= 3 ? "text-slate-300" : "text-slate-500 italic")}>
          {fmt1(pick(s))}
        </span>
      </span>
    ) : (
      <span className="tabular-nums text-slate-600">
        <span className="text-slate-600">{label}</span> –
      </span>
    );

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-px pl-[52px] text-[8.5px] leading-none">
      {sides.map(([side]) => (
        <div key={side} className="flex items-center gap-1">
          <span
            className={cn(
              "font-semibold uppercase",
              entry.pick === side ? "text-emerald-400" : "text-slate-500",
            )}
          >
            {side === "home" ? "D" : "E"}
          </span>
          {cell(entry.stats![side][winKey], "xG", (s) => s.xgFor)}
          <span className="text-slate-700">·</span>
          {cell(entry.stats![side][winKey], "B", (s) => s.goalsFor)}
          <span className="text-slate-700">·</span>
          {cell(entry.stats![side][winKey], "E", (s) => s.goalsAgainst)}
        </div>
      ))}
    </div>
  );
}

function MatchRow({
  entry,
  format,
  kickoff,
  winKey,
}: {
  entry: StrategyMatchEntry;
  format: (v: number) => string;
  kickoff: string;
  winKey: WindowKey;
}) {
  const home = sideBadge(entry, "home");
  const away = sideBadge(entry, "away");
  return (
    <li className="rounded px-0.5 py-1 hover:bg-slate-800/60">
      <div className="flex items-center gap-1.5">
        <span className="w-11 shrink-0 font-mono text-[9px] tabular-nums text-slate-500">{kickoff}</span>
        <div className="min-w-0 flex-1">
          <TeamName side={entry.home} highlight={home.highlight} bg="bg-slate-700" />
          <div className="px-1 text-[8px] text-slate-600">vs</div>
          <TeamName side={entry.away} highlight={away.highlight} bg="bg-slate-700" />
        </div>
        <span
          className={cn(
            "shrink-0 rounded px-1 py-0.5 font-mono text-[9px] tabular-nums",
            entry.pick ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400",
          )}
        >
          {format(entry.value)}
        </span>
      </div>
      <StatsLine entry={entry} winKey={winKey} />
    </li>
  );
}

function formatKickoff(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function FootballStrategyTop5Widget() {
  const { matchesFor, isLoading, error, isReady, window: win } = useFootballTop5();
  const [active, setActive] = useState<StrategyTop5Key>("bestTeam");
  const [winKey, setWinKey] = useState<WindowKey>("l5");

  const def = STRATEGIES.find((s) => s.key === active) ?? STRATEGIES[0];
  const rows = matchesFor(active);
  const hasData = rows.length > 0;

  return (
    <section aria-label="Top 5 matchs par stratégie" className="border-b border-slate-800/80 pb-2">
      <div className="flex items-center justify-between pr-2.5">
        <h2 className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Top 5 matchs
        </h2>
        {/* Bascule fenêtre L5/L10 pour les stats xG/buts */}
        <div className="flex overflow-hidden rounded border border-slate-700/60" role="group" aria-label="Fenêtre de forme">
          {(["l5", "l10"] as WindowKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setWinKey(k)}
              aria-pressed={winKey === k}
              className={cn(
                "px-1.5 py-px font-mono text-[9px] font-bold uppercase transition-colors",
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

      <div className="space-y-1 px-2.5 pb-1.5">
        {/* Sélecteur de stratégie (remplace la rangée de pills tronquée) */}
        <Select value={active} onValueChange={(v) => setActive(v as StrategyTop5Key)}>
          <SelectTrigger
            size="sm"
            aria-label="Stratégie du Top 5 matchs"
            className="h-8 w-full rounded-lg border-slate-700/80 bg-slate-900/90 text-xs font-medium text-slate-200 focus:ring-1 focus:ring-emerald-500"
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
        {/* Description dynamique en vert émeraude */}
        <p
          className="truncate pt-0.5 text-[11px] font-medium text-emerald-400"
          title={def.label}
          aria-live="polite"
        >
          {def.label}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-1.5 px-2.5 py-4 text-[11px] text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Calcul en cours…
        </div>
      ) : error || !isReady ? (
        <div className="flex items-center gap-1.5 px-2.5 py-3 text-[11px] text-slate-500">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
          Données insuffisantes.
        </div>
      ) : hasData ? (
        <div className="px-2">
          <p className="px-0.5 pb-1 text-[10px] text-slate-500">
            xG/buts/encaissés moyens D=E par côté ({winKey === "l5" ? "5" : "10"} derniers dom/ext)
          </p>
          <ul className="space-y-0.5">
            {rows.map((entry) => (
              <MatchRow
                key={entry.matchId}
                entry={entry}
                format={def.format}
                kickoff={formatKickoff(entry.kickoff)}
                winKey={winKey}
              />
            ))}
          </ul>
          <p className="px-0.5 pt-1 text-[8px] leading-tight text-slate-600">
            xG réel Understat · B = buts marqués moy. · E = encaissés moy.
          </p>
        </div>
      ) : (
        <p className="px-2.5 py-3 text-[11px] text-slate-500">
          Pas de match qualifié (forme L{win} home/away exigée).
        </p>
      )}
    </section>
  );
}
