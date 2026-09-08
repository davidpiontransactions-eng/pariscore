"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Formateur date Paris — singleton Intl. */
const parisDayFmt = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric", month: "2-digit", day: "2-digit",
});
const parisLabelFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "short", day: "numeric", month: "short",
});
const parisWeekdayFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "long", day: "numeric", month: "long",
});

export function parisDateKey(d: Date): string {
  return parisDayFmt.format(d); // YYYY-MM-DD
}
export function parisDateLabel(d: Date): string {
  const today = parisDateKey(new Date());
  const tomorrow = parisDateKey(new Date(Date.now() + 86400000));
  const key = parisDateKey(d);
  if (key === today) return "Aujourd'hui";
  if (key === tomorrow) return "Demain";
  return parisLabelFmt.format(d);
}
export function parisDateFull(d: Date): string {
  return parisWeekdayFmt.format(d);
}

type Props = {
  selectedDate: Date;
  onSelect: (d: Date) => void;
  className?: string;
};

export function CalendarDateNav({ selectedDate, onSelect, className }: Props) {
  const days = useMemo(() => {
    const result: Date[] = [];
    const now = new Date();
    for (let i = -1; i < 8; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      result.push(d);
    }
    return result;
  }, []);

  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none", className)}>
      {/* Prev day button */}
      <button
        type="button"
        onClick={() => {
          const prev = new Date(selectedDate);
          prev.setDate(prev.getDate() - 1);
          onSelect(prev);
        }}
        className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        aria-label="Jour précédent"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {days.map((d) => {
        const isToday = parisDateKey(d) === parisDateKey(new Date());
        const isSelected = parisDateKey(d) === parisDateKey(selectedDate);
        const label = isToday ? "Auj." : d.toLocaleDateString("fr-FR", { weekday: "short" }).slice(0, 3);
        const dayNum = d.getDate();
        return (
          <button
            key={parisDateKey(d)}
            type="button"
            onClick={() => onSelect(d)}
            className={cn(
              "shrink-0 flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 min-w-[52px] transition-all",
              isSelected
                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-500/10"
                : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800/50",
            )}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
            <span className={cn(
              "text-lg font-bold leading-none",
              isSelected ? "text-emerald-300" : "text-slate-200",
            )}>
              {dayNum}
            </span>
          </button>
        );
      })}

      {/* Next day button */}
      <button
        type="button"
        onClick={() => {
          const next = new Date(selectedDate);
          next.setDate(next.getDate() + 1);
          onSelect(next);
        }}
        className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        aria-label="Jour suivant"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}