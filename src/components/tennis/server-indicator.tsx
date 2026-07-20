import { CircleDot } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Props = {
  /** Which side is currently serving — kept for API completeness / future use
   *  (e.g. alignment hints). The displayed name carries the meaning here. */
  server: "A" | "B";
  /** Display name of the player currently serving. */
  serverName: string;
  className?: string;
};

/**
 * Compact "X is serving" indicator with a pulsing ball dot.
 *
 * lucide-react v0.525 does not ship a `Tennis` icon, so we use `CircleDot` —
 * a small filled dot in a ring that reads as a tennis ball at this size and
 * matches the sport's circular serve imagery without an emoji fallback.
 *
 * The icon has a subtle `animate-pulse` to convey "live / in motion", kept
 * faint to avoid the AI-slop flashing-over-everything smell. Honours the
 * reduced-motion media query via the global Tailwind config default.
 */
export function ServerIndicator({ server, serverName, className }: Props) {
  const t = useTranslations("match");
  void server; // accepted by API, not used in render (see Props.server doc)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        className,
      )}
      aria-label={t("serverAria", { name: serverName })}
      role="img"
    >
      <CircleDot
        className={cn(
          "h-3 w-3 shrink-0 animate-pulse text-emerald-500",
          "motion-reduce:animate-none",
        )}
        aria-hidden
      />
      <span className="truncate">{t("serving", { name: serverName })}</span>
    </span>
  );
}
