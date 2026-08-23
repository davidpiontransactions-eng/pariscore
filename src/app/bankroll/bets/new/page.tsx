"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useBetManager } from "@/hooks/use-bet-manager";
import { BetForm } from "@/components/bet-manager/bet-form";
import { ArrowLeft, Trophy } from "lucide-react";

export default function BankrollNewBetPage() {
  const bm = useBetManager();

  return (
    <div className="min-h-screen bg-bg-deep pb-16 text-zinc-100">
      <header className="border-b border-white/5 bg-bg-deep">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center justify-between px-4 py-2">
          <Link
            href="/bankroll/bets"
            className="inline-flex items-center gap-2.5 text-sm font-bold tracking-tight text-white transition-opacity hover:opacity-80"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Trophy className="h-4 w-4" />
            </span>
            Nouveau pari
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <BetForm
          bankrollId={bm.activeBankroll?.id ?? null}
          onAdd={async (input) => {
            await bm.addBet(input);
            toast.success("Pari ajouté !");
          }}
        />
      </main>
    </div>
  );
}