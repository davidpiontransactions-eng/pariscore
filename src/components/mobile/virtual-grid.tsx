import { useState, useRef, useCallback, useMemo, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * VirtualGrid
 *
 * Grille virtualisée pour les listes de matchs longues.
 * Rend uniquement les éléments visibles + buffer, comme react-window
 * mais sans dépendance externe.
 *
 * Pattern : IntersectionObserver + placeholder height pour maintenir
 * le scroll naturel. Les éléments hors viewport ont un placeholder
 * avec la bonne hauteur pour que le scrollbar soit correct.
 *
 * Usage :
 * <VirtualGrid items={matches} renderItem={(m) => <MatchCard match={m} />} />
 */

type Props<T> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  /** Nombre de colonnes sur desktop (défaut: 2) */
  columns?: number;
  /** Hauteur estimée par élément en px (pour le placeholder) */
  estimatedHeight?: number;
  /** Buffer : nombre d'éléments à charger avant/après le viewport */
  buffer?: number;
  /** Classe CSS de la grille */
  className?: string;
  /** Clé unique par élément */
  keyExtractor?: (item: T, index: number) => string;
};

export function VirtualGrid<T>({
  items,
  renderItem,
  columns = 2,
  estimatedHeight = 200,
  buffer = 4,
  className,
  keyExtractor,
}: Props<T>) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(buffer * 2 + 10, items.length) });
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Sentinel element for infinite scroll detection
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Update visible range based on scroll position
  const updateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;

    const startIdx = Math.max(0, Math.floor(scrollTop / estimatedHeight) - buffer);
    const endIdx = Math.min(
      items.length,
      Math.ceil((scrollTop + viewportHeight) / estimatedHeight) + buffer
    );

    setVisibleRange({ start: startIdx, end: endIdx });
  }, [items.length, estimatedHeight, buffer]);

  // Observe sentinel for load-more
  useEffect(() => {
    if (!sentinelRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleRange((prev) => ({
            start: prev.start,
            end: Math.min(items.length, prev.end + 10),
          }));
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [items.length]);

  // Scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      requestAnimationFrame(updateVisibleRange);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [updateVisibleRange]);

  // Initial range
  useEffect(() => {
    updateVisibleRange();
  }, [updateVisibleRange]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end);
  }, [items, visibleRange.start, visibleRange.end]);

  const totalHeight = items.length * estimatedHeight;
  const offsetY = visibleRange.start * estimatedHeight;

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-y-auto", className)}
      style={{ height: "100%" }}
    >
      {/* Placeholder pour maintenir la hauteur totale du scroll */}
      <div style={{ height: totalHeight }} className="absolute inset-x-0 top-0" />

      {/* Grid container positionné */}
      <div
        className={cn(
          "grid gap-5",
          columns === 1 && "grid-cols-1",
          columns === 2 && "grid-cols-1 lg:grid-cols-2",
          columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          columns === 4 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
        )}
        style={{
          transform: `translateY(${offsetY}px)`,
          position: "relative",
        }}
      >
        {visibleItems.map((item, idx) => {
          const actualIndex = visibleRange.start + idx;
          const key = keyExtractor ? keyExtractor(item, actualIndex) : `vg-${actualIndex}`;
          return (
            <div key={key} style={{ minHeight: estimatedHeight }}>
              {renderItem(item, actualIndex)}
            </div>
          );
        })}
      </div>

      {/* Sentinel pour infinite scroll */}
      {visibleRange.end < items.length && (
        <div ref={sentinelRef} className="h-10" />
      )}
    </div>
  );
}
