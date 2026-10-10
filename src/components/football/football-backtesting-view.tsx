"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Lock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { parisDayLabel } from "@/lib/football-time";
import type { MarketBacktest, MarketBacktestResult, MarketCardInfo } from "@/lib/football-backtest/market-engine";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { leagueCountryOf } from "@/lib/league-mapping";
import { countryFlag } from "@/lib/country-flag";

/**
 * Libellé du groupe des ligues dont le pays n'est pas dans `LEAGUE_COUNTRY_BY_NAME`
 * (coupes internationales, ligues hors table). Un `SelectLabel` muet serait pire que
 * la liste plate d'avant : on dit qu'on ne sait pas, plutôt que d'inventer un pays.
 */
const AUTRE_PAYS = "Autres pays";

/**
 * Onglet « Back Testing » football (vague 3, phase 1) — rejeu walk-forward des
 * marchés : ROI, taux de réussite et drawdown par marché, plus les cartes
 * BLOQUÉES (corners, tirs cadrés, but tardif) qui documentent ce qui n'est pas
 * backtestable faute de cotes réelles. Source : /api/football/backtest/markets.
 */

/* Teintes FotMob clair — identiques à football-results-view.tsx */
const C = {
  card: "#ffffff",
  cardBorder: "#f0f0f0",
  headerBg: "#f5f5f5",
  headerText: "#000000",
  team: "#222222",
  time: "#717171",
  accent: "#00985f",
  win: "#00985f",
  loss: "#EF4444",
  warn: "#FF6D00",
} as const;

function fmtUnits(n: number): string {
  if (n === 0) return "0,00 u";
  return `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(2).replace(".", ",")} u`;
}

function pnlColor(n: number): string {
  if (n > 0) return C.win;
  if (n < 0) return C.loss;
  return C.time;
}

/** Source de cote : réelle (verte) ou dérivée (ambre) — jamais silencieux. */
function SourceBadge({ label, derived }: { label: string; derived: boolean }) {
  return (
    <span
      title={derived ? "Cote mathématiquement dérivée des cotes 1X2 réelles dé-vigées" : "Cote réelle du book"}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        derived
          ? "border-[#FF6D00]/25 bg-[#FF6D00]/10 text-[#FF6D00]"
          : "border-[#00985f]/25 bg-[#00985f]/10 text-[#00985f]",
      )}
    >
      {label}
    </span>
  );
}

/** Sparkline SVG de la courbe de P&L cumulé. */
function PnlSparkline({ curve }: { curve: number[] }) {
  if (curve.length < 2) return null;
  const min = Math.min(0, ...curve);
  const max = Math.max(0, ...curve);
  const span = max - min || 1;
  const pts = curve
    .map((v, i) => {
      const x = (i / (curve.length - 1)) * 100;
      const y = 28 - ((v - min) / span) * 26;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" className="h-8 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={pnlColor(curve[curve.length - 1])}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function MarketCard({ m }: { m: MarketBacktest }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl p-4"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}
      data-testid={`market-card-${m.key}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold" style={{ color: C.headerText }}>
          {m.label}
        </span>
        <SourceBadge label={m.oddsSourceLabel} derived={m.oddsSource === "derived-devig"} />
        {m.n > 0 && !m.sampleOk && (
          <span
            title={`Moins de 10 paris réglés — ROI non significatif`}
            className="inline-flex items-center rounded-full bg-[#FF6D00]/10 px-2 py-0.5 text-[10px] font-semibold text-[#FF6D00]"
          >
            échantillon faible
          </span>
        )}
      </div>

      {m.n === 0 ? (
        <p className="text-xs" style={{ color: C.time }}>
          Aucun pick de stratégie sur ce marché pour la période.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] tabular-nums sm:grid-cols-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: C.time }}>
                Paris
              </div>
              <div className="font-semibold" style={{ color: C.team }}>
                {m.n}
                <span className="ml-1 font-normal" style={{ color: C.time }}>
                  ({m.nWithOdds} avec cote)
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: C.time }}>
                Réussite
              </div>
              <div className="font-semibold" style={{ color: C.team }}>
                {m.winRatePct != null ? `${m.winRatePct.toFixed(1).replace(".", ",")} %` : "—"}
                <span className="ml-1 font-normal" style={{ color: C.time }}>
                  {m.wins}V / {m.losses}N
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: C.time }}>
                ROI
              </div>
              <div
                className="font-mono font-semibold"
                style={{ color: pnlColor(m.roiPct ?? 0) }}
              >
                {m.roiPct != null
                  ? `${m.roiPct > 0 ? "+" : ""}${m.roiPct.toFixed(1).replace(".", ",")} %`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: C.time }}>
                P&amp;L / Drawdown
              </div>
              <div className="font-mono font-semibold" style={{ color: pnlColor(m.pnl) }}>
                {fmtUnits(m.pnl)}
                <span className="ml-1 font-normal" style={{ color: C.time }}>
                  / {m.maxDrawdown.toFixed(2).replace(".", ",")} u
                </span>
              </div>
            </div>
          </div>
          <PnlSparkline curve={m.curve} />
        </>
      )}
    </div>
  );
}

function BlockedCard({ m }: { m: MarketCardInfo }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl p-4 opacity-90"
      style={{ background: C.headerBg, border: `1px dashed ${C.cardBorder}` }}
      data-testid={`market-blocked-${m.key}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold" style={{ color: C.time }}>
          {m.label}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#e0e0e0] bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-semibold text-[#717171]">
          <Lock className="h-2.5 w-2.5" aria-hidden />
          Bloqué
        </span>
        <span className="text-[10px]" style={{ color: C.time }}>
          {m.oddsSourceLabel}
        </span>
      </div>
      <p className="text-xs" style={{ color: C.time }}>
        {m.blockedReason}
      </p>
    </div>
  );
}

export function FootballBacktestingView() {
  const [data, setData] = useState<MarketBacktestResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Championnat filtré — `""` = tous. */
  const [league, setLeague] = useState("");
  /**
   * Liste des ligues disponibles. Toujours celle de la fenêtre ENTIERE, renvoyée par la
   * route indépendamment du filtre : sinon le sélecteur se réduirait à l'option filtrée
   * et l'utilisateur ne pourrait plus revenir en arrière.
   */
  const [availableLeagues, setAvailableLeagues] = useState<string[]>([]);
  /** Requête en cours, pour abandonner la précédente si le filtre change. */
  const setAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Changer de championnat relance la requête : deux réponses peuvent se croiser si
    // l'utilisateur enchaîne les sélections, et la dernière arrivée n'est pas forcément
    // la dernière demandée. L'abandon évite d'afficher les cartes d'une ligue sous
    // le titre d'une autre — un backtest mensonger.
    const ctrl = new AbortController();
    setAbortRef.current = ctrl;
    try {
      const qs = league ? `?league=${encodeURIComponent(league)}` : "";
      const res = await fetch(`/api/football/backtest/markets${qs}`, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`API backtest marchés ${res.status}`);
      const body = (await res.json()) as MarketBacktestResult & {
        warnings?: string[];
        leagues?: string[];
      };
      setData(body);
      setWarnings(body.warnings ?? []);
      if (body.leagues) setAvailableLeagues(body.leagues);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("[FootballBacktesting] fetch error:", err);
      setError("Impossible de charger le backtest des marchés.");
      setData(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [league]);

  useEffect(() => {
    void load();
    return () => setAbortRef.current?.abort();
  }, [load]);

  // Groupement par pays, ordre alphabétique FR.
  const leaguesByCountry = useMemo(() => {
    const byCountry = new Map<string, string[]>();
    for (const l of availableLeagues) {
      const country = leagueCountryOf(l) ?? AUTRE_PAYS;
      const arr = byCountry.get(country);
      if (arr) arr.push(l);
      else byCountry.set(country, [l]);
    }
    return [...byCountry.entries()]
      .map(([country, list]) => ({
        country,
        flag: countryFlag(country),
        leagues: [...list].sort((a, b) => a.localeCompare(b, "fr")),
      }))
      .sort((a, b) => a.country.localeCompare(b.country, "fr"));
  }, [availableLeagues]);

  return (
    <div className="w-full min-w-0 rounded-2xl p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-semibold" style={{ color: C.headerText }}>
          Back Testing — marchés
        </h2>
        {data && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: `${C.accent}15`, color: C.accent }}
          >
            {parisDayLabel(`${data.from}T12:00:00Z`)} → {parisDayLabel(`${data.to}T12:00:00Z`)}
          </span>
        )}
        <Select
          value={league || "__all__"}
          onValueChange={(v) => setLeague(v === "__all__" ? "" : v)}
        >
          <SelectTrigger
            size="sm"
            aria-label="Championnat du backtest"
            className="h-7 w-full max-w-[15rem] rounded-lg px-2 py-0 text-xs font-medium sm:w-[13rem]"
            style={{ background: C.card, borderColor: C.cardBorder, color: C.headerText }}
          >
            <SelectValue placeholder="Tous les championnats" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous les championnats</SelectItem>
            {leaguesByCountry.map((group) => (
              <SelectGroup key={group.country}>
                <SelectLabel className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
                  <span aria-hidden>{group.flag}</span>
                  {group.country}
                </SelectLabel>
                {group.leagues.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium disabled:opacity-50"
          style={{ borderColor: C.cardBorder, color: C.time }}
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} aria-hidden />
          Actualiser
        </button>
      </div>

      <p className="mb-3 text-xs" style={{ color: C.time }}>
        Rejeu walk-forward des picks prospectifs (snapshot avant coup d&apos;envoi) — mise fixe
        1u, cotes réelles uniquement. La Double Chance est dérivée du dé-vig 1X2 (marquée
        « Dérivé »). Aucune cote synthétique n&apos;est jamais fabriquée.
      </p>

      {warnings.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <p>{warnings.join(" · ")}</p>
        </div>
      )}

      {loading && (
        <div role="status" aria-live="polite" className="flex items-center gap-2 px-1 py-6 text-xs" style={{ color: C.time }}>
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
          Chargement du backtest…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 px-3 py-3 text-xs text-[#EF4444]">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className="ml-auto underline underline-offset-2">
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div
            className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl px-4 py-3 text-[12px] tabular-nums"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}
            data-testid="markets-totals"
          >
            <span style={{ color: C.time }}>
              {data.totals.nBets} paris · {data.totals.nWithOdds} avec cote
            </span>
            <span style={{ color: C.time }}>
              <span style={{ color: C.win }}>{data.totals.wins} V</span> ·{" "}
              <span style={{ color: C.loss }}>{data.totals.losses} N</span>
            </span>
            <span className="font-mono font-semibold" style={{ color: pnlColor(data.totals.pnl) }}>
              P&amp;L {fmtUnits(data.totals.pnl)}
            </span>
            {data.totals.roiPct != null && (
              <span className="font-mono font-semibold" style={{ color: pnlColor(data.totals.roiPct) }}>
                ROI {data.totals.roiPct > 0 ? "+" : ""}
                {data.totals.roiPct.toFixed(1).replace(".", ",")} %
              </span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.markets.map((m) => (
              <MarketCard key={m.key} m={m} />
            ))}
            {data.blocked.map((m) => (
              <BlockedCard key={m.key} m={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
