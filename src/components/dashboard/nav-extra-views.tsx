"use client";

import Link from "next/link";
import {
  Radio,
  Gem,
  Star,
  User,
  Volleyball,
  Footprints,
  ListFilter,
  BarChart3,
  Trophy,
  FlaskConical,
  Code,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useDashboardData } from "@/components/dashboard/dashboard-data-provider";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { PushToggle } from "@/components/push-toggle";
import { EmailToggle } from "@/components/email-toggle";
import { openBankrollDialog } from "@/components/bankroll-dialog";
import { openPaperTradingDialog } from "@/components/paper-trading-dialog";
import { openAboutDialog } from "@/components/about-dialog";
import { openPrivacyDialog } from "@/components/privacy-dialog";
import { openApiDocsDialog } from "@/components/api-docs-dialog";

type ViewProps = {
  /** Bascule vers un onglet sport (cartes passerelles). */
  onSportSelect: (tab: string) => void;
};

function ViewShell({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400" aria-hidden>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
          <p className="text-xs text-zinc-400">{desc}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Matchs live — formes défensives (les deux APIs renvoient des shapes BSD enrichis). */
type LiveFoot = {
  id: string;
  league?: { name?: string; country?: string };
  home?: { name?: string };
  away?: { name?: string };
  live?: { homeScore?: number; awayScore?: number; minute?: number; status?: string } | null;
};
type LiveTennis = {
  id: string;
  tournament?: string;
  playerA?: { name?: string };
  playerB?: { name?: string };
  player1_sets?: number;
  player2_sets?: number;
  current_set?: number;
  current_game_p1?: number;
  current_game_p2?: number;
  is_serving_p1?: boolean;
};

const liveFetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

/** Vue « Live » — flux agrégé temps réel Tennis + Football (SWR 30 s). */
export function LiveNavView({ onSportSelect }: ViewProps) {
  const { data: foot } = useSWR<{ matches?: LiveFoot[] }>("/api/football/live", liveFetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });
  const { data: tennis } = useSWR<{ matches?: LiveTennis[] }>("/api/tennis/live", liveFetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  const footMatches = foot?.matches ?? [];
  const tennisMatches = tennis?.matches ?? [];
  const total = footMatches.length + tennisMatches.length;

  return (
    <ViewShell
      icon={Radio}
      title="Matchs en direct"
      desc={`${total} match${total > 1 ? "s" : ""} en cours · actualisation toutes les 30 s`}
    >
      {total === 0 ? (
        <p className="rounded-xl border border-white/5 bg-zinc-900/60 p-4 text-sm text-zinc-500">
          Aucun match en direct pour l'instant. Les rencontres apparaissent ici dès le coup d'envoi.
        </p>
      ) : (
        <div className="space-y-5">
          {/* Football */}
          {footMatches.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Football · {footMatches.length}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {footMatches.slice(0, 12).map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-zinc-900/60 px-3 py-2"
                  >
                    <span className="w-9 shrink-0 rounded bg-red-500/15 px-1 py-0.5 text-center font-mono text-[10px] font-bold tabular-nums text-red-300">
                      {m.live?.status === "HT" ? "MT" : `${m.live?.minute ?? ""}'`}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                      {m.home?.name} <span className="text-slate-600">vs</span> {m.away?.name}
                    </span>
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-emerald-400">
                      {m.live?.homeScore ?? 0}–{m.live?.awayScore ?? 0}
                    </span>
                  </li>
                ))}
                {footMatches.length > 12 && (
                  <li className="px-3 text-[11px] text-zinc-500">+ {footMatches.length - 12} autres…</li>
                )}
              </ul>
            </div>
          )}

          {/* Tennis */}
          {tennisMatches.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Tennis · {tennisMatches.length}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {tennisMatches.slice(0, 12).map((m) => {
                  const serving = m.is_serving_p1 ? "●" : "";
                  const servingB = !m.is_serving_p1 ? "●" : "";
                  return (
                    <li
                      key={m.id}
                      className="rounded-lg border border-white/5 bg-zinc-900/60 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm text-slate-200">
                          <span aria-hidden className="text-emerald-400">{serving}</span>{" "}
                          {m.playerA?.name}{" "}
                          <span className="text-slate-600">vs</span>{" "}
                          {m.playerB?.name}{" "}
                          <span aria-hidden className="text-emerald-400">{servingB}</span>
                        </p>
                        <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-emerald-400">
                          {m.player1_sets ?? 0}–{m.player2_sets ?? 0}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-zinc-500">
                        {m.tournament}
                        {m.current_set != null && (
                          <>
                            {" "}· Set {m.current_set} ({m.current_game_p1 ?? 0}-{m.current_game_p2 ?? 0})
                          </>
                        )}
                      </p>
                    </li>
                  );
                })}
                {tennisMatches.length > 12 && (
                  <li className="px-3 text-[11px] text-zinc-500">+ {tennisMatches.length - 12} autres…</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Accès aux analyses complètes par sport */}
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { id: "tennis", label: "Analyse tennis" },
          { id: "football", label: "Analyse football" },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSportSelect(s.id)}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {s.label}
          </button>
        ))}
      </div>
    </ViewShell>
  );
}

/** Vue « Value » — meilleurs edges tennis calculés depuis les cotes bookmakers. */
export function ValueNavView() {
  const { tennisData, tennisLoading } = useDashboardData();

  const rows = useMemo(() => {
    const out: { id: string; title: string; tournament: string; side: "A" | "B"; bookmaker: string; edge: number }[] = [];
    for (const m of tennisData?.matches ?? []) {
      let best: { side: "A" | "B"; bookmaker: string; edge: number } | null = null;
      for (const o of m.allOdds ?? []) {
        // impliedProbA/B sont en 0-100 chez tous les producteurs (bsd-fetcher,
        // real-matches, mocks) — soustraction directe comme les autres vues.
        const eA = m.probA - o.impliedProbA;
        const eB = m.probB - o.impliedProbB;
        const cand =
          eA >= eB
            ? { side: "A" as const, bookmaker: o.bookmaker, edge: eA }
            : { side: "B" as const, bookmaker: o.bookmaker, edge: eB };
        if (!best || cand.edge > best.edge) best = cand;
      }
      if (best && best.edge > 0) {
        out.push({
          id: m.id,
          title: `${m.playerA.name} vs ${m.playerB.name}`,
          tournament: m.tournament,
          side: best.side,
          bookmaker: best.bookmaker,
          edge: best.edge,
        });
      }
    }
    return out.sort((a, b) => b.edge - a.edge).slice(0, 8);
  }, [tennisData?.matches]);

  return (
    <ViewShell
      icon={Gem}
      title="Value bets"
      desc="Écarts entre probabilités du modèle et cotes dévigées des bookmakers."
    >
      {tennisLoading ? (
        <p className="py-4 text-sm text-zinc-500">Analyse des marchés en cours…</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-sm text-zinc-500">
          Aucun value bet détecté pour le moment. Reviens plus tard — le scanner tourne en continu.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={`${r.id}-${r.bookmaker}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-zinc-900/60 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{r.title}</p>
                <p className="truncate text-xs text-zinc-400">
                  {r.tournament} · {r.bookmaker} · joue {r.side === "A" ? r.title.split(" vs ")[0] : r.title.split(" vs ")[1]}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-bold tabular-nums text-emerald-400">
                +{r.edge.toFixed(1)} pts
              </span>
            </li>
          ))}
        </ul>
      )}
    </ViewShell>
  );
}

/** Vue « Favoris » — résumé des favoris et de la sélection courante. */
export function FavorisNavView({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const favoriteLeagueIds = useSportsSidebarStore((s) => s.favoriteLeagueIds);
  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);

  return (
    <ViewShell
      icon={Star}
      title="Favoris"
      desc="Tes ligues suivies et ta sélection de matchs en cours."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-4">
          <p className="text-sm font-semibold text-white">
            {favoriteLeagueIds.length > 0
              ? `${favoriteLeagueIds.length} ligue${favoriteLeagueIds.length > 1 ? "s" : ""} favorite${favoriteLeagueIds.length > 1 ? "s" : ""}`
              : "Aucune ligue favorite"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Étoile une ligue dans l'arborescence du filtre latéral pour la retrouver ici.
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-4">
          <p className="text-sm font-semibold text-white">
            {selectedMatchIds.length > 0
              ? `${selectedMatchIds.length} match${selectedMatchIds.length > 1 ? "s" : ""} sélectionné${selectedMatchIds.length > 1 ? "s" : ""}`
              : "Aucune sélection de matchs"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Clique des matchs dans le filtre latéral pour concentrer la grille dessus.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenDrawer}
        className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ListFilter className="h-4 w-4" aria-hidden />
        Ouvrir le filtre latéral
      </button>
    </ViewShell>
  );
}

/** Vue « Profil » — préférences d'affichage et raccourcis produits. */
export function ProfilNavView() {
  const tBankroll = useTranslations("bankroll");
  const tAbout = useTranslations("about");

  const shortcuts = [
    { href: "/bankroll" as const, onClick: undefined as (() => void) | undefined, icon: BarChart3, label: "Bet Manager", accent: "text-emerald-400 bg-emerald-500/10" },
    { href: "/ligues" as const, onClick: undefined as (() => void) | undefined, icon: Trophy, label: "Championnats", accent: "text-sky-400 bg-sky-500/10" },
    { href: null, onClick: () => openBankrollDialog(), icon: Wallet, label: tBankroll("trigger"), accent: "text-purple-400 bg-purple-500/10" },
    { href: null, onClick: () => openPaperTradingDialog(), icon: FlaskConical, label: "Paper Trading", accent: "text-amber-400 bg-amber-500/10" },
    { href: null, onClick: () => openApiDocsDialog(), icon: Code, label: "API & Docs", accent: "text-teal-400 bg-teal-500/10" },
    { href: null, onClick: () => openAboutDialog(), icon: User, label: tAbout("trigger"), accent: "text-zinc-300 bg-zinc-800" },
  ];

  return (
    <ViewShell
      icon={User}
      title="Profil & préférences"
      desc="Personnalise l'affichage et accède à tes outils."
    >
      <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Préférences</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
          <PushToggle />
          <EmailToggle />
        </div>
      </div>

      <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Mes outils</h3>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((s) => {
          const Icon = s.icon;
          const inner = (
            <>
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", s.accent)} aria-hidden>
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-white">{s.label}</span>
            </>
          );
          const cls =
            "flex min-h-[44px] items-center gap-3 rounded-xl border border-white/5 bg-zinc-900/60 p-3.5 text-left transition-colors hover:border-emerald-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
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

      <button
        type="button"
        onClick={openPrivacyDialog}
        className="mt-3 text-xs font-medium text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-300"
      >
        Gérer mes cookies
      </button>
    </ViewShell>
  );
}
