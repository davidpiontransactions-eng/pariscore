"use client";


import { motion } from "framer-motion";
import { Calendar, Scale } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ProbabilityRing } from "@/components/tennis/probability-ring";
import { cn } from "@/lib/utils";

export type MmaFight = {
  fighter_a: string;
  fighter_b: string;
  prob_a: number;
  prob_b: number;
  commence_time: string;
  weight_class?: string;
  event_name?: string;
  photo_a?: string;
  photo_b?: string;
};

type Props = {
  fight: MmaFight;
  index?: number;
};

const WEIGHT_CLASS_COLORS: Record<string, string> = {
  heavyweight: "#FF6B6B",
  light_heavyweight: "#FFA94D",
  middleweight: "#FFD43B",
  welterweight: "#69DB7C",
  lightweight: "#4DABF7",
  featherweight: "#9775FA",
  bantamweight: "#F783AC",
  flyweight: "#63E6BE",
};

function formatCommenceTime(iso: string): string {
  try {
    const d = parseISO(iso);
    return format(d, "MMM d, yyyy · HH:mm");
  } catch {
    return iso;
  }
}

export function MmaFightCard({ fight, index = 0 }: Props) {
  const probA = fight.prob_a != null ? Math.round(fight.prob_a * 100) : 50;
  const probB = fight.prob_b != null ? Math.round(fight.prob_b * 100) : 50;
  const wcColor = fight.weight_class
    ? WEIGHT_CLASS_COLORS[fight.weight_class.toLowerCase().replace(/\s+/g, "_")] ?? "#94A3B8"
    : "#94A3B8";

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: (index ?? 0) * 0.05, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10",
        "bg-[#1A1A2E] text-white shadow-lg",
        "transition-all duration-300",
        "hover:border-[#00E676]/60 hover:shadow-[0_0_20px_rgba(0,230,118,0.15)]",
        "focus-within:ring-2 focus-within:ring-[#00E676]/50 focus-within:ring-offset-2 focus-within:ring-offset-[#1A1A2E]"
      )}
    >
      {/* Inner glow overlay on hover */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(0,230,118,0.06) 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 px-5 py-5">
        {/* Main row: fighter A | VS | fighter B */}
        <div className="flex items-center justify-between gap-3">
          {/* Fighter A */}
          <div className="flex flex-1 flex-col items-center gap-2 text-center">
            {fight.photo_a ? (
              <img
                src={fight.photo_a}
                alt={fight.fighter_a}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-white/20"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-sm font-bold uppercase text-white/60">
                {fight.fighter_a
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")}
              </div>
            )}
            <span className="text-sm font-bold leading-tight tracking-tight">
              {fight.fighter_a}
            </span>
          </div>

          {/* VS divider */}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <ProbabilityRing
              value={probA}
              size={80}
              stroke={6}
              color="#00E676"
              trackColor="rgba(255,255,255,0.08)"
            >
              <span className="text-lg font-bold tabular-nums text-white">
                {probA}%
              </span>
            </ProbabilityRing>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
              VS
            </span>
            <ProbabilityRing
              value={probB}
              size={80}
              stroke={6}
              color="#FF6B6B"
              trackColor="rgba(255,255,255,0.08)"
            >
              <span className="text-lg font-bold tabular-nums text-white">
                {probB}%
              </span>
            </ProbabilityRing>
          </div>

          {/* Fighter B */}
          <div className="flex flex-1 flex-col items-center gap-2 text-center">
            {fight.photo_b ? (
              <img
                src={fight.photo_b}
                alt={fight.fighter_b}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-white/10"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-sm font-bold uppercase text-white/60">
                {fight.fighter_b
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")}
              </div>
            )}
            <span className="text-sm font-bold leading-tight tracking-tight">
              {fight.fighter_b}
            </span>
          </div>
        </div>

        {/* Event name + weight class */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/50">
          {fight.event_name && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span className="font-semibold uppercase tracking-[0.08em]">
                {fight.event_name}
              </span>
            </span>
          )}
          {fight.weight_class && (
            <span className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" style={{ color: wcColor }} />
              <span
                className="font-semibold uppercase tracking-[0.08em]"
                style={{ color: wcColor }}
              >
                {fight.weight_class}
              </span>
            </span>
          )}
        </div>

        {/* Commence time */}
        <div className="mt-2 text-center text-[11px] font-medium text-white/40">
          <Calendar className="mr-1.5 inline-block h-3 w-3 align-text-top" />
          {formatCommenceTime(fight.commence_time)}
        </div>
      </div>
    </motion.article>
  );
}
