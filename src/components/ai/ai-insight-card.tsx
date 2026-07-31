"use client";

import { Star, Sparkles, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Factor = {
  label: string;
  value: string;
};

export type AIInsightCardProps = {
  matchName?: string;
  insight?: string;
  factors?: Factor[];
  edge?: number;
  confidence?: number; // 1–5 scale
  className?: string;
};

// ---------------------------------------------------------------------------
// Demo data (French)
// ---------------------------------------------------------------------------

const DEMO: Required<Omit<AIInsightCardProps, "className">> = {
  matchName: "Sinner vs Alcaraz — Wimbledon Final",
  insight:
    "Le modèle détecte une value significative (+15%) sur Sinner. L'écart s'explique par la sous-estimation du marché de son jeu sur gazon (72% win rate surface vs 65% implied). L'IC 95% est étroit [62-74], ce qui renforce la fiabilité.",
  factors: [
    { label: "Surface gazon", value: "+8% edge" },
    { label: "Forme récente", value: "5-0 (W)" },
    { label: "H2H vs Alcaraz", value: "3-2 favorable" },
    { label: "Elo surface", value: "+45 vs Elo global" },
  ],
  edge: 15,
  confidence: 4,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderStars(rating: number, max = 5): React.ReactNode {
  return Array.from({ length: max }, (_, i) => (
    <Star
      key={i}
      className={cn(
        "h-3.5 w-3.5",
        i < Math.round(rating)
          ? "fill-amber-400 text-amber-400"
          : "fill-muted-foreground/20 text-muted-foreground/30"
      )}
    />
  ));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIInsightCard({
  matchName,
  insight,
  factors,
  edge,
  confidence,
  className,
}: AIInsightCardProps) {
  const m = matchName ?? DEMO.matchName;
  const i = insight ?? DEMO.insight;
  const f = factors ?? DEMO.factors;
  const e = edge ?? DEMO.edge;
  const c = confidence ?? DEMO.confidence;

  const hasEdge = e > 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-purple-500/20 bg-card p-4",
        className
      )}
    >
      {/* Ambient purple glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl"
      />

      {/* ── Header ── */}
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-400">
          <Sparkles className="h-3 w-3" />
          Gemini AI Insight
        </span>
      </div>

      {/* ── Match name ── */}
      <h3 className="mb-2 text-sm font-semibold tracking-tight">{m}</h3>

      {/* ── Insight text ── */}
      <p className="text-sm leading-relaxed text-muted-foreground">{i}</p>

      {/* ── Factors grid ── */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {f.map((factor) => (
          <div
            key={factor.label}
            className="flex flex-col rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5"
          >
            <span className="text-[11px] leading-tight text-muted-foreground">
              {factor.label}
            </span>
            <span className="text-sm font-semibold text-emerald-400">
              {factor.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Footer: edge badge + confidence stars ── */}
      <div className="mt-3 flex items-center justify-between border-t border-purple-500/10 pt-3">
        {/* Edge badge */}
        <div className="flex items-center gap-1.5">
          {hasEdge ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              Value détectée
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              Aucune value
            </span>
          )}
          <span
            className={cn(
              "text-xs font-mono font-semibold",
              hasEdge ? "text-emerald-400" : "text-muted-foreground"
            )}
          >
            {hasEdge ? "+" : ""}
            {e}% edge
          </span>
        </div>

        {/* Confidence stars */}
        <div className="flex items-center gap-1">
          <span className="mr-0.5 text-[11px] text-muted-foreground">
            Confiance
          </span>
          <div className="flex items-center gap-0.5" aria-label={`${c}/5 confidence`}>
            {renderStars(c)}
          </div>
        </div>
      </div>
    </div>
  );
}
