"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import type { ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useSportLiveCounts } from "@/hooks/use-sport-live-counts";
import { useSportPreferences } from "@/hooks/use-sport-preferences";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import {
  FootballPicto,
  TennisPicto,
  BasketballPicto,
  HockeyPicto,
  RugbyPicto,
  MmaPicto,
  CyclingPicto,
  HelmetPicto,
  BaseballPicto,
  CrosshairPicto,
  SnookerPicto,
  HandballPicto,
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
  { id: "hockey", label: "Hockey", icon: HockeyPicto },
  { id: "rugby", label: "Rugby", icon: RugbyPicto },
  { id: "mma", label: "MMA", icon: MmaPicto },
  { id: "cycling", label: "Cyclisme", icon: CyclingPicto },
  { id: "f1", label: "F1", icon: HelmetPicto },
  { id: "baseball", label: "Baseball", icon: BaseballPicto },
  { id: "cs2", label: "CS2", icon: CrosshairPicto },
  { id: "snooker", label: "Snooker", icon: SnookerPicto },
  { id: "handball", label: "Handball", icon: HandballPicto },
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
  const [showMore, setShowMore] = useState(false);

  // Sports favoris (localStorage, max 5)
  const allSportIds = useMemo(() => SPORT_TABS.map((t) => t.id), []);
  const { favorites, secondary, addFavorite } = useSportPreferences(allSportIds);

  // Tabs à afficher : favoris en premier
  const visibleTabs = useMemo(
    () => SPORT_TABS.filter((t) => favorites.includes(t.id)),
    [favorites]
  );
  const moreTabs = useMemo(
    () => SPORT_TABS.filter((t) => secondary.includes(t.id)),
    [secondary]
  );

  // Détection responsive
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ─── Compteur de matchs live par sport ────────────────────────────────────
  // Source unique : multisport-calendar (tous sports, polling 30s)
  const { counts: liveCounts } = useSportLiveCounts();

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

  // ─── Navigation clavier (roving tabindex) ────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const allTabs = [...visibleTabs, ...moreTabs];
      const currentIdx = allTabs.findIndex((t) => t.id === activeSport);
      if (currentIdx < 0) return;

      let nextIdx = currentIdx;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextIdx = (currentIdx + 1) % allTabs.length;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nextIdx = (currentIdx - 1 + allTabs.length) % allTabs.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIdx = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIdx = allTabs.length - 1;
      } else {
        return;
      }

      const nextSport = allTabs[nextIdx].id;
      onSportChange(nextSport);
      scrollToTab(nextSport);
    },
    [activeSport, visibleTabs, moreTabs, onSportChange, scrollToTab]
  );

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
      onKeyDown={handleKeyDown}
    >
      <div className="relative mx-auto flex h-full max-w-7xl items-center">
        {/* Conteneur scrollable sur mobile, centré sur desktop */}
        <div
          ref={scrollRef}
          className={cn(
            "flex h-full items-center gap-1 px-3",
            "overflow-x-auto snap-x snap-mandatory scrollbar-none",
            "md:mx-auto md:justify-center md:overflow-visible"
          )}
        >
          {visibleTabs.map((tab) => {
            const isActive = activeSport === tab.id;
            const liveCount = liveCounts[tab.id] ?? 0;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                data-sport={tab.id}
                role="tab"
                tabIndex={isActive ? 0 : -1}
                aria-selected={isActive}
                aria-label={tab.label}
                onClick={() => onSportChange(tab.id)}
                className={cn(
                  "relative flex h-full shrink-0 snap-start items-center gap-1.5 px-3",
                  "text-xs font-medium whitespace-nowrap",
                  "transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <LiveBadge count={liveCount} />

                {/* Barre active animée sous l'onglet */}
                {isActive && (
                  <motion.div
                    layoutId="sport-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            );
          })}

          {/* Bouton "Plus" — dropdown sports secondaires */}
          {moreTabs.length > 0 && (
            <div className="relative flex h-full items-center">
              <button
                onClick={() => setShowMore((v) => !v)}
                className={cn(
                  "flex h-full items-center gap-1 px-2.5 text-xs font-medium",
                  "text-muted-foreground hover:text-foreground transition-colors",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
                  showMore && "text-foreground"
                )}
                aria-expanded={showMore}
                aria-haspopup="true"
              >
                <span>Plus</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", showMore && "rotate-180")} />
              </button>

              <AnimatePresence>
                {showMore && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 z-50 mt-1 min-w-[140px] rounded-lg border border-border bg-popover p-1 shadow-lg"
                  >
                    {moreTabs.map((tab) => {
                      const liveCount = liveCounts[tab.id] ?? 0;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            addFavorite(tab.id);
                            onSportChange(tab.id);
                            setShowMore(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs",
                            "text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{tab.label}</span>
                          <LiveBadge count={liveCount} />
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
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