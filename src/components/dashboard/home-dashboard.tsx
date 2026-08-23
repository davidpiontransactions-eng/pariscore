"use client";

import Link from "next/link";
import {
  CircleDot,
  MousePointerClick,
  Gem,
  Wallet,
  BarChart3,
  Trophy,
  FlaskConical,
  Code,
  Timer,
} from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { openPaperTradingDialog } from "@/components/paper-trading-dialog";
import { openApiDocsDialog } from "@/components/api-docs-dialog";

type HomeDashboardProps = {
  /** Bascule vers un onglet sport (cartes/CTA de la home). */
  onSportSelect: (tab: string) => void;
};

const STEPS = [
  {
    icon: MousePointerClick,
    title: "1 · Choisis ton sport",
    desc: "Tennis, football, CS2, NBA… chaque sport a ses marchés et son filtre latéral.",
    accent: "text-emerald-400 bg-emerald-500/10",
  },
  {
    icon: Gem,
    title: "2 · Repère les value bets",
    desc: "PariScore compare cotes bookmakers et probabilités du modèle pour isoler l'edge.",
    accent: "text-sky-400 bg-sky-500/10",
  },
  {
    icon: Wallet,
    title: "3 · Pilote ta bankroll",
    desc: "Kelly fractionnaire, suivi des mises et courbe de capital dans le Bet Manager.",
    accent: "text-purple-400 bg-purple-500/10",
  },
];

const FEATURES = [
  {
    href: "/bankroll" as const,
    onClick: undefined as (() => void) | undefined,
    icon: BarChart3,
    label: "Bet Manager",
    desc: "Suivi de bankroll, historique de paris et courbe de capital.",
    tile: "border-emerald-500/25 hover:border-emerald-500/50",
    chip: "text-emerald-400 bg-emerald-500/10",
  },
  {
    href: "/ligues" as const,
    onClick: undefined as (() => void) | undefined,
    icon: Trophy,
    label: "Championnats",
    desc: "Stats ligues OddAlerts : formes, fixtures et cotes dévigées.",
    tile: "border-sky-500/25 hover:border-sky-500/50",
    chip: "text-sky-400 bg-sky-500/10",
  },
  {
    href: null,
    onClick: () => openPaperTradingDialog(),
    icon: FlaskConical,
    label: "Paper Trading",
    desc: "Entraîne-toi sans risque : stratégies testées sur données réelles.",
    tile: "border-purple-500/25 hover:border-purple-500/50",
    chip: "text-purple-400 bg-purple-500/10",
  },
  {
    href: null,
    onClick: () => openApiDocsDialog(),
    icon: Code,
    label: "API & Docs",
    desc: "Endpoints publics v1 pour intégrer les signaux PariScore.",
    tile: "border-amber-500/25 hover:border-amber-500/50",
    chip: "text-amber-400 bg-amber-500/10",
  },
];

/**
 * Vue d'accueil par défaut — remplace l'affichage direct d'un onglet sport.
 * Contenu neutre multi-sports : onboarding en 3 étapes, raccourcis produits
 * et CTA vers le contenu phare. Les sections globales (Best matches,
 * Prochains matchs, Gemini AI) restent rendues sous cette vue par page.tsx.
 */
export function HomeDashboard({ onSportSelect }: HomeDashboardProps) {
  const reduceMotion = useReducedMotion();

  const scrollToUpcoming = () => {
    document
      .getElementById("section-upcoming")
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <section aria-label="Accueil PariScore" className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-6">
      {/* Panneau bienvenue */}
      <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-5 sm:p-6">
        <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
          Bienvenue sur PariScore
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">
          L'outil d'analyse de paris sportifs qui croise forme récente, xG et cotes de marché
          pour détecter les value bets. Choisis un point de départ :
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onSportSelect("football")}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            <CircleDot className="h-4 w-4" aria-hidden />
            Explorer le football
          </button>
          <button
            type="button"
            onClick={scrollToUpcoming}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Timer className="h-4 w-4" aria-hidden />
            Prochains matchs
          </button>
        </div>
      </div>

      {/* Onboarding 3 étapes */}
      <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-zinc-500">
        Comment ça marche
      </h3>
      <ol className="mt-2 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className="rounded-xl border border-white/5 bg-zinc-900/60 p-4"
            >
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${step.accent}`}
                aria-hidden
              >
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-2.5 text-sm font-semibold text-white">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{step.desc}</p>
            </li>
          );
        })}
      </ol>

      {/* Raccourcis produits */}
      <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-zinc-500">
        Aller plus loin
      </h3>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          const inner = (
            <>
              <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${f.chip}`}
                aria-hidden
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{f.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">
                  {f.desc}
                </span>
              </span>
            </>
          );
          const cls = `flex min-h-[44px] items-start gap-3 rounded-xl border bg-zinc-900/60 p-4 text-left transition-colors ${f.tile}`;
          return f.href ? (
            <Link key={f.label} href={f.href} className={cls}>
              {inner}
            </Link>
          ) : (
            <button key={f.label} type="button" onClick={f.onClick} className={cls}>
              {inner}
            </button>
          );
        })}
      </div>
    </section>
  );
}
