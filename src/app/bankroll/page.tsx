"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useBetManager } from "@/hooks/use-bet-manager";
import { BetManagerNav } from "@/components/bet-manager/bet-manager-nav";
import { KpiStrip } from "@/components/bet-manager/kpi-strip";
import { CapitalChart } from "@/components/bet-manager/capital-chart";
import { BreakdownList } from "@/components/bet-manager/breakdown-list";
import { BetTable } from "@/components/bet-manager/bet-table";
import { BetForm } from "@/components/bet-manager/bet-form";
import { BankrollForm } from "@/components/bet-manager/bankroll-form";
import { CsvImport } from "@/components/bet-manager/csv-import";
import { LocalStorageMigration } from "@/components/bet-manager/local-storage-migration";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, Plus, Trophy, ArrowLeft, Loader2, Download } from "lucide-react";

export default function BankrollDashboardPage() {
  const bm = useBetManager();
  const [showForm, setShowForm] = useState(false);
  const [showBankrollForm, setShowBankrollForm] = useState(false);
  const [settling, setSettling] = useState(false);

  const loading = !bm.bankrolls && bm.betsLoading;
  const currency = bm.activeBankroll?.currency ?? "EUR";

  return (
    <div className="min-h-screen bg-bg-deep pb-16 text-zinc-100">
      {/* En-tête du module */}
      <header className="border-b border-white/5 bg-bg-deep">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between px-4 py-2 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-sm font-bold tracking-tight text-white transition-opacity hover:opacity-80"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Trophy className="h-4 w-4" />
            </span>
            PariScore
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
              Bet Manager
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Accueil
          </Link>
        </div>
      </header>

      <BetManagerNav
        bankrolls={bm.bankrolls as any}
        activeId={bm.activeId}
        onSelect={bm.selectBankroll}
        onCreate={() => setShowBankrollForm(true)}
      />

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6">
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl bg-white/5" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-xl bg-white/5" />
          </div>
        ) : bm.bankrolls.length === 0 ? (
          /* État vide — première bankroll */
          <section className="mx-auto mt-16 max-w-md rounded-2xl border border-dashed border-emerald-500/25 bg-emerald-500/[0.03] p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Plus className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-white">Crée ta première bankroll</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Une bankroll est ton capital de départ (ex. 1 000 €). Ensuite, enregistre tes paris
              manuellement, par scan de ticket 1xbet (OCR) ou par import CSV.
            </p>
            <Button
              className="mt-5 gap-1.5 bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
              onClick={() => setShowBankrollForm(true)}
            >
              <Plus className="h-4 w-4" /> Créer ma bankroll
            </Button>
          </section>
        ) : !bm.stats ? (
          <div className="flex items-center justify-center py-20 text-zinc-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement des paris…
          </div>
        ) : (
          <>
            {/* Migration ancien module */}
            <LocalStorageMigration onMigrated={() => window.location.reload()} />

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-base font-bold text-white">
                {bm.activeBankroll?.name}
                <span className="ml-2 font-mono text-xs font-normal text-zinc-500">
                  {bm.stats.stats.totalBets} paris · {bm.stats.stats.pendingCount} en attente
                </span>
              </h1>
              <div className="flex items-center gap-2">
                {bm.stats.stats.pendingCount > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-white/10 text-xs text-zinc-300 hover:bg-white/5"
                    onClick={async () => {
                      setSettling(true);
                      const r = await bm.autoSettle();
                      setSettling(false);
                      if (r) {
                        if (r.settled > 0) toast.success(`${r.settled} pari${r.settled > 1 ? "s" : ""} réglé${r.settled > 1 ? "s" : ""} automatiquement ⚡`);
                        else toast.info(`Aucun pari réglable pour l'instant (${r.unresolved} non résolus)`);
                      }
                    }}
                    disabled={settling}
                  >
                    {settling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-amber-400" />}
                    Résultats auto
                  </Button>
                ) : null}
                <CsvImport onImport={bm.importCSV} />
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                  onClick={() => setShowForm(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Ajouter un pari
                </Button>
              </div>
            </div>

            {/* KPIs — signature trading cockpit */}
            <KpiStrip stats={bm.stats.stats} currency={currency} />

            {/* Courbe de capital */}
            <CapitalChart curve={bm.stats.curve} currency={currency} />

            {/* Répartitions */}
            <div className="grid gap-4 md:grid-cols-3">
              <BreakdownList title="Par sport" groups={bm.stats.bySport} />
              <BreakdownList title="Par bookmaker" groups={bm.stats.byBookmaker} />
              <BreakdownList title="Par plage de cote" groups={bm.stats.byOdds} showOdds />
            </div>

            {/* Derniers paris */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  Derniers paris
                </h2>
                <Link
                  href="/bankroll/bets"
                  className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                >
                  Tout voir <Download className="h-3 w-3 rotate-[-90deg]" />
                </Link>
              </div>
              <BetTable bets={bm.bets.slice(0, 8)} onSettle={bm.settleBet} onDelete={bm.deleteBet} />
            </section>
          </>
        )}
      </main>

      {showForm && bm.activeId ? (
        <BetForm bankrollId={bm.activeId} onAdd={bm.addBet} onClose={() => setShowForm(false)} />
      ) : null}
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