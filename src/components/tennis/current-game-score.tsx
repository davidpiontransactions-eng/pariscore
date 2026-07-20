import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatPoints } from "@/lib/tennis-format";

type Props = {
  /** Points won by side A in the current game (0/1/2/3+). */
  pointsA: number;
  /** Points won by side B in the current game. */
  pointsB: number;
  className?: string;
};

/**
 * Current game score in tennis point notation (0/15/30/40/Av.).
 *
 * Renders as a compact emerald badge: `30-15`, `40-40` (deuce), or `Av.-40`.
 * Used inside the live header to show where the rally is *right now*, as
 * opposed to {@link SetScoreline} which shows the cumulative match state.
 *
 * Pure / presentational — formatting delegated to {@link formatPoints} so the
 * deuce / advantage quirk is defined once.
 */
export function CurrentGameScore({ pointsA, pointsB, className }: Props) {
  const t = useTranslations("match");
  const points = formatPoints(pointsA, pointsB);

  const isDeuce = pointsA >= 3 && pointsA === pointsB;
  const hasAdvantage = pointsA >= 3 && pointsB >= 3 && pointsA !== pointsB;

  const ariaKey = isDeuce
    ? "gameScoreAriaDeuce"
    : hasAdvantage
      ? "gameScoreAriaAdvantage"
      : "gameScoreAria";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded bg-emerald-500/10 px-2 py-0.5",
        "font-mono text-xs font-semibold tabular-nums",
        "text-emerald-700 dark:text-emerald-300",
        className,
      )}
      aria-label={t(ariaKey, { score: points })}
      role="img"
    >
      {points}
    </span>
  );
}
