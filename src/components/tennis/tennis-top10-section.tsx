"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, BarChart3, TrendingUp, Zap, Target, Brain, Flame, Trophy, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTennisTop10, type TennisTop10Metric, type TennisTop10Surface, type TennisTop10Period } from "@/hooks/use-tennis-top10";
import { TennisPlayerCard } from "./tennis-player-card";
import { TennisPlayerModal } from "./tennis-player-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {entries.map((entry) => (
            <TennisPlayerCard
              key={entry.rank}
              entry={entry}
              onClick={() => setSelectedEntry(entry.rank)}
              backtest={backtest[entry.player.name]}
            />
          ))}
        </div>
      )}

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <TennisPlayerModal
          player={selectedPlayer.player}
          metricValue={selectedPlayer.metricValue}
          metricLabel={selectedPlayer.metricLabel}
          insight={selectedPlayer.insight}
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
