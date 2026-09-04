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
import { useTranslations } from "next-intl";
import { openPaperTradingDialog } from "@/components/paper-trading-dialog";
import { openApiDocsDialog } from "@/components/api-docs-dialog";

type HomeDashboardProps = {
  /** Bascule vers un onglet sport (cartes/CTA de la home). */
  onSportSelect: (tab: string) => void;
};

const STEPS = [
  {
    icon: MousePointerClick,
    key: "chooseSport",
    accent: "text-emerald-400 bg-emerald-500/10",
  },
  {
    icon: Gem,
    key: "spotValue",
    accent: "text-sky-400 bg-sky-500/10",
  },
  {
    icon: Wallet,
    key: "manageBankroll",
    accent: "text-purple-400 bg-purple-500/10",
  },
] as const;

const FEATURES = [
  {
    href: "/bankroll" as const,
    onClick: undefined as (() => void) | undefined,
    icon: BarChart3,
    key: "betManager",
    tile: "border-emerald-500/25 hover:border-emerald-500/50",
    chip: "text-emerald-400 bg-emerald-500/10",
  },
  {
    href: "/ligues" as const,
    onClick: undefined as (() => void) | undefined,
    icon: Trophy,
    key: "leagues",
    tile: "border-sky-500/25 hover:border-sky-500/50",
    chip: "text-sky-400 bg-sky-500/10",
  },
  {
    href: null,
    onClick: () => openPaperTradingDialog(),
    icon: FlaskConical,
    key: "paperTrading",
    tile: "border-purple-500/25 hover:border-purple-500/50",
    chip: "text-purple-400 bg-purple-500/10",
  },
  {
    href: null,
    onClick: () => openApiDocsDialog(),
    icon: Code,
    key: "apiDocs",
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
  const t = useTranslations("home");
  const reduceMotion = useReducedMotion();

  const scrollToUpcoming = () => {
    document
      .getElementById("section-upcoming")
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <section aria-label={t("ariaLabel")} className="w-full px-4 sm:px-6 pt-6">
      {/* Panneau bienvenue */}
      <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-5 sm:p-6">
        <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
          {t("welcome")}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">
          {t("intro")}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onSportSelect("football")}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            <CircleDot className="h-4 w-4" aria-hidden />
            {t("ctaFootball")}
          </button>
          <button
            type="button"
            onClick={scrollToUpcoming}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Timer className="h-4 w-4" aria-hidden />
            {t("ctaUpcoming")}
          </button>
        </div>
      </div>

      {/* Onboarding 3 étapes */}
      <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-zinc-400">
        {t("howItWorks")}
      </h3>
      <ol className="mt-2 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <li
              key={step.key}
              className="rounded-xl border border-white/5 bg-zinc-900/60 p-4"
            >
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${step.accent}`}
                aria-hidden
              >
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-2.5 text-sm font-semibold text-white">{t(`steps.${step.key}.title`)}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{t(`steps.${step.key}.desc`)}</p>
            </li>
          );
        })}
      </ol>

      {/* Raccourcis produits */}
      <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-zinc-400">
        {t("goFurther")}
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
                <span className="block text-sm font-semibold text-white">{t(`features.${f.key}.label`)}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">
                  {t(`features.${f.key}.desc`)}
                </span>
              </span>
            </>
          );
          const cls = `flex min-h-[44px] items-start gap-3 rounded-xl border bg-zinc-900/60 p-4 text-left transition-colors ${f.tile}`;
          return f.href ? (
            <Link key={f.key} href={f.href} className={cls}>
              {inner}
            </Link>
          ) : (
            <button key={f.key} type="button" onClick={f.onClick} className={cls}>
              {inner}
            </button>
          );
        })}
      </div>
    </section>
  );
}
