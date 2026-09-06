"use client";

import { useRef, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

interface ScrollRevealProps {
  children: ReactNode;
  direction?: "up" | "down" | "left" | "right";
  delay?: number;
  duration?: number;
  className?: string;
  as?: React.ElementType;
}

/**
 * Wrapper générique — révèle son contenu au scroll.
 * Utilise CSS animation-timeline: view() (native, zero JS).
 * Réspecte prefers-reduced-motion.
 */
export function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  duration = 600,
  className,
  as: Component = "div",
}: ScrollRevealProps) {
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  if (prefersReduced) {
    return (
      <Component className={cn("opacity-100", className)}>
        {children}
      </Component>
    );
  }

  const animationName = {
    up: "scroll-reveal-up",
    down: "scroll-reveal-down",
    left: "scroll-reveal-left",
    right: "scroll-reveal-right",
  }[direction];

  return (
    <Component
      ref={ref}
      className={cn(
        "scroll-reveal",
        `scroll-reveal-${direction}`,
        className
      )}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
        animationName,
      }}
    >
      {children}
    </Component>
  );
}