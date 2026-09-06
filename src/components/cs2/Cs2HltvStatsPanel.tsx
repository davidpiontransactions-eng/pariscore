"use client";

import { useMemo, useState } from "react";
import { Shield, TrendingUp, TrendingDown, Minus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHltvStats } from "@/hooks/use-hltv-stats";
import { displayTeamName, formatCS2Winrate } from "@/lib/cs2/format";
import type { HltvTeamStats, HltvMapPool } from "@/lib/cs2/hltv-stats-types";
import { ACTIVE_MAP_POOL } from "@/lib/prediction/cs2/cs2-predictive-ml-engine";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${Math.round(x)}%`;
}

function kdColor(kd: number | null): string {
  if (kd == null) return "text-zinc-400";
  if (kd >= 1.1) return "text-[#00E676]";
  if (kd >= 1.0) return "text-zinc-200";
  return "text-red-400";
}

function trendIcon(wr3m: number | null, wr6m: number | null) {
  if (wr3m == null || wr6m == null) return <Minus className="h-3 w-3 text-zinc-600" />;
  const delta = wr3m - wr6m;
  if (delta > 2) return <TrendingUp className="h-3 w-3 text-[#00E676]" />;
  if (delta < -2) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-zinc-500" />;
}

// ─── Winrate Bars ─────────────────────────────────────────────────────────────

function WinrateBar({ wr, label }: { wr: number | null; label?: string }) {
  const v = wr ?? 0;
  const color =
    v >= 60 ? "bg-[#00E676]/70" :
    v >= 50 ? "bg-sky-500/70" :
    v >= 40 ? "bg-amber-500/70" :
    "bg-red-500/70";
  return (
    <div className="space-y-0.5">
      {label && <p className="text-[10px] text-zinc-500">{label}</p>}
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div className={color} style={{ width: `${v}%` }} />
      </div>
      <p className="text-right text-[10px] font-mono tabular-nums text-zinc-400">
        {formatCS2Winrate(wr)}
      </p>
    </div>
  );
}

// ─── Team Card ────────────────────────────────────────────────────────────────

function TeamCard({
  team,
  selected,
  onClick,
}: {
  team: HltvTeamStats;
  selected: boolean;
  onClick: () => void;
}) {
  const o = team.overview;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition-all",
        selected
          ? "border-orange-500/40 bg-orange-500/10"
          : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-[10px] font-bold text-zinc-400">
            #{team.rank || "?"}
          </span>
          <span className="text-sm font-bold text-white">
            {displayTeamName(team.name)}
          </span>
        </div>
        {o?.kdRatio != null && (
          <span className={cn("font-mono text-xs font-bold", kdColor(o.kdRatio))}>
            K/D {o.kdRatio.toFixed(2)}
          </span>
        )}
      </div>
      {o && (
        <div className="flex gap-4 text-[11px] text-zinc-400">
          <span>{o.mapsPlayed ?? "?"} cartes</span>
          <span>
            <span className="text-[#00E676]">{o.wins ?? 0}W</span>{" "}
            <span className="text-zinc-500">{o.draws ?? 0}D</span>{" "}
            <span className="text-red-400">{o.losses ?? 0}L</span>
          </span>
        </div>
      )}
    </button>
  );
}

// ─── Map Pool Grid ────────────────────────────────────────────────────────────

function MapPoolGrid({
  team,
  mapPool,
}: {
  team: HltvTeamStats;
  mapPool: Record<string, HltvMapPool> | undefined;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Winrate par carte
      </h4>
      {ACTIVE_MAP_POOL.map((map) => {
        const ms = team.mapStats[map];
        const pool = mapPool?.[map];
        const teamRank = pool?.teams?.find(t => t.name === team.name)?.rank;
        return (
          <div
            key={map}
            className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
          >
            <span className="w-16 shrink-0 text-xs font-semibold text-zinc-200">
              {map}
            </span>
            <div className="flex-1">
              <WinrateBar wr={ms?.winRate ?? null} />
            </div>
            <span className="w-8 text-center text-[10px] text-zinc-500">
              {teamRank ? `#${teamRank}` : "—"}
            </span>
            <span className="w-16 text-right text-[10px] text-zinc-500">
              {ms ? `${ms.wins}W-${ms.losses}L` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Map Pool Overview ────────────────────────────────────────────────────────

function MapPoolOverview({ mapPool }: { mapPool: Record<string, HltvMapPool> }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Cartes — winrate moyen top-30
      </h4>
      {ACTIVE_MAP_POOL.map((map) => {
        const pool = mapPool[map];
        if (!pool) return null;
        return (
          <div
            key={map}
            className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">{map}</span>
              <span className="text-[11px] font-mono text-zinc-400">
                μ {pct(pool.avgWinrate)} · {pool.totalMatches} matchs
              </span>
            </div>
            <WinrateBar wr={pool.avgWinrate} />
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-500">
              {pool.teams.slice(0, 5).map((t) => (
                <span key={t.name}>
                  #{t.rank} {t.name} ({pct(t.winRate)})
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Cs2HltvStatsPanel() {
  const { teamStats, mapPool, isLoading, error } = useHltvStats();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"teams" | "maps">("teams");

  const teams = useMemo(() => {
    const all = teamStats?.teams ?? [];
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter(t => t.name.toLowerCase().includes(q));
  }, [teamStats, search]);

  const selected = useMemo(
    () => teams.find(t => t.name === selectedTeam) ?? null,
    [teams, selectedTeam]
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3 rounded-2xl border border-white/10 bg-[#1A1A2E] p-5">
        <div className="h-5 w-40 rounded bg-white/10" />
        <div className="h-3 w-64 rounded bg-white/10" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 rounded-lg bg-white/5" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-5 text-center">
        <Shield className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
        <p className="text-sm text-zinc-400">
          Stats HLTV indisponibles
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Lancez{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            bun run scrape:hltv
          </code>{" "}
          depuis une IP résidentielle
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">
            Stats HLTV
          </h3>
          <p className="text-[11px] text-zinc-500">
            {teamStats?.n_teams ?? 0} équipes · {teamStats?.generated ?? "?"}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
          <button
            type="button"
            onClick={() => setView("teams")}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              view === "teams"
                ? "bg-orange-500/20 text-orange-400"
                : "text-zinc-400 hover:text-white"
            )}
          >
            Équipes
          </button>
          <button
            type="button"
            onClick={() => setView("maps")}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              view === "maps"
                ? "bg-orange-500/20 text-orange-400"
                : "text-zinc-400 hover:text-white"
            )}
          >
            Cartes
          </button>
        </div>
      </div>

      {view === "teams" ? (
        <>
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrer équipe..."
              className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-orange-500/40"
            />
          </div>

          {/* Team list */}
          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {teams.map(team => (
              <TeamCard
                key={team.name}
                team={team}
                selected={selectedTeam === team.name}
                onClick={() =>
                  setSelectedTeam(prev =>
                    prev === team.name ? null : team.name
                  )
                }
              />
            ))}
          </div>

          {/* Selected team detail */}
          {selected && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <MapPoolGrid
                team={selected}
                mapPool={mapPool?.mapPool}
              />
            </div>
          )}
        </>
      ) : (
        <MapPoolOverview mapPool={mapPool?.mapPool ?? {}} />
      )}
    </div>
  );
}
