"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CalendarClock,
  CircleDot,
  Clock,
  Flag,
  PauseCircle,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  resolveState,
  stateRequiresReason,
  transientFallback,
  type MatchState,
} from "@/lib/match-state";

type Props = {
  state: MatchState;
  /**
   * Raison affichée en infobulle. **Obligatoire** pour `suspended`, `postponed` et
   * `canceled` : un état bloqué sans explication est exactement le pattern destructeur
   * de confiance désigné par le benchmark. Absente → un libellé explicite le dit, on
   * n'invente jamais de raison.
   */
  reason?: string;
  /**
   * Durée d'affichage d'un état transitoire (`odds-changed`, `halftime`) avant retour
   * automatique à l'état stable. `0` = persistant (utile si le flux gère lui-même la
   * bascule). Défaut 3000.
   */
  transientMs?: number;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Icône par état — second canal de signalisation, la couleur n'est jamais seule
 * (charte §3.3, WCAG 1.4.1).
 */
const ICONS = {
  scheduled: CalendarClock,
  live: CircleDot,
  halftime: PauseCircle,
  suspended: ShieldAlert,
  "odds-changed": Clock,
  finished: Flag,
  postponed: Clock,
  canceled: XCircle,
} as const satisfies Record<MatchState, typeof CircleDot>;

/**
 * Classes par état. Les couleurs viennent des tokens sémantiques Tailwind
 * (`--edge-*`, `--confidence-*`, `--live-pulse`) — jamais d'hex en dur.
 */
const VARIANTS = {
  scheduled: "border-border bg-muted text-muted-foreground",
  live: "border-[color:var(--live-pulse)]/40 bg-[color:var(--live-pulse)]/12 text-[color:var(--live-pulse)]",
  halftime: "border-[color:var(--confidence-mid)]/40 bg-[color:var(--confidence-mid)]/12 text-[color:var(--confidence-mid)]",
  suspended: "border-[color:var(--confidence-mid)]/40 bg-[color:var(--confidence-mid)]/12 text-[color:var(--confidence-mid)]",
  "odds-changed": "border-[color:var(--accent)]/45 bg-[color:var(--accent)]/12 text-[color:var(--accent)]",
  finished: "border-border bg-muted text-muted-foreground",
  postponed: "border-[color:var(--confidence-mid)]/40 bg-[color:var(--confidence-mid)]/12 text-[color:var(--confidence-mid)]",
  canceled: "border-[color:var(--edge-negative)]/40 bg-[color:var(--edge-negative)]/12 text-[color:var(--edge-negative)]",
} as const satisfies Record<MatchState, string>;

/** Le live pulse, le reste est statique. `glow-pulse` est déclarée fonctionnelle. */
const LIVE_ONLY: MatchState[] = ["live"];

export function MatchStateBadge({ state, reason, transientMs = 3000, size = "sm", className }: Props) {
  const t = useTranslations("matchState");
  const [displayed, setDisplayed] = useState<MatchState>(resolveState(state));

  // Reset immédiat quand le flux renvoie un nouvel état : sans ça, un `odds-changed`
  // qui suit un `live` afficherait le fallback au lieu du nouvel état.
  useEffect(() => {
    setDisplayed(state);
  }, [state]);

  // Retour automatique à l'état stable, borné en durée (charte §9.3 règle 3) :
  // une animation d'état qui persiste = défaut WCAG 2.2.2.
  useEffect(() => {
    const fallback = transientFallback(displayed);
    if (fallback == null || transientMs <= 0) return;
    const timer = setTimeout(() => setDisplayed(fallback), transientMs);
    return () => clearTimeout(timer);
  }, [displayed, transientMs]);

  const Icon = ICONS[displayed];
  const isLive = LIVE_ONLY.includes(displayed);
  const needsReason = stateRequiresReason(displayed);
  const tooltip = `${t("reasonLabel")} : ${t(displayed)}${reason ? ` — ${reason}` : needsReason ? ` — ${t("reasonMissing")}` : ""}`;

  return (
    <span
      // `title` = raison d'un état bloqué, en complément du texte visible. `data-state`
      // sert aux tests et aux audits visuels.
      //
      // Pas de `role="status"` : ce rôle est un live region, il annoncerait chaque badge
      // au montage — une liste de 50 cartes en mi-temps produirait 50 annonces polières,
      // puis 50 de plus à la bascule. L'état est un contenu à lire quand le curseur y
      // arrive, pas une alerte à pousser ; le texte visible porte déjà l'information.
      title={tooltip}
      data-state={displayed}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border font-medium",
        VARIANTS[displayed],
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        isLive && "motion-safe:animate-glow-pulse",
        className,
      )}
    >
      <Icon aria-hidden className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      <span>{t(displayed)}</span>
      {reason ? <span className="max-w-[16ch] truncate opacity-80">· {reason}</span> : null}
    </span>
  );
}