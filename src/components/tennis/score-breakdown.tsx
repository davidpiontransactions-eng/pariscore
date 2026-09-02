"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

type ScoreBreakdownProps = {
  score: number;
  breakdown: {
    closeness: number;
    tournamentImp: number;
    eloQuality: number;
    starPower: number;
    form: number;
    rivalry: number;
  };
  className?: string;
};

/**
 * Labels des signaux avec poids et description.
 */
const SIGNAL_LABELS: Record<
  string,
  { label: string; weight: number; description: string }
> = {
  closeness: {
    label: "Closeness",
    weight: 2.5,
    description: "Equilibre des forces (coinflip vs blowout)",
  },
  tournamentImp: {
    label: "Tournoi",
    weight: 3.0,
    description: "Importance du tournoi + round",
  },
  eloQuality: {
    label: "Elo Quality",
    weight: 2.0,
    description: "Niveau moyen des joueurs",
  },
  starPower: {
    label: "Star Power",
    weight: 2.0,
    description: "Rang ATP/WTA des joueurs",
  },
  form: {
    label: "Forme",
    weight: 1.5,
    description: "5 derniers resultats",
  },
  rivalry: {
    label: "Rivalite",
    weight: 0.5,
    description: "Historique H2H",
  },
};

/**
 * Affiche le score brut (0-1) d'un signal sous forme de barre.
 */
function SignalBar({
  value,
  label,
  weight,
  description,
}: {
  value: number;
  label: string;
  weight: number;
  description: string;
}) {
  const pct = Math.round(value * 100);
  const weighted = Math.round(value * weight * 10) / 10;

  return (
    <div className="group relative flex items-center gap-2">
      {/* Barre */}
      <div className="h-1.5 w-16 rounded-full bg-white/5">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            pct >= 80
              ? "bg-emerald-500"
              : pct >= 50
                ? "bg-sky-500"
                : "bg-zinc-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Label + score */}
      <span className="flex-1 text-[10px] text-muted-foreground">{label}</span>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
        {weighted.toFixed(1)}
      </span>

      {/* Tooltip au hover */}
      <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-48 rounded-lg border border-border/60 bg-popover p-2 text-xs shadow-lg group-hover:block">
        <p className="font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-muted-foreground">{description}</p>
        <p className="mt-1 text-[10px]">
          Valeur: {(value * 100).toFixed(0)}% x Poids {weight} ={" "}
          <span className="font-semibold text-emerald-400">{weighted}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Tooltip/panel affichant le breakdown complet du score 0-10.
 *
 * Utilise pour la transparence : l'utilisateur voit POURQUOI
 * un match est classe "TOP MATCH" ou "FEATURED".
 *
 * Affiche chaque signal avec :
 * - Barre visuelle 0-100%
 * - Label + poids
 * - Score pondere (value x weight)
 * - Description au hover
 */
export function ScoreBreakdown({
  score,
  breakdown,
  className,
}: ScoreBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const entries = Object.entries(breakdown) as [
    string,
    number,
  ][];

  return (
    <div className={cn("relative inline-flex", className)}>
      {/* Bouton trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <Info className="h-3 w-3" />
        <span>Score</span>
      </button>

      {/* Panel breakdown */}
      {isOpen && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-border/60 bg-popover p-3 shadow-xl animate-in fade-in slide-in-from-bottom-1 duration-150">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Score: {score.toFixed(1)}/10
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground/50 hover:text-muted-foreground"
            >
              <span className="sr-only">Fermer</span>
              x
            </button>
          </div>

          {/* Signaux */}
          <div className="space-y-1.5">
            {entries.map(([key, value]) => {
              const meta = SIGNAL_LABELS[key];
              if (!meta) return null;
              return (
                <SignalBar
                  key={key}
                  value={value}
                  label={meta.label}
                  weight={meta.weight}
                  description={meta.description}
                />
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-2 border-t border-border/40 pt-2">
            <p className="text-[10px] text-muted-foreground/50">
              Score = tanh(Somme(poids x signal)) x 10
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
