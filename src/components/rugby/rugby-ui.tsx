"use client";

/**
 * Primitives UI partagées du domaine Rugby (PariScore Rugby4Cast).
 * Thème sombre PariScore : fond navy #0F0F1A, accent teal --sport-rugby.
 * Aucune dépendance externe — composants légers et réutilisables.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { VerdictLabel } from "@/lib/rugby/types";

/* ------------------------------------------------------------------ */
/* Formatage                                                            */
/* ------------------------------------------------------------------ */

export function pct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  });
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export function fmtDateLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  });
}

export function fmtHandicap(line: number): string {
  // Convention bookmaker : la ligne est celle du favori (domicile).
  // line > 0 → le domicile est favori → "Domicile -9.5" ; line < 0 → "Domicile +7.5".
  const abs = Math.abs(line).toFixed(1);
  return line > 0 ? `-${abs}` : `+${abs}`;
}

/* ------------------------------------------------------------------ */
/* Logo d'équipe                                                        */
/* ------------------------------------------------------------------ */

export function RugbyTeamLogo({
  src,
  name,
  size = 28,
  className,
}: {
  src: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const [error, setError] = useState(false);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (!src || error) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-teal-500/15 font-bold text-teal-300 ring-1 ring-teal-500/30",
          className
        )}
        style={{ width: size, height: size, fontSize: size * 0.36 }}
        aria-hidden
      >
        {initials}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setError(true)}
      className={cn("shrink-0 rounded-full object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Barre de probabilité 1X2                                             */
/* ------------------------------------------------------------------ */

export function ProbBar({
  homePct,
  awayPct,
  drawPct,
  className,
}: {
  homePct: number;
  awayPct: number;
  drawPct: number;
  className?: string;
}) {
  const h = Math.round(homePct * 100);
  const d = Math.round(drawPct * 100);
  // a déduit des valeurs arrondies (pas de double arrondi → segments = 100).
  const a = 100 - h - d;
  return (
    <div
      className={cn("flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800", className)}
      role="img"
      aria-label={`Probabilités : domicile ${h}%, nul ${d}%, extérieur ${a}%`}
    >
      <div className="bg-teal-400" style={{ width: `${h}%` }} />
      <div className="bg-slate-500" style={{ width: `${d}%` }} />
      <div className="bg-sky-400" style={{ width: `${a}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badge de verdict                                                     */
/* ------------------------------------------------------------------ */

const VERDICT_META: Record<VerdictLabel, { label: string; cls: string }> = {
  "backing-home": { label: "Confiance domicile", cls: "bg-teal-500/15 text-teal-300 ring-teal-500/40" },
  "backing-away": { label: "Confiance extérieur", cls: "bg-sky-500/15 text-sky-300 ring-sky-500/40" },
  "leaning-home": { label: "Tendance domicile", cls: "bg-teal-500/10 text-teal-200/90 ring-teal-500/25" },
  "leaning-away": { label: "Tendance extérieur", cls: "bg-sky-500/10 text-sky-200/90 ring-sky-500/25" },
  "toss-up": { label: "Match ouvert", cls: "bg-slate-500/15 text-slate-300 ring-slate-500/30" },
};

export function VerdictBadge({ verdict, className }: { verdict: VerdictLabel; className?: string }) {
  const meta = VERDICT_META[verdict] ?? VERDICT_META["toss-up"];
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1",
        meta.cls,
        className
      )}
    >
      {meta.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Badges de forme (W / L / D)                                          */
/* ------------------------------------------------------------------ */

const FORM_META: Record<string, string> = {
  W: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40",
  L: "bg-red-500/15 text-red-300 ring-red-500/30",
  D: "bg-slate-500/20 text-slate-300 ring-slate-500/30",
};

export function FormBadges({ form, className }: { form: string; className?: string }) {
  if (!form) return null;
  const chars = form.split("").slice(-5);
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`Forme : ${form}`}
    >
      {chars.map((c, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded text-[11px] font-black ring-1",
            FORM_META[c] ?? FORM_META.D
          )}
        >
          {c}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* En-tête de section                                                   */
/* ------------------------------------------------------------------ */

export function SectionHeading({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-6">
      <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-teal-400">{kicker}</p>
      <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">{title}</h2>
      {sub && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Carte générique                                                      */
/* ------------------------------------------------------------------ */

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-white/8 bg-[#12151f] shadow-lg shadow-black/20", className)}>
      {children}
    </div>
  );
}
