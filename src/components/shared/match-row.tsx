"use client";

/**
 * MatchRow — composant canonique unifié pour afficher un match en ligne.
 *
 * Pattern #1 du secteur (Sofascore/Flashscore/Bet365).
 * Utilisé sur les fixtures, résultats, ligues, et listes upcoming.
 * Coexiste avec les cartes riches (FootballMatchCard, MatchCard tennis)
 * qui restent pour les vues détaillées.
 *
 * Props génériques : accepte n'importe quel match avec home/away/score/odds/form.
 * Deux modes de densité : compact (Forebet/Bet365) et confort (Sofascore).
 *
 * Refonte design 2026-08-25 — cf. .context/design-refonte-2026-08-25.md
 */

import { memo, useState, useEffect, useCallback, useMemo } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Star, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDensity } from "@/components/ui/density-toggle";

/* ─── Types ────────────────────────────────────────────────────────────── */

export type FormResult = "W" | "D" | "L";

export interface MatchRowData {
  id: string;
  /** Nom du sport (pour la couleur d'accent optionnelle). */
  sport?: "football" | "tennis" | "basketball" | "cs2" | "mma" | "cycling" | "f1" | "baseball" | "rugby";
  /** Équipe / joueur domicile. */
  homeName: string;
  homeRank?: number;
  homeLogo?: string;
  homeForm?: FormResult[];
  /** Équipe / joueur extérieur. */
  awayName: string;
  awayRank?: number;
  awayLogo?: string;
  awayForm?: FormResult[];
  /** Score (affiché tel quel — "2 - 1", "6-3 4-6", etc.). */
  scoreDisplay?: string;
  /** Statut : "LIVE", "HT", "FT", "1Q", etc. */
  status?: string;
  /** Minute si live (ex: "45'" ou "2ème set"). */
  minute?: string;
  /** Cotes [1, N, 2] ou [A, B] — nombre décimal. */
  odds?: (number | null)[];
  /** Cote précédente (pour détecter le changement et déclencher le flash). */
  previousOdds?: (number | null)[];
  /** Heure de début (si pas live). */
  kickoff?: string;
  /** Ligue / tournoi. */
  league?: string;
  /** Badge de value bet (edge %). */
  edge?: number;
  /** Probabilité modèle (0-100). */
  confidence?: number;
  /** Clic sur la ligne → ouvre le détail. */
  onClick?: () => void;
  /** Clic sur le bouton favori. */
  onFavoriteToggle?: () => void;
  /** Est en favori ? */
  isFavorite?: boolean;
  /** Désactivé (match terminé, etc.). */
  disabled?: boolean;
}

/* ─── Sous-composants ──────────────────────────────────────────────────── */

/** Forme W/D/L : 5 pastilles colorées (vert/jaune/rouge). */
function FormStrip({ form, compact }: { form: FormResult[]; compact?: boolean }) {
  const size = compact ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[9px]";
  return (
    <div className="flex items-center gap-0.5">
      {form.slice(-5).map((r, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex items-center justify-center rounded-full font-bold tabular-nums",
            size,
            r === "W" && "bg-emerald-500/20 text-emerald-400",
            r === "D" && "bg-amber-500/20 text-amber-400",
            r === "L" && "bg-red-500/20 text-red-400",
          )}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

/** Pill de cote avec flash animation au changement. */
function OddsPill({
  value,
  previous,
  compact,
}: {
  value: number | null;
  previous?: number | null;
  compact?: boolean;
}) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || value == null || previous == null || value === previous) return;
    const dir = value > previous ? "up" : "down";
    setFlash(dir);
    const t = setTimeout(() => setFlash(null), 400);
    return () => clearTimeout(t);
  }, [value, previous, reduceMotion]);

  if (value == null) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-border/30 bg-zinc-800/50 text-zinc-600 tabular-nums",
          compact ? "h-6 min-w-[48px] px-1.5 text-[10px]" : "h-7 min-w-[56px] px-2 text-[11px]",
        )}
      >
        —
      </span>
    );
  }

  return (
    <motion.span
      animate={
        flash && !reduceMotion
          ? {
              backgroundColor:
                flash === "up"
                  ? "rgba(0,230,118,0.25)"
                  : "rgba(239,68,68,0.25)",
            }
          : { backgroundColor: "rgba(39,39,42,0.5)" }
      }
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-border/30 tabular-nums font-semibold transition-colors",
        compact ? "h-6 min-w-[48px] px-1.5 text-[10px]" : "h-7 min-w-[56px] px-2 text-[11px]",
        flash === "up" && "text-emerald-300",
        flash === "down" && "text-red-300",
        !flash && "text-zinc-200",
      )}
    >
      {value.toFixed(2)}
    </motion.span>
  );
}

/** Badge LIVE pulsant. */
function LiveBadge({ minute, compact }: { minute?: string; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      {minute && (
        <span
          className={cn(
            "font-semibold tabular-nums text-red-400",
            compact ? "text-[10px]" : "text-[11px]",
          )}
        >
          {minute}
        </span>
      )}
    </span>
  );
}

/** Badge edge (value bet). */
function EdgeBadge({ edge, compact }: { edge: number; compact?: boolean }) {
  if (edge <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-semibold tabular-nums",
        compact ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[10px]",
      )}
    >
      +{edge.toFixed(1)}%
    </span>
  );
}

/* ─── MatchRow principal ────────────────────────────────────────────────── */

export const MatchRow = memo(function MatchRow({
  match,
  index = 0,
}: {
  match: MatchRowData;
  index?: number;
}) {
  const [density] = useDensity();
  const reduceMotion = useReducedMotion();
  const compact = density === "compact";

  const isLive = match.status === "LIVE";
  const isFinished = match.status === "FT";

  const row = useMemo(
    () => (
      <div
        role="button"
        tabIndex={0}
        onClick={match.onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") match.onClick?.();
        }}
        className={cn(
          "group flex items-center gap-2 rounded-xl border border-transparent bg-zinc-900/30 transition-all duration-200",
          "hover:border-border/40 hover:bg-zinc-800/40",
          compact ? "px-3 py-2" : "px-4 py-3",
          match.disabled && "opacity-50 pointer-events-none",
          !match.onClick && "pointer-events-none",
        )}
      >
        {/* Col 1 : Heure / Live / Status */}
        <div className={cn("flex flex-col items-center shrink-0", compact ? "w-12" : "w-14")}>
          {isLive ? (
            <LiveBadge minute={match.minute} compact={compact} />
          ) : isFinished ? (
            <span className={cn("font-semibold text-zinc-400", compact ? "text-[10px]" : "text-[11px]")}>
              {match.status}
            </span>
          ) : match.kickoff ? (
            <span className={cn("font-semibold text-zinc-400 tabular-nums", compact ? "text-[10px]" : "text-[11px]")}>
              {match.kickoff}
            </span>
          ) : null}
        </div>

        {/* Col 2 : Home */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {match.homeLogo ? (
            <img
              src={match.homeLogo}
              alt=""
              className={cn("shrink-0 rounded object-contain", compact ? "h-4 w-4" : "h-5 w-5")}
              loading="lazy"
            />
          ) : null}
          {match.homeRank != null && (
            <span className="text-[9px] font-bold text-zinc-400 tabular-nums">{match.homeRank}</span>
          )}
          <span
            className={cn(
              "truncate font-medium text-zinc-100",
              compact ? "text-[11px]" : "text-[12px]",
            )}
          >
            {match.homeName}
          </span>
          {match.homeForm && <FormStrip form={match.homeForm} compact={compact} />}
        </div>

        {/* Col 3 : Score / VS */}
        <div className={cn("flex shrink-0 items-center justify-center tabular-nums font-bold", compact ? "w-16 text-xs" : "w-20 text-sm")}>
          {match.scoreDisplay ? (
            <span className={cn("text-white", isLive && "text-emerald-400")}>
              {match.scoreDisplay}
            </span>
          ) : (
            <span className="text-zinc-600">vs</span>
          )}
        </div>

        {/* Col 4 : Away */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {match.awayForm && <FormStrip form={match.awayForm} compact={compact} />}
          <span
            className={cn(
              "truncate text-right font-medium text-zinc-100",
              compact ? "text-[11px]" : "text-[12px]",
            )}
          >
            {match.awayName}
          </span>
          {match.awayRank != null && (
            <span className="text-[9px] font-bold text-zinc-400 tabular-nums">{match.awayRank}</span>
          )}
          {match.awayLogo ? (
            <img
              src={match.awayLogo}
              alt=""
              className={cn("shrink-0 rounded object-contain", compact ? "h-4 w-4" : "h-5 w-5")}
              loading="lazy"
            />
          ) : null}
        </div>

        {/* Col 5 : Cotes */}
        {match.odds && match.odds.length > 0 && (
          <div className={cn("flex shrink-0 items-center gap-1", compact ? "ml-2" : "ml-3")}>
            {match.odds.map((o, i) => (
              <OddsPill
                key={i}
                value={o}
                previous={match.previousOdds?.[i]}
                compact={compact}
              />
            ))}
          </div>
        )}

        {/* Col 6 : Edge + Favori */}
        <div className={cn("flex shrink-0 items-center gap-1.5", compact ? "ml-1" : "ml-2")}>
          {match.edge != null && <EdgeBadge edge={match.edge} compact={compact} />}
          {match.confidence != null && match.confidence > 0 && (
            <span
              className={cn(
                "tabular-nums font-semibold",
                compact ? "text-[9px] text-zinc-400" : "text-[10px] text-zinc-400",
              )}
            >
              {match.confidence}%
            </span>
          )}
          {match.onFavoriteToggle && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                match.onFavoriteToggle?.();
              }}
              className={cn(
                "rounded-md p-1 transition-colors",
                match.isFavorite
                  ? "text-amber-400 hover:text-amber-300"
                  : "text-zinc-600 hover:text-zinc-400",
              )}
              aria-label={match.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            >
              <Star className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5", match.isFavorite && "fill-current")} />
            </button>
          )}
        </div>
      </div>
    ),
    [
      compact,
      isLive,
      isFinished,
      match.homeName,
      match.homeRank,
      match.homeLogo,
      match.homeForm,
      match.awayName,
      match.awayRank,
      match.awayLogo,
      match.awayForm,
      match.scoreDisplay,
      match.status,
      match.minute,
      match.kickoff,
      match.odds,
      match.previousOdds,
      match.edge,
      match.confidence,
      match.isFavorite,
      match.onFavoriteToggle,
      match.onClick,
      match.disabled,
    ],
  );

  if (reduceMotion) return row;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3), ease: [0.4, 0, 0.2, 1] }}
    >
      {row}
    </motion.div>
  );
});
