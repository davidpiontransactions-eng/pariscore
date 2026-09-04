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
    <section className="max-w-screen-2xl mx-auto w-full px-4 sm:px-6 pt-6">
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
  /** Champs enrichis du flux BSD (shapes réels de /api/tennis/live). */
  setsDetail?: Array<{ p1: number; p2: number }>;
  currentPoint?: { p1: number; p2: number };
  server?: "A" | "B";
  liveProbA?: number;
  liveProbB?: number;
  oddsA?: number | null;
  oddsB?: number | null;
  roundName?: string | null;
};

const liveFetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

/* ─────────────────────────────────────────────────────────────────────────
   Widget Live Tennis — style broadcast (références Sofascore/Flashscore :
   rangées joueurs alignées, colonnes de sets, jeu courant en accent,
   barre de proba, groupement par tournoi). Tokens PariScore uniquement.
   ───────────────────────────────────────────────────────────────────────── */

const TENNIS_LIVE_MAX = 15;

function fmtPoints(n?: number): string {
  if (n == null || !Number.isFinite(n)) return "";
  // BSD expose des points entiers (0/15/30/40/45=Ad selon flux) — affiché brut.
  return String(Math.round(n));
}

/** Carte d'un match live tennis : 2 rangées alignées + barre de probabilité. */
function TennisLiveMatchCard({ m }: { m: LiveTennis }) {
  const sets = Array.isArray(m.setsDetail) ? m.setsDetail : [];
  const nSets = Math.max(sets.length, 1);
  const server = m.server === "B" ? "B" : m.server === "A" ? "A" : m.is_serving_p1 ? "A" : null;
  const probA =
    typeof m.liveProbA === "number" && Number.isFinite(m.liveProbA)
      ? Math.min(100, Math.max(0, Math.round(m.liveProbA)))
      : null;
  const probB = probA != null ? 100 - probA : null;
  // Grille partagée par les 2 rangées pour un alignement broadcast parfait.
  const gridCols = `12px minmax(0,1fr) repeat(${nSets}, 26px) 54px`;

  const playerRow = (
    side: "p1" | "p2",
    name: string | undefined,
    isServing: boolean,
    probPct: number | null,
  ) => (
    <div className="grid items-center gap-x-1" style={{ gridTemplateColumns: gridCols }}>
      <span className="flex justify-center" aria-hidden>
        {isServing ? (
          <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(0,230,118,0.9)]" />
        ) : (
          <span className="block h-1.5 w-1.5" />
        )}
      </span>
      <span
        className={cn(
          "truncate text-[13px] leading-tight",
          isServing ? "font-semibold text-white" : "text-slate-300",
        )}
      >
        {name ?? "—"}
      </span>
      {Array.from({ length: nSets }, (_, i) => {
        const s = sets[i];
        if (!s) return <span key={i} />;
        const mine = side === "p1" ? s.p1 : s.p2;
        const other = side === "p1" ? s.p2 : s.p1;
        return (
          <span
            key={`s${i}`}
            className={cn(
              "text-center font-mono text-xs tabular-nums",
              mine > other ? "font-bold text-white" : "text-zinc-400",
            )}
          >
            {mine}
          </span>
        );
      })}
      {/* Jeu courant : encart accent + points en exposant */}
      <span className="flex items-center justify-center gap-0.5 rounded bg-emerald-500/10 px-1 py-0.5 font-mono text-xs font-bold tabular-nums text-emerald-300">
        {side === "p1" ? (m.current_game_p1 ?? 0) : (m.current_game_p2 ?? 0)}
        {showPoint(m, side) && (
          <sub className="text-[8px] font-medium text-emerald-400/80">
            {fmtPoints(side === "p1" ? m.currentPoint?.p1 : m.currentPoint?.p2)}
          </sub>
        )}
      </span>
      <span
        className={cn(
          "text-right font-mono text-[11px] tabular-nums",
          probPct != null && probPct >= 50 ? "font-bold text-emerald-300" : "text-zinc-600",
        )}
      >
        {probPct != null ? `${probPct}%` : ""}
      </span>
    </div>
  );

  return (
    <article className="rounded-xl border border-white/5 bg-zinc-900/60 p-3 transition-colors hover:border-emerald-500/30">
      {/* Statut + cotes */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
          </span>
          Set {(m.current_set ?? Math.max(sets.length - 1, 0)) + 1}
        </span>
        <span className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-zinc-400">
          {m.oddsA != null && <span className="rounded bg-zinc-800 px-1 py-px">{m.oddsA.toFixed(2)}</span>}
          {m.oddsB != null && <span className="rounded bg-zinc-800 px-1 py-px">{m.oddsB.toFixed(2)}</span>}
        </span>
      </div>

      {/* Rangées joueurs */}
      <div className="space-y-1">
        {playerRow("p1", m.playerA?.name, server === "A", probA)}
        {playerRow("p2", m.playerB?.name, server === "B", probB)}
      </div>

      {/* Barre de probabilité live */}
      {probA != null && (
        <div className="mt-2 flex h-1 overflow-hidden rounded-full bg-zinc-800" role="img" aria-label={`Probabilité ${probA}% / ${100 - probA}%`}>
          <span className="bg-emerald-500/90" style={{ width: `${probA}%` }} />
          <span className="flex-1 bg-sky-500/50" />
        </div>
      )}
    </article>
  );
}

function showPoint(m: LiveTennis, side: "p1" | "p2"): boolean {
  const v = side === "p1" ? m.currentPoint?.p1 : m.currentPoint?.p2;
  return typeof v === "number" && Number.isFinite(v);
}

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
        <p className="rounded-xl border border-white/5 bg-zinc-900/60 p-4 text-sm text-zinc-400">
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
                  <li className="px-3 text-[11px] text-zinc-400">+ {footMatches.length - 12} autres…</li>
                )}
              </ul>
            </div>
          )}

          {/* Tennis — widget broadcast groupé par tournoi */}
          {tennisMatches.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                Tennis · {tennisMatches.length}
                <span className="relative flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
              </h3>
              {(() => {
                const groups = new Map<string, LiveTennis[]>();
                for (const m of tennisMatches.slice(0, TENNIS_LIVE_MAX)) {
                  const t = m.tournament?.trim() || "Autres tournois";
                  const arr = groups.get(t) ?? [];
                  arr.push(m);
                  groups.set(t, arr);
                }
                const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
                return (
                  <div className="mt-2 space-y-4">
                    {ordered.map(([tournament, matches]) => (
                      <section key={tournament}>
                        <header className="mb-1.5 flex items-center gap-2">
                          <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-300/80" aria-hidden />
                          <h4 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
                            {tournament}
                          </h4>
                          <span className="shrink-0 rounded-full bg-zinc-800 px-1.5 py-px font-mono text-[9px] font-bold tabular-nums text-zinc-400">
                            {matches.length}
                          </span>
                        </header>
                        <ul className="space-y-2">
                          {matches.map((m) => (
                            <li key={m.id}>
                              <TennisLiveMatchCard m={m} />
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                    {tennisMatches.length > TENNIS_LIVE_MAX && (
                      <p className="text-[11px] text-zinc-400">
                        + {tennisMatches.length - TENNIS_LIVE_MAX} autres matchs…
                      </p>
                    )}
                  </div>
                );
              })()}
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
        <p className="py-4 text-sm text-zinc-400">Analyse des marchés en cours…</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-sm text-zinc-400">
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
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Préférences</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
          <PushToggle />
          <EmailToggle />
        </div>
      </div>

      <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Mes outils</h3>
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
        className="mt-3 text-xs font-medium text-zinc-400 underline underline-offset-2 transition-colors hover:text-zinc-300"
      >
        Gérer mes cookies
      </button>
    </ViewShell>
  );
}
