"use client";

import { HandballTeamLogo } from "./handball-team-logo";
import type { PariscorePrediction, PariscoreTeamMetrics } from "@/lib/handball-pariscore";

// ─── Format ───

/** « 04.10.2026 | 15:00 » — jour + heure Europe/Paris. */
const DAY_FMT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${DAY_FMT.format(d)} | ${TIME_FMT.format(d)}`;
}

/** Pastille de forme : V vert / N ciel / D rose (W/D/L brut côté lib). */
const FORM_TONE: Record<string, string> = {
  W: "bg-emerald-500 text-white",
  D: "bg-sky-500 text-white",
  L: "bg-rose-500 text-white",
};
const FORM_FR: Record<string, string> = { W: "V", D: "N", L: "D" };

/** 5 pastilles de forme (L5), les plus récentes à droite. */
function FormPills({ seq }: { seq: string }) {
  if (!seq) {
    return <span className="text-[10px] text-white/50">—</span>;
  }
  return (
    <span className="inline-flex gap-1" aria-label={`Forme ${seq}`}>
      {seq.split("").map((r, i) => (
        <span
          key={i}
          title={r === "W" ? "Victoire" : r === "D" ? "Nul" : "Défaite"}
          className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${FORM_TONE[r] ?? "bg-white/25 text-white"}`}
        >
          {FORM_FR[r] ?? r}
        </span>
      ))}
    </span>
  );
}

function TeamColumn({
  metrics,
  logoName,
  label,
  align,
}: {
  metrics: PariscoreTeamMetrics | null;
  logoName: string;
  label: string;
  align: "left" | "right";
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <HandballTeamLogo name={logoName} size={28} />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold leading-tight text-white" title={label}>
          {label}
        </p>
        <p className="text-[10px] tabular-nums text-white/60">
          {metrics ? `Pwr ${metrics.power}/100 · Forme ${metrics.formPct}%` : "—"}
        </p>
        <div className="mt-1">
          <FormPills seq={metrics?.seq ?? ""} />
        </div>
      </div>
    </div>
  );
}

type Props = {
  kickoff: string;
  homeName: string;
  awayName: string;
  homeShort?: string | null;
  awayShort?: string | null;
  prediction: PariscorePrediction;
  /** true si un tip Vitibet existe pour ce match → badge TIP jaune. */
  hasTip: boolean;
};

/**
 * Banner « Score Prédit » — en-tête du popup Calendrier.
 *
 * Fond marine (#0A2E5C) pour détacher le bloc du thème clair du dialog, et
 * garder la lecture « score » au-dessus du pli : c'est la première réponse à
 * la question que pose l'utilisateur en ouvrant un match.
 */
export function HandballScoreBanner({
  kickoff,
  homeName,
  awayName,
  homeShort,
  awayShort,
  prediction,
  hasTip,
}: Props) {
  const label = (name: string, short?: string | null) => short ?? name;
  return (
    <section
      aria-label="Score prédit"
      className="rounded-2xl bg-[#0A2E5C] p-3 text-white"
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          Score Prédit
        </h3>
        <time
          dateTime={kickoff}
          className="text-[11px] font-medium tabular-nums text-white/80"
        >
          {formatDateTime(kickoff)}
        </time>
      </header>

      <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamColumn
          metrics={prediction.home}
          logoName={homeName}
          label={label(homeName, homeShort)}
          align="left"
        />

        <div className="text-center">
          <p className="font-mono text-4xl font-black leading-none tabular-nums">
            {prediction.scoreHome}
            <span className="mx-1 text-2xl font-normal text-white/50">:</span>
            {prediction.scoreAway}
          </p>
          {hasTip && (
            <span className="mt-1.5 inline-block rounded bg-amber-400 px-2 py-0.5 text-[10px] font-black tracking-wide text-black">
              TIP
            </span>
          )}
          <p
            className="mt-1 text-[10px] tabular-nums text-white/60"
            title="Index Pariscore : > 0 = avantage domicile"
          >
            Index {prediction.index > 0 ? "+" : ""}
            {prediction.index}
          </p>
        </div>

        <TeamColumn
          metrics={prediction.away}
          logoName={awayName}
          label={label(awayName, awayShort)}
          align="right"
        />
      </div>

      <p className="mt-2.5 border-t border-white/10 pt-2 text-[10px] leading-snug text-white/50">
        {prediction.note} · total attendu {prediction.expectedTotal} buts
      </p>
    </section>
  );
}