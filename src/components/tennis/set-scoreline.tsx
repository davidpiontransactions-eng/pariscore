import { useTranslations } from "next-intl";
import type { SideScore } from "@/hooks/use-live-matches";
import { cn } from "@/lib/utils";

type Props = {
  /** Score for side A — `sets[]` holds past sets, `games` is the current set. */
  scoreA: SideScore;
  /** Score for side B — same shape as `scoreA`. */
  scoreB: SideScore;
  className?: string;
};

/**
 * Set-by-set scoreline in standard tennis notation.
 *
 * Renders `6-4 6-3 3-2` where past sets are in the default foreground colour
 * and the current (in-progress) set is highlighted in emerald bold — the live
 * part of the score the eye should jump to.
 *
 * Pure / presentational — no hooks, safe in server components. Uses next-intl
 * only for the `aria-label` description.
 *
 * @example <SetScoreline scoreA={{sets:[6,6],games:3,...}} scoreB={{sets:[4,3],games:2,...}} />
 *          // → "6-4 6-3" muted + "3-2" emerald bold
 */
export function SetScoreline({ scoreA, scoreB, className }: Props) {
  const t = useTranslations("match");

  const pastSets = scoreA.sets.map((gA, i) => ({
    a: gA,
    b: scoreB.sets[i] ?? 0,
  }));

  const hasCurrentGames = scoreA.games > 0 || scoreB.games > 0;

  // Human-readable description for screen readers — spelled out set by set,
  // with the in-progress set framed as "X jeux à Y dans le set en cours".
  const pastSetsSpoken = pastSets.map((s) => `${s.a}-${s.b}`).join(", ");
  const ariaScore = hasCurrentGames
    ? pastSetsSpoken
      ? t("scoreAriaWithCurrent", {
          past: pastSetsSpoken,
          gamesA: scoreA.games,
          gamesB: scoreB.games,
        })
      : t("scoreAriaCurrentOnly", {
          gamesA: scoreA.games,
          gamesB: scoreB.games,
        })
    : t("scoreAriaPast", { past: pastSetsSpoken });

  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 font-mono text-xs tabular-nums",
        className,
      )}
      aria-label={t("scoreAria", { score: ariaScore })}
      role="img"
    >
      {pastSets.map((s, i) => (
        <span
          key={i}
          className="text-muted-foreground"
        >
          {s.a}-{s.b}
        </span>
      ))}

      {hasCurrentGames && (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {scoreA.games}-{scoreB.games}
        </span>
      )}

      {/* Edge case: no sets played and current games still 0-0 (e.g. pre-match
          warmup). Show a neutral 0-0 so the slot keeps its layout slot. */}
      {!hasCurrentGames && pastSets.length === 0 && (
        <span className="text-muted-foreground">0-0</span>
      )}
    </span>
  );
}
