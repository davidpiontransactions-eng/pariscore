"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, BarChart3, TrendingUp, Zap, Target, Brain, Flame, Trophy, Cpu, Calendar, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTennisTop10, type TennisTop10Metric, type TennisTop10Surface, type TennisTop10Period } from "@/hooks/use-tennis-top10";
import { TennisPlayerModal } from "./tennis-player-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFlagAssets } from "@/lib/flag-utils";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const METRICS = [
  { key: "surfaceElo", label: "Elo Surface", icon: Target, emoji: "🎯" },
  { key: "eloGlobal", label: "Elo Global", icon: Globe, emoji: "🌍" },
  { key: "momentum", label: "Momentum", icon: Flame, emoji: "🔥" },
  { key: "serveDominance", label: "Service", icon: Zap, emoji: "⚡" },
  { key: "returnEfficiency", label: "Retour", icon: Target, emoji: "🧲" },
  { key: "completeness", label: "Completude", icon: Brain, emoji: "🧩" },
  { key: "pressure", label: "Pression", icon: TrendingUp, emoji: "💪" },
  { key: "gagnant", label: "Modele", icon: Trophy, emoji: "🎯" },
  { key: "mlWinner", label: "ML v2.0", icon: Cpu, emoji: "🤖" },
] as const;

const SURFACES = [
  { key: "all", label: "Toutes" },
  { key: "hard", label: "Dur" },
  { key: "clay", label: "Terre" },
  { key: "grass", label: "Gazon" },
] as const;

const PERIODS = [
  { key: "52w", label: "52 sem." },
  { key: "ytd", label: "Depuis janv." },
  { key: "all", label: "Tout" },
] as const;

// Manque import pour Globe
function Globe({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function TennisTop10Section() {
  const [metric, setMetric] = useState("surfaceElo");
  const [surface, setSurface] = useState("all");
  const [period, setPeriod] = useState("52w");
  const [selectedEntry, setSelectedEntry] = useState<number | null>(null);

  const { entries, meta, error, isLoading } = useTennisTop10(metric, surface, period);

  const currentMetric = METRICS.find((m) => m.key === metric);

  // Backtest data
  const [backtest, setBacktest] = useState<Record<string, { winRate?: number | null; roi?: number | null }>>({});

  // Fetch backtest on mount
  const fetchBacktest = useCallback(async () => {
    try {
      const res = await fetch("/api/tennis/top5/backtest");
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, { winRate?: number | null; roi?: number | null }> = {};
      for (const strat of Object.values(data.strategies ?? {}) as Record<string, { winRatePct?: number | null; roi?: { roiPct?: number | null } }>[]) {
        for (const [key, stats] of Object.entries(strat)) {
          if (stats && typeof stats === "object") {
            map[key] = {
              winRate: (stats as { winRatePct?: number | null }).winRatePct ?? null,
              roi: (stats as { roi?: { roiPct?: number | null } }).roi?.roiPct ?? null,
            };
          }
        }
      }
      setBacktest(map);
    } catch {}
  }, []);

  // Fetch once on mount
  useState(() => { fetchBacktest(); });

  const closeModal = useCallback(() => setSelectedEntry(null), []);
  const selectedPlayer = selectedEntry != null ? entries.find((e) => e.rank === selectedEntry) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-100">
            {currentMetric?.emoji} TOP 10 — {currentMetric?.label}
          </h2>
          {meta && (
            <p className="text-[10px] text-zinc-500">
              {meta.playersConsidered} joueurs consideres · {meta.surface !== "all" ? meta.surface : "toutes surfaces"}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={metric} onValueChange={setMetric}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METRICS.map((m) => (
              <SelectItem key={m.key} value={m.key} className="text-xs">
                {m.emoji} {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={surface} onValueChange={setSurface}>
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SURFACES.map((s) => (
              <SelectItem key={s.key} value={s.key} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.key} value={p.key} className="text-xs">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <span className="ml-2 text-sm text-zinc-400">Chargement...</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium text-red-300">Erreur de chargement</span>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-2 text-sm text-zinc-500">Aucune donnee disponible</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[40px_1fr_80px_100px_120px_100px_80px_60px] gap-2 px-3 py-2 border-b border-white/[0.06] text-[10px] font-medium text-zinc-500 uppercase">
            <span>#</span>
            <span>Joueur</span>
            <span className="text-right">Elo</span>
            <span className="text-center">Forme</span>
            <span className="text-center">Prochain match</span>
            <span className="text-right">Cote</span>
            <span className="text-right">Win%</span>
            <span className="text-right">Score</span>
          </div>

          {/* Table rows */}
          {entries.map((entry, idx) => {
            const { rank, player, metricValue, metricLabel, insight, isValue, scorecard } = entry;
            const nm = player.nextMatch;
            const flag = player.country ? getFlagAssets(player.country) : null;
            const isBest = idx === 0;
            const formLen = player.form?.length ?? 0;
            const formWins = player.form?.filter(f => f === "W").length ?? 0;
            const formPct = formLen > 0 ? Math.round((formWins / formLen) * 100) : 0;

            const dateStr = nm ? new Date(nm.scheduledAt).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "—";
            const timeStr = nm ? new Date(nm.scheduledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";

            return (
              <motion.div
                key={rank}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => setSelectedEntry(rank)}
                className={cn(
                  "grid grid-cols-[40px_1fr_80px_100px_120px_100px_80px_60px] gap-2 px-3 py-2.5 items-center",
                  "cursor-pointer hover:bg-white/[0.03] transition-colors",
                  "border-b border-white/[0.03] last:border-b-0",
                  isBest && "bg-emerald-500/[0.04] border-emerald-500/10"
                )}
              >
                {/* Rank */}
                <span className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                  rank === 1 ? "bg-amber-500/20 text-amber-400" :
                  rank === 2 ? "bg-zinc-400/20 text-zinc-300" :
                  rank === 3 ? "bg-orange-500/20 text-orange-400" :
                  "bg-white/[0.04] text-zinc-500"
                )}>
                  {rank}
                </span>

                {/* Player name + flag */}
                <div className="flex items-center gap-2 min-w-0">
                  {flag && <span className="text-sm shrink-0">{flag.emoji}</span>}
                  <span className={cn(
                    "truncate text-sm font-semibold",
                    isBest ? "text-emerald-300" : "text-zinc-100"
                  )}>
                    {player.name}
                  </span>
                  {player.atpRank && <span className="text-[9px] font-mono text-zinc-500 shrink-0">ATP#{player.atpRank}</span>}
                  {player.wtaRank && <span className="text-[9px] font-mono text-pink-400/70 shrink-0">WTA#{player.wtaRank}</span>}
                  {isValue && <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium shrink-0">VALUE</span>}
                </div>

                {/* Elo */}
                <span className="text-right text-sm font-mono text-zinc-300">
                  {player.elo}
                </span>

                {/* Form */}
                <div className="flex items-center justify-center gap-0.5">
                  {player.form.map((f, i) => (
                    <span key={i} className={cn(
                      "h-4 w-2 rounded-sm text-[8px] flex items-center justify-center font-bold",
                      f === "W" ? "bg-emerald-500/30 text-emerald-400" : "bg-red-500/30 text-red-400"
                    )}>
                      {f}
                    </span>
                  ))}
                  {formLen === 0 && <span className="text-[10px] text-zinc-600">—</span>}
                </div>

                {/* Next match */}
                {nm ? (
                  <div className="text-center">
                    <div className="text-[10px] text-zinc-400">vs <span className="text-zinc-200 font-medium">{nm.opponentShort}</span></div>
                    <div className="text-[9px] text-zinc-500">{dateStr} {timeStr}</div>
                    <div className="text-[9px] text-zinc-600 truncate">{nm.tournament}</div>
                  </div>
                ) : (
                  <span className="text-[10px] text-zinc-600 text-center">Pas de match</span>
                )}

                {/* Odds */}
                <span className={cn(
                  "text-right text-sm font-mono font-semibold",
                  nm?.odds != null ? (
                    (nm.marketProb ?? 0) >= 60 ? "text-emerald-400" :
                    (nm.marketProb ?? 0) <= 40 ? "text-red-400" :
                    "text-zinc-300"
                  ) : "text-zinc-600"
                )}>
                  {nm?.odds != null ? nm.odds.toFixed(2) : "—"}
                </span>

                {/* Win probability */}
                <span className={cn(
                  "text-right text-sm font-semibold",
                  (nm?.matchWinProb ?? 0) >= 65 ? "text-emerald-400" :
                  (nm?.matchWinProb ?? 0) <= 35 ? "text-red-400" :
                  "text-zinc-300"
                )}>
                  {nm?.matchWinProb != null ? `${nm.matchWinProb}%` : "—"}
                </span>

                {/* Scorecard */}
                <div className="flex items-center justify-end gap-1">
                  <span className={cn(
                    "text-sm font-bold font-mono",
                    isBest ? "text-emerald-400" :
                    scorecard >= 60 ? "text-zinc-200" :
                    scorecard >= 40 ? "text-zinc-400" :
                    "text-zinc-500"
                  )}>
                    {scorecard}
                  </span>
                  {isBest && <Trophy className="h-3 w-3 text-emerald-400" />}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <TennisPlayerModal
          player={selectedPlayer.player}
          metricValue={selectedPlayer.metricValue}
          metricLabel={selectedPlayer.metricLabel}
          insight={selectedPlayer.insight}
          scorecard={selectedPlayer.scorecard}
          onClose={closeModal}
        />
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Momentum 80+
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Momentum 40-79
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Momentum &lt;40
        </span>
        <span className="flex items-center gap-0.5">
          <span className="h-2 w-2 rounded-t-sm bg-emerald-500" /> = Win
        </span>
        <span className="flex items-center gap-0.5">
          <span className="h-2 w-2 rounded-t-sm bg-red-500" /> = Loss
        </span>
      </div>
    </div>
  );
}
