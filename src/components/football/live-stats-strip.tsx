"use client";

// LiveStatsStrip — bandeau de stats live façon PackBall : une rangée de chips
// défilables, chacune avec icône + libellé + valeur domicile/extérieur.
//
// Complément à LiveStatsBreakdown (qui est une table détaillée avec jauges et
// seuils funnel) : le strip sert la LECTURE RAPIDE — « où on en est » en un
// coup d'œil, avant de faire défiler le détail.
//
// Contrôle qualité des données (règle « pas de zéros silencieux ») : une stat
// non fournie par la source est rendue "—", jamais 0. Une chip n'est affichée
// que si au moins un des deux camps a une valeur.

import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CornerDownRight,
  Crosshair,
  Flame,
  Goal,
  Target,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FOT } from "./fotmob-theme";
import type { FootballLiveState } from "@/lib/football-data";

type Nullable = number | null | undefined;

const num = (v: Nullable): number | null => (v != null && Number.isFinite(v) ? v : null);

/** Une case du bandeau. */
type Chip = {
  key: string;
  label: string;
  home: number | null;
  away: number | null;
  /** Formatage : % pour possession, décimale pour xG, entier sinon. */
  format?: "int" | "pct" | "dec1";
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  /** Couleur d'accent de l'icône (défaut : couleur du libellé). */
  accent?: string;
};

/** Somme jaunes + rouges ; null si la source ne fournit aucune carte. */
function sumCards(yellow: Nullable, red: Nullable): number | null {
  if (yellow == null && red == null) return null;
  return (yellow ?? 0) + (red ?? 0);
}

function formatValue(v: number | null, format: Chip["format"]): string {
  if (v == null) return "—";
  if (format === "pct") return `${Math.round(v)}%`;
  if (format === "dec1") return v.toFixed(1);
  return String(Math.round(v));
}

export function LiveStatsStrip({
  live,
  homeName = "Domicile",
  awayName = "Extérieur",
  className,
}: {
  live: FootballLiveState;
  homeName?: string;
  awayName?: string;
  className?: string;
}) {
  const chips = useMemo<Chip[]>(() => {
    const out: Chip[] = [
      { key: "shots", label: "Coups", home: num(live.homeShots), away: num(live.awayShots), icon: Activity },
      { key: "sot", label: "Tirs cadrés", home: num(live.homeShotsOnTarget), away: num(live.awayShotsOnTarget), icon: Crosshair },
      { key: "corners", label: "Corners", home: num(live.homeCorners), away: num(live.awayCorners), icon: CornerDownRight },
      { key: "poss", label: "Possession", home: num(live.homePossession), away: num(live.homePossession) != null ? 100 - live.homePossession : null, format: "pct", icon: TrendingUp },
      { key: "cards", label: "Cartes", home: sumCards(live.homeYellowCards, live.homeRedCards), away: sumCards(live.awayYellowCards, live.awayRedCards), icon: AlertTriangle, accent: "#eab308" },
      { key: "goals", label: "Buts", home: num(live.homeScore), away: num(live.awayScore), icon: Goal },
      { key: "dangerous", label: "Att. dangereuses", home: num(live.homeDangerousAttacks), away: num(live.awayDangerousAttacks), icon: Flame },
      { key: "attacks", label: "Attaques", home: num(live.homeAttacks), away: num(live.awayAttacks), icon: Target },
    ];
    // On ne garde que les chips ayant au moins une valeur réelle.
    return out.filter((c) => c.home != null || c.away != null);
  }, [live]);

  if (!chips.length) {
    return (
      <div
        className={cn("flex h-11 items-center justify-center rounded-2xl border text-xs", className)}
        style={{ backgroundColor: FOT.card, borderColor: FOT.border, color: FOT.muted }}
      >
        Stats indisponibles
      </div>
    );
  }

  return (
    <div
      className={cn("overflow-x-auto", className)}
      style={{ backgroundColor: FOT.card, borderColor: FOT.border }}
    >
      <ul
        className="flex min-w-max items-stretch divide-x"
        style={{ borderColor: FOT.border }}
        aria-label="Statistiques live du match"
      >
        {chips.map((c) => {
          const Icon = c.icon;
          return (
            <li
              key={c.key}
              className="flex min-w-[5.5rem] flex-col items-center gap-0.5 px-2.5 py-1.5"
              title={`${c.label} — ${homeName} vs ${awayName}`}
            >
              <span
                className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider"
                style={{ color: FOT.muted }}
              >
                <Icon className="h-3 w-3 shrink-0" style={c.accent ? { color: c.accent } : undefined} />
                <span className="truncate">{c.label}</span>
              </span>
              <span
                className="flex items-baseline gap-1 text-[13px] font-bold tabular-nums"
                style={{ color: FOT.ink }}
              >
                <span>{formatValue(c.home, c.format)}</span>
                <span aria-hidden="true" style={{ color: FOT.muted }}>·</span>
                <span>{formatValue(c.away, c.format)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
