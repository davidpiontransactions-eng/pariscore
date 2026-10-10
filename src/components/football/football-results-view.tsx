"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { parisDateShort, parisDayLabel, parisKickoff } from "@/lib/football-time";
import type {
  SettledMatch,
  SettledPick,
  SettledResults,
  StrategySummary,
} from "@/lib/football-results";

/**
 * Onglet « Résultats » football (vague 2) — scores des matchs terminés sur
 * 7 jours, verdict vert/rouge par stratégie, cote, P&L 1u fixe + footer global.
 * Source : GET /api/football/results/settled (journal top5 réglé par
 * settleFootballPick, enrichi corners/SOT BSD + archives SQLite).
 */

import { FOTMOB } from "@/components/football/fotmob-tokens";

/* Teintes FotMob clair — source unique dans fotmob-tokens.ts. `win`/`loss` restent
   propres à cette vue (issuetemplate) car elles n'ont pas d'équivalent ailleurs. */
const C = {
  card: FOTMOB.card,
  cardBorder: FOTMOB.cardBorder,
  rowSep: FOTMOB.rowSep,
  headerBg: FOTMOB.headerBg,
  headerText: FOTMOB.headerText,
  team: FOTMOB.team,
  time: FOTMOB.time,
  accent: FOTMOB.accent,
  score: FOTMOB.score,
  win: FOTMOB.accent,
  loss: "#EF4444",
} as const;

const STATUS_UI: Record<
  SettledPick["status"],
  { label: string; cls: string }
> = {
  won: {
    label: "Gagné",
    cls: "bg-[#00985f]/10 text-[#00985f] border-[#00985f]/25",
  },
  lost: {
    label: "Perdu",
    cls: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/25",
  },
  void: {
    label: "Void",
    cls: "bg-[#f0f0f0] text-[#717171] border-[#e0e0e0]",
  },
  pending: {
    label: "En attente",
    cls: "bg-[#FF6D00]/10 text-[#FF6D00] border-[#FF6D00]/25",
  },
};

function fmtUnits(n: number): string {
  if (n === 0) return "0,00 u";
  return `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(2).replace(".", ",")} u`;
}

function pnlColor(n: number): string {
  if (n > 0) return C.win;
  if (n < 0) return C.loss;
  return C.time;
}

function VerdictPill({ status }: { status: SettledPick["status"] }) {
  const ui = STATUS_UI[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        ui.cls,
      )}
    >
      {ui.label}
    </span>
  );
}

function PickLine({ pick }: { pick: SettledPick }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5"
      style={{ background: `${C.headerBg}` }}
    >
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ background: `${C.accent}15`, color: C.accent }}
      >
        {pick.strategyLabel}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: C.team }}>
        {pick.pickDesc}
      </span>
      {pick.odds != null && (
        <span className="font-mono text-[12px] tabular-nums" style={{ color: C.score }}>
          {pick.odds.toFixed(2)}
        </span>
      )}
      <VerdictPill status={pick.status} />
      <span
        className="w-[70px] text-right font-mono text-[12px] font-semibold tabular-nums"
        style={{ color: pnlColor(pick.pnl) }}
      >
        {pick.odds != null && pick.odds > 1 ? fmtUnits(pick.pnl) : "—"}
      </span>
    </div>
  );
}

function MatchCard({ match }: { match: SettledMatch }) {
  const hasStats = match.stats.corners.home != null || match.stats.sot.home != null;
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}
    >
      <div className="flex flex-col gap-1 px-4 pt-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="truncate text-[11px]" style={{ color: C.time }}>
            {match.league} · {parisDateShort(match.kickoff)} {parisKickoff(match.kickoff)}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[13px]" style={{ color: C.team }}>
            <span className="truncate font-medium">{match.home}</span>
            <span
              className="shrink-0 rounded-md px-2 py-0.5 font-mono text-[15px] font-bold tabular-nums"
              style={{ background: C.headerBg, color: C.score }}
            >
              {match.homeScore ?? "–"}–{match.awayScore ?? "–"}
            </span>
            <span className="truncate font-medium">{match.away}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasStats && (
            <div className="flex items-center gap-2 text-[11px] tabular-nums" style={{ color: C.time }}>
              <span title="Corners">
                Corners {match.stats.corners.home ?? "–"}–{match.stats.corners.away ?? "–"}
              </span>
              <span title="Tirs cadrés">
                Cadrés {match.stats.sot.home ?? "–"}–{match.stats.sot.away ?? "–"}
              </span>
            </div>
          )}
          <span
            className="w-[80px] text-right font-mono text-[13px] font-bold tabular-nums"
            style={{ color: pnlColor(match.pnl) }}
          >
            {fmtUnits(match.pnl)}
          </span>
        </div>
      </div>

      <div className="mx-3 mb-3 overflow-hidden rounded-xl" style={{ background: C.headerBg }}>
        {match.picks.map((p) => (
          <PickLine key={`${p.strategyKey}-${p.pickDesc}`} pick={p} />
        ))}
      </div>
    </div>
  );
}

function StrategySummaryTable({ rows }: { rows: StrategySummary[] }) {
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}
    >
      <div
        className="flex h-10 items-center px-4"
        style={{ background: C.headerBg, borderBottom: `1px solid ${C.cardBorder}` }}
      >
        <span className="text-[13px] font-semibold" style={{ color: C.headerText }}>
          Bilan par stratégie
        </span>
      </div>
      <div className="w-full text-[13px]">
        <div
          className="hidden items-center px-4 py-2 text-[11px] font-medium uppercase tracking-wider md:grid"
          style={{
            gridTemplateColumns: "minmax(0,1fr) 70px 110px 90px",
            color: C.time,
            borderBottom: `1px solid ${C.rowSep}`,
          }}
        >
          <span>Stratégie</span>
          <span className="text-center">V / N</span>
          <span className="text-right">Réussite</span>
          <span className="text-right">P&amp;L</span>
        </div>
        {rows.map((s, i) => (
          <div
            key={s.strategyKey}
            className="flex flex-col gap-1 px-4 py-2 md:grid md:items-center md:gap-0"
            style={{
              gridTemplateColumns: "minmax(0,1fr) 70px 110px 90px",
              borderBottom: i < rows.length - 1 ? `1px solid ${C.rowSep}` : undefined,
            }}
          >
            <span className="truncate font-medium" style={{ color: C.team }}>
              {s.label}
            </span>
            <span className="text-center text-[12px] tabular-nums" style={{ color: C.time }}>
              {s.wins} / {s.losses}
            </span>
            <span className="text-right text-[12px] tabular-nums" style={{ color: C.score }}>
              {s.winRatePct != null ? `${Math.round(s.winRatePct)} %` : "—"}
            </span>
            <span
              className="text-right font-mono text-[12px] font-semibold tabular-nums"
              style={{ color: pnlColor(s.pnl) }}
            >
              {fmtUnits(s.pnl)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FootballResultsView() {
  const [data, setData] = useState<SettledResults | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/football/results/settled", { cache: "no-store" });
      if (!res.ok) throw new Error(`API résultats ${res.status}`);
      const body = (await res.json()) as SettledResults & { warnings?: string[] };
      setData(body);
      setWarnings(body.warnings ?? []);
    } catch (err) {
      console.error("[FootballResults] fetch error:", err);
      setError("Impossible de charger les résultats.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="w-full min-w-0 rounded-2xl p-3 sm:p-4">
      {/* En-tête — titre + fenêtre + rafraîchir */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-semibold" style={{ color: C.headerText }}>
          Résultats
        </h2>
        {data && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: `${C.accent}15`, color: C.accent }}
          >
            {parisDayLabel(`${data.from}T12:00:00Z`)} → {parisDayLabel(`${data.to}T12:00:00Z`)}
          </span>
        )}
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

      {warnings.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <p>{warnings.join(" · ")}</p>
        </div>
      )}

      {loading && (
        <div role="status" aria-live="polite" className="flex items-center gap-2 px-1 py-6 text-xs" style={{ color: C.time }}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Chargement des résultats…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 px-3 py-3 text-xs text-[#EF4444]">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="ml-auto underline underline-offset-2"
          >
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && data && data.matches.length === 0 && (
        <div
          className="rounded-2xl px-6 py-10 text-center"
          style={{ background: C.card, border: `1px dashed ${C.cardBorder}` }}
        >
          <Trophy className="mx-auto h-8 w-8" style={{ color: C.time }} aria-hidden />
          <p className="mt-2 text-sm font-medium" style={{ color: C.team }}>
            Aucun pick réglé sur la période
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs" style={{ color: C.time }}>
            Le journal des stratégies se remplit chaque matin (cron 05:15 UTC). En
            local :{" "}
            <code className="rounded bg-[#f5f5f5] px-1 py-0.5">
              bun scripts/backfill-top5-backtest.ts --sport=football --days=7
            </code>
          </p>
        </div>
      )}

      {!loading && !error && data && data.matches.length > 0 && (
        <>
          {/* Bandeau P&L global */}
          <div
            className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl px-4 py-3"
            style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}
          >
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: C.time }}>
                P&amp;L global
              </div>
              <div
                className="font-mono text-[22px] font-bold tabular-nums"
                style={{ color: pnlColor(data.summary.pnl) }}
                data-testid="results-pnl-global"
              >
                {fmtUnits(data.summary.pnl)}
              </div>
            </div>
            <div className="text-[12px] tabular-nums" style={{ color: C.time }}>
              <span style={{ color: C.win }}>{data.summary.wins} V</span>
              {" · "}
              <span style={{ color: C.loss }}>{data.summary.losses} N</span>
              {" · "}
              {data.summary.voids} void{data.summary.pending > 0 ? ` · ${data.summary.pending} en attente` : ""}
            </div>
            <div className="text-[12px] tabular-nums" style={{ color: C.time }}>
              {data.summary.nPicks} picks · {data.summary.nWithOdds} avec cote
              {data.summary.roiPct != null && (
                <>
                  {" · "}
                  <span style={{ color: pnlColor(data.summary.roiPct) }}>
                    ROI {data.summary.roiPct > 0 ? "+" : ""}
                    {data.summary.roiPct.toFixed(1).replace(".", ",")} %
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Matchs + verdicts */}
          <div className="space-y-3">
            {data.matches.map((m) => (
              <MatchCard key={m.matchId} match={m} />
            ))}
          </div>

          {/* Bilan par stratégie */}
          <div className="mt-3">
            <StrategySummaryTable rows={data.summary.byStrategy} />
          </div>
        </>
      )}
    </div>
  );
}
