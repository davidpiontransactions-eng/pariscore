"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileDown, HardDriveDownload, KeyRound, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useBetManager } from "@/hooks/use-bet-manager";
import { BetManagerNav } from "@/components/bet-manager/bet-manager-nav";
import { CalculatorsGrid } from "@/components/bet-manager/calculators-grid";
import { BankrollForm } from "@/components/bet-manager/bankroll-form";
import { LocalStorageMigration } from "@/components/bet-manager/local-storage-migration";
import { Button } from "@/components/ui/button";
import { betsToCSV } from "@/lib/bet-manager/calculators";

export default function BankrollToolsPage() {
  const bm = useBetManager();
  const [showBankrollForm, setShowBankrollForm] = useState(false);
  const initial = bm.activeBankroll?.initial ?? 1000;

  const download = (name: string, mime: string, text: string) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    download(`paris-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;", betsToCSV(bm.bets));
    toast.success("Export CSV généré.");
  };

  const exportBackup = () => {
    download(
      `backup-betmanager-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json",
      JSON.stringify({ exportedAt: new Date().toISOString(), bankrolls: bm.bankrolls, bets: bm.bets }, null, 2)
    );
    toast.success("Backup JSON généré.");
  };

  return (
    <div className="min-h-screen bg-bg-deep pb-16 text-zinc-100">
      <header className="border-b border-white/5 bg-bg-deep">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between px-4 py-2 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2.5 text-sm font-bold tracking-tight text-white transition-opacity hover:opacity-80">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Trophy className="h-4 w-4" />
            </span>
            PariScore
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
              Bet Manager
            </span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Accueil
          </Link>
        </div>
      </header>

      <BetManagerNav
        bankrolls={bm.bankrolls}
        activeId={bm.activeId}
        onSelect={bm.selectBankroll}
        onCreate={() => setShowBankrollForm(true)}
      />

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6">
        <div>
          <h1 className="text-base font-bold text-white">Outils du parieur</h1>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            19 calculateurs gratuits — cotes, Kelly, arbitrage, conversion de bonus, Monte Carlo… Le « Plan de mise »
            utilise ton historique réel ({bm.bets.length} paris).
          </p>
        </div>
        <CalculatorsGrid bets={bm.bets} initial={initial} />

        {/* Paramètres & données */}
        <section className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <h2 className="text-sm font-semibold text-zinc-100">Paramètres &amp; données</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            Exporte ton historique, sauvegarde tout en JSON, ou migre les données de l'ancien module localStorage.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={bm.bets.length === 0}>
              <FileDown className="mr-1.5 h-3.5 w-3.5" /> Export CSV ({bm.bets.length} paris)
            </Button>
            <Button variant="outline" size="sm" onClick={exportBackup} disabled={bm.bets.length === 0}>
              <HardDriveDownload className="mr-1.5 h-3.5 w-3.5" /> Backup JSON
            </Button>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2.5 text-[11px] leading-relaxed text-[#6B5B8D]">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Clés API (API-Football, The Odds API…) : configurées côté serveur dans <code className="font-mono">.env</code>,
              jamais exposées au navigateur. Les résultats automatiques les utilisent en toute sécurité.
            </span>
          </div>
        </section>

        <LocalStorageMigration />
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