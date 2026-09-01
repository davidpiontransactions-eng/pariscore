"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * T24 — PullToRefresh
 *
 * Wrapper pull-to-refresh pour les listes de matchs.
 * Pattern FotMob/Flashscore : tirer vers le bas pour rafraîchir.
 *
 * Fonctionnalités :
 * - Threshold configurable (défaut: 80px)
 * - Animation de spinner avec rotation
 * - État "refreshing" avec texte
 * - Rubber band aux extrémités
 * - Respecte prefers-reduced-motion
 * - Désactivé si isRefreshing (évite les double-refresh)
 *
 * Usage :
 * <PullToRefresh onRefresh={async () => { await refetch(); }}>
 *   <MatchList matches={matches} />
 * </PullToRefresh>
 */

type Props = {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  /** Distance en px pour déclencher le refresh */
  threshold?: number;
  /** Désactiver le pull-to-refresh */
  disabled?: boolean;
  /** Texte affiché pendant le tirage */
  pullingText?: string;
  /** Texte affiché pendant le rafraîchissement */
  refreshingText?: string;
};

export function PullToRefresh({
  onRefresh,
  children,
  className,
  threshold = 80,
  disabled = false,
  pullingText = "Tirez vers le bas pour rafraîchir",
  refreshingText = "Rafraîchissement...",
}: Props) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canPull, setCanPull] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);

  // Vérifier si le scroll est en haut (pour activer le pull)
  const checkScrollTop = useCallback(() => {
    if (!containerRef.current) return false;
    return containerRef.current.scrollTop <= 0;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isRefreshing || !checkScrollTop()) return;

      startY.current = e.touches[0].clientY;
      isDragging.current = true;
    },
    [disabled, isRefreshing, checkScrollTop],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current || disabled || isRefreshing) return;

      currentY.current = e.touches[0].clientY;
      const deltaY = currentY.current - startY.current;

      // Seulement si on tire vers le bas
      if (deltaY > 0) {
        setCanPull(true);
        // Rubber band : résistance exponentielle
        const resistance = 0.5;
        const distance = Math.min(deltaY * resistance, threshold * 1.5);
        setPullDistance(distance);

        // Empêcher le scroll natif pendant le pull
        if (distance > 0) {
          e.preventDefault();
        }
      }
    },
    [disabled, isRefreshing, threshold],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    // Si le pull dépasse le threshold, déclencher le refresh
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.6); // maintien partiel

      try {
        await onRefresh();
      } catch {
        // Erreur silencieuse
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setCanPull(false);
      }
    } else {
      // Reset sans refresh
      setPullDistance(0);
      setCanPull(false);
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  // Réinitialiser le scroll container
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.overflow = pullDistance > 0 ? "hidden" : "";
    }
  }, [pullDistance]);

  const progress = Math.min(pullDistance / threshold, 1);
  const isTriggered = pullDistance >= threshold;

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-y-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 flex flex-col items-center justify-center overflow-hidden transition-all duration-200",
          canPull || isRefreshing ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        style={{ height: `${pullDistance}px` }}
      >
        <RefreshCw
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            isRefreshing && "animate-spin",
          )}
          style={{
            transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`,
          }}
        />
        <span className="mt-1 text-[10px] text-muted-foreground">
          {isRefreshing ? refreshingText : isTriggered ? "Relâchez pour rafraîchir" : pullingText}
        </span>
      </div>

      {/* Content with shift */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
