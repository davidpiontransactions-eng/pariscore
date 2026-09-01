"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Probabilité de victoire (0-100) */
  value: number;
  /** Confiance du modèle (0-1) */
  confidence: number;
  /** Taille en px */
  size?: number;
  /** Épaisseur du stroke principal */
  stroke?: number;
  /** Couleur principale (hex) */
  color: string;
  trackColor?: string;
  animate?: boolean;
  durationMs?: number;
  children?: React.ReactNode;
};

/**
 * Anneau de confiance — ProbabilityRing augmentée avec un arc de confiance.
 * L'arc extérieur (plus fin) représente la confiance du modèle (0-1).
 * L'arc intérieur (plus épais) représente la probabilité de victoire (0-100).
 *
 * Convention visuelle :
 * - Arc principal (épais) = probabilité de victoire
 * - Arc extérieur (fin, opacité réduite) = confiance du modèle
 * - Plus la confiance est haute, plus l'arc extérieur est complet
 */
export function ConfidenceRing({
  value,
  confidence,
  size = 96,
  stroke = 8,
  color,
  trackColor,
  animate = true,
  durationMs = 1100,
  children,
}: Props) {
  const [progress, setProgress] = useState(() => (animate ? 0 : value));
  const [confProgress, setConfProgress] = useState(() => (animate ? 0 : confidence * 100));
  const fromRef = useRef(animate ? 0 : value);
  const confFromRef = useRef(animate ? 0 : confidence * 100);

  useEffect(() => {
    if (!animate) {
      setProgress(value);
      setConfProgress(confidence * 100);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = fromRef.current;
    const confFrom = confFromRef.current;
    const to = value;
    const confTo = confidence * 100;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      const confNext = confFrom + (confTo - confFrom) * eased;
      fromRef.current = next;
      confFromRef.current = confNext;
      setProgress(next);
      setConfProgress(confNext);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        confFromRef.current = confTo;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, confidence, animate, durationMs]);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress / 100);

  // Confiance: arc extérieur plus fin
  const confStroke = Math.max(2, stroke * 0.4);
  const confRadius = radius + stroke / 2 + confStroke / 2 + 1;
  const confCircumference = 2 * Math.PI * confRadius;
  const confDashOffset = confCircumference * (1 - confProgress / 100);

  // Couleur de la confiance: vert si > 0.7, amber si > 0.4, rouge sinon
  const confColor = confidence > 0.7 ? "#00e676" : confidence > 0.4 ? "#fbbf24" : "#ff3856";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Probabilité ${Math.round(value)}%, confiance ${Math.round(confidence * 100)}%`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Track confiance (extérieur) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={confRadius}
          fill="none"
          stroke={trackColor ?? "currentColor"}
          strokeOpacity={0.06}
          strokeWidth={confStroke}
        />

        {/* Arc confiance (extérieur) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={confRadius}
          fill="none"
          stroke={confColor}
          strokeWidth={confStroke}
          strokeLinecap="round"
          strokeDasharray={confCircumference}
          strokeDashoffset={confDashOffset}
          style={{
            transition: animate
              ? `stroke-dashoffset ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
              : undefined,
          }}
        />

        {/* Track principal (intérieur) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor ?? "currentColor"}
          strokeOpacity={trackColor ? 1 : 0.12}
          strokeWidth={stroke}
        />

        {/* Arc principal (intérieur) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: animate
              ? `stroke-dashoffset ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
              : undefined,
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
