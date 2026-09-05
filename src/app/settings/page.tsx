import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { PushToggle } from "@/components/push-toggle";
import { EmailToggle } from "@/components/email-toggle";
import { openBankrollDialog } from "@/components/bankroll-dialog";
import { openPaperTradingDialog } from "@/components/paper-trading-dialog";
import { openAboutDialog } from "@/components/about-dialog";
import { openPrivacyDialog } from "@/components/privacy-dialog";
import { openApiDocsDialog } from "@/components/api-docs-dialog";
import {
  BarChart3,
  Trophy,
  Wallet,
  FlaskConical,
  Code,
  User,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { AbTestDebugBadge } from "@/components/ab-test-debug";
import { DensityToggle } from "@/components/ui/density-toggle";

/**
 * Page Settings / Réglages.
 *
 * Route cible des liens "Profil" et "Réglages" du user-menu.
 * Combine les préférences utilisateur, outils, debug et légal.
 */
export default function SettingsPage() {
  const t = useTranslations("about");

  const shortcuts = [
    { href: "/bankroll" as const, icon: BarChart3, label: "Bet Manager", accent: "text-emerald-400 bg-emerald-500/10" },
    { href: "/ligues" as const, icon: Trophy, label: "Championnats", accent: "text-sky-400 bg-sky-500/10" },
    { href: null, onClick: () => openBankrollDialog(), icon: Wallet, label: "Bankroll", accent: "text-purple-400 bg-purple-500/10" },
    { href: null, onClick: () => openPaperTradingDialog(), icon: FlaskConical, label: "Paper Trading", accent: "text-amber-400 bg-amber-500/10" },
    { href: null, onClick: () => openApiDocsDialog(), icon: Code, label: "API & Docs", accent: "text-teal-400 bg-teal-500/10" },
    { href: null, onClick: () => openAboutDialog(), icon: User, label: t("trigger"), accent: "text-[#6B5B8D] bg-[#EDE8F5]" },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-lg font-bold">Réglages</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Personnalise ton expérience PariScore.
      </p>

      {/* Préférences */}
      <section className="mt-6 rounded-xl border border-[#E0D8F0] bg-[#F5F3FA] p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Préférences
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ThemeToggle />
          <LanguageToggle />
          <PushToggle />
          <EmailToggle />
        </div>
      </section>

      {/* Affichage */}
      <section className="mt-4 rounded-xl border border-[#E0D8F0] bg-[#F5F3FA] p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Affichage
        </h2>
        <div className="mt-3">
          <p className="mb-2 text-sm text-zinc-300">Densité d&apos;affichage</p>
          <DensityToggle />
        </div>
      </section>

      {/* Outils */}
      <section className="mt-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Mes outils
        </h2>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shortcuts.map((s) => {
            const Icon = s.icon;
            const inner = (
              <>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.accent}`}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-white">{s.label}</span>
              </>
            );
            const cls =
              "flex min-h-[44px] items-center gap-3 rounded-xl border border-[#E0D8F0] bg-[#F5F3FA] p-3.5 text-left transition-colors hover:border-emerald-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
            return s.href ? (
              <Link key={s.label} href={s.href} className={cls}>
                {inner}
              </Link>
            ) : (
              <button key={s.label} type="button" onClick={s.onClick} className={cls}>
                {inner}
              </button>
            );
          })}
        </div>
      </section>

      {/* Debug */}
      <section className="mt-4 rounded-xl border border-[#E0D8F0] bg-[#F5F3FA] p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Debug &amp; Expérimentation
        </h2>
        <div className="mt-3">
          <AbTestDebugBadge inline />
        </div>
      </section>

      {/* Légal */}
      <section className="mt-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Légal
        </h2>
        <div className="mt-2 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={openPrivacyDialog}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E0D8F0] bg-[#F5F3FA] px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-emerald-500/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Shield className="h-4 w-4" />
            Gérer mes cookies
          </button>
        </div>
      </section>
    </div>
  );
}
