"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Trophy, FileDown, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBetManager } from "@/hooks/use-bet-manager";
import { BetManagerNav } from "@/components/bet-manager/bet-manager-nav";
import { BetTable } from "@/components/bet-manager/bet-table";
import { BetForm } from "@/components/bet-manager/bet-form";
import { BankrollForm } from "@/components/bet-manager/bankroll-form";
import { CsvImport } from "@/components/bet-manager/csv-import";
import { LocalStorageMigration } from "@/components/bet-manager/local-storage-migration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { betsToCSV } from "@/lib/bet-manager/calculators";

const STATUSES = [
  { value: "all", label: "Tous" },
  { value: "pending", label: "En attente" },
  { value: "won", label: "Gagnés" },
  { value: "lost", label: "Perdus" },
  { value: "void", label: "Remboursés" },
  { value: "cashout", label: "Cashout" },
];

export default function BankrollBetsPage() {
  const bm = useBetManager();
  const [showForm, setShowForm] = useState(false);
  const [showBankrollForm, setShowBankrollForm] = useState(false);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [settling, setSettling] = useState(false);
  const pendingCount = bm.bets.filter((b) => b.status === "pending").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bm.bets.filter((b) => {
      if (status !== "all" && b.status !== status) return false;
      if (!q) return true;
      return [b.matchLabel, b.pick, b.competition, b.bookmaker, b.tipster]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [bm.bets, status, search]);

  const exportCsv = () => {
    const csv = betsToCSV(bm.bets);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pariscore-bets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        bankrolls={bm.bankrolls as any}
        activeId={bm.activeId}
        onSelect={bm.selectBankroll}
        onCreate={() => setShowBankrollForm(true)}
      />

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6">
        <LocalStorageMigration onMigrated={() => window.location.reload()} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-base font-bold text-white">
            Tous les paris
            <span className="ml-2 font-mono text-xs font-normal text-zinc-500">
              {filtered.length}/{bm.bets.length}
            </span>
          </h1>
          <div className="flex items-center gap-2">
            {pendingCount > 0 ? (
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
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-white/10 text-xs text-zinc-300 hover:bg-white/5"
              onClick={exportCsv}
              disabled={bm.bets.length === 0}
            >
              <FileDown className="h-3.5 w-3.5 text-emerald-400" /> Export CSV
            </Button>
            <CsvImport onImport={bm.importCSV} />
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
              onClick={() => setShowForm(true)}
              disabled={!bm.activeId}
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter un pari
            </Button>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              className="h-9 w-52 border-white/10 bg-white/5 pl-8 text-xs text-zinc-100"
              placeholder="Rechercher (match, bookmaker, tipster…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-36 border-white/10 bg-white/5 text-xs text-zinc-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#101420] text-zinc-100">
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <BetTable bets={filtered} onSettle={bm.settleBet} onDelete={bm.deleteBet} />
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