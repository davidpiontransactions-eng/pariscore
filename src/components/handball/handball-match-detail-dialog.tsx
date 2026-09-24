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
// Type-only : le module handball-players lit fs.readFileSync (server-only) —
// le snapshot joueurs est servi par la route /api/handball/players.
import type { HblPlayer, HblTeamTopPlayers } from "@/lib/handball-players";

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
        <div className="mt-2 rounded bg-muted/40 px-2 py-1.5 dark:bg-white/[0.06]">
          <p className="truncate text-[11px] font-semibold">
            {gk.name} <span className="font-normal text-muted-foreground">· gardien</span>
          </p>
          {gkLine && (
            <p className="text-[10px] tabular-nums text-muted-foreground">{gkLine}</p>
          )}
        </div>
      )}
      {tops.field.length > 0 && (
        <ul className="mt-1.5 divide-y divide-border">
          {tops.field.map((p) => (
            <li
              key={`${p.name}-${p.team}`}
              className="flex items-center justify-between gap-2 py-1 text-[11px]"
            >
              <span className="truncate font-medium">{p.name}</span>
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
          : `--background` du site pour ne pas casser le thème clair. */}
      <DialogContent className="bg-background dark:bg-[#1D1D1D] max-w-lg max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:mt-auto max-sm:w-full">
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

        <Tabs defaultValue="analyse" className="mt-1">
          <TabsList className="h-auto w-full p-1 dark:bg-white/[0.07]">
            <TabsTrigger value="analyse" className="flex-1">
              Analyse
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex-1">
              Stats équipes
            </TabsTrigger>
            <TabsTrigger value="bets" className="flex-1">
              {"Bets & Joueurs"}
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

            {/* État vide honnête : seulement si aucune section n'a affiché de donnée
                (un match joué sans stats détaillées a déjà sa note explicative). */}
            {!isPlayed && !hasFormRow && !hasGoals && !hasOdds && (
              <p className="py-4 text-center text-[11px] text-muted-foreground">
                Aucune statistique disponible pour ce match
              </p>
            )}
          </TabsContent>

          {/* ── Onglet 3 : 3 bets prédictifs + meilleurs joueurs ── */}
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
