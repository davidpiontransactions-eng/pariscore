"use client";

import { useMemo } from "react";
import { Sparkles, ArrowRight, TrendingUp } from "lucide-react";
import type { FootballMatch } from "@/lib/football-data";
import type { PickLeg } from "@/lib/football-pick-utils";
import { parisKickoff } from "@/lib/football-time";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { ConfidenceRing } from "@/components/shared/confidence-ring";
import { EditorialInsight } from "@/components/ai/editorial-insight";
import {
  pickScore,
  pickLabel,
  pickConfidence,
  STRONG_PICK_THRESHOLD,
} from "@/lib/football-pick-utils";


/** Confiance 1X2 dérivée pour la couleur du ring dominateur. */
function homeDomProb(match: FootballMatch): number {
  return Math.max(match.prediction.homeProb, match.prediction.drawProb, match.prediction.awayProb);
}

/** Une ou deux phrases d'argumentaire « Pourquoi » — purement frontend. */
function bankerReasoning(match: FootballMatch, pick: PickLeg): string {
  const home = match.home;
  const away = match.away;
  const hm = match.prediction.formMomentum?.home?.trend;
  const am = match.prediction.formMomentum?.away?.trend;
  const st = match.prediction.standingStats;
  const hPpg = st && st.home.played > 0 ? st.home.ppg.toFixed(2) : null;
  const aPpg = st && st.away.played > 0 ? st.away.ppg.toFixed(2) : null;
  const trendTxt = (x?: "up" | "down" | "stable") =>
    x === "up" ? "sur une dynamique ascendante" : x === "down" ? "en perte de récent" : "stable";
  const leads: string[] = [`${home.shortName} ${trendTxt(hm)}`];
  if (hPpg) leads.push(`${hPpg} PPG à domicile`);
  if (aPpg) leads.push(`${aPpg} PPG à l'extérieur`);
  return `${pick.leg} à ${pick.prob}% : ${leads.join(", ")}.`;
}

/**
 * « Le pronostic de la semaine » — Banker du week-end.
 * Affiche LE pick le plus confiant du périmètre (respecte les filtres ligue)
 * sous forme éditoriale + les 2-3 picks suivants en bandeau compact.
 * Rend `null` si aucun pick ≥ seuil (n'affiche jamais de pick faible).
 */
export function FootballBankerWidget({
  matches,
  onOpenDetail,
}: {
  matches: FootballMatch[];
  onOpenDetail?: (m: FootballMatch) => void;
}) {
  const banker = useMemo(() => {
    if (matches.length === 0) return null;
    const ranked = [...matches]
      .map((m) => ({ m, score: pickScore(m), pick: pickLabel(m), dom: homeDomProb(m) }))
      .filter((x) => x.pick && x.score >= STRONG_PICK_THRESHOLD)
      .sort((a, b) => b.score - a.score);
    if (ranked.length === 0) return null;
    const [first, ...rest] = ranked;
    return { banker: first, top3: rest.slice(0, 3) };
  }, [matches]);

  if (!banker) return null;
  const { banker: b, top3 } = banker;
  const homeColor = b.m.home.color || "#22c55e";

  return (
    <section className="mb-8">
      {/* En-tête */}
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-emerald-400" aria-hidden />
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
          Le pronostic du weekend
        </h2>
        <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-400 ring-1 ring-inset ring-emerald-500/40">
          Banker
        </span>
      </div>

      {/* Banker — carte éditoriale */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-card p-4 shadow-lg shadow-emerald-500/5">
        {/* Halo dégradé */}
        <div className="pointer-events-none absolute inset-x-0 -top-20 h-40 bg-gradient-to-b from-emerald-500/10 to-transparent" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Teams */}
          <div className="flex flex-1 items-center justify-between gap-3 sm:justify-start">
            <div className="flex min-w-0 items-center gap-3">
              <PlayerAvatar
                name={b.m.home.name}
                photoUrl={b.m.home.logo}
                color={b.m.home.color}
                size="lg"
                sport="football"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{b.m.home.shortName}</p>
                <p className="text-[11px] font-medium text-muted-foreground">{b.m.round}</p>
                <p className="text-[11px] text-muted-foreground">domicile · {parisKickoff(b.m.scheduledAt)}</p>
              </div>
            </div>
            <div className="flex flex-col items-center px-2 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">vs</span>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-bold">{b.m.away.shortName}</p>
                <p className="text-[11px] font-medium text-muted-foreground">{b.m.league.name}</p>
                <p className="text-[11px] text-muted-foreground">extérieur</p>
              </div>
              <PlayerAvatar
                name={b.m.away.name}
                photoUrl={b.m.away.logo}
                color={b.m.away.color}
                size="lg"
                sport="football"
              />
            </div>
          </div>

          {/* Ring de confiance + pick */}
          <div className="flex shrink-0 items-center justify-center gap-4">
            <ConfidenceRing
              prob={b.score}
              confidence={pickConfidence(b.score)}
              color={homeColor}
              size="lg"
              label="Confiance"
            />
            <div className="text-center sm:text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pick fort</p>
              <p className="text-base font-black text-emerald-400">{b.pick?.leg}</p>
              <p className="text-xs font-semibold tabular-nums text-foreground">
                {b.pick?.prob}%
              </p>
              {b.m.odds && (
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  cote {b.m.odds.home.toFixed(2)}/{b.m.odds.draw.toFixed(2)}/{b.m.odds.away.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pourquoi + actions */}
        <div className="relative mt-4 border-t border-border/60 pt-3">
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-card-foreground/85">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            <span>
              <span className="font-semibold text-foreground">{b.m.home.shortName} – {b.m.away.shortName} : </span>
              {bankerReasoning(b.m, b.pick!)}
            </span>
          </p>
          <EditorialInsight
            sport="football"
            matchId={b.m.id}
            playerA={b.m.home.name}
            playerB={b.m.away.name}
            variant="compact"
            className="mt-1"
          />
          {onOpenDetail && (
            <button
              type="button"
              onClick={() => onOpenDetail(b.m)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              Voir l'analyse du match
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Top 3 — bandeau compact */}
      {top3.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {top3.map(({ m, score, pick }) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpenDetail?.(m)}
              className="group flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-left transition-colors hover:border-emerald-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PlayerAvatar name={m.home.name} photoUrl={m.home.logo} color={m.home.color} size="sm" sport="football" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">
                  {m.home.shortName} – {m.away.shortName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{pick?.leg}</p>
              </div>
              <span className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-400">
                {score}%
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}