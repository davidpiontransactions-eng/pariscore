"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { matchDayLabel } from "@/lib/fotmob-filter";
import { cn } from "@/lib/utils";

/* ─── Barre filtre façon FotMob (thème clair mesuré, cf. T1) ───
   Datepicker jour −/+  +  En direct  +  Par heure (fenêtre)  +  recherche.
   « À la TV » volontairement absent : aucune donnée de diffusion. */

const C = {
  pillBg: "#ffffff", pillBorder: "#f0f0f0", text: "#222222", muted: "#717171",
  live: "#00985f", liveDot: "#e11d48", circleBg: "#f0f0f0",
} as const;

const HOUR_OPTIONS: { value: string; label: string; hours: number | null }[] = [
  { value: "all", label: "Par heure", hours: null },
  { value: "1", label: "≤1h", hours: 1 },
  { value: "2", label: "≤2h", hours: 2 },
  { value: "4", label: "≤4h", hours: 4 },
  { value: "8", label: "≤8h", hours: 8 },
  { value: "16", label: "≤16h", hours: 16 },
  { value: "24", label: "≤24h", hours: 24 },
];

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
};

export function FotmobFilterBar(p: FotmobFilterBarProps) {
  const activeOpt = HOUR_OPTIONS.find((o) => o.hours === p.hours) ?? HOUR_OPTIONS[0];
  const activeLabel =
    p.hours != null && p.count != null ? `${activeOpt.label} (${p.count})` : activeOpt.label;
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
        {/* Pilule horaire : verte quand un filtre actif (même pattern que "En direct"). */}
        <div
          className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-1.5"
          style={{
            backgroundColor: p.hours != null ? C.live : C.pillBg,
            borderColor: p.hours != null ? C.live : C.pillBorder,
          }}
        >
          <select
            value={p.hours == null ? "all" : String(p.hours)}
            onChange={(e) => {
              const v = e.target.value === "all" ? null : Number(e.target.value);
              p.onHours(v != null && v > 0 ? v : null);
            }}
            aria-label={p.hours != null ? `Matchs dans les ${p.hours} prochaines heures` : "Fenêtre horaire"}
            className="bg-transparent text-xs font-bold outline-none"
            style={{ color: p.hours != null ? "#ffffff" : C.text }}
          >
            {HOUR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} style={{ color: "#222222", backgroundColor: "#ffffff" }}>
                {o.hours != null && o.hours === p.hours ? activeLabel : o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="size-3"
            style={{ color: p.hours != null ? "#ffffff" : C.muted }}
            aria-hidden="true"
          />
        </div>
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
