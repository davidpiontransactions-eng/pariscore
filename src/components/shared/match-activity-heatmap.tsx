"use client";

import { cn } from "@/lib/utils";

export type HeatmapCell = {
  /** Label de la zone (ex: "Def. Gauche", "Milieu Central") */
  zone: string;
  /** Valeur d'activité (0-100) */
  value: number;
  /** Nombre d'actions (optionnel, pour tooltip) */
  actions?: number;
};

type Props = {
  /** Données heatmap — 6 zones de terrain typiques */
  data: HeatmapCell[];
  /** Label du joueur */
  playerName?: string;
  className?: string;
};

/**
 * Heatmap d'activité terrain — grille 3x2 (défense, milieu, attaque × gauche, droite).
 * Affiche l'intensité d'activité par zone avec dégradé de couleur.
 *
 * Convention :
 * - Vert foncé = haute activité
 * - Vert moyen = activité moyenne
 * - Gris = faible activité
 * - Fond sombre pour contraste
 */

const ZONE_ORDER = [
  "Attaque Droite",
  "Attaque Central",
  "Attaque Gauche",
  "Milieu Droite",
  "Milieu Central",
  "Milieu Gauche",
  "Défense Droite",
  "Défense Central",
  "Défense Gauche",
];

const ZONE_GRID: (string | null)[][] = [
  // Ligne haute (attaque) — vue depuis le haut du terrain
  ["Attaque Gauche", "Attaque Central", "Attaque Droite"],
  // Ligne milieu
  ["Milieu Gauche", "Milieu Central", "Milieu Droite"],
  // Ligne défense
  ["Défense Gauche", "Défense Central", "Défense Droite"],
];

function getIntensityColor(value: number): string {
  if (value >= 80) return "bg-emerald-500/80";
  if (value >= 60) return "bg-emerald-500/60";
  if (value >= 40) return "bg-emerald-500/40";
  if (value >= 20) return "bg-emerald-500/20";
  return "bg-emerald-500/8";
}

function getIntensityTextColor(value: number): string {
  if (value >= 60) return "text-white";
  if (value >= 30) return "text-emerald-300";
  return "text-muted-foreground";
}

export function MatchActivityHeatmap({
  data,
  playerName,
  className,
}: Props) {
  // Index les données par zone
  const dataByZone = new Map(data.map((d) => [d.zone, d]));

  return (
    <div className={cn("w-full", className)}>
      <header className="mb-2 flex items-baseline justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Activité terrain
        </h4>
        {playerName && (
          <span className="text-[10px] text-muted-foreground">{playerName}</span>
        )}
      </header>

      <div className="grid grid-cols-3 gap-1">
        {ZONE_GRID.map((row, rowIdx) =>
          row.map((zone) => {
            if (!zone) return <div key={`${rowIdx}-${zone}`} />;
            const cell = dataByZone.get(zone);
            const value = cell?.value ?? 0;

            return (
              <div
                key={zone}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-md py-1.5 px-1",
                  getIntensityColor(value),
                  "transition-colors duration-300",
                )}
                title={cell?.actions ? `${zone}: ${cell.actions} actions` : zone}
              >
                <span className={cn("text-[9px] font-medium leading-tight text-center", getIntensityTextColor(value))}>
                  {zone.split(" ")[0]}
                </span>
                <span className={cn("font-mono text-[10px] font-bold tabular-nums", getIntensityTextColor(value))}>
                  {value}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Légende */}
      <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[8px] text-muted-foreground">
        <span>Faible</span>
        <div className="flex gap-0.5">
          {[8, 20, 40, 60, 80].map((v) => (
            <div
              key={v}
              className={cn("h-2 w-3 rounded-sm", getIntensityColor(v))}
            />
          ))}
        </div>
        <span>Fort</span>
      </div>
    </div>
  );
}
