"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ArrowLeft, Trophy, RotateCcw } from "lucide-react";
import { useBetManager } from "@/hooks/use-bet-manager";
import { BetManagerNav } from "@/components/bet-manager/bet-manager-nav";
import { BankrollForm } from "@/components/bet-manager/bankroll-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  PLAN_DEFAULTS,
  betPL,
  computeReal,
  computeTheoretical,
  stakeForTarget,
  type PlanBet,
  type PlanParams,
} from "@/lib/bet-manager/plan";
import { tradeoffTable } from "@/lib/bet-manager/calculators";

const STORAGE_KEY = "bm-plan-params";
const fmt = (n: number, d = 2) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Champs numériques éditables du paramétrage. */
const FIELDS: { key: keyof PlanParams; label: string; step?: string; type?: "number" | "date" | "check" }[] = [
  { key: "capital", label: "Capital (€)", step: "1" },
  { key: "startDate", label: "Début", type: "date" },
  { key: "days", label: "Jours", step: "1" },
  { key: "targetPct", label: "Objectif (%/j)", step: "1" },
  { key: "bankPct", label: "Part banque (%)", step: "1" },
  { key: "stakePct", label: "Engagé (% cap.)", step: "1" },
  { key: "maxBets", label: "Paris/jour", step: "1" },
  { key: "oddsTarget", label: "Cote cible", step: "0.01" },
  { key: "winProb", label: "Proba q (0-1)", step: "0.05" },
];

export default function BankrollPlanPage() {
  const bm = useBetManager();
  const [showBankrollForm, setShowBankrollForm] = useState(false);
  const [params, setParams] = useState<PlanParams>(PLAN_DEFAULTS);

  // Persistance locale des paramètres (même pattern que suivi-paris.html)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        setParams((p) => {
          const next = { ...p };
          for (const k of Object.keys(PLAN_DEFAULTS) as (keyof PlanParams)[]) {
            if (saved[k] !== undefined && typeof saved[k] === typeof PLAN_DEFAULTS[k]) {
              (next as any)[k] = saved[k];
            }
          }
          return next;
        });
      }
    } catch {
      /* sauvegarde corrompue → défauts */
    }
  }, []);

  const setField = (key: keyof PlanParams, value: string, type?: string) => {
    setParams((p) => {
      const next: PlanParams = {
        ...p,
        [key]:
          type === "number"
            ? parseFloat(value.replace(",", ".")) || 0
            : type === "check"
              ? value === "true"
              : (value as never),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
  };

  // Journal des paris groupé par jour (AAAA-MM-JJ)
  const daysMap = useMemo(() => {
    const map: Record<string, PlanBet[]> = {};
    for (const b of bm.bets) {
      const key = b.placedAt.slice(0, 10);
      (map[key] ??= []).push({ stake: b.stake, odds: b.odds, status: b.status, payout: b.payout });
    }
    return map;
  }, [bm.bets]);

  const th = useMemo(() => computeTheoretical(params), [params]);
  const real = useMemo(() => computeReal(params, th, daysMap), [params, th, daysMap]);
  const arb = useMemo(() => tradeoffTable(params.capital, params.targetPct, [5, 10, 15, 20, 30, 40, 50, 100]), [params.capital, params.targetPct]);

  const live = real.live;
  const liveTh = live ? th[live.d - 1] : null;

  return (
    <div className="min-h-screen bg-bg-deep pb-16 text-zinc-100">
      <header className="border-b border-white/5 bg-bg-deep">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between px-4 py-2 sm:px-6">
          <Link
            href="/bankroll"
            className="inline-flex items-center gap-2.5 text-sm font-bold tracking-tight text-white transition-opacity hover:opacity-80"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <CalendarDays className="h-4 w-4" />
            </span>
            Plan +{params.targetPct}%/j
          </Link>
          <Link href="/bankroll" className="text-sm text-zinc-400 hover:text-white">
            Dashboard
          </Link>
        </div>
      </header>

      <BetManagerNav
        bankrolls={bm.bankrolls}
        activeId={bm.activeId}
        onSelect={bm.selectBankroll}
        onCreate={() => setShowBankrollForm(true)}
      />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        {/* Paramètres */}
        <section className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">Paramètres du plan</h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] text-[#6B5B8D]"
              onClick={() => {
                setParams(PLAN_DEFAULTS);
                try {
                  localStorage.removeItem(STORAGE_KEY);
                } catch {
                  /* quota */
                }
              }}
            >
              <RotateCcw className="mr-1 h-3 w-3" /> Défauts (200 €, +20 %)
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <Label className="text-[10px] text-zinc-400">{f.label}</Label>
                <Input
                  type={f.type === "date" ? "date" : "number"}
                  step={f.step}
                  value={String(params[f.key])}
                  onChange={(e) => setField(f.key, e.target.value, f.type)}
                  className="mt-1 h-8 font-mono text-xs"
                />
              </div>
            ))}
            <div className="flex items-end gap-2 pb-1">
              <input
                id="planAutoBank"
                type="checkbox"
                checked={params.autoBank}
                onChange={(e) => setField("autoBank", String(e.target.checked), "check")}
                className="h-4 w-4 accent-emerald-500"
              />
              <Label htmlFor="planAutoBank" className="text-[11px] text-zinc-400">
                Virement auto en banque
              </Label>
            </div>
          </div>
        </section>

        {/* KPIs du jour courant : théorique vs réel */}
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            {
              label: "Capital (réel)",
              value: live ? `${fmt(live.cap)} €` : "—",
              sub: liveTh ? `théorique ${fmt(liveTh.C)} €` : undefined,
              tone: live && liveTh && live.cap >= liveTh.C ? "good" : "bad",
            },
            {
              label: "Banque (réel)",
              value: live ? `${fmt(live.bank)} €` : "—",
              sub: liveTh ? `théorique ${fmt(liveTh.B)} €` : undefined,
              tone: "accent" as const,
            },
            {
              label: "Total réel",
              value: live ? `${fmt(live.tRe)} €` : "—",
              sub: liveTh ? `théorique ${fmt(liveTh.T)} €` : undefined,
              tone: undefined,
            },
            {
              label: live && live.retard !== null ? (live.retard > 0 ? "Retard à combler" : "Avance") : "Retard",
              value: live && live.retard !== null ? `${live.retard > 0 ? "+" : ""}${fmt(live.retard)} €` : "—",
              sub:
                live && live.retardJour !== null && live.retard !== null && live.retard > 0
                  ? `${fmt(live.retardJour)} €/j sur ${live.jrest} j`
                  : live && live.jrest !== null
                    ? `${live.jrest} j restants`
                    : undefined,
              tone: live && (live.retard ?? 0) > 0 ? "bad" : "good",
            },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[#6B5B8D]">{k.label}</div>
              <div
                className={cn(
                  "mt-1.5 font-mono text-lg font-semibold tabular-nums",
                  k.tone === "good" && "text-emerald-400",
                  k.tone === "bad" && "text-red-400",
                  k.tone === "accent" && "text-sky-400",
                  !k.tone && "text-zinc-100"
                )}
              >
                {k.value}
              </div>
              {k.sub ? <div className="mt-0.5 text-[11px] text-[#6B5B8D]">{k.sub}</div> : null}
            </div>
          ))}
        </section>

        {/* Journal : projection théorique + suivi réel */}
        <section className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.03]">
          <div className="border-b border-white/5 px-3 py-2.5">
            <h2 className="text-sm font-semibold text-zinc-100">
              Journal — objectif {params.targetPct} % du capital de début de journée · {params.maxBets} paris max/jour
            </h2>
            <p className="mt-0.5 text-[11px] text-[#6B5B8D]">
              Cote requise jour 1 : {liveTh?.oReq ? fmt(liveTh.oReq) : "—"} · espérance nulle :{" "}
              {liveTh?.oNeutral ? fmt(liveTh.oNeutral) : "—"} (q = {fmt(params.winProb * 100, 0)} %) · mise/pari ={" "}
              {liveTh ? fmt(liveTh.miseParPari) : "—"} € (stakeForTarget :{" "}
              {liveTh ? fmt(stakeForTarget(liveTh.gainParPari, params.oddsTarget) ?? 0) : "—"} € à {fmt(params.oddsTarget)})
            </p>
          </div>
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-[#6B5B8D]">
                <th className="px-2 py-2 font-semibold">J</th>
                <th className="px-2 py-2 font-semibold">Date</th>
                <th className="px-2 py-2 text-right font-semibold">Début</th>
                <th className="px-2 py-2 text-right font-semibold">Gain G</th>
                <th className="px-2 py-2 text-right font-semibold">Banque</th>
                <th className="px-2 py-2 text-right font-semibold">Réinvest</th>
                <th className="px-2 py-2 text-right font-semibold">C fin</th>
                <th className="px-2 py-2 text-right font-semibold">B</th>
                <th className="px-2 py-2 text-right font-semibold">T th.</th>
                <th className="px-2 py-2 text-right font-semibold">Misé</th>
                <th className="px-2 py-2 text-right font-semibold">T réel</th>
                <th className="px-2 py-2 text-right font-semibold">Retard</th>
                <th className="px-2 py-2 text-right font-semibold">R/j</th>
                <th className="px-2 py-2 font-semibold">État</th>
              </tr>
            </thead>
            <tbody>
              {th.map((t, i) => {
                const r = real.rows[i];
                const isLive = real.live?.d === t.d;
                return (
                  <tr
                    key={t.d}
                    className={cn(
                      "border-b border-white/[0.03]",
                      isLive && "bg-emerald-500/[0.06]",
                      r?.future && "opacity-45"
                    )}
                  >
                    <td className="px-2 py-1.5 font-mono text-[11px] text-[#6B5B8D]">{t.d}</td>
                    <td className="px-2 py-1.5 font-mono text-[11px] text-[#6B5B8D]">{t.key.slice(8)}/{t.key.slice(5, 7)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{fmt(t.cStart)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-400">{fmt(t.G)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-sky-400">{fmt(t.toBank)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{fmt(t.reinvest)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold">{fmt(t.C)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-sky-400">{fmt(t.B)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold">{fmt(t.T)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[#6B5B8D]">{fmt(t.stake)}</td>
                    <td className={cn("px-2 py-1.5 text-right font-mono font-semibold", r && !r.future && r.tRe >= t.T ? "text-emerald-400" : "text-zinc-200")}>
                      {r && !r.future ? fmt(r.tRe) : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-1.5 text-right font-mono",
                        r && !r.future ? (r.retard !== null && r.retard > 0 ? "text-red-400" : "text-emerald-400") : "text-zinc-600"
                      )}
                    >
                      {r && !r.future && r.retard !== null ? `${r.retard > 0 ? "+" : ""}${fmt(r.retard)}` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-[#6B5B8D]">
                      {r && !r.future && r.retardJour !== null ? fmt(r.retardJour) : "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      {r?.future ? (
                        <span className="font-mono text-[10px] text-zinc-600">à venir</span>
                      ) : r && r.n > 0 ? (
                        <span className="font-mono text-[10px] text-emerald-400">
                          {r.won}G {r.lost}P {r.pending}C
                        </span>
                      ) : isLive ? (
                        <span className="font-mono text-[10px] text-amber-400">aujourd'hui</span>
                      ) : (
                        <span className="font-mono text-[10px] text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Table d'arbitrage risque / espérance */}
        <section className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.03]">
          <div className="border-b border-white/5 px-3 py-2.5">
            <h2 className="text-sm font-semibold text-zinc-100">Table d'arbitrage — cote requise par engagement</h2>
            <p className="mt-0.5 text-[11px] text-[#6B5B8D]">
              Pour viser {params.targetPct} % du capital ({fmt(params.capital)} €) le premier jour
            </p>
          </div>
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-[#6B5B8D]">
                <th className="px-3 py-2 font-semibold">Capital engagé</th>
                {arb.map((r) => (
                  <th key={r.pct} className="px-3 py-2 text-right font-semibold">
                    {r.pct} %
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/[0.03]">
                <td className="px-3 py-2 text-[#6B5B8D]">Mise à engager</td>
                {arb.map((r) => (
                  <td key={r.pct} className="px-3 py-2 text-right font-mono">
                    {fmt(r.stake)} €
                  </td>
                ))}
              </tr>
              <tr className="border-b border-white/[0.03]">
                <td className="px-3 py-2 text-[#6B5B8D]">Cote moyenne requise</td>
                {arb.map((r) => (
                  <td key={r.pct} className="px-3 py-2 text-right font-mono font-semibold text-emerald-400">
                    {fmt(r.odds)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-white/[0.03]">
                <td className="px-3 py-2 text-[#6B5B8D]">Mise / pari ({params.maxBets})</td>
                {arb.map((r) => (
                  <td key={r.pct} className="px-3 py-2 text-right font-mono">
                    {fmt(r.stake / Math.max(1, params.maxBets))} €
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-3 py-2 text-[#6B5B8D]">Perte si tout perdu</td>
                {arb.map((r) => (
                  <td key={r.pct} className="px-3 py-2 text-right font-mono text-red-400">
                    −{fmt(r.stake)} €
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      </main>

      <BankrollForm
        open={showBankrollForm}
        onOpenChange={setShowBankrollForm}
        onCreate={async (name, initial, currency) => {
          await bm.createBankroll(name, initial, currency);
          window.location.reload();
        }}
      />
    </div>
  );
}
