"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Shield,
  Goal,
  Lock,
  TrendingUp,
  Crosshair,
  Swords,
  ShieldCheck,
  FlagTriangleRight,
  TrendingDown,
} from "lucide-react";
import type { FootballMatch } from "@/lib/football-data";
import type { CornervalueLeague, CornervalueTeam } from "@/hooks/use-cornervalue-stats";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Clés des 10 presets de filtres rapides. */
export type TopTeamPreset =
  | "top1x2"
  | "doubleChance"
  | "over15"
  | "under35"
  | "ppg15"
  | "topSot"
  | "topAttack"
  | "topDefense"
  | "topCorners"
  | "lowCorners";

export interface PresetDef {
  key: TopTeamPreset;
  label: string;
  icon: React.ReactNode;
  tooltip: string;
  unavailable?: boolean;
}

// ---------------------------------------------------------------------------
// Définitions des presets
// ---------------------------------------------------------------------------

const PRESETS: PresetDef[] = [
  { key: "top1x2", label: "Top 1X2", icon: <Trophy className="h-3.5 w-3.5" />, tooltip: "Meilleur taux de victoire (Home/Away)" },
  { key: "doubleChance", label: "Double Chance", icon: <Shield className="h-3.5 w-3.5" />, tooltip: "Taux de non-défaite le plus élevé" },
  { key: "over15", label: "Over 1.5", icon: <Goal className="h-3.5 w-3.5" />, tooltip: "≥ 80% de matchs avec au moins 2 buts" },
  { key: "under35", label: "Under 3.5", icon: <Lock className="h-3.5 w-3.5" />, tooltip: "≥ 85% de matchs à ≤ 3 buts" },
  { key: "ppg15", label: "PPG ≥ 1.5", icon: <TrendingUp className="h-3.5 w-3.5" />, tooltip: "Au moins 1.5 points par match en moyenne" },
  { key: "topSot", label: "Top Tirs Cadrés", icon: <Crosshair className="h-3.5 w-3.5" />, tooltip: "Meilleure moyenne de tirs cadrés par match", unavailable: true },
  { key: "topAttack", label: "Top Attaque", icon: <Swords className="h-3.5 w-3.5" />, tooltip: "Meilleure moyenne de buts marqués par match" },
  { key: "topDefense", label: "Top Défense", icon: <ShieldCheck className="h-3.5 w-3.5" />, tooltip: "Moins de buts concédés par match" },
  { key: "topCorners", label: "Top Corners", icon: <FlagTriangleRight className="h-3.5 w-3.5" />, tooltip: "Plus haute moyenne de corners obtenus" },
  { key: "lowCorners", label: "− Corners", icon: <TrendingDown className="h-3.5 w-3.5" />, tooltip: "Plus faible moyenne de corners par match" },
];
// ---------------------------------------------------------------------------
// Logique de filtrage par preset
// ---------------------------------------------------------------------------

function fuzzyKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Trouve les stats Cornervalue pour une équipe (fuzzy match). */
function findCVTeam(teamName: string, cvData?: CornervalueLeague): CornervalueTeam | undefined {
  if (!cvData?.teams) return undefined;
  const key = fuzzyKey(teamName);
  return cvData.teams.find((t) => fuzzyKey(t.teamName) === key);
}

/** Filtre les matchs selon le preset actif, avec donnees Cornervalue optionnelles. */
export function applyPresetFilter(
  matches: FootballMatch[],
  preset: TopTeamPreset | null,
  cvData?: CornervalueLeague,
): { filtered: FootballMatch[]; count: number } {
  if (!preset) return { filtered: matches, count: matches.length };

  const filtered = matches.filter((m) => {
    const st = m.prediction.standingStats;
    const ms = m.prediction.metricStats;

    switch (preset) {
      case "top1x2": {
        if (st) {
          const homeWR = st.home.played > 0 ? st.home.wins / st.home.played : 0;
          const awayWR = st.away.played > 0 ? st.away.wins / st.away.played : 0;
          return homeWR >= 0.5 || awayWR >= 0.5;
        }
        return m.prediction.homeProb >= 50 || m.prediction.awayProb >= 50;
      }
      case "doubleChance":
        return (m.prediction.doubleChance?.prob ?? 0) >= 65;
      case "over15":
        return (m.prediction.over15Prob ?? 0) >= 80;
      case "under35":
        return (m.prediction.under35Prob ?? 0) >= 85;
      case "ppg15":
        if (st) {
          return (
            (st.home.played > 0 && st.home.ppg >= 1.5) ||
            (st.away.played > 0 && st.away.ppg >= 1.5)
          );
        }
        return false;
      case "topSot": {
        if (!ms) return false;
        const h = ms.home.sot.for.value;
        const a = ms.away.sot.for.value;
        return (h !== null && h >= 5) || (a !== null && a >= 5);
      }
      case "topAttack":
        if (st) {
          const hGpg = st.home.played > 0 ? st.home.goalsFor / st.home.played : 0;
          const aGpg = st.away.played > 0 ? st.away.goalsFor / st.away.played : 0;
          return hGpg >= 2.0 || aGpg >= 2.0;
        }
        return false;
      case "topDefense":
        if (st) {
          const hGa = st.home.played > 0 ? st.home.goalsAgainst / st.home.played : 99;
          const aGa = st.away.played > 0 ? st.away.goalsAgainst / st.away.played : 99;
          return hGa <= 0.8 || aGa <= 0.8;
        }
        return false;
      case "topCorners": {
        // Priorite: donnees reelles Cornervalue > prediction modele
        if (cvData) {
          const homeCv = findCVTeam(m.home.name, cvData);
          const awayCv = findCVTeam(m.away.name, cvData);
          const homeAvg = homeCv?.avgCornersFT ?? homeCv?.avgCornersFor;
          const awayAvg = awayCv?.avgCornersFT ?? awayCv?.avgCornersFor;
          if (homeAvg !== null && homeAvg !== undefined && awayAvg !== null && awayAvg !== undefined) {
            return (homeAvg + awayAvg) / 2 >= 10; // Moyenne >= 10 corners FT
          }
          // Fallback: over 7.5 hit rate >= 65%
          const homeO75 = homeCv?.hitRates?.["over7_5"];
          const awayO75 = awayCv?.hitRates?.["over7_5"];
          if (homeO75 || awayO75) {
            const maxPct = Math.max(homeO75?.pct ?? 0, awayO75?.pct ?? 0);
            return maxPct >= 65;
          }
        }
        return (m.prediction.bestCornerOver?.overProb ?? 0) >= 65;
      }
      case "lowCorners": {
        if (cvData) {
          const homeCv = findCVTeam(m.home.name, cvData);
          const awayCv = findCVTeam(m.away.name, cvData);
          const homeAvg = homeCv?.avgCornersFT;
          const awayAvg = awayCv?.avgCornersFT;
          if (homeAvg !== null && homeAvg !== undefined && awayAvg !== null && awayAvg !== undefined) {
            return (homeAvg + awayAvg) / 2 <= 8; // Moyenne <= 8 corners FT
          }
        }
        return (m.prediction.bestCornerOver?.overProb ?? 100) <= 35;
      }
      default:
        return true;
    }
  });

  return { filtered, count: filtered.length };
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function TopTeamsPresetsBar({
  matches,
  activePreset,
  onPresetChange,
  cvData,
}: {
  matches: FootballMatch[];
  activePreset: TopTeamPreset | null;
  onPresetChange: (preset: TopTeamPreset | null) => void;
  cvData?: CornervalueLeague;
}) {
  const result = useMemo(
    () => applyPresetFilter(matches, activePreset, cvData),
    [matches, activePreset, cvData],
  );

  return (
    <div className="space-y-2">
      {/* Pills horizontales scrollables */}
      <div className="flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => onPresetChange(null)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            activePreset === null
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40",
          )}
        >
          Tous
        </button>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPresetChange(activePreset === p.key ? null : p.key)}
            disabled={p.unavailable}
            title={p.unavailable ? "Données bientôt disponibles" : p.tooltip}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              p.unavailable && "cursor-not-allowed opacity-40",
              activePreset === p.key
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40",
            )}
          >
            {p.icon}
            {p.label}
          </button>
        ))}
      </div>

      {/* Badge récapitulatif */}
      {activePreset && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-medium">
            {PRESETS.find((p) => p.key === activePreset)?.icon}
            <span>
              Filtre actif : {PRESETS.find((p) => p.key === activePreset)?.label}
            </span>
          </span>
          <span>
            ({result.count} match{result.count > 1 ? "s" : ""})
          </span>
        </div>
      )}
    </div>
  );
}
