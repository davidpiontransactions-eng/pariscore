"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SportId } from "@/lib/sport-images";
import {
  TennisPicto,
  FootballPicto,
  CrosshairPicto,
  MmaPicto,
  BasketballPicto,
  CyclingPicto,
  HelmetPicto,
  BaseballPicto,
  RugbyPicto,
} from "@/components/ui/sport-pictograms";

type TabDef = {
  id: SportId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

const TABS: TabDef[] = [
  { id: "home", label: "Accueil", icon: Home, accent: "bg-emerald-600" },
  { id: "tennis", label: "Tennis", icon: TennisPicto, accent: "bg-emerald-500" },
  { id: "football", label: "Football", icon: FootballPicto, accent: "bg-sky-500" },
  { id: "cs2", label: "CS2", icon: CrosshairPicto, accent: "bg-orange-500" },
  { id: "mma", label: "MMA", icon: MmaPicto, accent: "bg-red-500" },
  { id: "nba", label: "NBA", icon: BasketballPicto, accent: "bg-sky-600" },
  { id: "wnba", label: "WNBA", icon: BasketballPicto, accent: "bg-purple-500" },
  { id: "cycling", label: "Cycling", icon: CyclingPicto, accent: "bg-amber-500" },
  { id: "f1", label: "F1", icon: HelmetPicto, accent: "bg-red-600" },
  { id: "baseball", label: "Baseball", icon: BaseballPicto, accent: "bg-amber-500" },
  { id: "rugby", label: "Rugby", icon: RugbyPicto, accent: "bg-teal-500" },
] as const;

type SportTabsProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
};

export function SportTabs({ activeTab, onTabChange }: SportTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Roving tabindex : ←/→/Home/End déplacent le focus ET sélectionnent l'onglet
  // (activation automatique, pattern ARIA tabs). Le focus reste synchronisé
  // avec l'onglet actif.
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = TABS.length;
    let next: number;
    switch (e.key) {
      case "ArrowRight":
        next = (index + 1) % count;
        break;
      case "ArrowLeft":
        next = (index - 1 + count) % count;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    onTabChange(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <nav
      className="relative flex w-full overflow-x-auto bg-[#0F0F1A] scrollbar-hide"
      role="tablist"
      aria-label="Sport selection"
    >
      <div className="relative z-10 flex min-w-max items-center gap-1 px-4 py-2.5">
        {TABS.map((tab, index) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors duration-200",
                isActive
                  ? "text-emerald-400"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="sport-tab-indicator"
                  className={cn(
                    "absolute bottom-0 left-1/2 h-0.5 w-3/5 -translate-x-1/2 rounded-full",
                    tab.accent
                  )}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 35,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
