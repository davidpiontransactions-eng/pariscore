"use client";

import { ChevronLeft, ChevronRight, Search, Star } from "lucide-react";
import { matchDayLabel } from "@/lib/fotmob-filter";
import { cn } from "@/lib/utils";

/* ─── Barre filtre façon FotMob (thème clair mesuré, cf. T1) ───
   Datepicker jour −/+  +  En direct  +  Par heure (fenêtre)  +  recherche.
   « À la TV » volontairement absent : aucune donnée de diffusion. */

const C = {
  pillBg: "#ffffff", pillBorder: "#f0f0f0", text: "#222222", muted: "#717171",
  live: "#00985f", liveDot: "#e11d48", circleBg: "#f0f0f0",
} as const;

// ─── Segmented control horaire (E1 P1) : remplace le <select> — 1 tap, état
// toujours visible desktop + mobile (scroll-x). Clic sur l'actif = reset.
const HOUR_SEGS: { label: string; hours: number }[] = [
  { label: "≤1h", hours: 1 },
  { label: "≤2h", hours: 2 },
  { label: "≤4h", hours: 4 },
  { label: "≤8h", hours: 8 },
  { label: "≤16h", hours: 16 },
  { label: "≤24h", hours: 24 },
];

function HourSegments({ hours, onHours, count }: { hours: number | null; onHours: (h: number | null) => void; count?: number }) {
  return (
    <div
      className="flex shrink-0 items-center gap-1 overflow-x-auto"
      role="group"
      aria-label="Fenêtre horaire"
    >
      {HOUR_SEGS.map((o) => {
        const on = hours === o.hours;
        return (
          <button
            key={o.hours}
            type="button"
            onClick={() => onHours(on ? null : o.hours)}
            aria-pressed={on}
            aria-label={on ? `Filtre ${o.label} actif, désactiver` : `Matchs dans les ${o.hours} prochaines heures`}
            title={on ? "Désactiver le filtre horaire" : `Coup d'envoi dans les ${o.hours}h`}
            className="shrink-0 rounded-full border px-2.5 py-1.5 text-xs font-bold tabular-nums transition-colors active:scale-95"
            style={{
              backgroundColor: on ? C.live : C.pillBg,
              borderColor: on ? C.live : C.pillBorder,
              color: on ? "#ffffff" : C.text,
            }}
          >
            {on && count != null ? `${o.label} (${count})` : o.label}
          </button>
        );
      })}
    </div>
  );
}

export type FotmobFilterBarProps = {
  dateKey: string;
  todayKey: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  onPickDate: (key: string) => void;
  liveOnly: boolean;
  onToggleLive: () => void;
  hours: number | null;
  onHours: (h: number | null) => void;
  query: string;
  onQuery: (q: string) => void;
  /** Nombre de matchs après filtre (compteur affiché dans l'option active). */
  count?: number;
  /** Toggle "Top stratégies" : ne garde que les matchs corrélés au Top10. */
  topOnly: boolean;
  onToggleTop: () => void;
  /** Nombre de matchs Top corrélés (badge du toggle). */
  topCount?: number;
};

export function FotmobFilterBar(p: FotmobFilterBarProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Datepicker : hier / jour / demain */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button" onClick={p.onPrevDay} aria-label="Jour précédent"
          className="flex size-8 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
          style={{ backgroundColor: C.circleBg, color: C.text }}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-28 text-center text-sm font-medium" style={{ color: C.text }}>
          {matchDayLabel(p.dateKey, p.todayKey)}
        </span>
        <input
          type="date" value={p.dateKey} aria-label="Choisir la date"
          onChange={(e) => e.target.value && p.onPickDate(e.target.value)}
          className="h-8 rounded-full border px-2 text-xs"
          style={{ backgroundColor: C.pillBg, borderColor: C.pillBorder, color: C.text, colorScheme: "light" }}
        />
        <button
          type="button" onClick={p.onNextDay} aria-label="Jour suivant"
          className="flex size-8 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
          style={{ backgroundColor: C.circleBg, color: C.text }}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      {/* Filtres : En direct / Par heure / recherche */}
      <div className="flex items-center gap-2">
        <button
          type="button" onClick={p.onToggleLive} aria-pressed={p.liveOnly}
          className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            backgroundColor: p.liveOnly ? C.live : C.pillBg,
            borderColor: p.liveOnly ? C.live : C.pillBorder,
            color: p.liveOnly ? "#ffffff" : C.text,
          }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: p.liveOnly ? "#ffffff" : C.liveDot }}
            aria-hidden="true"
          />
          En direct
        </button>
        <HourSegments hours={p.hours} onHours={p.onHours} count={p.count} />
        {/* Toggle Top stratégies (E pill) : filtre les matchs corrélés au Top10. */}
        <button
          type="button"
          onClick={p.onToggleTop}
          aria-pressed={p.topOnly}
          aria-label={p.topOnly ? "Filtre Top stratégies actif, désactiver" : "Ne montrer que les matchs Top stratégies"}
          title="Matchs identifiés Top10 par stratégie"
          className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors active:scale-95"
          style={{
            backgroundColor: p.topOnly ? C.live : C.pillBg,
            borderColor: p.topOnly ? C.live : C.pillBorder,
            color: p.topOnly ? "#ffffff" : C.text,
          }}
        >
          <Star
            className="size-3.5"
            fill={p.topOnly ? "#ffffff" : C.live}
            style={{ color: p.topOnly ? "#ffffff" : C.live }}
            aria-hidden="true"
          />
          Top
          {p.topCount != null && p.topCount > 0 && (
            <span
              className="rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums"
              style={{
                backgroundColor: p.topOnly ? "#ffffff" : C.live,
                color: p.topOnly ? C.live : "#ffffff",
              }}
            >
              {p.topCount}
            </span>
          )}
        </button>
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border px-3 py-1.5"
          style={{ backgroundColor: C.pillBg, borderColor: C.pillBorder }}
        >
          <Search className="size-3.5 shrink-0" style={{ color: C.muted }} aria-hidden="true" />
          <input
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
            placeholder="Filtrer par équipe…"
            aria-label="Filtrer par équipe"
            className="w-full bg-transparent text-xs outline-none placeholder:text-[#9e9e9e]"
            style={{ color: C.text }}
          />
        </div>
      </div>
    </div>
  );
}
