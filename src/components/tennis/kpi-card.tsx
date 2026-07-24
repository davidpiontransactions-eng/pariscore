"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  header?: ReactNode;
  icon?: ReactNode;
  label?: string;
  value: ReactNode;
  footer?: ReactNode;
  description?: ReactNode;
  badge?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
};

export function KpiCard({
  header,
  icon,
  label,
  value,
  footer,
  description,
  badge,
  trend,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4 min-h-[140px]",
        trend === "up" && "border-l-2 border-l-emerald-500",
        trend === "down" && "border-l-2 border-l-rose-500",
        className,
      )}
    >
      {header ?? (
        <div className="flex items-center gap-1.5">
          {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
          {label && (
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {label}
            </span>
          )}
          {badge && (
            <span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 text-[0.6rem] font-semibold text-accent">
              {badge}
            </span>
          )}
        </div>
      )}
      <div className="text-xl font-extrabold leading-tight tracking-tight text-foreground">
        {value}
      </div>
      {footer ?? (description && (
        <div className="mt-auto text-xs leading-relaxed text-muted-foreground">
          {description}
        </div>
      ))}
    </div>
  );
}