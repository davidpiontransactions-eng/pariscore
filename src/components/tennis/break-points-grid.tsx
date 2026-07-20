/**
 * BreakPointsGrid — Matrice visuelle des balles de break.
 *
 * Affiche, pour chaque joueur, un cluster de points (● sauvées / ○ subies)
 * suivi du ratio {saved}/{faced} et du taux de conversion coloré.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │  Balles de break                              │
 *   │  Player A   ●●●●○○  4/6 sauvées   67%        │
 *   │  Player B   ●●○○            2/4 sauvées   50% │
 *   └──────────────────────────────────────────────┘
 *
 * Conception Tufte :
 *  - Data-ink maximal : pas de bordure/légende, couleurs uniquement
 *    pour encoder le taux de conversion (3 paliers).
 *  - Direct labeling : ratio + % à côté du cluster, pas de légende.
 *  - Text alternative : `role="img"` + aria-label complet sur chaque cluster.
 *
 * Limitation de données : le hook `useTennisLiveStats` n'expose que
 * `p1_bp_saved` / `p2_bp_saved` (cumul sur tout le match), SANS `bp_faced`.
 * Tant que `bpFaced*` est absent, on affiche simplement "{n} sauvées"
 * (un seul chiffre, sans dots ni ratio). Dès que les props `bpFaced*`
 * seront renseignées (données enrichies futures), la matrice complète
 * (dots + ratio + %) s'affiche automatiquement — aucune modification
 * du composant nécessaire.
 */

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Props = {
  /** Balles de break sauvées (cumul match). */
  bpSavedA: number | null;
  bpSavedB: number | null;
  /** Balles de break confrontées (optionnel — pas encore dans le hook). */
  bpFacedA?: number | null;
  bpFacedB?: number | null;
  player1Name: string;
  player2Name: string;
  className?: string;
};

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

type Tone = "emerald" | "amber" | "rose";

/** Palier de couleur selon le taux de conversion (saved / faced). */
function conversionTone(rate: number): Tone {
  if (rate >= 0.67) return "emerald";
  if (rate >= 0.5) return "amber";
  return "rose";
}

const TONE_DOT: Record<Tone, string> = {
  emerald: "bg-emerald-500 dark:bg-emerald-400",
  amber: "bg-amber-500 dark:bg-amber-400",
  rose: "bg-rose-500 dark:bg-rose-400",
};

const TONE_TEXT: Record<Tone, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
};

const TONE_RING: Record<Tone, string> = {
  emerald: "ring-emerald-500/30 dark:ring-emerald-400/30",
  amber: "ring-amber-500/30 dark:ring-amber-400/30",
  rose: "ring-rose-500/30 dark:ring-rose-400/30",
};

// ────────────────────────────────────────────
// Sous-composant : cluster de dots
// ────────────────────────────────────────────

type DotsProps = {
  saved: number;
  faced: number;
  tone: Tone;
  ariaLabel: string;
};

function BreakDots({ saved, faced, tone, ariaLabel }: DotsProps) {
  const missed = Math.max(0, faced - saved);
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cn(
        "flex flex-wrap items-center gap-[3px] rounded-md px-1 py-0.5 ring-1 ring-inset",
        TONE_RING[tone],
      )}
    >
      {Array.from({ length: saved }, (_, i) => (
        <span
          key={`s${i}`}
          aria-hidden
          className={cn("size-2 rounded-full", TONE_DOT[tone])}
        />
      ))}
      {Array.from({ length: missed }, (_, i) => (
        <span
          key={`m${i}`}
          aria-hidden
          className={cn(
            "size-2 rounded-full border border-muted-foreground/40 bg-transparent",
          )}
        />
      ))}
    </span>
  );
}

// ────────────────────────────────────────────
// Sous-composant : une ligne joueur
// ────────────────────────────────────────────

type RowProps = {
  name: string;
  saved: number | null;
  faced: number | null;
  savedLabel: string;
  ratioTemplate: string;
  ariaFullTemplate: string;
  ariaOnlyTemplate: string;
};

function PlayerBreakRow({
  name,
  saved,
  faced,
  savedLabel,
  ratioTemplate,
  ariaFullTemplate,
  ariaOnlyTemplate,
}: RowProps) {
  // Pas de donnée du tout → ligne élidée (caller décide).
  if (saved === null && faced === null) return null;

  // Donnée cumulée seule : un seul chiffre, pas de dots ni de ratio.
  if (faced === null || faced === undefined) {
    const s = saved ?? 0;
    const ariaOnly = ariaOnlyTemplate
      .replace("{player}", name)
      .replace("{saved}", String(s));
    return (
      <div
        className="flex items-center justify-between gap-3 py-1"
        role="img"
        aria-label={ariaOnly}
      >
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          {name}
        </span>
        <span
          className="font-mono text-sm font-semibold tabular-nums text-foreground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {saved !== null ? `${s} ${savedLabel}` : "—"}
        </span>
      </div>
    );
  }

  // Données enrichies : dots + ratio + %.
  const safeFaced = Math.max(0, faced);
  const safeSaved = Math.max(0, Math.min(saved ?? 0, safeFaced));
  const rate = safeFaced > 0 ? safeSaved / safeFaced : 0;
  const tone = conversionTone(rate);
  const pct = Math.round(rate * 100);

  const ariaLabel = ariaFullTemplate
    .replace("{player}", name)
    .replace("{saved}", String(safeSaved))
    .replace("{faced}", String(safeFaced))
    .replace("{rate}", String(pct));

  const ratio = ratioTemplate
    .replace("{saved}", String(safeSaved))
    .replace("{faced}", String(safeFaced));

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-24 min-w-0 shrink-0 truncate text-sm font-medium text-foreground">
        {name}
      </span>
      <BreakDots
        saved={safeSaved}
        faced={safeFaced}
        tone={tone}
        ariaLabel={ariaLabel}
      />
      <span
        className="ml-auto flex items-baseline gap-2 font-mono tabular-nums"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <span className="text-xs text-muted-foreground">
          {ratio} {savedLabel}
        </span>
        <span className={cn("text-sm font-bold", TONE_TEXT[tone])}>
          {pct}%
        </span>
      </span>
    </div>
  );
}

// ────────────────────────────────────────────
// Composant principal
// ────────────────────────────────────────────

export function BreakPointsGrid({
  bpSavedA,
  bpSavedB,
  bpFacedA,
  bpFacedB,
  player1Name,
  player2Name,
  className,
}: Props) {
  const t = useTranslations("tennis.breakPoints");

  const title = t("title");
  const savedLabel = t("saved");
  const ratioTemplate = t("ratio");
  const ariaFullTemplate = t("savedAria");
  const ariaOnlyTemplate = t("savedOnlyAria");

  const hasA = bpSavedA !== null || bpFacedA != null;
  const hasB = bpSavedB !== null || bpFacedB != null;

  if (!hasA && !hasB) {
    return (
      <section
        className={cn(
          "rounded-lg border border-border/40 bg-muted/20 px-3 py-2",
          className,
        )}
        aria-label={title}
      >
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </h3>
        <p className="py-2 text-xs text-muted-foreground">{t("noData")}</p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-lg border border-border/40 bg-muted/20 px-3 py-2",
        className,
      )}
      aria-label={title}
    >
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y divide-border/30">
        {hasA && (
          <PlayerBreakRow
            name={player1Name}
            saved={bpSavedA}
            faced={bpFacedA ?? null}
            savedLabel={savedLabel}
            ratioTemplate={ratioTemplate}
            ariaFullTemplate={ariaFullTemplate}
            ariaOnlyTemplate={ariaOnlyTemplate}
          />
        )}
        {hasB && (
          <PlayerBreakRow
            name={player2Name}
            saved={bpSavedB}
            faced={bpFacedB ?? null}
            savedLabel={savedLabel}
            ratioTemplate={ratioTemplate}
            ariaFullTemplate={ariaFullTemplate}
            ariaOnlyTemplate={ariaOnlyTemplate}
          />
        )}
      </div>
    </section>
  );
}
