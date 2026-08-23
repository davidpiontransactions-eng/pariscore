"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Trophy, FileDown, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBetManager } from "@/hooks/use-bet-manager";
import { BetManagerNav } from "@/components/bet-manager/bet-manager-nav";
import { BetTable } from "@/components/bet-manager/bet-table";
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

  const filteredBets = useMemo(() => {
    let bets = bm.bets;
    if (status !== "all") bets = bets.filter((b) => b.status === status);
    if (search) {
      const q = search.toLowerCase();
      bets = bets.filter(
        (b) =>
          b.matchLabel?.toLowerCase().includes(q) ||
          b.bookmaker?.toLowerCase().includes(q) ||
          b.pick?.toLowerCase().includes(q) ||
          b.tipster?.toLowerCase().includes(q)
      );
    }
    return bets;
  }, [bm.bets, status, search]);

  const currency = bm.activeBankroll?.currency ?? "EUR";

  return (
    <div className="min-h-screen bg-bg-deep pb-16 text-zinc-100">
      {/* En-tête du module */}
      <header className="border-b border-white/5 bg-bg-deep">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between px-4 py-2 sm:px-6">
          <Link
            href="/bankroll"
            className="inline-flex items-center gap-2.5 text-sm font-bold tracking-tight text-white transition-opacity hover:opacity-80"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Trophy className="h-4 w-4" />
            </span>
            Paris
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/bankroll" className="text-sm text-zinc-400 hover:text-white">
              Dashboard
            </Link>
            <Link href="/bankroll/tools" className="text-sm text-zinc-400 hover:text-white">
              Calculateurs
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <LocalStorageMigration />

        {/* Filtres + actions */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Rechercher (match, bookmaker, pick, tipster…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBankrollForm(true)}>
              <Trophy className="h-4 w-4 mr-2" />
              Bankroll
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const csv = betsToCSV(filteredBets);
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `paris-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}>
              <FileDown className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
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
            >
              {settling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Résolution…
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Résultats auto
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Import CSV */}
        <CsvImport bankrollId={bm.activeBankroll?.id} onImported={bm.refresh} />

        {/* Liste des paris */}
        <BetTable bets={filteredBets} currency={currency} />

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
        {showBankrollForm && (
          <BankrollForm
            bankrolls={bm.bankrolls}
            activeId={bm.activeBankroll?.id}
            onSelect={bm.setActiveBankroll}
            onCreate={async (input) => {
              await bm.createBankroll(input);
              setShowBankrollForm(false);
            }}
            onUpdate={bm.updateBankroll}
            onDelete={bm.deleteBankroll}
            loading={bm.bankrollsLoading}
          />
        )}
      </main>
    </div>
  );
}