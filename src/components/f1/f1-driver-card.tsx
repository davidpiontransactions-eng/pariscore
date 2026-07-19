"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ProbabilityRing } from "@/components/tennis/probability-ring";

export type F1Driver = {
  code: string;
  name: string;
  team: string;
  teamId?: string;
  pos?: number;
  points?: number;
  wins?: number;
  ppg?: number;
  carRating?: number;
  driverSkill?: number;
  qualiPace?: number;
  formScore?: number;
  trackScore?: number;
  eta?: number;
  dnfRate?: number;
  reliability?: number;
  driverConfidence?: number;
  strength?: number;
  photo?: string;
  logo?: string;
  win?: number;
  podium?: number;
  top10?: number;
  winSE?: number;
  podiumSE?: number;
  top10SE?: number;
};

type Props = {
  driver: F1Driver;
  index?: number;
};

const TEAM_COLORS: Record<string, string> = {
  red_bull: "#3671C6",
  ferrari: "#E8002D",
  mercedes: "#27F4D2",
  mclaren: "#FF8700",
  alpine: "#FF87BC",
  aston_martin: "#245C33",
  williams: "#37BEDD",
  rb: "#4E7BB6",
  sauber: "#52E252",
  haas: "#B6B6B6",
};

export function F1DriverCard({ driver, index = 0 }: Props) {
  const winPct = driver.win != null ? Math.round(driver.win * 100) : 0;
  const podiumPct = driver.podium != null ? Math.round(driver.podium * 100) : 0;
  const top10Pct = driver.top10 != null ? Math.round(driver.top10 * 100) : 0;
  const teamColor = driver.teamId ? TEAM_COLORS[driver.teamId] : "#666";
  const reliabilityPct = driver.reliability != null ? Math.round(driver.reliability * 100) : 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10",
        "bg-[#1A1A2E] text-white shadow-lg",
        "transition-all duration-300",
        "hover:border-[#00E676]/60 hover:shadow-[0_0_20px_rgba(0,230,118,0.15)]"
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(0,230,118,0.06) 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 p-4">
        {/* Team color bar */}
        <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl" style={{ backgroundColor: teamColor }} />

        {/* Driver info row */}
        <div className="flex items-center gap-4 pl-2">
          {/* Photo */}
          <div className="relative shrink-0">
            {driver.photo ? (
              <img
                src={driver.photo}
                alt={driver.name}
                className="h-14 w-14 rounded-full object-cover ring-2"
                style={{ ringColor: teamColor + "40" }}
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-sm font-bold uppercase text-white/60">
                {driver.code}
              </div>
            )}
            {driver.logo && (
              <img
                src={driver.logo}
                alt={driver.team}
                className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[#1A1A2E] p-0.5 ring-1 ring-white/10"
              />
            )}
          </div>

          {/* Name + team */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold">{driver.name}</span>
              {driver.pos != null && (
                <span className={cn(
                  "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded",
                  driver.pos <= 3 ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-zinc-500"
                )}>
                  #{driver.pos}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-zinc-400">{driver.team}</p>
          </div>

          {/* Championship points */}
          {driver.points != null && (
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold tabular-nums" style={{ color: teamColor }}>
                {driver.points}
              </p>
              <p className="text-[10px] text-zinc-500">pts</p>
            </div>
          )}
        </div>

        {/* Win probability ring */}
        <div className="mt-4 flex items-center justify-center">
          <ProbabilityRing value={winPct} size={80} stroke={6} color="#00E676" trackColor="rgba(255,255,255,0.08)">
            <span className="text-lg font-bold tabular-nums text-white">{winPct}%</span>
          </ProbabilityRing>
        </div>

        {/* Stats bars */}
        <div className="mt-4 space-y-2">
          <StatBar label="Podium" value={podiumPct} color="#4FC3F7" />
          <StatBar label="Top 10" value={top10Pct} color="#FFB74D" />
          <StatBar label="Fiabilité" value={reliabilityPct} color="#81C784" />
        </div>

        {/* Driver strengths */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {driver.carRating != null && (
            <StrengthBadge label="Écurie" value={driver.carRating.toFixed(2)} />
          )}
          {driver.driverSkill != null && (
            <StrengthBadge label="Pilote" value={driver.driverSkill.toFixed(2)} />
          )}
          {driver.qualiPace != null && (
            <StrengthBadge label="Qualif" value={driver.qualiPace.toFixed(2) + "%"} />
          )}
        </div>
      </div>
    </motion.article>
  );
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: value + "%", backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right font-mono text-[10px] font-bold tabular-nums" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

function StrengthBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
      {label}: {value}
    </span>
  );
}
