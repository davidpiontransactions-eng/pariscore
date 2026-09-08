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

const HOUR_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Par heure" },
  { value: "1", label: "1h" },
  { value: "2", label: "2h" },
  { value: "4", label: "4h" },
  { value: "8", label: "8h" },
  { value: "24", label: "24h" },
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
        <div
          className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-1.5"
          style={{ backgroundColor: C.pillBg, borderColor: C.pillBorder }}
        >
          <select
            value={p.hours == null ? "all" : String(p.hours)}
            onChange={(e) => p.onHours(e.target.value === "all" ? null : Number(e.target.value))}
            aria-label="Fenêtre horaire"
            className="bg-transparent text-xs font-medium outline-none"
            style={{ color: C.text }}
          >
            {HOUR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="size-3" style={{ color: C.muted }} aria-hidden="true" />
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
