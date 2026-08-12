"use client";

import { useCallback, useRef } from "react";
import { SportTabs } from "@/components/layout/sport-tabs";

// Matches the tab order defined in SportTabs:
// tennis → football → cs2 → mma → nba → wnba → cycling → f1
const TAB_ORDER = [
  "tennis",
  "football",
  "cs2",
  "mma",
  "nba",
  "wnba",
  "cycling",
  "f1",
  "baseball",
] as const;

type SportSwipeHeaderProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
};

/**
 * Wraps the existing SportTabs with touch-swipe gesture support so users
 * can swipe left/right to cycle through sports on mobile devices.
 *
 * A minimum horizontal drag of 50 px triggers the tab change.
 */
export function SportSwipeHeader({
  activeTab,
  onTabChange,
}: SportSwipeHeaderProps) {
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      touchStartX.current = e.touches[0].clientX;
    },
    [],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (touchStartX.current === null) return;

      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      touchStartX.current = null;

      // Ignore vertical swipes or taps
      if (Math.abs(deltaX) < 50) return;

      const currentIdx = TAB_ORDER.indexOf(activeTab as (typeof TAB_ORDER)[number]);
      if (currentIdx === -1) return;

      if (deltaX < 0) {
        // Swipe left → next tab (wrap around)
        const nextIdx = (currentIdx + 1) % TAB_ORDER.length;
        onTabChange(TAB_ORDER[nextIdx]);
      } else {
        // Swipe right → previous tab (wrap around)
        const prevIdx = (currentIdx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
        onTabChange(TAB_ORDER[prevIdx]);
      }
    },
    [activeTab, onTabChange],
  );

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="touch-pan-y"
    >
      <SportTabs activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
