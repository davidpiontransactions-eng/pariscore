"use client";

import { cn } from "@/lib/utils";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";

/**
 * Barre de mode Prematch / Live — rendue indépendamment du SiteHeader.
 */
export function ModeToggle() {
  const headerMode = useSportsSidebarStore((s) => s.headerMode ?? "prematch");
  const setHeaderMode = useSportsSidebarStore((s) => s.setHeaderMode);

  return (
    <div id="mode-toggle-bar" className="flex items-center justify-center h-9 border-b border-purple-500/20 bg-white/80 backdrop-blur-sm sticky top-[96px] z-40">
      <div className="flex items-center gap-0.5 rounded-lg border border-[#E0D8F0] bg-white p-0.5">
        <button
          type="button"
          onClick={() => setHeaderMode("prematch")}
          className={cn(
            "px-3 py-1 text-xs font-semibold rounded-md transition-all",
            headerMode === "prematch"
              ? "bg-[#7B3FA0] text-white shadow-sm"
              : "text-[#6B5B8D] hover:text-[#1A1145]"
          )}
        >
          📅 Prematch
        </button>
        <button
          type="button"
          onClick={() => setHeaderMode("live")}
          className={cn(
            "px-3 py-1 text-xs font-semibold rounded-md transition-all",
            headerMode === "live"
              ? "bg-rose-500 text-white shadow-sm"
              : "text-[#6B5B8D] hover:text-[#1A1145]"
          )}
        >
          🔴 Live
        </button>
      </div>
    </div>
  );
}
