"use client";

import { cn } from "@/lib/utils";

type Outcome = "W" | "L";

type Props = {
  form: Outcome[];
  color: string;
  size?: "sm" | "md";
  ariaLabel?: string;
};

/**
 * Recent form as colored dots (● for W, ○ for L).
 * Most recent last. Reads left-to-right = oldest-to-newest.
 */
export function FormDots({ form, color, size = "sm", ariaLabel }: Props) {
  const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={ariaLabel ?? `Forme : ${form.join(", ")}`}
    >
      {form.map((res, i) => (
        <span
          key={i}
          className={cn("rounded-full transition-colors", dotSize)}
          style={{
            background: res === "W" ? color : "transparent",
            border: res === "L" ? `1.5px solid ${color}80` : "none",
            opacity: res === "W" ? 1 : 0.5,
          }}
          title={res === "W" ? "Victoire" : "Défaite"}
        />
      ))}
    </div>
  );
}
