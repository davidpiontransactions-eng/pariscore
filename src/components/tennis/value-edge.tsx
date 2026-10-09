"use client";

// Affichage de l'ÉCART modèle ↔ marché (VALUE bet), marchés ① et ②.
//
// Remplace le blending `markov·w + marché·(1-w)` : la moyenne des deux
// probabilités détruit l'information utile. Si le modèle PariScore dit 73 %
// et le bookmaker 61 %, l'utilisateur veut voir +12 — la moyenne 67 ne
// répond pas à « le modèle apporte-t-il une information que le marché n'a
// pas ? ». C'est pourtant exactement la question d'un parieur.

import { cn } from "@/lib/utils";

/** Seuil au-delà duquel le marché est considéré comme sous-coté. */
export const VALUE_EDGE_THRESHOLD = 5;

type Props = {
  /** P(modèle) pour le joueur A, en %. */
  modelA: number;
  /** P(marché implicite) pour le joueur A, en %. */
  marketA: number;
  /** Affiche le badge VALUE quand l'écart dépasse le seuil. */
  showBadge?: boolean;
  className?: string;
};

export function ValueEdge({ modelA, marketA, showBadge = true, className }: Props) {
  const edge = Math.round(modelA - marketA);
  const isValue = showBadge && edge >= VALUE_EDGE_THRESHOLD;
  // Écart négatif = le modèle est plus prudent que le marché sur A.
  // La couleur seule ne porte jamais l'information : le signe est écrit.
  const tone =
    edge > 0
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : edge < 0
        ? "text-rose-400 border-rose-500/30 bg-rose-500/10"
        : "text-slate-500 border-white/10 bg-white/5";

  return (
    <div
      className={cn(
        "mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] leading-tight",
        className
      )}
    >
      <span className="text-muted-foreground/70">
        Modèle <span className="font-semibold text-slate-300">{modelA} %</span>
      </span>
      <span aria-hidden className="text-muted-foreground/40">·</span>
      <span className="text-muted-foreground/70">
        Marché{" "}
        <span className="font-semibold text-slate-300">{marketA} %</span>
      </span>
      <span
        className={cn(
          "rounded-full border px-1.5 py-0.5 font-bold tabular-nums",
          tone
        )}
        title={
          edge > 0
            ? `Le modèle PariScore est ${edge} pts plus optimiste pour le joueur A que le bookmaker`
            : edge < 0
              ? `Le modèle PariScore est ${-edge} pts plus prudent que le bookmaker pour le joueur A`
              : "Modèle et marché sont alignés"
        }
      >
        {edge > 0 ? `+${edge}` : edge} pts
      </span>
      {isValue && (
        <span
          className="rounded-full border border-amber-400/50 bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-amber-300"
          title={`Écart ≥ ${VALUE_EDGE_THRESHOLD} pts : le bookmaker sous-cote le joueur A selon le modèle PariScore`}
        >
          VALUE
        </span>
      )}
    </div>
  );
}