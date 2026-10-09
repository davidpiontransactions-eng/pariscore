"use client";

// Scénario contrefactuel « ET SI ? » — la projection au prochain jeu.
//
// Le widget affichait des probabilités qui changent au score suivant, sans
// dire ce que ce prochain jeu vaut. « 63,7 % » n'est pas actionnable ; « si
// ce jeu est gagné, 89,7 % » l'est. C'est ce que montre ce composant.
//
// Il appelle le MÊME `setWinProb` que l'affichage du marché, avec le score
// incrémenté : le contrefactuel ne peut donc PAS annoncer une probabilité
// différente de celle affichée juste au-dessus.
import { counterfactualNextGame } from "@/lib/prediction/counterfactual";
import { cn } from "@/lib/utils";

type Props = {
  /** P(A gagne le set en cours), fraction [0, 1]. */
  setWinA: number;
  holdA: number;
  holdB: number;
  setsA: number;
  setsB: number;
  gamesA: number;
  gamesB: number;
  server: "A" | "B";
  /** Noms affichés ; par défaut A / B. */
  nameA?: string;
  nameB?: string;
  className?: string;
};

export function ScenarioImpact({
  setWinA,
  holdA,
  holdB,
  setsA,
  setsB,
  gamesA,
  gamesB,
  server,
  nameA = "A",
  nameB = "B",
  className,
}: Props) {
  const cf = counterfactualNextGame({
    setWinA,
    holdA,
    holdB,
    setsA,
    setsB,
    gamesA,
    gamesB,
    server,
    bo3: true,
  });

  const nowPct = Math.round(cf.nowA * 100);
  const ifAPct = Math.round(cf.ifAWinsGame * 100);
  // `ifBWinsGame` est DÉJÀ exprimé du point de vue de A (le module calcule
  // toujours P(A | ·)) : l'afficher tel quel, sans le prendre pour P(B),
  // évite un mensonge de plusieurs dizaines de points.
  const ifBPct = Math.round(cf.ifBWinsGame * 100);
  const serverName = server === "A" ? nameA : nameB;
  const otherName = server === "A" ? nameB : nameA;
  const swingA = Math.round(cf.swingIfA * 100);
  const swingB = Math.round(cf.swingIfB * 100);

  // Un écart < 1 pt est du bruit d'arrondi : l'afficher serait du bruit visuel.
  const noisy = Math.abs(swingA) < 1 && Math.abs(swingB) < 1;

  return (
    <div
      className={cn(
        "mt-2 rounded-xl border border-white/5 bg-slate-950/50 p-2.5",
        className
      )}
      data-testid="scenario-impact"
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70">
          Et si… prochain jeu
        </span>
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
          {serverName} au service
        </span>
      </div>

      {noisy ? (
        <p className="text-[11px] text-muted-foreground/60">
          Ce jeu ne change presque rien à l&apos;issue du match.
        </p>
      ) : (
        <ul className="space-y-1 text-[11px]">
          <li className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-slate-300">
              <span className="font-bold text-emerald-400">{nameA}</span> gagne
              le jeu
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-200">
              {ifAPct} %
              {swingA > 0 && (
                <span className="ml-1 text-emerald-400">+{swingA}</span>
              )}
            </span>
          </li>
          <li className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-slate-300">
              <span className="font-bold text-rose-400">{otherName}</span>{" "}
              {server === "B" ? "gagne" : "brise"} le jeu
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-200">
              {ifBPct} %
              {swingB > 0 && (
                <span className="ml-1 text-rose-400">−{swingB}</span>
              )}
            </span>
          </li>
        </ul>
      )}

      <p className="mt-1.5 border-t border-white/5 pt-1.5 text-[10px] text-muted-foreground/60 tabular-nums">
        Aujourd&apos;hui : {nowPct} % pour {nameA}
      </p>
    </div>
  );
}