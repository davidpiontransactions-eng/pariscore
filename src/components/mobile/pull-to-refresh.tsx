import { useState, useRef, useCallback, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PullToRefresh
 *
 * Composant mobile-first pour pull-to-refresh.
 * Pattern natif iOS/Android avec rubber band et spinner animé.
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
  /** Distance minimale en px pour déclencher le refresh */
  threshold?: number;
  /** Couleur du spinner */
  color?: string;
};

export function PullToRefresh({
  onRefresh,
  children,
  className,
  threshold = 80,
  color = "text-emerald-400",
}: Props) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isAtTop = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    if (!el) return;
    // Vérifier si on est tout en haut du scroll
    isAtTop.current = el.scrollTop <= 0;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isRefreshing) return;
      if (!isAtTop.current) return;

      const deltaY = e.touches[0].clientY - touchStartY.current;
      if (deltaY > 0) {
        // Rubber band : ralentir après le threshold
        const distance = Math.min(deltaY * 0.5, threshold * 1.5);
        setPullDistance(distance);
      }
    },
    [isRefreshing, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (isRefreshing) return;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  // Afficher le spinner si pullDistance > 0
  const showSpinner = pullDistance > 20 || isRefreshing;
  const progress = Math.min(pullDistance / threshold, 1);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-y-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Spinner indicator */}
      {showSpinner && (
        <div
          className="flex justify-center py-3 transition-opacity"
          style={{ opacity: isRefreshing ? 1 : progress }}
        >
          <RefreshCw
            className={cn(
              "h-5 w-5",
              color,
              isRefreshing && "animate-spin"
            )}
            style={{
              transform: isRefreshing
                ? undefined
                : `rotate(${progress * 360}deg)`,
            }}
          />
          {isRefreshing && (
            <span className="ml-2 text-xs text-zinc-400">Actualisation...</span>
          )}
        </div>
      )}

      {/* Contenu avec offset dynamique */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.3}px)` : undefined,
          transition: pullDistance === 0 ? "transform 0.2s ease-out" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
