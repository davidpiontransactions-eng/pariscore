"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number; // 0-100
  size?: number; // px
  stroke?: number; // px
  color: string; // hex
  trackColor?: string;
  animate?: boolean;
  durationMs?: number;
  children?: React.ReactNode; // center label
};

export function ProbabilityRing({
  value,
  size = 96,
  stroke = 8,
  color,
  trackColor,
  animate = true,
  durationMs = 1100,
  children,
}: Props) {
  const [progress, setProgress] = useState(() => (animate ? 0 : value));
  // Track the current displayed progress in a ref so subsequent value changes
  // animate FROM the current value (smooth live updates) rather than always
  // restarting from 0. On first mount the ref is 0, preserving the original
  // "reveal from 0" animation.
  const fromRef = useRef(animate ? 0 : value);

  useEffect(() => {
    if (!animate) return;
    let raf = 0;
    const start = performance.now();
    const from = fromRef.current;
    const to = value;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      fromRef.current = next;
      setProgress(next);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, animate, durationMs]);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Probabilité de victoire ${Math.round(value)}%`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor ?? "currentColor"}
          strokeOpacity={trackColor ? 1 : 0.12}
          strokeWidth={stroke}
        />
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
            transition: animate ? `stroke-dashoffset ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)` : undefined,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
