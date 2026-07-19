"use client";

import { motion } from "framer-motion";
import { MapPin, Mountain, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type StageData = {
  stage: number;
  date: string;
  route: string;
  km: number;
  type: string;
  elev: number;
  country: string;
};

export type RiderFavourite = {
  name: string;
  prob: number;
  team: string;
  photo?: string;
};

type Props = {
  stage: StageData;
  favourites?: RiderFavourite[];
  priority?: boolean;
  index?: number;
};

const TYPE_COLORS: Record<string, string> = {
  ITT: "border-purple-500/30 bg-purple-500/15 text-purple-400",
  TTT: "border-indigo-500/30 bg-indigo-500/15 text-indigo-400",
  Mountain: "border-orange-500/30 bg-orange-500/15 text-orange-400",
  Flat: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
  Hilly: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  Hills: "border-amber-500/30 bg-amber-500/15 text-amber-400",
};

const RANK_COLORS = ["text-amber-400", "text-gray-300", "text-orange-500"] as const;
const RANK_BG = ["bg-amber-500/20", "bg-gray-400/20", "bg-orange-600/20"] as const;
const BAR_GRADIENTS = [
  "from-amber-500 to-amber-400",
  "from-gray-400 to-gray-300",
  "from-orange-500 to-orange-400",
] as const;

export function CyclingStageCard({
  stage,
  favourites = [],
  priority = false,
  index = 0,
}: Props) {
  const top3 = [...favourites].sort((a, b) => b.prob - a.prob).slice(0, 3);
  const maxProb = top3.length > 0 ? Math.max(...top3.map((r) => r.prob)) : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-[#1A1A2E] transition-all hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5",
      )}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-500/0 via-amber-500/40 to-amber-500/0" />

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 text-sm font-extrabold text-amber-400 tabular-nums">
              {stage.stage}
            </span>
            <div>
              <span className="text-sm font-semibold text-white">
                &Eacute;tape {stage.stage}
              </span>
              <p className="text-[11px] text-gray-400">{stage.date}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]",
              TYPE_COLORS[stage.type] ??
                "border-gray-500/30 bg-gray-500/15 text-gray-400",
            )}
          >
            {stage.type === "Hills" ? "Hilly" : stage.type}
          </Badge>
        </div>
        <h3 className="mb-3 text-base font-semibold leading-snug text-white">
          {stage.route}
        </h3>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
            <span className="font-medium tabular-nums">{stage.km}</span> km
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Mountain className="h-3.5 w-3.5 text-gray-500" />
            <span className="font-medium tabular-nums">{stage.elev}</span> m D+
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-gray-500" />
            {stage.country}
          </span>
        </div>
        {top3.length > 0 && (
          <div className="mt-4 border-t border-border/40 pt-3.5">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">
              Favoris du mod&egrave;le
            </p>
            <div className="space-y-2.5">
              {top3.map((rider, i) => (
                <div key={rider.name} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                      RANK_BG[i],
                      RANK_COLORS[i],
                    )}
                  >
                    {i + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {rider.photo ? (
                          <img
                            src={rider.photo}
                            alt=""
                            className="h-4 w-4 shrink-0 rounded-full object-cover"
                          />
                        ) : null}
                        <span className="truncate text-[13px] font-medium text-white">
                          {rider.name}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-amber-400">
                        {rider.prob.toFixed(1)}%
                      </span>
                    </div>

                    <div className="relative h-1.5 overflow-hidden rounded-full bg-gray-700/50">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: Math.max(2, (rider.prob / maxProb) * 100) + "%",
                        }}
                        transition={{
                          duration: 0.8,
                          delay: 0.15 + i * 0.1,
                          ease: "easeOut",
                        }}
                        className={cn(
                          "h-full rounded-full bg-gradient-to-r",
                          BAR_GRADIENTS[i],
                        )}
                      />
                    </div>

                    <p className="mt-0.5 truncate text-[10px] text-gray-500">
                      {rider.team}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function CyclingStageCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-[#1A1A2E] p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 animate-pulse rounded-full bg-gray-700/50" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-20 animate-pulse rounded bg-gray-700/50" />
            <div className="h-3 w-16 animate-pulse rounded bg-gray-700/30" />
          </div>
        </div>
        <div className="h-5 w-14 animate-pulse rounded-full bg-gray-700/40" />
      </div>
      <div className="mb-3 h-4 w-3/4 animate-pulse rounded bg-gray-700/50" />
      <div className="mb-4 flex gap-4">
        <div className="h-3.5 w-16 animate-pulse rounded bg-gray-700/30" />
        <div className="h-3.5 w-16 animate-pulse rounded bg-gray-700/30" />
        <div className="h-3.5 w-20 animate-pulse rounded bg-gray-700/30" />
      </div>
      <div className="border-t border-border/40 pt-3.5">
        <div className="mb-2.5 h-3 w-24 animate-pulse rounded bg-gray-700/30" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="h-5 w-5 animate-pulse rounded-full bg-gray-700/40" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-28 animate-pulse rounded bg-gray-700/50" />
                <div className="h-1.5 w-full animate-pulse rounded-full bg-gray-700/40" />
                <div className="h-2.5 w-20 animate-pulse rounded bg-gray-700/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
