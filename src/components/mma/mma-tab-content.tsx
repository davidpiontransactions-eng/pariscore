"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  AlertCircle,
  RefreshCw,
  Loader2,
  Swords,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MmaFilters } from "./mma-filters";
import { MmaFightCard, type MmaFight } from "./mma-fight-card";

type MmaEvent = {
  event_date: string;
  event_name: string;
  fights: MmaFight[];
};

type ApiResponse = {
  fights: MmaEvent[];
  source?: string;
};

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-[#1A1A2E] p-5">
      <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-white/10" />
      <div className="mx-auto mb-2 h-4 w-32 rounded bg-white/10" />
      <div className="mx-auto mb-1 h-3 w-24 rounded bg-white/10" />
      <div className="mx-auto h-3 w-36 rounded bg-white/10" />
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
      <p className="mb-1 text-lg font-semibold text-white">
        Données MMA indisponibles
      </p>
      <p className="mb-6 text-sm text-zinc-400">
        L'API des cotes MMA ne répond pas pour le moment.
      </p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
      >
        <RefreshCw className="h-4 w-4" />
        Réessayer
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Swords className="mb-4 h-12 w-12 text-zinc-600" />
      <p className="text-lg font-semibold text-white">
        Aucun combat à venir
      </p>
      <p className="text-sm text-zinc-400">
        Revenez plus tard pour les prochains événements UFC/MMA.
      </p>
    </div>
  );
}

function EventSection({
  event,
  defaultOpen,
}: {
  event: MmaEvent;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-[#1A1A2E]/60"
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-zinc-400" />
          <div>
            <span className="font-semibold text-white">
              {event.event_name}
            </span>
            <span className="ml-3 text-sm text-zinc-400">
              {event.fights.length} combat{event.fights.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-zinc-400 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-5 pb-5">
              {event.fights.map((fight, i) => (
                <MmaFightCard key={`${fight.fighter_a}-${fight.fighter_b}`} fight={fight} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function MmaTabContent() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weightClass, setWeightClass] = useState("All");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mma/fights");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = data?.fights
    ?.map((ev) => ({
      ...ev,
      fights:
        weightClass === "All"
          ? ev.fights
          : ev.fights.filter(
              (f) =>
                f.weight_class?.toLowerCase().replace(/\s+/g, "_") ===
                weightClass.toLowerCase().replace(/\s+/g, "_")
            ),
    }))
    .filter((ev) => ev.fights.length > 0);

  if (loading && !data) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4">
        <ErrorState onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <MmaFilters weightClass={weightClass} onWeightClassChange={setWeightClass} />

      {!filtered || filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <AnimatePresence mode="popLayout">
          {filtered.map((ev) => (
            <EventSection
              key={ev.event_name}
              event={ev}
              defaultOpen={filtered.length === 1}
            />
          ))}
        </AnimatePresence>
      )}

      {data?.source && (
        <p className="text-center text-xs text-zinc-600">
          Source: {data.source.replace("odds-api+ml", "The Odds API + ML")}
        </p>
      )}
    </div>
  );
}
