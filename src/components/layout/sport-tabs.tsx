"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLiveMatches } from "@/hooks/use-live-matches";
import { useFootballMatches } from "@/hooks/use-football-matches";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import {
  FootballPicto,
  TennisPicto,
  BasketballPicto,
  RugbyPicto,
  MmaPicto,
  CyclingPicto,
  HelmetPicto,
  BaseballPicto,
  CrosshairPicto,
  SnookerPicto,
} from "@/components/ui/sport-pictograms";

// ─── Définition d'un onglet sport ────────────────────────────────────────────
type SportTab = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

// ─── Liste des sports supportés (pictos SVG originaux, pas d'emoji) ──────────
const SPORT_TABS: SportTab[] = [
  { id: "football", label: "Football", icon: FootballPicto },
  { id: "tennis", label: "Tennis", icon: TennisPicto },
  { id: "basketball", label: "Basketball", icon: BasketballPicto },
  { id: "rugby", label: "Rugby", icon: RugbyPicto },
  { id: "mma", label: "MMA", icon: MmaPicto },
  { id: "cycling", label: "Cyclisme", icon: CyclingPicto },
  { id: "f1", label: "F1", icon: HelmetPicto },
  { id: "baseball", label: "Baseball", icon: BaseballPicto },
  { id: "cs2", label: "CS2", icon: CrosshairPicto },
  { id: "snooker", label: "Snooker", icon: SnookerPicto },
] as const;

// ─── Props du composant ──────────────────────────────────────────────────────
type SportTabsProps = {
  activeSport: string;
  onSportChange: (sport: string) => void;
  className?: string;
};

// ─── Badge nombre de matchs live ─────────────────────────────────────────────
function LiveBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "ml-1 inline-flex h-4 min-w-4 items-center justify-center",
        "rounded-full bg-rose-500/20 px-1 text-[10px] font-semibold leading-none text-rose-400",
        "tabular-nums"
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────
export function SportTabs({
  activeSport,
  onSportChange,
  className,
}: SportTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });

  // Détection responsive
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ─── Compteur de matchs live par sport ────────────────────────────────────
  // useLiveMatches fournit les matchs tennis live.
  // useFootballMatches fournit les matchs football (certains live).
  const { liveMatchList: tennisLive } = useLiveMatches();
  const { data: footballData } = useFootballMatches();

  const liveCounts = useMemo(() => {
    const counts: Record<string, number> = {
      football: 0,
      tennis: 0,
      basketball: 0,
      rugby: 0,
      mma: 0,
      cycling: 0,
      f1: 0,
      baseball: 0,
      cs2: 0,
      snooker: 0,
    };

    // Tennis live — le hook expose directement les matchs en cours
    counts.tennis = tennisLive.filter((m) => m.isLive).length;

    // Football live — les matchs marqués live dans la réponse API
    if (footballData?.matches) {
      counts.football = footballData.matches.filter(
        (m) => m.live && m.live.status !== "FT"
      ).length;
    }

    return counts;
  }, [tennisLive, footballData]);

  // ─── Scroll vers l'onglet actif (mobile) ─────────────────────────────────
  const scrollToTab = useCallback(
    (tabId: string) => {
      if (!scrollRef.current) return;
      const el = scrollRef.current.querySelector(`[data-sport="${tabId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    },
    []
  );

  // Scroll automatique quand l'actif change
  useEffect(() => {
    if (isMobile) scrollToTab(activeSport);
  }, [activeSport, isMobile, scrollToTab]);

  // ─── Rendu ────────────────────────────────────────────────────────────────
  return (
    <LiquidGlass
      tier="tier1"
      noSheen
      className={cn(
        "sticky top-0 z-40",
        "h-10",
        "border-b border-white/[0.04]",
        className
      )}
      role="tablist"
      aria-label="Navigation par sport"
    >
      <div className="relative mx-auto flex h-full max-w-7xl items-center">
        {/* Conteneur scrollable sur mobile, centré sur desktop */}
        <div
          ref={scrollRef}
          className={cn(
            "flex h-full items-center gap-1 px-3",
            "overflow-x-auto scrollbar-none",
            "md:mx-auto md:justify-center md:overflow-visible"
          )}
        >
          {SPORT_TABS.map((tab) => {
            const isActive = activeSport === tab.id;
            const liveCount = liveCounts[tab.id] ?? 0;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                data-sport={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                onClick={() => onSportChange(tab.id)}
                className={cn(
                  "relative flex h-full shrink-0 items-center gap-1.5 px-3",
                  "text-xs font-medium whitespace-nowrap",
                  "transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#7B3FA0]/50",
                  isActive
                    ? "text-[#7B3FA0]"
                    : "text-[#6B5B8D] hover:text-[#1A1145]"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <LiveBadge count={liveCount} />

                {/* Barre active animée sous l'onglet */}
                {isActive && (
                  <motion.div
                    layoutId="sport-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7B3FA0]"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Fade gradient sur le bord droit (mobile uniquement) */}
        <div
          className={cn(
            "pointer-events-none absolute right-0 top-0 h-full w-8",
            "bg-gradient-to-l from-white to-transparent",
            "md:hidden"
          )}
          aria-hidden="true"
        />
      </div>
    </LiquidGlass>
  );
}
