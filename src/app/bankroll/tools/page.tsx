"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { useBetManager } from "@/hooks/use-bet-manager";
import { BetManagerNav } from "@/components/bet-manager/bet-manager-nav";
import { CalculatorsGrid } from "@/components/bet-manager/calculators-grid";
import { BankrollForm } from "@/components/bet-manager/bankroll-form";

export default function BankrollToolsPage() {
  const bm = useBetManager();
  const [showBankrollForm, setShowBankrollForm] = useState(false);
  const initial = bm.activeBankroll?.initial ?? 1000;

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
        bankrolls={bm.bankrolls as any}
        activeId={bm.activeId}
        onSelect={bm.selectBankroll}
        onCreate={() => setShowBankrollForm(true)}
      />

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6">
        <div>
          <h1 className="text-base font-bold text-white">Outils du parieur</h1>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            17 calculateurs gratuits — cotes, Kelly, arbitrage, Monte Carlo… Le « Plan de mise »
            utilise ton historique réel ({bm.bets.length} paris).
          </p>
        </div>
        <CalculatorsGrid bets={bm.bets} initial={initial} />
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