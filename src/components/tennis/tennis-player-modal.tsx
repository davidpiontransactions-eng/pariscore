"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, TrendingDown, Minus, Zap, Target, Brain, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFlagAssets } from "@/lib/flag-utils";
import type { TennisTop10Player } from "@/lib/tennis-top10";

// ─── RADAR CHART (5 axes) ─────────────────────────────────────────────────────

function RadarChart({ player }: { player: TennisTop10Player }) {
  // Normalize values to 0-1 for radar
  const metrics = [
    { label: "Service", value: (player.serveWonPct ?? 50) / 100 },
    { label: "Retour", value: (player.returnWonPct ?? 50) / 100 },
    { label: "Pression", value: (player.tiebreaksWonPct ?? 50) / 100 },
    { label: "Momentum", value: player.momentumScore / 100 },
    { label: "Elo", value: Math.min((player.surfaceElo ?? player.elo) / 2000, 1) },
  ];

  const cx = 80, cy = 80, r = 60;
  const angleStep = (2 * Math.PI) / metrics.length;

  // Grid circles
  const gridLevels = [0.25, 0.5, 0.75, 1];

  // Data polygon points
  const dataPoints = metrics.map((m, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const x = cx + m.value * r * Math.cos(angle);
    const y = cy + m.value * r * Math.sin(angle);
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width="160" height="160" className="mx-auto">
      {/* Grid */}
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={metrics.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            return `${cx + level * r * Math.cos(angle)},${cy + level * r * Math.sin(angle)}`;
          }).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.5"
        />
      ))}
      {/* Axes */}
      {metrics.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + r * Math.cos(angle)}
            y2={cy + r * Math.sin(angle)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.5"
          />
        );
      })}
      {/* Data */}
      <polygon points={dataPoints} fill="rgba(0,230,118,0.15)" stroke="#00e676" strokeWidth="1.5" />
      {/* Dots */}
      {metrics.map((m, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = cx + m.value * r * Math.cos(angle);
        const y = cy + m.value * r * Math.sin(angle);
        return <circle key={i} cx={x} cy={y} r="3" fill="#00e676" />;
      })}
      {/* Labels */}
      {metrics.map((m, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const lx = cx + (r + 16) * Math.cos(angle);
        const ly = cy + (r + 16) * Math.sin(angle);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            className="fill-zinc-400 text-[8px] font-medium">
            {m.label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── STAT ROW ─────────────────────────────────────────────────────────────────

function StatRow({ label, value, icon: Icon }: { label: string; value: string | number; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <span className="text-xs font-mono font-semibold text-zinc-200">{value}</span>
    </div>
  );
}

// ─── FORM TIMELINE ────────────────────────────────────────────────────────────

function FormTimeline({ form }: { form: ("W" | "L")[] }) {
  if (form.length === 0) return <span className="text-xs text-zinc-500">Pas de forme dispo</span>;

  return (
    <div className="flex items-center gap-1">
      {form.map((r, i) => (
        <div
          key={i}
          className={cn(
            "h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold",
            r === "W" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          )}
        >
          {r}
        </div>
      ))}
    </div>
  );
}

// ─── MOMENTUM GAUGE ───────────────────────────────────────────────────────────

function MomentumGauge({ score }: { score: number }) {
  const color =
    score >= 80 ? "#00e676" :
    score >= 60 ? "#4ade80" :
    score >= 40 ? "#fbbf24" :
    score >= 20 ? "#f97316" :
    "#ef4444";

  const angle = (score / 100) * 180 - 90; // -90 to 90

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        {/* Background arc */}
        <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
        {/* Value arc */}
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 157} 157`}
        />
        <text x="60" y="55" textAnchor="middle" className="fill-zinc-100 text-lg font-bold tabular-nums">
          {score}
        </text>
        <text x="60" y="67" textAnchor="middle" className="fill-zinc-500 text-[8px]">
          MOMENTUM
        </text>
      </svg>
    </div>
  );
}

// ─── MAIN MODAL ───────────────────────────────────────────────────────────────

export const TennisPlayerModal = memo(function TennisPlayerModal({
  player,
  metricValue,
  metricLabel,
  insight,
  onClose,
}: {
  player: TennisTop10Player;
  metricValue: number;
  metricLabel: string;
  insight: string;
  onClose: () => void;
}) {
  const flag = player.country ? getFlagAssets(player.country) : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0e121e] p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Photo */}
              <div className="h-14 w-14 rounded-full bg-white/[0.06] overflow-hidden">
                {player.photoUrl ? (
                  <img src={player.photoUrl} alt={player.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold text-zinc-400">
                    {player.shortName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-zinc-100">{player.name}</h3>
                  {flag && <span className="text-sm">{flag.emoji}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  {player.atpRank && <span>ATP #{player.atpRank}</span>}
                  {player.wtaRank && <span className="text-pink-400/70">WTA #{player.wtaRank}</span>}
                  <span>Elo {player.elo}</span>
                  {player.surfaceElo && <span>Surface {player.surfaceElo}</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Insight */}
          <div className="mb-4 rounded-lg bg-white/[0.03] px-3 py-2 text-sm font-medium text-emerald-400">
            {insight}
          </div>

          {/* Metric + Momentum */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl bg-white/[0.03] p-3 text-center">
              <p className="text-[10px] text-zinc-500 uppercase">{metricLabel}</p>
              <p className="text-2xl font-bold text-zinc-100 tabular-nums">{metricValue}</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3 flex items-center justify-center">
              <MomentumGauge score={player.momentumScore} />
            </div>
          </div>

          {/* Radar */}
          <div className="mb-4 rounded-xl bg-white/[0.03] p-3">
            <p className="text-[10px] text-zinc-500 uppercase mb-2 text-center">Profil multidimensionnel</p>
            <RadarChart player={player} />
          </div>

          {/* Stats */}
          <div className="mb-4 rounded-xl bg-white/[0.03] p-3">
            <p className="text-[10px] text-zinc-500 uppercase mb-1">Stats detaillees</p>
            <StatRow label="Service points gagnes" value={player.serveWonPct != null ? `${player.serveWonPct.toFixed(1)}%` : "—"} icon={Zap} />
            <StatRow label="Retour points gagnes" value={player.returnWonPct != null ? `${player.returnWonPct.toFixed(1)}%` : "—"} icon={Target} />
            <StatRow label="Tie-breaks gagnes" value={player.tiebreaksWonPct != null ? `${player.tiebreaksWonPct.toFixed(1)}%` : "—"} icon={TrendingUp} />
            <StatRow label="Sets decisifs gagnes" value={player.decidingSetsWonPct != null ? `${player.decidingSetsWonPct.toFixed(1)}%` : "—"} icon={Trophy} />
          </div>

          {/* Form */}
          <div className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-[10px] text-zinc-500 uppercase mb-2">Forme recente (6 derniers)</p>
            <FormTimeline form={player.form} />
          </div>

          {/* Next Match */}
          {player.nextMatch && (
            <div className="mt-3 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-3">
              <p className="text-[10px] text-emerald-400 uppercase mb-2 font-medium">Prochain match</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    vs {player.nextMatch.opponent}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {player.nextMatch.round} · {player.nextMatch.tournament}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {new Date(player.nextMatch.scheduledAt).toLocaleDateString("fr-FR", {
                      weekday: "long", day: "numeric", month: "long", year: "numeric"
                    })} à{" "}
                    {new Date(player.nextMatch.scheduledAt).toLocaleTimeString("fr-FR", {
                      hour: "2-digit", minute: "2-digit"
                    })}
                  </p>
                </div>
                {player.nextMatch.odds != null && (
                  <div className="text-right">
                    <p className="text-lg font-bold text-zinc-100 font-mono">{player.nextMatch.odds.toFixed(2)}</p>
                    {player.nextMatch.marketProb != null && (
                      <p className={cn(
                        "text-xs font-medium",
                        player.nextMatch.marketProb >= 60 ? "text-emerald-400" :
                        player.nextMatch.marketProb <= 40 ? "text-red-400" :
                        "text-zinc-400"
                      )}>
                        {player.nextMatch.marketProb}% implicite
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});
