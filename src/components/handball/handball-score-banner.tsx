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
  onDuel,
  duelLabel,
}: {
  metrics: PariscoreTeamMetrics | null;
  logoName: string;
  label: string;
  align: "left" | "right";
  /** Ouvre l'analyse du duel — le nom/blason devient la zone cliquable. */
  onDuel?: () => void;
  duelLabel?: string;
}) {
  const name = (
    <>
      <HandballTeamLogo name={logoName} size={28} />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold leading-tight text-white" title={label}>
          {label}
        </p>
        {/* KPIs en badges contrastés : « Pwr 31.6 » en texte gris sur marine
            était illisible (rapproché 2.9:1, sous le seuil WCAG AA 4.5:1).
            Le fond translucide + le blanc plein montent le texte à ~9:1 et
            le remplissage par la valeur double les canaux : on lit le niveau
            sans lire le nombre.

            `flex-wrap` + `min-w-[…]` sur chaque badge : sans ce plancher, les
            deux badges se partagent la largeur de la colonne (~70 px) au lieu de
            passer à la ligne, et leur texte se réduisait à « P… » / « F… » — un
            badge illisible est pire que pas de badge du tout. */}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {metrics ? (
            <>
              <PowerBadge power={metrics.power} align={align} />
              <FormBadge formPct={metrics.formPct} align={align} />
            </>
          ) : (
            <span className="text-[10px] text-white/50">Pas de stats</span>
          )}
        </div>
        <div className="mt-1">
          <FormPills seq={metrics?.seq ?? ""} />
        </div>
      </div>
    </>
  );

  if (!onDuel) {
    return (
      <div
        className={`flex min-w-0 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}
      >
        {name}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onDuel}
      aria-label={duelLabel}
      className={`flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676] ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {name}
    </button>
  );
}

// ─── Badges KPI (Pwr / Forme) ───

/** Seuils de la Forme Calculée : < 35 % faible, < 65 % moyen, sinon forte. */
const FORM_BADGE_TONE = [
  { max: 35, chip: "bg-rose-500/25 text-rose-100 ring-rose-400/50", bar: "bg-rose-400" },
  { max: 65, chip: "bg-amber-400/25 text-amber-100 ring-amber-300/50", bar: "bg-amber-300" },
  { max: Infinity, chip: "bg-emerald-400/25 text-emerald-100 ring-emerald-300/50", bar: "bg-emerald-300" },
] as const;

/** Jauge 0..100 : la largeur porte le niveau, la pastille le texte. */
function Meter({ pct, bar, align }: { pct: number; bar: string; align: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 block h-1 w-full overflow-hidden rounded-full bg-white/20"
    >
      <span
        className={`block h-full rounded-full ${bar} ${align === "right" ? "ml-auto" : ""}`}
        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
      />
    </span>
  );
}

/** Badge « ⚡ Pwr 62.3 » — teinte neutre cyan, jauge remplie à la valeur. */
function PowerBadge({ power, align }: { power: number; align: "left" | "right" }) {
  return (
    <span
      className="flex min-w-[4.75rem] flex-1 flex-col rounded-md bg-sky-400/20 px-1.5 py-0.5 ring-1 ring-sky-300/40"
      title={`Team Power ${power}/100 — rapportée à la moyenne de la ligue (50 = niveau moyen)`}
    >
      <span className="truncate text-[10px] font-bold tabular-nums text-white">
        ⚡ Pwr {power.toFixed(1)}
      </span>
      <Meter pct={power} bar="bg-sky-300" align={align} />
    </span>
  );
}

/** Badge « 🔥 Forme 71.7 % » — rouge / ambre / vert selon le seuil. */
function FormBadge({ formPct, align }: { formPct: number; align: "left" | "right" }) {
  const tone = FORM_BADGE_TONE.find((t) => formPct < t.max) ?? FORM_BADGE_TONE[FORM_BADGE_TONE.length - 1];
  return (
    <span
      className={`flex min-w-[5.25rem] flex-1 flex-col rounded-md px-1.5 py-0.5 ring-1 ${tone.chip}`}
      title={`Forme Calculée ${formPct}% — points/match pondérés par la récence, le lieu et l'écart de buts`}
    >
      <span className="truncate text-[10px] font-bold tabular-nums">
        🔥 Forme {formPct.toFixed(1)}%
      </span>
      <Meter pct={formPct} bar={tone.bar} align={align} />
    </span>
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
  /**
   * Ouvre l'analyse du duel. Rend le nom + blason de chaque équipe
   * cliquables : c'est ici que vit désormais l'affordance (le bloc d'équipes
   * en dessous du banner a été supprimé, il répétait nom + logo une 2ᵉ fois).
   */
  onDuel?: () => void;
  /** Score RÉEL si le match est joué — affiché sous le score prédit. */
  actualScore?: { home: number; away: number } | null;
  /** « MT » ou « 47' » si le match est en direct. */
  liveBadge?: string | null;
};

/**
 * Banner « Score Prédit » — EN-TÊTE UNIQUE du pop-up match.
 *
 * Fond marine (#0A2E5C) pour détacher le bloc du thème clair du dialog, et
 * garder la lecture « score » au-dessus du pli : c'est la première réponse à
 * la question que pose l'utilisateur en ouvrant un match.
 *
 * Il PORTE l'identité des deux équipes (blason + nom + badges Pwr/Forme +
 * pastilles de forme) : c'est le seul endroit où elles apparaissent. Avant,
 * le dialog réimprimait la même ligne juste en dessous, et
 * `HandballPredictionCards` réimprimait le score une 3ᵉ fois — trois lectures
 * du même chiffre sur un écran de 375 px de haut.
 */
export function HandballScoreBanner({
  kickoff,
  homeName,
  awayName,
  homeShort,
  awayShort,
  prediction,
  hasTip,
  onDuel,
  actualScore,
  liveBadge,
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

      <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <TeamColumn
          metrics={prediction.home}
          logoName={homeName}
          label={label(homeName, homeShort)}
          align="left"
          onDuel={onDuel}
          duelLabel={onDuel ? `Analyser le duel ${homeName} contre ${awayName}` : undefined}
        />

        <div className="text-center">
          {/* Aucune donnée exploitable des deux côtés : on affiche « — : — »
              plutôt qu'un score calculé sur le prior de ligue. Un « 28 : 28 »
              présenté comme score prédit serait le prior de ligue déguisé en
              prédiction — et l'Index / les badges le trahiraient d'ailleurs. */}
          <p
            className={`font-mono font-black leading-none tabular-nums ${
              prediction.hasSignal ? "text-4xl" : "text-3xl text-white/45"
            }`}
          >
            {prediction.hasSignal ? prediction.scoreHome : "—"}
            <span className="mx-1 text-2xl font-normal text-white/50">:</span>
            {prediction.hasSignal ? prediction.scoreAway : "—"}
          </p>
          {!prediction.hasSignal && (
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
              Données insuffisantes
            </p>
          )}
          {liveBadge && (
            <span className="mt-1 inline-block rounded bg-rose-500 px-2 py-0.5 text-[10px] font-black tabular-nums text-white">
              {liveBadge}
            </span>
          )}
          {actualScore && !liveBadge && (
            <p className="mt-1 text-[10px] font-semibold tabular-nums text-white/70">
              Réel {actualScore.home} : {actualScore.away}
            </p>
          )}
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
          onDuel={onDuel}
          duelLabel={onDuel ? `Analyser le duel ${awayName} contre ${homeName}` : undefined}
        />
      </div>

      {onDuel && (
        <p className="mt-1 text-center text-[9px] text-white/45">
          Touchez un club pour l&apos;analyse du duel
        </p>
      )}

      <p className="mt-2.5 border-t border-white/10 pt-2 text-[10px] leading-snug text-white/50">
        {prediction.note} · total attendu {prediction.expectedTotal} buts
      </p>
    </section>
  );
}