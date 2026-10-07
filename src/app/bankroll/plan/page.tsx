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
  PLAN_STORAGE_KEY,
  betPL,
  computeReal,
  computeTheoretical,
  dailyLoanRepayment,
  loanCumulatedAt,
  loanRemainingAt,
  stakeForTarget,
  todayKey,
  type PlanBet,
  type PlanParams,
} from "@/lib/bet-manager/plan";
import { tradeoffTable } from "@/lib/bet-manager/calculators";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RealTable, SimulatedTable } from "@/components/bet-manager/plan-tables";
import { useBankLoan } from "@/hooks/use-bank-loan";

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
  const { loan, setLoan } = useBankLoan();
  const [showBankrollForm, setShowBankrollForm] = useState(false);
  const [params, setParams] = useState<PlanParams>(PLAN_DEFAULTS);

  const loanDaily = dailyLoanRepayment(loan);
  const showLoan = loanDaily !== null;

  // Persistance locale des paramètres (même pattern que suivi-paris.html)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PLAN_STORAGE_KEY);
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
        localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(next));
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
  // Retard TOTAL du jour courant : écart du plan + amortissement de l'emprunt cumulé.
  const retardLive = live && live.retard !== null ? live.retard + loanCumulatedAt(loan, live.key) : null;
  const retardJourLive =
    retardLive !== null && live && live.jrest !== null && live.jrest > 0
      ? Math.max(0, retardLive) / live.jrest
      : null;

  return (
    <div className="min-h-screen bg-bg-deep pb-16 text-foreground">
      <header className="border-b border-white/5 bg-bg-deep">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between px-4 py-2 sm:px-6">
          <Link
            href="/bankroll"
            className="inline-flex items-center gap-2.5 text-sm font-bold tracking-tight text-foreground transition-opacity hover:opacity-70"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <CalendarDays className="h-4 w-4" />
            </span>
            Plan +{params.targetPct}%/j
          </Link>
          <Link href="/bankroll" className="text-sm text-foreground opacity-70 hover:opacity-100">
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
            <h2 className="text-sm font-semibold text-foreground">Paramètres du plan</h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] text-foreground"
              onClick={() => {
                setParams(PLAN_DEFAULTS);
                try {
                  localStorage.removeItem(PLAN_STORAGE_KEY);
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
                <Label className="text-[10px] text-foreground">{f.label}</Label>
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
              <Label htmlFor="planAutoBank" className="text-[11px] text-foreground">
                Virement auto en banque
              </Label>
            </div>
          </div>
        </section>

        {/* Emprunt banque — capital pris en banque, à amortir EN PLUS des gains (bead v1v8) */}
        <section className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Emprunt banque</h2>
            {showLoan && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-foreground"
                onClick={() => setLoan({ amount: 0, startDate: "", days: 0 })}
              >
                Retirer l'emprunt
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-[10px] text-foreground">Montant emprunté (€)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={loan.amount > 0 ? String(loan.amount) : ""}
                placeholder="ex: 200"
                onChange={(e) => setLoan({ ...loan, amount: parseFloat(e.target.value) || 0 })}
                className="mt-1 h-8 font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-foreground">Pris le (date)</Label>
              <Input
                type="date"
                value={loan.startDate}
                onChange={(e) => setLoan({ ...loan, startDate: e.target.value })}
                className="mt-1 h-8 font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-foreground">Durée d'amortissement (jours)</Label>
              <Input
                type="number"
                step="1"
                min="1"
                value={loan.days > 0 ? String(loan.days) : ""}
                placeholder="ex: 24"
                onChange={(e) => setLoan({ ...loan, days: parseInt(e.target.value, 10) || 0 })}
                className="mt-1 h-8 font-mono text-xs"
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-foreground">
            {showLoan && loan.startDate ? (
              <>
                <strong className="font-mono">{fmt(loanDaily as number)} €/jour</strong> à rembourser en plus des gains ·
                reste <strong className="font-mono">{fmt(loanRemainingAt(loan, todayKey()))} €</strong> à ce jour
                (contracté le {loan.startDate.slice(8)}/{loan.startDate.slice(5, 7)}/{loan.startDate.slice(0, 4)} sur{" "}
                {loan.days} j) · amortissement cumulé intégré à l'objectif et au retard.
              </>
            ) : (
              "Aucun emprunt actif — renseigne montant, date et durée pour intégrer l'amortissement à l'objectif quotidien (gains + remboursement)."
            )}
          </p>
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
              label: retardLive !== null ? (retardLive > 0 ? "Retard à combler" : "Avance") : "Retard",
              value: retardLive !== null ? `${retardLive > 0 ? "+" : ""}${fmt(retardLive)} €` : "—",
              sub:
                retardLive !== null && retardJourLive !== null && retardLive > 0
                  ? `${fmt(retardJourLive)} €/j sur ${live?.jrest} j${showLoan ? " (gains + emprunt)" : ""}`
                  : live && live.jrest !== null
                    ? `${live.jrest} j restants`
                    : undefined,
              tone: undefined,
            },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-foreground">{k.label}</div>
          <div
            className={
              "mt-1.5 font-mono text-lg font-semibold tabular-nums text-foreground"
            }
          >
                {k.value}
              </div>
              {k.sub ? <div className="mt-0.5 text-[11px] text-foreground">{k.sub}</div> : null}
            </div>
          ))}
        </section>

        {/* Journal — dualité Simulé vs Réel (mission ybz4) */}
        <section className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.03]">
          <div className="border-b border-white/5 px-3 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">
              Journal — objectif {params.targetPct} % du capital de début de journée · {params.maxBets} paris max/jour
            </h2>
            <p className="mt-0.5 text-[11px] text-foreground">
              Cote requise jour 1 : {liveTh?.oReq ? fmt(liveTh.oReq) : "—"} · espérance nulle :{" "}
              {liveTh?.oNeutral ? fmt(liveTh.oNeutral) : "—"} (q = {fmt(params.winProb * 100, 0)} %) · mise/pari ={" "}
              {liveTh ? fmt(liveTh.miseParPari) : "—"} € (stakeForTarget :{" "}
              {liveTh ? fmt(stakeForTarget(liveTh.gainParPari, params.oddsTarget) ?? 0) : "—"} € à {fmt(params.oddsTarget)})
              {showLoan && loanDaily !== null
                ? ` · emprunt : ${fmt(loanDaily)} €/j à rembourser en plus (objectif total = gains + amortissement)`
                : ""}
            </p>
            {live && liveTh && liveTh.T > 0 && (
              (() => {
                // Delta capital : réel actuel vs simulé à la même date (€ et %).
                const delta = liveTh.T - live.tRe;
                const pct = (Math.abs(delta) / liveTh.T) * 100;
                return (
                  <p className="mt-1 text-[11px] font-semibold text-foreground">
                    Delta capital — simulé {fmt(liveTh.T)} € vs réel {fmt(live.tRe)} € :{" "}
                    {delta > 0 ? `retard +${fmt(delta)} €` : `avance +${fmt(-delta)} €`} ({fmt(pct, 1)} %)
                  </p>
                );
              })()
            )}
          </div>
          <div className="p-3">
            <Tabs defaultValue="simule">
              <TabsList className="mb-3">
                <TabsTrigger value="simule">Tableau Simulé</TabsTrigger>
                <TabsTrigger value="reel">Tableau Réel</TabsTrigger>
              </TabsList>
              <TabsContent value="simule">
                <SimulatedTable
                  params={params}
                  th={th}
                  real={real}
                  loan={loan}
                  showLoan={showLoan}
                  loanDaily={loanDaily}
                />
              </TabsContent>
              <TabsContent value="reel">
                <RealTable
                  params={params}
                  th={th}
                  real={real}
                  loan={loan}
                  showLoan={showLoan}
                  loanDaily={loanDaily}
                />
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* Table d'arbitrage risque / espérance */}
        <section className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.03]">
          <div className="border-b border-white/5 px-3 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">Table d'arbitrage — cote requise par engagement</h2>
            <p className="mt-0.5 text-[11px] text-foreground">
              Pour viser {params.targetPct} % du capital ({fmt(params.capital)} €) le premier jour
            </p>
          </div>
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-foreground">
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
                <td className="px-3 py-2 text-foreground">Mise à engager</td>
                {arb.map((r) => (
                  <td key={r.pct} className="px-3 py-2 text-right font-mono">
                    {fmt(r.stake)} €
                  </td>
                ))}
              </tr>
              <tr className="border-b border-white/[0.03]">
                <td className="px-3 py-2 text-foreground">Cote moyenne requise</td>
                {arb.map((r) => (
                  <td key={r.pct} className="px-3 py-2 text-right font-mono font-semibold text-foreground">
                    {fmt(r.odds)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-white/[0.03]">
                <td className="px-3 py-2 text-foreground">Mise / pari ({params.maxBets})</td>
                {arb.map((r) => (
                  <td key={r.pct} className="px-3 py-2 text-right font-mono">
                    {fmt(r.stake / Math.max(1, params.maxBets))} €
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-3 py-2 text-foreground">Perte si tout perdu</td>
                {arb.map((r) => (
                  <td key={r.pct} className="px-3 py-2 text-right font-mono text-foreground">
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
