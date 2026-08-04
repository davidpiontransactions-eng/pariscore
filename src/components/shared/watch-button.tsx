"use client";

import { useState } from "react";
import { MonitorPlay } from "lucide-react";
import type { LiveTvSport } from "@/lib/livetv-stream-service";
import { cn } from "@/lib/utils";
import { StreamPlayerModal } from "./stream-player-modal";

type Props = {
  sport: LiveTvSport;
  home: string;
  away: string;
  subtitle?: string;
  label?: string;
  /** Variante sombre réservée aux cartes MMA/NBA sur fond alt. */
  variant?: "default" | "subtle" | "dark";
  className?: string;
};

/**
 * Bouton « Visionner » (TV) déclenchant le StreamPlayerModal.
 * Classe réutilisable à tous les sports — n'affiche que le bouton ; le modal
 * est monté une seule fois ici.
 */
export function WatchButton({ sport, home, away, subtitle, label = "Visionner", variant = "default", className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Regarder ${home} vs ${away} en direct (LiveTV)`}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
          variant === "default" &&
            "bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400",
          variant === "subtle" &&
            "border border-border bg-card text-foreground hover:bg-muted",
          variant === "dark" &&
            "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/40 hover:bg-emerald-500/25",
          className,
        )}
      >
        <MonitorPlay className="h-3.5 w-3.5" aria-hidden />
        {label}
      </button>

      <StreamPlayerModal
        open={open}
        onOpenChange={setOpen}
        sport={sport}
        home={home}
        away={away}
        subtitle={subtitle}
      />
    </>
  );
}