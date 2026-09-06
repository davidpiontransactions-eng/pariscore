"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveMatches } from "@/hooks/use-live-matches";
import { useFootballMatches } from "@/hooks/use-football-matches";
import { LiquidGlass } from "@/components/ui/liquid-glass";

// ─── Définition d'un onglet sport ────────────────────────────────────────────
type SportTab = {
  id: string;
  label: string;
  emoji: string;
};

// ─── Liste des sports supportés ──────────────────────────────────────────────
const SPORT_TABS: SportTab[] = [
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "tennis", label: "Tennis", emoji: "🎾" },
  { id: "basketball", label: "Basketball", emoji: "🏀" },
  { id: "rugby", label: "Rugby", emoji: "🏉" },
  { id: "mma", label: "MMA", emoji: "🥊" },
  { id: "cycling", label: "Cyclisme", emoji: "🚴" },
  { id: "f1", label: "F1", emoji: "🏎️" },
  { id: "baseball", label: "Baseball", emoji: "⚾" },
  { id: "cs2", label: "CS2", emoji: "🎯" },
] as const;

// Nombre d'onglets visibles sur mobile avant le menu "Plus"
const MOBILE_VISIBLE_COUNT = 6;

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
  const [showMore, setShowMore] = useState(false);
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

  // ─── Onglets visibles et menu "Plus" sur mobile ──────────────────────────
  const visibleTabs = isMobile
    ? SPORT_TABS.slice(0, MOBILE_VISIBLE_COUNT)
    : SPORT_TABS;
  const overflowTabs = isMobile
    ? SPORT_TABS.slice(MOBILE_VISIBLE_COUNT)
    : [];

  const hasOverflow = overflowTabs.length > 0;
  const overflowActive = hasOverflow && overflowTabs.some((t) => t.id === activeSport);

  // Fermer le dropdown "Plus" si on clique ailleurs
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showMore) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMore]);

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
          {visibleTabs.map((tab) => {
            const isActive = activeSport === tab.id;
            const liveCount = liveCounts[tab.id] ?? 0;

            return (
              <button
                key={tab.id}
                data-sport={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSportChange(tab.id)}
                className={cn(
                  "relative flex h-full items-center gap-1.5 px-3",
                  "text-xs font-medium whitespace-nowrap",
                  "transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#7B3FA0]/50",
                  isActive
                    ? "text-[#7B3FA0]"
                    : "text-[#6B5B8D] hover:text-[#1A1145]"
                )}
              >
                <span className="text-sm leading-none">{tab.emoji}</span>
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

          {/* Menu "Plus" pour les sports débordants sur mobile */}
          {hasOverflow && (
            <div ref={moreRef} className="relative">
              <button
                onClick={() => setShowMore((v) => !v)}
                className={cn(
                  "flex h-full items-center gap-1 px-3",
                  "text-xs font-medium whitespace-nowrap",
                  "transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#7B3FA0]/50",
                  overflowActive
                    ? "text-[#7B3FA0]"
                    : "text-[#6B5B8D] hover:text-[#1A1145]"
                )}
                aria-expanded={showMore}
                aria-haspopup="true"
              >
                <span>Plus</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-150",
                    showMore && "rotate-180"
                  )}
                />
              </button>

              {/* Dropdown */}
              {showMore && (
                <div
                  className={cn(
                    "absolute right-0 top-full z-50 mt-1",
                    "min-w-[140px] rounded-lg",
                    "border border-[#E0D8F0] bg-white shadow-xl shadow-black/10",
                    "py-1"
                  )}
                  role="menu"
                >
                  {overflowTabs.map((tab) => {
                    const isActive = activeSport === tab.id;
                    const liveCount = liveCounts[tab.id] ?? 0;

                    return (
                      <button
                        key={tab.id}
                        role="menuitem"
                        onClick={() => {
                          onSportChange(tab.id);
                          setShowMore(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-1.5",
                          "text-xs font-medium",
                          "transition-colors duration-100",
                          isActive
                            ? "bg-[#7B3FA0]/10 text-[#7B3FA0]"
                            : "text-[#1A1145] hover:bg-[#EDE8F5] hover:text-[#1A1145]"
                        )}
                      >
                        <span className="text-sm">{tab.emoji}</span>
                        <span>{tab.label}</span>
                        <LiveBadge count={liveCount} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fade gradient sur le bord droit (mobile uniquement) */}
        <div
          className={cn(
            "pointer-events-none absolute right-0 top-0 h-full w-8",
            "bg-gradient-to-l from-[#0e121e] to-transparent",
            "md:hidden"
          )}
          aria-hidden="true"
        />
      </div>
    </LiquidGlass>
  );
}
