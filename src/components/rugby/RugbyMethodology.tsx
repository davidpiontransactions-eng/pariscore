"use client";

/**
 * Section méthodologie du modèle Rugby4Cast — transparence sur la façon dont
 * les prédictions sont produites (Elo, Poisson, facteurs contextuels, Monte Carlo).
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./rugby-ui";

const PILLARS: { icon: string; title: string; desc: string }[] = [
  {
    icon: "📊",
    title: "Ratings Elo dynamiques",
    desc: "Chaque équipe porte un rating qui évolue après chaque résultat, pondéré par la marge de victoire et l'avantage du terrain. Les grandes victoires contre des adversaires cotés rapportent plus.",
  },
  {
    icon: "🧮",
    title: "Modèle de score Poisson",
    desc: "Des facteurs attaque/défense (pondérés par récence) sont convertis en scores attendus via une grille de probabilités 2D — d'où découlent 1X2, scores exacts et totaux.",
  },
  {
    icon: "🛌",
    title: "Fraîcheur & repos",
    desc: "Les jours de repos depuis le dernier match ajustent le score attendu : repos court pénalisant, fenêtre optimale ~7–14 jours, très longues coupures légèrement coûteuses en rythme.",
  },
  {
    icon: "🤝",
    title: "Historique des confrontations",
    desc: "Le bilan des face-à-face passés entre deux équipes donne un léger avantage à celle qui domine historiquement la rivalité.",
  },
  {
    icon: "🎯",
    title: "Marchés dérivés",
    desc: "La grille de scores prix les totaux (41.5 à 61.5), l'handicap (spread) et les bandes de marge (victoire de 1-6, 7-12, 13+ points).",
  },
  {
    icon: "🎲",
    title: "Simulation Monte Carlo",
    desc: "La fin de saison est simulée 2 000 fois pour estimer les chances de titre de chaque équipe à partir des fixtures restantes.",
  },
];

export function RugbyMethodology() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-[#12151f] px-5 py-4 text-left transition-colors hover:border-teal-500/30"
        aria-expanded={open}
      >
        <span className="text-sm font-bold text-white">Comment fonctionne le modèle ?</span>
        <span className={cn("text-teal-400 transition-transform", open && "rotate-180")} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <Card className="mt-3 p-5">
          <p className="mb-4 text-sm leading-relaxed text-slate-400">
            Les prédictions s&apos;appuient sur les résultats réels synchronisés depuis l&apos;API
            publique ESPN (14 mois d&apos;historique), jamais sur des données inventées. Quand une
            métrique manque, elle est affichée « — ».
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {PILLARS.map((p) => (
              <div key={p.title} className="flex gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-lg ring-1 ring-teal-500/20"
                  aria-hidden
                >
                  {p.icon}
                </span>
                <div>
                  <p className="text-sm font-bold text-white">{p.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-white/5 pt-3 text-[11px] text-slate-400">
            Les probabilités sont des estimations statistiques, pas des garanties. Jouez de manière
            responsable.
          </p>
        </Card>
      )}
    </div>
  );
}
