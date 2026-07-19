"use client";

import { motion } from "framer-motion";
import {
  Volleyball,
  Footprints,
  Swords,
  Bike,
  Gauge,
  Crosshair,
  Target,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TabDef = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

const TABS: TabDef[] = [
  { id: "tennis", label: "Tennis", icon: Volleyball, accent: "bg-emerald-500" },
  { id: "football", label: "Football", icon: Footprints, accent: "bg-sky-500" },
  { id: "cs2", label: "CS2", icon: Crosshair, accent: "bg-orange-500" },
  { id: "mma", label: "MMA", icon: Swords, accent: "bg-red-500" },
  { id: "nba", label: "NBA", icon: Target, accent: "bg-sky-600" },
  { id: "wnba", label: "WNBA", icon: Trophy, accent: "bg-purple-500" },
  { id: "cycling", label: "Cycling", icon: Bike, accent: "bg-amber-500" },
  { id: "f1", label: "F1", icon: Gauge, accent: "bg-red-600" },
] as const;

type SportTabsProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
};

export function SportTabs({ activeTab, onTabChange }: SportTabsProps) {
  return (
    <nav
      className="relative flex w-full overflow-x-auto bg-[#0F0F1A] scrollbar-hide"
      role="tablist"
      aria-label="Sport selection"
    >
      <div className="flex min-w-max items-center gap-1 px-4 py-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors duration-200",
                isActive
                  ? "text-white"
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
