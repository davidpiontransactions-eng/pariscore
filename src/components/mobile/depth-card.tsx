import { type ReactNode, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * DepthCard
 *
 * Carte avec effet de profondeur 3D au hover.
 * Pattern "Interactive 3D Models" 2026 — version CSS-only (0 dépendance).
 * Utilise perspective + rotateX/Y pour simuler la 3D.
 *
 * Usage :
 * <DepthCard>
 *   <img src="match.jpg" />
 *   <div className="p-4">Match info</div>
 * </DepthCard>
 *
 * <DepthCard intensity={15} glowColor="emerald">
 *   <BigNumber value={73} suffix="%" />
 * </DepthCard>
 */

type DepthCardProps = {
  children: ReactNode;
  className?: string;
  /** Intensité de la rotation (défaut: 10deg) */
  intensity?: number;
  /** Activer le glow au hover */
  glow?: boolean;
  /** Couleur du glow */
  glowColor?: "emerald" | "sky" | "purple" | "amber";
  /** Perspective en px (défaut: 800) */
  perspective?: number;
};

const GLOW_COLORS = {
  emerald: "rgba(0, 230, 118, 0.15)",
  sky: "rgba(56, 189, 248, 0.15)",
  purple: "rgba(168, 85, 247, 0.15)",
  amber: "rgba(251, 191, 36, 0.15)",
};

export function DepthCard({
  children,
  className,
  intensity = 10,
  glow = true,
  glowColor = "emerald",
  perspective = 800,
}: DepthCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const rotateX = ((e.clientY - centerY) / (rect.height / 2)) * -intensity;
      const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * intensity;

      setRotation({ x: rotateX, y: rotateY });
    },
    [intensity]
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setRotation({ x: 0, y: 0 });
  }, []);

  return (
    <div
      style={{ perspective: `${perspective}px` }}
      className={cn("relative", className)}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "relative rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden",
          "transition-transform duration-200 ease-out will-change-transform"
        )}
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Glow overlay */}
        {glow && isHovered && (
          <div
            className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${GLOW_COLORS[glowColor]}, transparent 70%)`,
              opacity: 0.5,
            }}
          />
        )}

        {/* Content */}
        <div className="relative z-20">{children}</div>
      </div>
    </div>
  );
}

/**
 * DepthCardGroup
 *
 * Groupe de DepthCards avec perspective partagée.
 *
 * Usage :
 * <DepthCardGroup>
 *   <DepthCard>Card 1</DepthCard>
 *   <DepthCard>Card 2</DepthCard>
 * </DepthCardGroup>
 */

type DepthCardGroupProps = {
  children: ReactNode;
  className?: string;
};

export function DepthCardGroup({ children, className }: DepthCardGroupProps) {
  return (
    <div
      className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6", className)}
      style={{ perspective: "1200px" }}
    >
      {children}
    </div>
  );
}
