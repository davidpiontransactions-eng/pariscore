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
import { BankrollForm } from "@/components/bet-manager/bankroll-form";
import { CsvImport } from "@/components/bet-manager/csv-import";
import { LocalStorageMigration } from "@/components/bet-manager/local-storage-migration";
import { Button } from "@/components/ui/button";
import { Zap, Plus, Trophy, Loader2 } from "lucide-react";
// Force rebuild: timestamp
const REBUILD_TRIGGER = Date.now();

export default function BankrollDashboardPage() {
  const bm = useBetManager();
  const [showForm, setShowForm] = useState(false);
  const [showBankrollForm, setShowBankrollForm] = useState(false);
  const [settling, setSettling] = useState(false);

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
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/bankroll/bets" className="text-sm text-zinc-400 hover:text-white">
              Voir tous les paris
            </Link>
            <Link href="/bankroll/tools" className="text-sm text-zinc-400 hover:text-white">
              Calculateurs
            </Link>
          </div>
        </div>
      </header>

      <BetManagerNav
        bankrolls={bm.bankrolls}
        activeId={bm.activeId}
        onSelect={bm.selectBankroll}
        onCreate={() => setShowBankrollForm(true)}
      />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <LocalStorageMigration />

        {/* KPIs + Courbe de capital */}
        <div className="grid gap-4 md:grid-cols-3">
          {bm.stats && (
            <>
              <KpiStrip stats={bm.stats.stats} currency={currency} />
              <div className="md:col-span-2">
                <CapitalChart curve={bm.stats.curve} currency={currency} />
              </div>
            </>
          )}
        </div>

        {/* Répartitions */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <BreakdownList title="Par sport" groups={bm.stats?.bySport ?? []} />
          <BreakdownList title="Par bookmaker" groups={bm.stats?.byBookmaker ?? []} />
          <BreakdownList title="Par plage de cote" groups={bm.stats?.byOdds ?? []} />
        </div>

        {/* Derniers paris + Formulaire */}
        <div className="mt-6 grid gap-4 md:grid-cols-[2fr_1fr]">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Derniers paris</h2>
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un pari
              </Button>
            </div>
            <BetTable
              bets={bm.bets.slice(0, 10)}
              onSettle={bm.settleBet}
              onDelete={bm.deleteBet}
            />
          </section>

          <aside className="space-y-4">
            <Button variant="outline" className="w-full" onClick={() => setShowBankrollForm(true)}>
              <Trophy className="h-4 w-4 mr-2" />
              Nouvelle bankroll
            </Button>
            <CsvImport onImport={bm.importCSV} />
          </aside>
        </div>

        {/* Auto-settle */}
        <div className="mt-6">
          <Button
            variant="outline"
            onClick={async () => {
              setSettling(true);
              try {
                const res = await fetch("/api/v1/bm/auto-settle", { method: "POST" });
                const data = await res.json();
                toast.success(data.message ?? `${data.settled} paris réglés, ${data.errors} erreurs`);
                bm.refresh();
              } catch (err: any) {
                toast.error("Échec auto-settle : " + err.message);
              } finally {
                setSettling(false);
              }
            }}
            disabled={settling || bm.betsLoading}
            className="w-full sm:w-auto"
          >
            {settling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Résolution en cours…
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Résultats auto (API-Football)
              </>
            )}
          </Button>
        </div>
      </main>

      {/* Dialogue d'ajout de pari — redirige vers page dédiée pour éviter les problèmes de build avec tesseract.js */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-bg-deep rounded-xl p-6 max-w-md w-full text-center">
            <h3 className="text-lg font-semibold mb-4">Formulaire de pari</h3>
            <p className="text-zinc-400 mb-6">
              Le formulaire complet avec OCR est disponible sur la page dédiée.
            </p>
            <Link
              href="/bankroll/bets/new"
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Ouvrir le formulaire complet
            </Link>
            <Button variant="ghost" className="mt-4 w-full" onClick={() => setShowForm(false)}>
              Fermer
            </Button>
          </div>
        </div>
      )}

      {/* Dialogue de création bankroll */}
      <BankrollForm
        open={showBankrollForm}
        onOpenChange={setShowBankrollForm}
        onCreate={async (name, initial, cur) => {
          await bm.createBankroll(name, initial, cur);
          window.location.reload();
        }}
      />
    </div>
  );
}