"use client";

// ExgForecast — « Buts / Corners attendus pour les N prochaines minutes »
// (parité PackBall). Affiche l'espérance par camp sur une fenêtre courte, avec
// la probabilité Poisson d'au moins un but en complément.
//
// Distinction affichée volontairement : l'espérance (0.3) et la probabilité
// (26 %) ne sont pas le même chiffre et ne doivent pas se lire pareil. Le
// panneau les présente sur deux lignes séparées pour éviter la confusion
// classique « xG = probabilité ».

import { useMemo, useState } from "react";
import { CornerDownRight, Flag, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOT } from "./fotmob-theme";
import { forecastNextWindow, type NextWindowInput } from "@/lib/football-next-window-forecast";
import type { FootballLiveState } from "@/lib/football-data";

const WINDOWS = [5, 10, 15] as const;

function fmt(v: number): string {
  return v >= 10 ? v.toFixed(0) : v.toFixed(1);
}

/** Une ligne « espérance » : valeur home · valeur away + libellé. */
function ExpectRow({
  label,
  icon: Icon,
  home,
  away,
  unit,
  homeName,
  awayName,
  hot,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  home: number;
  away: number;
  unit?: string;
  homeName: string;
  awayName: string;
  hot?: boolean;
}) {
  const total = home + away;
  const homeW = total > 0 ? (home / total) * 100 : 50;
  return (
    <div
      className="rounded-xl border px-2.5 py-2"
      style={{ backgroundColor: hot ? FOT.liveSoft : FOT.card, borderColor: hot ? FOT.live : FOT.border }}
    >
      <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: FOT.muted }}>
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="flex items-center justify-between text-[13px] font-bold tabular-nums" style={{ color: FOT.ink }}>
        <span>
          {fmt(home)}
          {unit}
        </span>
        <span className="text-[11px] font-normal" style={{ color: FOT.muted }}>
          {homeName} · {awayName}
        </span>
        <span>
          {fmt(away)}
          {unit}
        </span>
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: FOT.border }}>
        <div className="transition-all" style={{ width: `${homeW}%`, backgroundColor: FOT.home }} />
        <div className="transition-all" style={{ width: `${100 - homeW}%`, backgroundColor: FOT.away, opacity: 0.7 }} />
      </div>
    </div>
  );
}

export function ExgForecast({
  live,
  prematch,
  homeName = "Domicile",
  awayName = "Extérieur",
  className,
}: {
  live: FootballLiveState;
  prematch?: { homeProb: number; drawProb: number } | null;
  homeName?: string;
  awayName?: string;
  className?: string;
}) {
  const [win, setWin] = useState(10);

  const input = useMemo<NextWindowInput>(
    () => ({
      minute: live.minute,
      homeXg: live.homeXg,
      awayXg: live.awayXg,
      homeScore: live.homeScore,
      awayScore: live.awayScore,
      homeCorners: live.homeCorners,
      awayCorners: live.awayCorners,
      homeRedCards: live.homeRedCards,
      awayRedCards: live.awayRedCards,
      prematch: prematch ?? null,
    }),
    [live, prematch],
  );

  const f = useMemo(() => forecastNextWindow(input, win), [input, win]);

  const ended = f.goals.home === 0 && f.goals.away === 0 && f.corners.home === 0;

  return (
    <div
      className={cn("rounded-2xl border p-3", className)}
      style={{ backgroundColor: FOT.card, borderColor: FOT.border }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: FOT.muted }}>
          <TrendingUp className="h-3.5 w-3.5" />
          Attendu d'ici la {f.endMinute}&prime;
        </h3>
        <div role="group" aria-label="Fenêtre de prévision" className="flex items-center gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={win === w}
              onClick={() => setWin(w)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
                win === w ? "text-foreground" : "text-muted-foreground/60 hover:text-muted-foreground",
              )}
              style={win === w ? { backgroundColor: FOT.soft } : undefined}
            >
              {w}&prime;
            </button>
          ))}
        </div>
      </div>

      {ended ? (
        <p className="py-3 text-center text-xs" style={{ color: FOT.muted }}>
          Match terminé — plus rien à prévoir
        </p>
      ) : (
        <div className="space-y-2">
          <ExpectRow
            label="Buts attendus"
            icon={Flag}
            home={f.goals.home}
            away={f.goals.away}
            homeName={homeName}
            awayName={awayName}
            hot={f.goalProb.home >= 40 || f.goalProb.away >= 40}
          />
          <ExpectRow
            label="Corners attendus"
            icon={CornerDownRight}
            home={f.corners.home}
            away={f.corners.away}
            homeName={homeName}
            awayName={awayName}
          />
          {/* Probabilité Poisson d'au moins 1 but — distincte de l'espérance. */}
          <p className="text-[10px] leading-snug" style={{ color: FOT.muted }}>
            P(au moins 1 but sur {f.window}&prime;) ≈ <strong>{f.goalProb.home}%</strong> {homeName} ·{" "}
            <strong>{f.goalProb.away}%</strong> {awayName}
            {f.thinData && " — début de match, estimation fragile"}
            {f.source === "league" && " — taux moyen ligue (pas de xG disponible)"}
            {f.source === "score" && " — d'après les buts déjà marqués (pas de xG)"}
          </p>
        </div>
      )}
    </div>
  );
}
