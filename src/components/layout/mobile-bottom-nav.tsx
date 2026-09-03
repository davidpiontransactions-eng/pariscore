"use client";

import { motion } from "framer-motion";
import { Home, Radio, Gem, Star, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLiveMatches } from "@/hooks/use-live-matches";

type TabDef = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

const TABS: TabDef[] = [
  { id: "home", label: "Accueil", icon: Home, accent: "bg-emerald-600" },
  { id: "live", label: "Live", icon: Radio, accent: "bg-red-500" },
  { id: "value", label: "Value", icon: Gem, accent: "bg-emerald-500" },
  { id: "favoris", label: "Favoris", icon: Star, accent: "bg-amber-500" },
  { id: "profil", label: "Profil", icon: User, accent: "bg-sky-500" },
] as const;

type MobileBottomNavProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
};

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  const isMobile = useIsMobile();
  const { liveMatchList } = useLiveMatches();
  const liveCount = liveMatchList.filter((m) => m.isLive).length;

  if (!isMobile) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0e17]/90 backdrop-blur-md border-t border-white/10 pb-[env(safe-area-inset-bottom)] mobile-bottom-nav"
      role="navigation"
      aria-label="Navigation principale"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const isLive = tab.id === "live";

          return (
            <button
              key={tab.id}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full py-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "text-white"
                  : "text-zinc-400 hover:text-zinc-300"
              )}
            >
              {/* Accent bar at top of tab */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className={cn(
                    "absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full",
                    tab.accent
                  )}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 35,
                  }}
                />
              )}

              {/* Icon with optional live count badge */}
              <span className="relative inline-flex">
                <Icon className="h-5 w-5" />
                {isLive && liveCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white shadow-sm shadow-red-500/30">
                    {liveCount}
                  </span>
                )}
              </span>

              <span className="text-[11px] font-medium leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
