"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { HandballMatch } from "@/lib/handball-data";
import { buildFormStore, formSummaryStr } from "@/lib/handball-strategy-top8";
import {
  computeHandballPredictiveBets,
  devigHandball1x2,
  type HandballBetConfidence,
  type HandballPredictiveBet,
} from "@/lib/handball-predictive-bets";
import {
  computeHandballBonusMarkets,
  type BonusPick,
} from "@/lib/handball-bonus-markets";
import { HandballTeamLogo } from "@/components/handball/handball-team-logo";
import { HandballLeagueBadge } from "@/components/handball/handball-league-badge";
import { PlayerAvatar } from "@/components/ui/player-avatar";
// Type-only : le module handball-players lit fs.readFileSync (server-only) —
// le snapshot joueurs est servi par la route /api/handball/players.
import type { HblPlayer, HblTeamTopPlayers } from "@/lib/handball-players";
// Stats historique (table handball_match_history) : types purs + seuil 55 %.
import { PROB_FLOOR, BET_FLOOR, lineFlag, type OverLine, type ScorerThreshold, type TeamHistoryStats } from "@/lib/handball-history-stats";
// Rendu markdown de l'analyse IA (réponse Gemini, générée côté serveur).
import Markdown from "react-markdown";

type Props = {
  match: HandballMatch | null;
  /** Matchs terminés du snapshot → forme récente + paris ajustés (engine G3). */
  finished?: HandballMatch[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// ─── DTO joueurs (miroir de /api/handball/players) ───

type PlayersTops = { home: HblTeamTopPlayers; away: HblTeamTopPlayers };

type PlayersState = "idle" | "ready" | "error";

// ─── DTO analyse Over (miroir de /api/handball/analysis) ───

type AnalysisScorer = {
  name: string;
  team: string;
  goals: number;
  games: number;
  avgGoals: number;
  lambda: number;
  probs: ScorerThreshold[];
  /** Photo (snapshot Wikipedia) — null → initiales (PlayerAvatar). */
  photoUrl?: string | null;
};

/** Vue StarLigue d'une équipe (miroir /api/handball/analysis). */
type StarLigueSide = {
  team: string;
  played: number | null;
  standing: {
    rank: number;
    points: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
  } | null;
  metrics: { key: string; label: string; total: number | null; avg: number | null }[];
};

type AnalysisPayload = {
  ok: boolean;
  model: {
    base: number;
    observedMean: number | null;
    scale: number;
    lambdaH: number;
    lambdaA: number;
    nu: number;
    expectedTotal: number;
  };
  over: { floor: number; lines: OverLine[]; pick: OverLine | null };
  match1x2: { home: number; draw: number; away: number };
  teams: { home: TeamHistoryStats | null; away: TeamHistoryStats | null };
  starligue: {
    season: string | null;
    scrapedAt: string | null;
    metrics: { order: string; key: string; label: string }[];
    home: StarLigueSide | null;
    away: StarLigueSide | null;
  } | null;
  scorers: { home: AnalysisScorer[]; away: AnalysisScorer[] };
  method: string[];
  meta: { n: number; minDate: string | null; maxDate: string | null; lastRun: string | null } | null;
};

/** DTO de l'analyse IA (miroir /api/handball/ai-analysis — cache VPS 24h). */
type AiAnalysis = {
  ok: true;
  cached: boolean;
  generatedAt: string;
  expiresInHours: number;
  model: string;
  latencyMs: number;
  text: string;
};

// Cache module : slot unique « dernier URL gagnant » (match B écrase le slot
// du match A) — le snapshot joueurs ne bouge pas pendant la session, donc une
// seule requête par URL réutilisée aux réouvertures. Les échecs ne sont JAMAIS
// cachés : le slot est libéré pour retenter au prochain ouverture (sinon une
// seule erreur = colonnes joueurs vides définitives pour la session).
let playersReq: { url: string; promise: Promise<PlayersTops | null> } | null = null;

function fetchPlayersTops(url: string): Promise<PlayersTops | null> {
  if (playersReq?.url === url) return playersReq.promise;
  const promise = fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<PlayersTops>) : null))
    .catch(() => null)
    .then((d) => {
      const tops = d && d.home && d.away ? d : null;
      // Pas de cache d'échec : si c'est toujours DERNIÈRE entrée du slot,
      // on la retire (une entrée plus récente d'une autre URL n'est pas touchée).
      if (tops == null && playersReq?.url === url) playersReq = null;
      return tops;
    });
  playersReq = { url, promise };
  return promise;
}

// Cache module identique pour l'analyse Over (un seul fetch par match ouvert,
// réouverture instantanée ; les échecs ne sont jamais mis en cache).
let analysisReq: { url: string; promise: Promise<AnalysisPayload | null> } | null = null;

function fetchAnalysis(url: string): Promise<AnalysisPayload | null> {
  if (analysisReq?.url === url) return analysisReq.promise;
  const promise = fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<AnalysisPayload>) : null))
    .catch(() => null)
    .then((d) => {
      const payload = d && d.ok ? d : null;
      if (payload == null && analysisReq?.url === url) analysisReq = null;
      return payload;
    });
  analysisReq = { url, promise };
  return promise;
}

// Cache module pour l'analyse IA : la 1ʳᵉ ouverture génère (20-60 s), les
// suivantes sont servies du cache VPS 24h — jamais de cache d'erreur.
let aiReq: { url: string; promise: Promise<AiAnalysis | null> } | null = null;

function fetchAiAnalysis(url: string): Promise<AiAnalysis | null> {
  if (aiReq?.url === url) return aiReq.promise;
  const promise = fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<AiAnalysis>) : null))
    .catch(() => null)
    .then((payload) => {
      if (payload == null && aiReq?.url === url) aiReq = null;
      return payload;
    });
  aiReq = { url, promise };
  return promise;
}

// ─── Forme (TeamForm n'est pas exporté par strategy-top8 : type dérivé) ───

type TeamFormEntry = NonNullable<ReturnType<ReturnType<typeof buildFormStore>["get"]>>;

type TeamFormView = {
  /** Séquence FR des 5 derniers (W/D/L bruts, convertis à l'affichage). */
  seq: string;
  /** Buts marqués / match sur les 5 derniers. */
  scoredAvg: number | null;
  /** Buts encaissés / match sur les 5 derniers. */
  concededAvg: number | null;
  /** Total de buts / match (marqués + encaissés) = rythme de la rencontre. */
  totalAvg: number | null;
  /** Différence de buts / match (marqués - encaissés). */
  diffAvg: number | null;
  /** Nombre de matchs pris dans la fenêtre L5 (affiché en légende). */
  played: number;
};

/** Moyenne à 1 décimale, null si tableau vide (jamais de NaN affiché). */
function avg1(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/** Vue forme d'une équipe, null si historique absent (skip propre). */
function formView(f: TeamFormEntry | undefined): TeamFormView | null {
  if (!f || f.gf.length === 0) return null;
  const seq = formSummaryStr(f, 5);
  if (seq === "---") return null;
  const gf = f.gf.slice(-5);
  const ga = f.ga.slice(-5);
  const scoredAvg = avg1(gf);
  const concededAvg = avg1(ga);
  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    seq,
    scoredAvg,
    concededAvg,
    // Dérivées recalculées sur les mêmes moyennes (1 seul arrondi source)
    totalAvg:
      scoredAvg != null && concededAvg != null ? round1(scoredAvg + concededAvg) : null,
    diffAvg:
      scoredAvg != null && concededAvg != null ? round1(scoredAvg - concededAvg) : null,
    played: gf.length,
  };
}

/** W/D/L → V/N/D (libellés FR affichés). */
function frSeq(seq: string): string {
  return seq.replace(/W/g, "V").replace(/D/g, "N").replace(/L/g, "D");
}

function fmtNum(v: number | null | undefined): string {
  return v == null ? "—" : String(v);
}

/** Écart signé à 1 décimale (« +2.6 » / « -1.2 »), « — » si absent. */
function fmtDiff(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}

// ─── Tokens confiance (alignés widgets handball : emerald / amber / red) ───

const CONFIDENCE_CLS: Record<HandballBetConfidence, string> = {
  haute: "text-emerald-500 bg-emerald-500/10 ring-emerald-500/30",
  moyenne: "text-amber-500 bg-amber-500/10 ring-amber-500/30",
  basse: "text-red-500 bg-red-500/10 ring-red-500/30",
};

/** Couleur texte de la proba par bande (chips bonus — miroir CONFIDENCE_CLS). */
const CONFIDENCE_TEXT: Record<HandballBetConfidence, string> = {
  haute: "text-emerald-500",
  moyenne: "text-amber-500",
  basse: "text-red-500",
};

/** Source du calcul → libellé court FR. */
const SOURCE_LABEL: Record<HandballPredictiveBet["source"], string> = {
  model: "modèle cmp/skellam",
  cotes: "cotes dévigées",
  "form-fallback": "forme indisponible",
  "elo-fallback": "repli",
};

// ─── Petits composants internes ───

/** Pastille W/D/L d'une séquence de forme (V vert, N ciel, D rose). */
function FormSequence({ seq }: { seq: string }) {
  const colors: Record<string, string> = {
    W: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/30",
    D: "bg-sky-500/15 text-sky-500 ring-sky-500/30",
    L: "bg-rose-500/15 text-rose-500 ring-rose-500/30",
  };
  const fr: Record<string, string> = { W: "V", D: "N", L: "D" };
  const title: Record<string, string> = { W: "Victoire", D: "Nul", L: "Défaite" };
  return (
    <span className="inline-flex gap-1">
      {seq.split("").map((r, i) => (
        <span
          key={i}
          title={title[r] ?? r}
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ring-1 ${colors[r] ?? "bg-muted dark:bg-white/[0.08] text-muted-foreground ring-border"}`}
        >
          {fr[r] ?? r}
        </span>
      ))}
    </span>
  );
}

/** Ligne comparative 2 colonnes : valeur home (emerald) / label / valeur away (sky). */
function CompareRow({
  label,
  home,
  away,
}: {
  label: string;
  home: string;
  away: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px]">
      <span className="text-right font-semibold tabular-nums text-emerald-500">{home}</span>
      <span className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-left font-semibold tabular-nums text-sky-500">{away}</span>
    </div>
  );
}

/**
 * Ligne comparative à barre pooled 2 couleurs (chiffres aux extrémités,
 * barre proportionnelle dessous) — format Fotmob, tient à 390 px :
 * pas de colonne fixe, la barre prend toute la largeur restante.
 */
function CompareBar({
  label,
  home,
  away,
}: {
  label: string;
  home: number;
  away: number;
}) {
  const total = home + away;
  // Total nul (0-0) → barre à mi-chausse, jamais de division par zéro.
  const homePct = total > 0 ? Math.round((home / total) * 100) : 50;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold tabular-nums text-emerald-500">{home}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums text-sky-500">{away}</span>
      </div>
      <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-muted dark:bg-white/[0.07]">
        <div className="bg-emerald-500" style={{ width: `${homePct}%` }} />
        <div className="bg-sky-500" style={{ width: `${100 - homePct}%` }} />
      </div>
    </div>
  );
}

/** Case d'un des 3 paris prédictifs (prob %, cote, edge, EV, Kelly, confiance). */
function PredictiveBetTile({ bet }: { bet: HandballPredictiveBet }) {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-base leading-none" aria-hidden="true">
          {bet.icon}
        </span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${CONFIDENCE_CLS[bet.confidence]}`}
        >
          {bet.confidence}
        </span>
      </div>
      <p className="mt-1.5 truncate text-[11px] font-semibold text-foreground">{bet.label}</p>
      <p className="text-2xl font-black tabular-nums text-emerald-500">
        {bet.prob.toFixed(1)}
        <span className="text-sm font-bold">%</span>
      </p>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted dark:bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-emerald-400"
          style={{ width: `${Math.min(100, Math.max(0, Math.round(bet.prob)))}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] tabular-nums text-muted-foreground">
        {bet.odds != null ? (
          <>
            <span>cote {bet.odds.toFixed(2)}</span>
            {bet.edge != null && (
              <span className={bet.edge >= 0 ? "text-emerald-500" : "text-red-500"}>
                edge {bet.edge >= 0 ? "+" : ""}
                {bet.edge.toFixed(1)}%
              </span>
            )}
            {bet.ev != null && (
              <span className={bet.ev >= 0 ? "text-emerald-500" : "text-red-500"}>
                EV {bet.ev >= 0 ? "+" : ""}
                {(bet.ev * 100).toFixed(1)}%
              </span>
            )}
            {bet.kelly != null && <span>Kelly {(bet.kelly * 100).toFixed(1)}%</span>}
          </>
        ) : (
          <span className="text-amber-500">prob seule · pas de cote</span>
        )}
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
        {SOURCE_LABEL[bet.source]}
      </p>
    </div>
  );
}

/** Groupe de picks bonus (chips compacts : label, prob, badge confiance, edge). */
function BonusGroup({ title, picks }: { title: string; picks: BonusPick[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {picks.map((p, i) => (
          <span
            key={`${p.label}-${i}`}
            className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-1"
          >
            <span className="max-w-full truncate text-[10px] text-foreground/90">{p.label}</span>
            <span
              className={`text-[10px] font-bold tabular-nums ${CONFIDENCE_TEXT[p.confidence]}`}
            >
              {p.prob}%
            </span>
            <span
              className={`rounded-full px-1 py-px text-[9px] font-bold uppercase ring-1 ${CONFIDENCE_CLS[p.confidence]}`}
            >
              {p.confidence}
            </span>
            {p.edge != null && (
              <span
                className={`text-[10px] font-semibold tabular-nums ${p.edge >= 0 ? "text-emerald-500" : "text-red-500"}`}
              >
                {p.edge >= 0 ? "+" : ""}
                {p.edge}%
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ligne « joueur champ » : buts, moyenne/match, passes si dispo. */
function playerLine(p: HblPlayer): string {
  const avg = p.avgGoals ?? (p.games > 0 ? Math.round((p.goals / p.games) * 10) / 10 : null);
  const parts = [`${p.goals} buts`];
  if (avg != null) parts.push(`${avg}/m`);
  if (p.assists != null && p.assists > 0) parts.push(`${p.assists} passes`);
  return parts.join(" · ");
}

/** Colonne « meilleurs joueurs » d'une équipe (GK + top field), 2 colonnes côte à côte. */
function PlayerColumn({
  name,
  variant,
  tops,
  state,
}: {
  name: string;
  variant: "home" | "away";
  tops: HblTeamTopPlayers | null;
  state: PlayersState;
}) {
  const borderCls =
    variant === "home" ? "border-emerald-500/20" : "border-sky-500/20";
  const labelCls =
    variant === "home" ? "text-emerald-500" : "text-sky-500";
  const header = (
    <div className="flex min-w-0 items-center gap-1.5">
      <HandballTeamLogo name={name} size={16} />
      <span className={`truncate text-[11px] font-bold uppercase tracking-wider ${labelCls}`}>
        {name}
      </span>
    </div>
  );

  if (state === "idle") {
    return (
      <div className={`rounded-lg border ${borderCls} p-2.5`}>
        {header}
        <p className="mt-2 text-[11px] text-muted-foreground" aria-live="polite">
          Chargement des stats joueurs…
        </p>
      </div>
    );
  }

  const empty = !tops || (tops.gk.length === 0 && tops.field.length === 0);
  if (empty) {
    return (
      <div className={`rounded-lg border ${borderCls} p-2.5`}>
        {header}
        <p className="mt-2 text-[11px] text-muted-foreground">Stats joueurs indisponibles</p>
      </div>
    );
  }

  const gk = tops.gk[0];
  const gkLine =
    gk && (gk.savePct != null || gk.saves != null)
      ? gk.savePct != null
        ? `${gk.savePct}% d'arrêts${gk.saves != null ? ` (${gk.saves})` : ""}`
        : `${gk.saves} arrêts`
      : null;

  return (
    <div className={`rounded-lg border ${borderCls} p-2.5`}>
      {header}
      {gk && (
        <div className="mt-2 flex items-center gap-2 rounded bg-muted/40 px-2 py-1.5 dark:bg-white/[0.06]">
          <PlayerAvatar name={gk.name} photoUrl={gk.photoUrl} size="xs" sport="handball" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold">
              {gk.name} <span className="font-normal text-muted-foreground">· gardien</span>
            </p>
            {gkLine && (
              <p className="text-[10px] tabular-nums text-muted-foreground">{gkLine}</p>
            )}
          </div>
        </div>
      )}
      {tops.field.length > 0 && (
        <ul className="mt-1.5 divide-y divide-border">
          {tops.field.map((p) => (
            <li
              key={`${p.name}-${p.team}`}
              className="flex items-center justify-between gap-2 py-1 text-[11px]"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size="xs" sport="handball" />
                <span className="truncate font-medium">{p.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {playerLine(p)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Onglet « Over & Buteurs » (historique handball_match_history) ──────────

/** Nombre à 1 décimale, « — » si absent (jamais de NaN affiché). */
function n1(v: number | null | undefined): string {
  return v == null ? "—" : v.toFixed(1);
}

/** Signe explicite pour les écarts (« +3.2 » / « −1.4 »). */
function signed1(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}

/**
 * Tableau documenté d'une équipe : buts marqués / encaissés / différence /
 * PPG, sur L5 et L10, en situation Home (l'équipe reçoit) ET Away (l'équipe
 * est reçue) — colonnes L5 dom · L5 ext · L10 dom · L10 ext.
 */
function SplitTable({ stats, variant }: { stats: TeamHistoryStats | null; variant: "home" | "away" }) {
  if (!stats) {
    return (
      <p className="text-[11px] leading-snug text-muted-foreground">
        Aucun historique en base pour cette équipe — la couverture s&apos;étoffe à chaque run
        hebdomadaire du cron.
      </p>
    );
  }
  const accent = variant === "home" ? "text-emerald-500" : "text-sky-500";
  const rows: { label: string; get: (s: TeamHistoryStats, window: "l5" | "l10", side: "home" | "away") => string }[] = [
    { label: "Marqués", get: (s, w, side) => n1(s[side][w].scored) },
    { label: "Encaissés", get: (s, w, side) => n1(s[side][w].conceded) },
    { label: "Diff.", get: (s, w, side) => signed1(s[side][w].diff) },
    { label: "PPG", get: (s, w, side) => n1(s[side][w].ppg) },
  ];
  return (
    <div className="rounded-lg border border-border p-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`truncate text-[11px] font-bold uppercase tracking-wider ${accent}`}>
          {stats.name}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {stats.n} matchs · {stats.wins}V {stats.draws}N {stats.losses}D
        </span>
      </div>
      <div className="mt-1.5 overflow-x-auto">
        <table className="w-full text-[10px] tabular-nums">
          <thead>
            <tr className="text-muted-foreground">
              <th className="pb-1 pr-1 text-left font-medium">Situation</th>
              <th className="pb-1 px-1 text-right font-medium">L5 dom</th>
              <th className="pb-1 px-1 text-right font-medium">L5 ext</th>
              <th className="pb-1 px-1 text-right font-medium">L10 dom</th>
              <th className="pb-1 pl-1 text-right font-medium">L10 ext</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="py-0.5 pr-1 text-left text-muted-foreground">{r.label}</td>
                <td className="py-0.5 px-1 text-right font-semibold text-foreground">
                  {r.get(stats, "l5", "home")}
                </td>
                <td className="py-0.5 px-1 text-right font-semibold text-foreground">
                  {r.get(stats, "l5", "away")}
                </td>
                <td className="py-0.5 px-1 text-right font-semibold text-foreground">
                  {r.get(stats, "l10", "home")}
                </td>
                <td className="py-0.5 pl-1 text-right font-semibold text-foreground">
                  {r.get(stats, "l10", "away")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
        <span>
          Winrate{" "}
          <span className="font-semibold text-foreground">
            {stats.winrate == null ? "—" : `${Math.round(stats.winrate * 100)}%`}
          </span>
        </span>
        <span>
          dom{" "}
          <span className="font-semibold text-foreground">
            {stats.winrateHome == null ? "—" : `${Math.round(stats.winrateHome * 100)}%`}
          </span>
        </span>
        <span>
          ext{" "}
          <span className="font-semibold text-foreground">
            {stats.winrateAway == null ? "—" : `${Math.round(stats.winrateAway * 100)}%`}
          </span>
        </span>
        <span className="ml-auto">Forme {stats.lastSeq || "—"}</span>
      </div>
      <p className="mt-0.5 text-[9px] leading-tight text-muted-foreground/70">
        dom = l&apos;équipe reçoit ({stats.home.l5.n}L5/{stats.home.l10.n}L10) · ext = elle est
        reçue ({stats.away.l5.n}L5/{stats.away.l10.n}L10)
      </p>
    </div>
  );
}

/** Échelle Over : une chip par ligne — verte si ≥ 55 %, pill « pari » si ≥ 60 %. */
function OverLadder({ lines, floor }: { lines: OverLine[]; floor: number }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {lines.map((l) => {
        const flag = lineFlag(l.over);
        const playable = l.over >= floor;
        return (
          <div
            key={l.line}
            className={`rounded-lg border px-1.5 py-1.5 text-center ${
              flag === "bet"
                ? "border-emerald-500/60 bg-emerald-500/15 ring-1 ring-emerald-500/30"
                : playable
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-border bg-muted/30 dark:bg-white/[0.04]"
            }`}
          >
            <p
              className={`text-[9px] uppercase tracking-wider ${playable ? "text-emerald-500" : "text-muted-foreground"}`}
            >
              over {l.line}
            </p>
            <p
              className={`text-sm font-black tabular-nums ${playable ? "text-emerald-500" : "text-foreground/80"}`}
            >
              {(l.over * 100).toFixed(0)}
              <span className="text-[10px] font-bold">%</span>
            </p>
            {flag === "bet" && (
              <span className="mt-0.5 inline-block rounded-full bg-emerald-500 px-1.5 py-px text-[8px] font-black uppercase tracking-wider text-background">
                pari
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Un buteur : ligne + chips P(≥2/3/4/5), vertes si ≥ 55 %. */
function ScorerRow({ p, variant }: { p: AnalysisScorer; variant: "home" | "away" }) {
  const border = variant === "home" ? "border-emerald-500/20" : "border-sky-500/20";
  const accent = variant === "home" ? "text-emerald-500" : "text-sky-500";
  return (
    <div className={`rounded-lg border ${border} px-2 py-1.5`}>
      <div className="flex items-center gap-2">
        {/* Photo du buteur (Wikipedia) — initiales si absente */}
        <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size="xs" sport="handball" />
        <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
          <span className="truncate text-[11px] font-semibold">{p.name}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {n1(p.avgGoals)}/m · {p.goals} buts ({p.games} m)
          </span>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {p.probs.map((t) => (
          <span
            key={t.n}
            title={`${t.n} buts ou plus — ${(t.p * 100).toFixed(1)} %`}
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ring-1 ${
              t.playable
                ? "bg-emerald-500/15 text-emerald-500 ring-emerald-500/30"
                : "bg-muted text-muted-foreground ring-border dark:bg-white/[0.06]"
            }`}
          >
            {t.n}+ {(t.p * 100).toFixed(0)}%
          </span>
        ))}
      </div>
      <p className="mt-0.5 text-[9px] text-muted-foreground/70">
        λ ajusté {p.lambda.toFixed(1)} buts attendus
      </p>
      {p.probs.some((t) => t.playable) ? null : (
        <p className={`text-[9px] font-semibold ${accent}`}>aucun seuil ≥ 55 %</p>
      )}
    </div>
  );
}

/**
 * Bloc StarLigue de l'onglet Stats : classement (rang, points, V-N-D, diff)
 * + 5 métriques/équipe (buts marqués/encaissés, arrêts, passes, pertes),
 * snapshots lnh.fr — sert à informer le parieur même sans forme ni cotes.
 */
function StarLigueBlock({
  data,
  homeName,
  awayName,
}: {
  data: NonNullable<AnalysisPayload["starligue"]>;
  homeName: string;
  awayName: string;
}) {
  const h = data.home;
  const a = data.away;
  if (!h && !a) return null;

  const metricAvg = (side: typeof h, key: string): string => {
    const m = side?.metrics.find((x) => x.key === key);
    return m?.avg == null ? "—" : m.avg.toFixed(1);
  };
  const rows: { label: string; home: string; away: string }[] = [];

  if (h?.standing || a?.standing) {
    const hs = h?.standing;
    const as_ = a?.standing;
    rows.push({ label: "Rang", home: hs ? `#${hs.rank}` : "—", away: as_ ? `#${as_.rank}` : "—" });
    rows.push({
      label: "Points",
      home: hs ? String(hs.points) : "—",
      away: as_ ? String(as_.points) : "—",
    });
    rows.push({
      label: "V - N - D",
      home: hs ? `${hs.wins}-${hs.draws}-${hs.losses}` : "—",
      away: as_ ? `${as_.wins}-${as_.draws}-${as_.losses}` : "—",
    });
    rows.push({
      label: "Diff. buts",
      home: hs ? signed1(hs.goalDiff) : "—",
      away: as_ ? signed1(as_.goalDiff) : "—",
    });
  }

  for (const def of data.metrics) {
    const homeAvg = metricAvg(h, def.key);
    const awayAvg = metricAvg(a, def.key);
    if (homeAvg === "—" && awayAvg === "—") continue;
    rows.push({ label: def.label, home: homeAvg, away: awayAvg });
  }

  if (rows.length === 0) return null;

  return (
    <section className="space-y-2">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          StarLigue — classement &amp; stats équipes
        </h4>
        <span className="text-[10px] text-muted-foreground">saison {data.season ?? "—"}</span>
      </header>
      <div className="rounded-lg border border-border p-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pb-1.5">
          <span className="truncate text-right text-[11px] font-bold text-emerald-500">
            {h?.team ?? homeName}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">vs</span>
          <span className="truncate text-left text-[11px] font-bold text-sky-500">
            {a?.team ?? awayName}
          </span>
        </div>
        <div className="space-y-1.5">
          {rows.map((r) => (
            <CompareRow key={r.label} label={r.label} home={r.home} away={r.away} />
          ))}
        </div>
        <p className="mt-1.5 text-[9px] leading-tight text-muted-foreground/70">
          Source lnh.fr · moyennes / match · snapshot {data.scrapedAt ?? "—"}
          {(h?.played ?? a?.played) != null ? ` · ${h?.played ?? a?.played} j joués` : ""}
        </p>
      </div>
    </section>
  );
}

/** Contenu de l'onglet « IA » : analyse prédictive Gemini (cache VPS 24h). */
function AiTab({
  state,
  ai,
}: {
  state: "idle" | "loading" | "ready" | "error";
  ai: AiAnalysis | null;
}) {
  if (state === "idle" || state === "loading") {
    return (
      <div className="py-6 text-center text-[11px] text-muted-foreground" aria-live="polite">
        <p className="font-semibold text-foreground">Génération de l&apos;analyse IA…</p>
        <p className="mt-1">
          1ʳᵉ demande : 20 à 60 s. Ensuite, l&apos;analyse est mise en mémoire 24 h sur le serveur
          (aucun coût Gemini).
        </p>
      </div>
    );
  }
  if (state === "error" || !ai) {
    return (
      <p className="py-6 text-center text-[11px] text-muted-foreground">
        Analyse IA indisponible (quota / clé Gemini ou service en erreur) — réessaie dans un
        instant, les données chiffrées restent dans les onglets Over &amp; Stats.
      </p>
    );
  }
  const when = new Date(ai.generatedAt);
  const stamp = `${String(when.getDate()).padStart(2, "0")}/${String(when.getMonth() + 1).padStart(2, "0")} ${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            ai.cached ? "bg-muted text-muted-foreground" : "bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30"
          }`}
        >
          {ai.cached ? "déjà en mémoire" : "analysé maintenant"}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          analyse du {stamp} · expire dans ~{ai.expiresInHours} h · {ai.model}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-foreground [&_h1]:mb-2 [&_h1]:text-sm [&_h1]:font-bold [&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:text-xs [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wider [&_h3]:font-semibold [&_li]:mb-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-1.5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4">
        <Markdown>{ai.text}</Markdown>
      </div>

      <p className="text-[10px] font-medium text-amber-500">
        ⚠️ Aide à la décision, pas un conseil de pari — l&apos;IA peut se tromper (absences,
        cotes : à vérifier).
      </p>
    </div>
  );
}

/** Contenu complet de l'onglet Over & Buteurs. */
function OverBetsTab({ analysis }: { analysis: AnalysisPayload }) {
  const { model, over, match1x2, scorers, method, meta } = analysis;
  const pickLine = over.pick;
  return (
    <div className="space-y-3">
      {/* En-tête : total attendu + ligne jouable + 1X2 */}
      <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Over points
          </h4>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            total attendu {model.expectedTotal.toFixed(1)} · base {model.base}
          </span>
        </div>
        <p className="mt-1 text-sm">
          {pickLine ? (
            <>
              <span className="font-bold">Ligne jouable : Over {pickLine.line}</span>{" "}
              <span className="font-black tabular-nums text-emerald-500">
                {(pickLine.over * 100).toFixed(1)}%
              </span>
              {lineFlag(pickLine.over) === "bet" && (
                <span className="ml-2 inline-block rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-background">
                  pari ≥60%
                </span>
              )}
            </>
          ) : (
            <span className="font-bold text-amber-500">
              Aucune ligne ≥ {Math.round(over.floor * 100)} % — pas de pari Over sur ce match
            </span>
          )}
        </p>
        <div className="mt-2 flex justify-between text-[11px] tabular-nums">
          <span className="text-emerald-500">1 : {match1x2.home.toFixed(1)}%</span>
          <span className="text-muted-foreground">X : {match1x2.draw.toFixed(1)}%</span>
          <span className="text-sky-500">2 : {match1x2.away.toFixed(1)}%</span>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground/80">
          {meta
            ? `Historique : ${meta.n} matchs (${meta.minDate ?? "?"} → ${meta.maxDate ?? "?"})`
            : "Historique indisponible"}{" "}
            · ν {model.nu.toFixed(2)} · calibr. ×{model.scale.toFixed(3)}
        </p>
      </section>

      {/* Échelle complète 59.5 → 52.5 */}
      <section className="space-y-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Échelle Over (59.5 → 52.5)
        </h4>
        <OverLadder lines={over.lines} floor={over.floor} />
        <p className="text-[10px] leading-snug text-muted-foreground">
          P(total &gt; ligne) — vert = réussite ≥ {Math.round(over.floor * 100)} %, pill « pari » =
          bet predictif ≥ {Math.round(BET_FLOOR * 100)} %. Écart de 1 à 3 buts selon la ligne
          retenue.
        </p>
      </section>

      {/* Stats équipes : voir l'onglet « Stats » (splits L5/L10 dom/ext) */}

      {/* Buteurs */}
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          2 meilleurs buteurs — « au moins N buts »
        </h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            {scorers.home.length ? (
              scorers.home.map((p) => <ScorerRow key={`${p.name}-${p.team}`} p={p} variant="home" />)
            ) : (
              <p className="text-[11px] text-muted-foreground">Buteurs indisponibles (snapshot HBL/LNH)</p>
            )}
          </div>
          <div className="space-y-1.5">
            {scorers.away.length ? (
              scorers.away.map((p) => <ScorerRow key={`${p.name}-${p.team}`} p={p} variant="away" />)
            ) : (
              <p className="text-[11px] text-muted-foreground">Buteurs indisponibles (snapshot HBL/LNH)</p>
            )}
          </div>
        </div>
      </section>

      {/* Méthode documentée */}
      <details className="rounded-lg border border-border bg-muted/30 px-3 py-2 dark:bg-white/[0.04]">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Méthode &amp; sources
        </summary>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[10px] leading-snug text-muted-foreground">
          {method.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

// ─── Dialog ───

export function HandballMatchDetailDialog({
  match,
  finished,
  open,
  onOpenChange,
}: Props) {
  // Form store unique (mémo) : alimente à la fois les 3 paris et l'affichage forme.
  const formStore = useMemo(() => {
    if (!finished || finished.length === 0) return null;
    // Garde-fou : sans ids d'équipe, toutes les équipes tomberaient dans le
    // même bucket "undefined" → on saute la forme plutôt que d'afficher du faux.
    if (finished.some((m) => m.home.id == null || m.away.id == null)) return null;
    return buildFormStore(finished);
  }, [finished]);

  // 3 paris prédictifs — pur (match + form-store), ne throw jamais (G3).
  const bets = useMemo(
    () =>
      match ? computeHandballPredictiveBets(match, { formStore: formStore ?? undefined }) : null,
    [match, formStore],
  );

  // Marchés bonus (mi-temps / écart / race-to, G10) — même form-store que
  // les 3 paris core : un seul build, λs strictement alignés.
  const bonus = useMemo(
    () =>
      match ? computeHandballBonusMarkets(match, { formStore: formStore ?? undefined }) : null,
    [match, formStore],
  );

  // Section bonus repliée par défaut (16 chips : pas de surcharge au premier coup d'œil).
  const [bonusOpen, setBonusOpen] = useState(false);

  // Forme L5 + moyennes de buts des deux équipes (skip propre si absentes).
  const forms = useMemo(() => {
    if (!match || !formStore) return null;
    const home = formView(formStore.get(String(match.home.id)));
    const away = formView(formStore.get(String(match.away.id)));
    return home || away ? { home, away } : null;
  }, [match, formStore]);

  // URL du DTO joueurs (params = noms d'équipes + ligue pour le filtre pokal).
  const playersUrl = useMemo(() => {
    if (!match) return null;
    const params = new URLSearchParams({
      home: match.home.name,
      away: match.away.name,
      league: match.league.name,
    });
    return `/api/handball/players?${params.toString()}`;
  }, [match]);

  const [players, setPlayers] = useState<PlayersTops | null>(null);
  const [playersState, setPlayersState] = useState<PlayersState>("idle");

  // URL de l'analyse Over & Buteurs (historique SQLite) — même paramètres
  // que le DTO joueurs pour rester aligné sur le match ouvert.
  const analysisUrl = useMemo(() => {
    if (!match) return null;
    const params = new URLSearchParams({
      home: match.home.name,
      away: match.away.name,
      league: match.league.name,
      date: match.kickoff,
    });
    return `/api/handball/analysis?${params.toString()}`;
  }, [match]);

  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [analysisState, setAnalysisState] = useState<PlayersState>("idle");

  // Onglet actif : l'analyse IA n'est générée QU'à la visite de l'onglet « IA »
  // (et une seule fois — cache VPS 24h derrière).
  const [tab, setTab] = useState("analyse");
  const [ai, setAi] = useState<AiAnalysis | null>(null);
  const [aiState, setAiState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const aiUrl = useMemo(() => {
    if (!match) return null;
    const params = new URLSearchParams({
      home: match.home.name,
      away: match.away.name,
      league: match.league.name,
      date: match.kickoff,
    });
    return `/api/handball/ai-analysis?${params.toString()}`;
  }, [match]);

  // Génération à la demande (uniquement si l'onglet IA est ouvert).
  useEffect(() => {
    if (!open || tab !== "ia" || !aiUrl) return;
    if (aiState === "loading" || aiState === "ready") return;
    let cancelled = false;
    setAiState("loading");
    fetchAiAnalysis(aiUrl).then((payload) => {
      if (cancelled) return;
      if (payload) {
        setAi(payload);
        setAiState("ready");
      } else {
        setAiState("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, tab, aiUrl, aiState]);

  // Fetch lazy à l'ouverture (cache module : pas de re-fetch à la réouverture).
  useEffect(() => {
    if (!open || !analysisUrl) return;
    let cancelled = false;
    fetchAnalysis(analysisUrl).then((payload) => {
      if (cancelled) return;
      setAnalysis(payload);
      setAnalysisState(payload ? "ready" : "error");
    });
    return () => {
      cancelled = true;
    };
  }, [open, analysisUrl]);

  // Fetch lazy à l'ouverture (cache module : pas de re-fetch à la réouverture).
  useEffect(() => {
    if (!open || !playersUrl) return;
    let cancelled = false;
    fetchPlayersTops(playersUrl).then((tops) => {
      if (cancelled) return;
      setPlayers(tops);
      setPlayersState(tops ? "ready" : "error");
    });
    return () => {
      cancelled = true;
    };
  }, [open, playersUrl]);

  if (!match) return null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    });

  const isLive = match.status === "live" || match.status === "halftime";
  /** Match lancé ou terminé → la section « Stats du match » a du sens. */
  const isPlayed = isLive || match.status === "finished";
  const hasFormRow = !!(forms && (forms.home || forms.away));
  const hasGoals =
    forms?.home?.scoredAvg != null ||
    forms?.away?.scoredAvg != null ||
    forms?.home?.concededAvg != null ||
    forms?.away?.concededAvg != null;
  const hasOdds = !!(
    match.odds &&
    (match.odds.home != null || match.odds.draw != null || match.odds.away != null)
  );
  // Stats issues de l'historique DB + snapshots LNH (onglet Stats) : dès
  // qu'elles sont prêtes, l'état vide « Aucune statistique » disparaît.
  const hasDbStats = !!(analysis && (analysis.teams.home || analysis.teams.away));
  const hasStarLigue = !!(analysis?.starligue && (analysis.starligue.home || analysis.starligue.away));

  // Stats du match réellement renseignées (source API-Sports, repli de la
  // route /api/handball/matches). Le snapshot Flashscore ne transporte AUCUNE
  // clé de stats (id/time/home/away/score/halves/odds/status seulement) :
  // on n'affiche donc que les champs présents ET non nuls — jamais de 0
  // inventé, jamais de trou.
  const liveStatRows: { label: string; home: number; away: number }[] = [];
  if (match.stats) {
    const s = match.stats;
    const add = (label: string, home: number | undefined, away: number | undefined) => {
      if ((home ?? 0) === 0 && (away ?? 0) === 0) return;
      liveStatRows.push({ label, home: home ?? 0, away: away ?? 0 });
    };
    add("Tirs 7 m", s.home7m, s.away7m);
    add("Arrêts", s.homeSaves, s.awaySaves);
    add("Exclusions 2 min", s.homeRedCards, s.awayRedCards);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Fond du popup = teinte dark FotMob : `--GlobalColorScheme-Background-dialog:
          rgb(29,29,29)` du bloc `.theme-dark` servi par fotmob.com (fond de page
          dark = #000000, cartes = #1D1D1D). Scope au SEUL dialog handball :
          la charte PariScore (navy + vert néon) reste intacte ailleurs. Light
          : `--background` du site pour ne pas casser le thème clair.

          MOBILE (<640px) : bottom-sheet recentré — largeur écran réelle
          (max-w-none), ancrage gauche centré (left-0 + translate-x-0, même
          variante max-sm : aucun conflit d'ordre avec les classes base),
          hauteur bornée en dvh (viewport dynamique = barre navigateur
          déduite) avec scroll interne, padding réduit et safe-area iOS.
          Desktop : centré par défaut (max-w-lg), inchangé. */}
      <DialogContent className="bg-background dark:bg-[#1D1D1D] max-w-lg max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-h-[88dvh] max-sm:gap-3 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:p-4 max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-zinc-300 sm:hidden" />
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2">
            <HandballLeagueBadge
              leagueName={match.league.name}
              country={match.league.country}
            />
          </DialogTitle>
          <DialogDescription className="text-center sm:text-center">
            {formatDate(match.kickoff)}
          </DialogDescription>
        </DialogHeader>

        {/* Score / Équipes (logos + score si joué) */}
        <div className="flex items-center justify-between py-3">
          <div className="text-center flex-1">
            <div className="flex justify-center">
              <HandballTeamLogo name={match.home.name} size={30} />
            </div>
            <div className="mt-1 text-base font-bold leading-tight">{match.home.name}</div>
            {match.score && (
              <div className="text-3xl font-bold mt-0.5">{match.score.home}</div>
            )}
          </div>
          <div className="text-center px-4">
            {isLive ? (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded animate-pulse">
                {match.status === "halftime" ? "MT" : `${match.minute || 0}'`}
              </span>
            ) : match.score ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className="text-sm text-muted-foreground">vs</span>
            )}
          </div>
          <div className="text-center flex-1">
            <div className="flex justify-center">
              <HandballTeamLogo name={match.away.name} size={30} />
            </div>
            <div className="mt-1 text-base font-bold leading-tight">{match.away.name}</div>
            {match.score && (
              <div className="text-3xl font-bold mt-0.5">{match.score.away}</div>
            )}
          </div>
        </div>

        {/* Mi-temps */}
        {match.score?.homeHalf != null && (
          <div className="text-center text-sm text-muted-foreground">
            Mi-temps : {match.score.homeHalf} - {match.score.awayHalf}
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="mt-1">
          {/* 4 onglets : sur mobile la barre défile horizontalement plutôt
              que d'écraser les libellés (conformité 360 px). */}
          <TabsList className="h-auto w-full p-1 dark:bg-white/[0.07] max-sm:overflow-x-auto max-sm:flex-nowrap">
            <TabsTrigger value="analyse" className="flex-1 whitespace-nowrap">
              Analyse
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex-1 whitespace-nowrap">
              Stats
            </TabsTrigger>
            <TabsTrigger value="over" className="flex-1 whitespace-nowrap">
              Over &amp; Buteurs
            </TabsTrigger>
            <TabsTrigger value="bets" className="flex-1 whitespace-nowrap">
              Bets
            </TabsTrigger>
            <TabsTrigger value="ia" className="flex-1 whitespace-nowrap">
              ✨ IA
            </TabsTrigger>
          </TabsList>

          {/* ── Onglet 1 : Analyse (forme, cotes, verdict modèle) ── */}
          <TabsContent value="analyse" className="space-y-3">
            {hasFormRow && (
              <section className="space-y-1.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Forme récente (5 derniers)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-emerald-500/20 p-2 text-center">
                    <p className="truncate text-[11px] font-bold uppercase tracking-wider text-emerald-500">
                      {match.home.shortName ?? match.home.name}
                    </p>
                    <div className="mt-1 flex justify-center">
                      {forms?.home ? (
                        <FormSequence seq={forms.home.seq} />
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-sky-500/20 p-2 text-center">
                    <p className="truncate text-[11px] font-bold uppercase tracking-wider text-sky-500">
                      {match.away.shortName ?? match.away.name}
                    </p>
                    <div className="mt-1 flex justify-center">
                      {forms?.away ? (
                        <FormSequence seq={forms.away.seq} />
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Cotes 1X2 */}
            {hasOdds && match.odds && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Cotes 1X2</h4>
                <div className="flex gap-2">
                  {match.odds.home != null && (
                    <div className="flex-1 text-center rounded border p-2">
                      <div className="text-xs text-muted-foreground">1</div>
                      <div className="font-bold">{match.odds.home}</div>
                    </div>
                  )}
                  {match.odds.draw != null && (
                    <div className="flex-1 text-center rounded border p-2">
                      <div className="text-xs text-muted-foreground">X</div>
                      <div className="font-bold">{match.odds.draw}</div>
                    </div>
                  )}
                  {match.odds.away != null && (
                    <div className="flex-1 text-center rounded border p-2">
                      <div className="text-xs text-muted-foreground">2</div>
                      <div className="font-bold">{match.odds.away}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Verdict du modèle : favori + top bet + note de méthode */}
            {bets && (
              <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <header className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Verdict du modèle
                  </h4>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-500 ring-1 ring-emerald-500/20">
                    Confiance {bets.confidence}%
                  </span>
                </header>
                <p className="mt-1.5 text-sm">
                  <span className="font-bold">Favori : {bets.favoriteName}</span>{" "}
                  <span className="font-bold tabular-nums text-emerald-500">
                    {bets.favoriteProb}%
                  </span>
                </p>
                {bets.bets[0] && (
                  <p className="mt-1 text-sm">
                    <span aria-hidden="true">{bets.bets[0].icon}</span> {bets.bets[0].label} —{" "}
                    <span className="font-bold tabular-nums">{bets.bets[0].prob}%</span>
                  </p>
                )}
                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                  {bets.modelNote}
                </p>
              </section>
            )}
          </TabsContent>

          {/* ── Onglet 2 : Stats équipes (match en cours + moyennes prématch) ── */}
          <TabsContent value="stats" className="space-y-3">
            {/* En-tête colonnes */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="flex min-w-0 items-center justify-end gap-1.5">
                <span className="truncate text-xs font-bold text-emerald-500">
                  {match.home.shortName ?? match.home.name}
                </span>
                <HandballTeamLogo name={match.home.name} size={18} />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                vs
              </span>
              <div className="flex min-w-0 items-center gap-1.5">
                <HandballTeamLogo name={match.away.name} size={18} />
                <span className="truncate text-xs font-bold text-sky-500">
                  {match.away.shortName ?? match.away.name}
                </span>
              </div>
            </div>

            {/* Section 1 — Stats du match : uniquement les champs réellement
                fournis par la source (0 inventé, 0 trou béant). */}
            {isPlayed && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Stats du match
                </h4>
                {liveStatRows.length > 0 ? (
                  liveStatRows.map((r) => (
                    <CompareBar key={r.label} label={r.label} home={r.home} away={r.away} />
                  ))
                ) : (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Stats détaillées (7 m, arrêts, 2 min) non fournies par la source
                    Flashscore.
                  </p>
                )}
              </section>
            )}

            {/* Section 2 — Moyennes prématch (L5) : affichées aussi pour un
                match à venir, calculées par buildFormStore (même store que
                les 3 paris : pas de 2e heuristique). */}
            {(hasFormRow || hasGoals) && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Moyennes prématch (L5)
                </h4>

                {/* Résumé par équipe : buts marqués / encaissés sur les 5 derniers */}
                {hasGoals && (
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg border border-emerald-500/20 p-1.5">
                      <p className="truncate text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                        {match.home.shortName ?? match.home.name}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-snug tabular-nums text-muted-foreground">
                        <span className="text-foreground">{fmtNum(forms?.home?.scoredAvg)}</span>{" "}
                        marqués —{" "}
                        <span className="text-foreground">
                          {fmtNum(forms?.home?.concededAvg)}
                        </span>{" "}
                        encaissés
                      </p>
                      <p className="text-[10px] text-muted-foreground/70">
                        {forms?.home ? `${forms.home.played} matchs` : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-sky-500/20 p-1.5">
                      <p className="truncate text-[10px] font-bold uppercase tracking-wider text-sky-500">
                        {match.away.shortName ?? match.away.name}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-snug tabular-nums text-muted-foreground">
                        <span className="text-foreground">{fmtNum(forms?.away?.scoredAvg)}</span>{" "}
                        marqués —{" "}
                        <span className="text-foreground">
                          {fmtNum(forms?.away?.concededAvg)}
                        </span>{" "}
                        encaissés
                      </p>
                      <p className="text-[10px] text-muted-foreground/70">
                        {forms?.away ? `${forms.away.played} matchs` : "—"}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {hasFormRow && (
                    <CompareRow
                      label="Forme L5"
                      home={forms?.home ? frSeq(forms.home.seq) : "—"}
                      away={forms?.away ? frSeq(forms.away.seq) : "—"}
                    />
                  )}
                  {(forms?.home?.totalAvg != null || forms?.away?.totalAvg != null) && (
                    <CompareRow
                      label="Total buts / match"
                      home={fmtNum(forms?.home?.totalAvg)}
                      away={fmtNum(forms?.away?.totalAvg)}
                    />
                  )}
                  {(forms?.home?.diffAvg != null || forms?.away?.diffAvg != null) && (
                    <CompareRow
                      label="Écart moyen"
                      home={fmtDiff(forms?.home?.diffAvg)}
                      away={fmtDiff(forms?.away?.diffAvg)}
                    />
                  )}
                </div>
              </section>
            )}

            {/* Section 3 — Marché : cotes victoire + probabilités dé-vigées */}
            {hasOdds && match.odds && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Marché
                </h4>
                <div className="space-y-2">
                  {/* Cotes victoire côte à côte (le nul reste affiché en onglet Analyse) */}
                  <CompareRow
                    label="Cote victoire"
                    home={match.odds.home != null ? String(match.odds.home) : "—"}
                    away={match.odds.away != null ? String(match.odds.away) : "—"}
                  />
                  {/* Probabilités marché dé-vigées : comparaison home vs away */}
                  {(() => {
                    const devig = devigHandball1x2(match.odds);
                    if (!devig) return null;
                    return (
                      <CompareRow
                        label="Proba marché"
                        home={`${devig.home.toFixed(1)}%`}
                        away={`${devig.away.toFixed(1)}%`}
                      />
                    );
                  })()}
                </div>
              </section>
            )}

            {/* Section 4 — Stats COMPLÈTES des 2 équipes (historique DB) :
                buts marqués/encaissés + diff + PPG sur L5/L10 en situation
                dom/ext, winrate global/dom/ext — objectif « informer le
                parieur » même sans cotes ni stats de match. */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Stats des 2 équipes — historique (L5/L10, dom/ext)
              </h4>
              {analysisState === "idle" && (
                <p className="text-[11px] text-muted-foreground" aria-live="polite">
                  Chargement des stats équipes…
                </p>
              )}
              {analysisState === "error" && (
                <p className="text-[11px] text-muted-foreground">
                  Historique indisponible (base handball non chargée — cron hebdo).
                </p>
              )}
              {analysis && (
                <>
                  <SplitTable stats={analysis.teams.home} variant="home" />
                  <SplitTable stats={analysis.teams.away} variant="away" />
                </>
              )}
            </section>

            {/* Section 5 — StarLigue : classement + 5 métriques/équipe */}
            {analysis?.starligue && (
              <StarLigueBlock
                data={analysis.starligue}
                homeName={match.home.name}
                awayName={match.away.name}
              />
            )}

            {/* État vide honnête : seulement si aucune section n'a affiché de donnée
                (un match joué sans stats détaillées a déjà sa note explicative,
                et les stats DB/StarLigue sont affichées dès leur arrivée). */}
            {!isPlayed && !hasFormRow && !hasGoals && !hasOdds && !hasDbStats && !hasStarLigue && (
              <p className="py-4 text-center text-[11px] text-muted-foreground">
                Aucune statistique disponible pour ce match
              </p>
            )}
          </TabsContent>

          {/* ── Onglet 3 : Over & Buteurs (historique SQLite) ── */}
          <TabsContent value="over" className="space-y-3">
            {analysisState === "idle" && (
              <p className="py-4 text-center text-[11px] text-muted-foreground" aria-live="polite">
                Chargement de l&apos;analyse Over…
              </p>
            )}
            {analysisState === "error" && (
              <p className="py-4 text-center text-[11px] text-muted-foreground">
                Analyse indisponible — historique handball non chargé (cron hebdo à venir).
              </p>
            )}
            {analysis && <OverBetsTab analysis={analysis} />}
          </TabsContent>

          {/* ── Onglet 4 : 3 bets prédictifs + meilleurs joueurs ── */}
          <TabsContent value="bets" className="space-y-4">
            {bets && (
              <section>
                <header className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    3 paris prédictifs
                  </h4>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-500 ring-1 ring-emerald-500/20">
                    Confiance {bets.confidence}%
                  </span>
                </header>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {bets.bets.map((bet, i) => (
                    <PredictiveBetTile key={i} bet={bet} />
                  ))}
                </div>
              </section>
            )}

            {/* Marchés bonus (G10) : HT result / écart de vainqueur / race-to-X */}
            {bonus && (
              <Collapsible open={bonusOpen} onOpenChange={setBonusOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="group flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 dark:bg-white/[0.05] dark:hover:bg-white/[0.09]"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Marchés bonus
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      3 groupes · {bonus.htResult.length + bonus.margin.length + bonus.raceTo.length}{" "}
                      sélections
                      <span
                        aria-hidden="true"
                        className="transition-transform group-data-[state=open]:rotate-180"
                      >
                        ▾
                      </span>
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2.5 space-y-3">
                  <BonusGroup title="Résultat mi-temps" picks={bonus.htResult} />
                  <BonusGroup title="Écart de vainqueur" picks={bonus.margin} />
                  <BonusGroup title="Race to X (10 / 15 / 20 buts)" picks={bonus.raceTo} />
                  <p className="text-[10px] leading-snug text-muted-foreground/80">{bonus.note}</p>
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="h-px bg-border" />

            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Meilleurs joueurs
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <PlayerColumn
                  name={match.home.name}
                  variant="home"
                  tops={players?.home ?? null}
                  state={playersState}
                />
                <PlayerColumn
                  name={match.away.name}
                  variant="away"
                  tops={players?.away ?? null}
                  state={playersState}
                />
              </div>
            </section>
          </TabsContent>

          {/* ── Onglet 5 : Analyse IA (Gemini) — générée à la 1ʳᵉ visite,
              puis servie du cache VPS 24 h. ── */}
          <TabsContent value="ia" className="space-y-3">
            <AiTab state={aiState} ai={ai} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
