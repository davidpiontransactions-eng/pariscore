"use client";

// Bouton raccourci « 🎯 Widget Live » + panneau BETS PRÉDICTIFS, pour les
// cartes de match non-tennis.
//
// Le modèle tennis (`match-pip-widget.tsx:113`) est reproduit à l'identique :
// un `useState<string | null>` d'ID déployé, le panneau rendu en FRÈRE de la
// ligne — jamais à l'intérieur du `<button>` racine de la carte, sinon le
// clic remonte et re-déplie le panneau (bug documenté en `pip-match-row.tsx`).
//
// Le composant ne calcule rien : il appelle `useLivePredictiveBets`, qui
// route → adaptateur → moteur, et affiche l'un des trois états (loading /
// unavailable / ready). Pas de skeleton « dégradé » qui affiche des chiffres
// de repli : un flux qui ne porte pas les champs nécessaires affiche un
// message, pas un 50/50 fabriqué.

import { useState } from "react";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { LivePredictiveBetsWidget } from "@/components/sports/live-predictive-bets-widget";
import {
  useLivePredictiveBets,
  type LiveBetsStatus,
} from "@/hooks/use-live-predictive-bets";

export type LiveBetsTriggerProps = {
  /** Slug du sport — détermine la route, l'adaptateur et le moteur. */
  sport: string;
  /** Id du match ciblé. `null` = premier match live du flux. */
  matchId?: string | null;
  /** Libellé du camp A (équipe, joueur 1). */
  nameA: string;
  /** Libellé du camp B (équipe, joueur 2). */
  nameB: string;
  /** Force l'état replié même si un autre match est déployé. */
  collapsed?: boolean;
  /** Surcharge la route live du sport (quand la carte hôte sert un autre flux). */
  route?: string;
  className?: string;
};

/** Skeleton glassmorphic : même langage visuel que le panneau, sans chiffres. */
function GlassSkeleton() {
  return (
    <div
      className="mt-1.5 w-full min-w-0 animate-pulse rounded-3xl border border-slate-800/80 bg-slate-900/80 p-2 shadow-2xl backdrop-blur-xl"
      aria-busy="true"
      aria-live="polite"
      data-testid="live-bets-skeleton"
    >
      <div className="mb-2 h-3 w-48 rounded-full bg-slate-800/70" />
      <div className="space-y-2.5">
        {[0, 1].map((k) => (
          <div key={k} className="min-w-0 rounded-2xl border border-white/5 bg-slate-950/40 p-3.5">
            <div className="mb-2 h-3 w-32 rounded-full bg-slate-800/70" />
            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded-full bg-slate-800/60" />
              <div className="h-2.5 w-4/5 rounded-full bg-slate-800/60" />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] italic text-slate-500">Chargement des données live…</p>
    </div>
  );
}

/** Message d'indisponibilité : la cause réelle, jamais un « 50/50 » de repli. */
function UnavailableNotice({ status, message }: { status: LiveBetsStatus; message: string | null }) {
  const isError = status === "error";
  return (
    <div
      className={cn(
        "mt-1.5 w-full min-w-0 rounded-3xl border p-3 text-xs backdrop-blur-xl",
        isError ? "border-rose-500/30 bg-rose-950/40 text-rose-200" : "border-slate-800/80 bg-slate-900/80 text-slate-400"
      )}
      role="status"
      data-testid="live-bets-unavailable"
    >
      <span className="font-semibold">
        {isError ? "Flux live indisponible" : "Marchés live indisponibles"}
      </span>
      <p className="mt-1 leading-relaxed">
        {message ?? "Les données nécessaires au calcul ne sont pas servies par le flux."}
      </p>
    </div>
  );
}

/**
 * Carte de match + déclencheur.
 *
 * L'auto-déploiement suit la même règle que `MatchPipWidget` : on NE filtre
 * PAS sur `isLive`. Au clic, le flux peut avoir une seconde de retard sur le
 * score affiché — filtrer ferait clignoter le panneau en « indisponible »
 * juste après l'ouverture.
 */
export function LiveBetsTrigger({
  sport,
  matchId,
  nameA,
  nameB,
  collapsed = false,
  route,
  className,
}: LiveBetsTriggerProps) {
  const [open, setOpen] = useState(false);
  const expanded = !collapsed && open;

  const { bundle, status, message, updatedAt } = useLivePredictiveBets(sport, matchId, {
    enabled: expanded,
    route,
  });

  return (
    // `stopPropagation` sur la racine : la carte hôte peut être elle-même
    // cliquable (`HandballLiveCard` est un `div role="button"` qui ouvre la popup
    // d'analyse). Sans cet arrêt, cliquer « Widget Live » ouvrirait AUSSI la
    // popup — et refermerait le panneau qu'on vient d'ouvrir, puisque les
    // deux remontent au même parent.
    <div className={cn("w-full min-w-0", className)} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        aria-controls={expanded ? `live-bets-${sport}-${matchId ?? "first"}` : undefined}
        className={cn(
          "flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
          expanded
            ? "bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/20"
            : "bg-slate-800/70 text-slate-300 hover:bg-slate-700/70 hover:text-slate-100"
        )}
      >
        <Target className="h-3 w-3 shrink-0" aria-hidden />
        <span>Widget Live</span>
        {bundle && (
          <span className="shrink-0 font-mono text-[10px] tabular-nums opacity-80">
            {bundle.scoreA}–{bundle.scoreB}
          </span>
        )}
      </button>

      {expanded && (
        <div id={`live-bets-${sport}-${matchId ?? "first"}`} className="min-w-0">
          {status === "loading" && <GlassSkeleton />}
          {(status === "unavailable" || status === "error") && !bundle && (
            <UnavailableNotice status={status} message={message} />
          )}
          {bundle && (
            <>
              {/* Signalement de fraîcheur : un bundle affiché 3 min après le
                  dernier poll trahit une donnée figée, et l'utilisateur doit
                  le voir plutôt que de croire à une valeur temps réel. */}
              {status !== "ready" && (
                <p className="mt-1 text-[10px] text-amber-400/80">
                  {status === "error" ? "Flux coupé — dernier instantané connu." : "Données en attente."}
                </p>
              )}
              <LivePredictiveBetsWidget bundle={bundle} nameA={nameA} nameB={nameB} />
              {updatedAt !== null && (
                <p className="mt-1 text-right font-mono text-[10px] tabular-nums text-slate-600">
                  {new Date(updatedAt).toLocaleTimeString("fr-FR")}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}