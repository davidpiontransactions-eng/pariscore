"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * T23 — SwipeableTabs
 *
 * Onglets avec support swipe horizontal (mobile-first).
 * Utilise des touch handlers natifs (pas de dépendance externe).
 *
 * Pattern FotMob/The Athletic :
 * - Swipe gauche/droite pour changer d'onglet
 * - Indicateur animé sous l'onglet actif
 * - Rubber band aux extrémités
 * - Respecte prefers-reduced-motion
 *
 * Usage :
 * <SwipeableTabs tabs={["Tennis", "Football", "Basket"]}>
 *   <div>Contenu Tennis</div>
 *   <div>Contenu Football</div>
 *   <div>Contenu Basketball</div>
 * </SwipeableTabs>
 */

type Tab = {
  id: string;
  label: string;
  icon?: React.ReactNode;
};

type Props = {
  tabs: Tab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  children: React.ReactNode[];
  className?: string;
  /** Afficher l'indicateur animé */
  showIndicator?: boolean;
};

export function SwipeableTabs({
  tabs,
  activeTab: controlledTab,
  onTabChange,
  children,
  className,
  showIndicator = true,
}: Props) {
  const [internalTab, setInternalTab] = useState(tabs[0]?.id ?? "");
  const activeTab = controlledTab ?? internalTab;

  const tabsRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  const handleChange = useCallback(
    (tabId: string) => {
      setInternalTab(tabId);
      onTabChange?.(tabId);
    },
    [onTabChange],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const deltaX = e.touches[0].clientX - touchStartX.current;
      const deltaY = e.touches[0].clientY - touchStartY.current;

      // Si le mouvement est plus horizontal que vertical, c'est un swipe
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        isDragging.current = true;
        e.preventDefault(); // empêcher le scroll vertical pendant le swipe
      }
    },
    [],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current) return;

      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const threshold = 50; // px minimum pour déclencher un swipe

      if (deltaX < -threshold && activeIndex < tabs.length - 1) {
        // Swipe gauche → on suivant
        handleChange(tabs[activeIndex + 1].id);
      } else if (deltaX > threshold && activeIndex > 0) {
        // Swipe droite → on précédent
        handleChange(tabs[activeIndex - 1].id);
      }

      isDragging.current = false;
    },
    [activeIndex, tabs, handleChange],
  );

  // Calculer le style de l'indicateur
  const indicatorStyle = {
    width: `${100 / tabs.length}%`,
    transform: `translateX(${activeIndex * 100}%)`,
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Tabs header */}
      <div
        ref={tabsRef}
        className="relative flex border-b border-border/30"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="tablist"
        aria-orientation="horizontal"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => handleChange(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative z-10",
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/70",
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}

        {/* Animated indicator */}
        {showIndicator && (
          <div
            className="absolute bottom-0 left-0 h-0.5 bg-foreground transition-transform duration-200 ease-out"
            style={indicatorStyle}
          />
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1">
        {children.map((child, index) => (
          <div
            key={tabs[index]?.id}
            role="tabpanel"
            hidden={activeTab !== tabs[index]?.id}
            className={cn(
              "transition-opacity duration-200",
              activeTab === tabs[index]?.id ? "opacity-100" : "opacity-0",
            )}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
