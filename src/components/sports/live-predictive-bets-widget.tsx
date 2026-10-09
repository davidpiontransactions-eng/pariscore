"use client";

// BETS PRÉDICTIFS LIVE — composant POLYMORPHE multi-sports.
//
// Un seul composant pour football, basket, hockey, baseball, handball et
// snooker : il ne calcule AUCUNE probabilité, il lit le contrat `LiveBetsBundle`
// (`src/lib/prediction/live-common.ts`) que produit le moteur du sport. C'est la
// même séparation que le tennis (`pip-bet-panel.tsx` × `live-markov.ts`) : toute
// divergence entre un marché affiché et sa probabilité est impossible par
// construction, car l'UI n'a aucun moyen de la calculer.
//
// Les marchés sont produits par :
//   football   → live-football.ts     (1N2, prochain but/corner/carton, O/U)
//   basketball → live-basketball.ts   (QT/Match, handicap, race to X, prochain panier)
//   hockey     → live-hockey.ts       (TR, prolongation, PP, total période)
//   baseball   → live-baseball.ts     (moneyline, demi-manche, PA, runs)
//   handball   → live-handball.ts     (Mi-temps/Match, 2 min, prochaine attaque)
//   snooker    → live-snooker.ts      (frame, rencontre, century, prochaine bille)
//
// Le badge « value » est HEURISTIQUE (probabilité dans une fenêtre), PAS un
// calcul d'EV réel : comparer aux cotes demanderait les prix 1xBet/PSG, que le
// widget ne reçoit pas. C'est une aide à la décision, affichée comme telle.

import { memo, useMemo, useState } from "react";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LIVE_PROB_MAX,
  LIVE_PROB_MIN,
  type LiveBetsBundle,
  type LiveDriver,
  type LiveMarket,
  type LiveSport,
  type MarketScope,
} from "@/lib/prediction/live-common";

/** Fenêtre « value » : probabilité dans [60 %, 70 %]. */
const VALUE_MIN = 0.6;
const VALUE_MAX = 0.7;

/** Filtre par pilules tactiles. */
type MarketFilter = "all" | "structural" | "micro";

const FILTERS: ReadonlyArray<{ id: MarketFilter; label: string; icon: string }> = [
  { id: "all", label: "Tous", icon: "🎯" },
  { id: "structural", label: "Match / Set / Période", icon: "📈" },
  { id: "micro", label: "Micro-Bets", icon: "⚡" },
];

/** Un marché `micro` est un marché d'événement court ; les autres sont structurels. */
function scopeFilterMatches(scope: MarketScope, filter: MarketFilter): boolean {
  if (filter === "all") return true;
  return filter === "micro" ? scope === "micro" : scope !== "micro";
}

// ─── Sous-composants visuels ───────────────────────────────────────────────

/** Badge « value » : probabilité dans la fenêtre heuristique. */
function ValueBadge({ prob }: { prob: number }) {
  if (!(prob >= VALUE_MIN && prob <= VALUE_MAX)) return null;
  return (
    <span className="rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/20">
      value
    </span>
  );
}

/**
 * Jauge néon : dégradé émeraude→sarcelle (A), bleu→indigo (B), ambre (neutre).
 * `min-w-0` sur le conteneur est indispensable : sans lui une jauge force la
 * largeur du parent et crée un scroll horizontal sur mobile (bug historique de
 * `pip-bet-panel.tsx` avec les `w-[60px]` fixes).
 */
function NeonBar({ pct, tone }: { pct: number; tone: "a" | "b" | "amber" }) {
  const cls =
    tone === "a"
      ? "from-emerald-400 to-teal-500"
      : tone === "b"
        ? "from-blue-400 to-indigo-500"
        : "from-amber-400 to-orange-500";
  return (
    <div className="h-2.5 w-full min-w-0 overflow-hidden rounded-full bg-slate-800/80">
      <div
        className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-500", cls)}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/** En-tête de marché : pastille numérotée, libellé, badge value à droite. */
function MarketHead({
  n,
  label,
  hint,
  valueProb,
}: {
  n: string;
  label: string;
  hint?: string;
  valueProb?: number;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-300">
        <span className="shrink-0 font-black text-slate-500">{n}</span>
        <span className="truncate">{label}</span>
        {hint ? (
          <span className="shrink-0 text-[10px] text-slate-500" title={hint}>
            ⓘ
          </span>
        ) : null}
      </span>
      {valueProb != null ? <ValueBadge prob={valueProb} /> : null}
    </div>
  );
}

/** Ligne d'issue : libellé + jauge + %, empilée pour tenir sur mobile. */
function OutcomeRow({
  label,
  prob,
  tone,
  emphasis,
}: {
  label: string;
  prob: number;
  tone: "a" | "b" | "amber";
  emphasis?: boolean;
}) {
  const pct = prob * 100;
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "w-[92px] shrink-0 truncate text-xs sm:w-[110px]",
          emphasis ? "font-semibold text-white" : "text-slate-300"
        )}
      >
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <NeonBar pct={pct} tone={tone} />
      </div>
      <span
        className={cn(
          "w-10 shrink-0 text-right font-mono text-xs tabular-nums",
          tone === "a" ? "text-emerald-300" : tone === "b" ? "text-blue-300" : "text-amber-300"
        )}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

/**
 * Ton d'une issue : vert pour le camp A, bleu pour le camp B, ambre sinon.
 * Le choix est purement cosmétique (couleur de jauge), jamais probabiliste :
 * un marché sans camp dominant (corner, carton, over/under) reste ambre.
 */
const TONE_BY_OUTCOME: Readonly<Record<string, "a" | "b">> = {
  home: "a",
  away: "b",
  a: "a",
  b: "b",
};

function toneForOutcome(id: string, _index: number): "a" | "b" | "amber" {
  return TONE_BY_OUTCOME[id] ?? "amber";
}

/** Jauge de driver observé (xG, pace, Corsi, points sur table…). */
function DriverGauge({ d }: { d: LiveDriver }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[10px] uppercase tracking-wide text-slate-500">{d.label}</span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400">{d.display}</span>
      </div>
      <div className="mt-0.5 h-1 w-full min-w-0 overflow-hidden rounded-full bg-slate-800/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
          style={{ width: `${Math.max(0, Math.min(100, d.ratio * 100))}%` }}
        />
      </div>
    </div>
  );
}

/** Carte d'un marché : en-tête + une ligne par issue. */
function MarketCard({ n, market }: { n: string; market: LiveMarket }) {
  const top = market.outcomes.reduce((a, b) => (b.prob > a.prob ? b : a), market.outcomes[0]);
  return (
    <div className="min-w-0 rounded-2xl border border-white/5 bg-slate-950/40 p-3.5">
      <MarketHead n={n} label={market.label} hint={market.hint} valueProb={top?.prob} />
      <div className="space-y-1">
        {market.outcomes.map((o, i) => (
          <OutcomeRow
            key={o.id}
            label={o.label}
            prob={o.prob}
            tone={toneForOutcome(o.id, i)}
            emphasis={o.id === top?.id}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Composant ─────────────────────────────────────────────────────────────

export type LivePredictiveBetsWidgetProps = {
  /** Contrat produit par le moteur du sport. */
  bundle: LiveBetsBundle;
  /** Libellé du camp A (équipe, joueur 1). */
  nameA: string;
  /** Libellé du camp B (équipe, joueur 2). */
  nameB: string;
  className?: string;
};

function LivePredictiveBetsWidgetImpl({
  bundle,
  nameA,
  nameB,
  className,
}: LivePredictiveBetsWidgetProps) {
  const [filter, setFilter] = useState<MarketFilter>("all");

  // Séparation structurel / micro pour l'alternance des pastilles numérotées.
  const visible = useMemo(
    () => bundle.markets.filter((m) => scopeFilterMatches(m.scope, filter)),
    [bundle.markets, filter]
  );

  const numbered = useMemo(() => {
    const globalIndex = new Map(bundle.markets.map((m, i) => [m.id, i]));
    return visible.map((m) => globalIndex.get(m.id) ?? 0);
  }, [visible, bundle.markets]);

  const structural = visible.filter((m) => m.scope !== "micro");
  const micro = visible.filter((m) => m.scope === "micro");

  return (
    <div
      className={cn(
        "w-full min-w-0 rounded-3xl border border-slate-800/80 bg-slate-900/80 p-2 shadow-2xl backdrop-blur-xl",
        className
      )}
      data-testid="live-predictive-bets-widget"
      data-sport={bundle.sport satisfies LiveSport}
    >
      {/* En-tête + filtre par pilules tactiles */}
      <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 text-xs font-bold text-emerald-300">
          <Target className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">BETS PRÉDICTIFS LIVE</span>
          <span className="truncate font-normal text-slate-500">
            · {nameA} vs {nameB}
          </span>
        </span>
        <div
          role="group"
          aria-label="Filtre de marchés"
          className="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                "min-h-[36px] shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
                filter === f.id
                  ? "bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/20"
                  : "bg-slate-800/70 text-slate-400 hover:text-slate-200"
              )}
            >
              <span aria-hidden className="mr-1">
                {f.icon}
              </span>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Horloge du segment + score */}
      <div className="mb-2 flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/40 px-3 py-2 text-xs">
        <span className="font-semibold text-slate-300">
          {bundle.scoreA} — {bundle.scoreB}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-slate-500">{bundle.clock}</span>
      </div>

      {/* Marchés structurels (fin de rencontre / segment) */}
      {structural.length > 0 && (
        <div className="mb-2.5 space-y-2.5">
          {structural.map((m, i) => (
            <MarketCard key={m.id} n={`${numbered[i] + 1}`} market={m} />
          ))}
        </div>
      )}

      {/* Marchés micro (événement court) */}
      {micro.length > 0 && (
        <div className="space-y-2.5">
          {micro.map((m, i) => (
            <MarketCard key={m.id} n={`${numbered[structural.length + i] + 1}`} market={m} />
          ))}
        </div>
      )}

      {/* Drivers observés : l'input du modèle, visible = calibrable */}
      {bundle.drivers.length > 0 && (
        <div className="mt-2.5 rounded-2xl border border-white/5 bg-slate-950/40 p-3.5">
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            DRIVERS OBSERVÉS
          </span>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
            {bundle.drivers.map((d) => (
              <DriverGauge key={d.label} d={d} />
            ))}
          </div>
        </div>
      )}

      <p className="mt-2 text-[10px] italic text-slate-500">
        value = probabilité ∈ [60 %, 70 %] · heuristique, pas un calcul d&apos;EV réel ·
        bornage micro-bets [{Math.round(LIVE_PROB_MIN * 100)} %, {Math.round(LIVE_PROB_MAX * 100)} %]
      </p>
    </div>
  );
}

export const LivePredictiveBetsWidget = memo(LivePredictiveBetsWidgetImpl);