"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Landmark, Loader2, Plus, Trophy, Trash2 } from "lucide-react";
import { useBetManager } from "@/hooks/use-bet-manager";
import { BetManagerNav } from "@/components/bet-manager/bet-manager-nav";
import { BankrollForm } from "@/components/bet-manager/bankroll-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bmApi } from "@/lib/bet-manager/api";
import { ledgerKpis } from "@/lib/bet-manager/stats";
import type { BankrollTx } from "@/lib/bet-manager/types";

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const KIND_META: Record<BankrollTx["kind"], { label: string; className: string }> = {
  deposit: { label: "Dépôt", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  withdrawal: { label: "Retrait", className: "border-red-500/30 bg-red-500/10 text-red-400" },
  bonus: { label: "Bonus", className: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
  adjustment: { label: "Ajustement", className: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
};

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "accent" }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[#6B5B8D]">{label}</div>
      <div
        className={
          "mt-1.5 font-mono text-lg font-semibold tabular-nums " +
          (tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : tone === "accent" ? "text-emerald-400" : "text-zinc-100")
        }
      >
        {value}
      </div>
    </div>
  );
}

export default function BankrollLedgerPage() {
  const bm = useBetManager();
  const [showBankrollForm, setShowBankrollForm] = useState(false);
  const [txs, setTxs] = useState<BankrollTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<BankrollTx["kind"]>("deposit");
  const [amount, setAmount] = useState("");
  const [at, setAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const activeId = bm.activeId;

  const reload = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    try {
      const res = await bmApi.listTxs(activeId);
      setTxs(res.txs);
    } catch (err: any) {
      toast.error("Ledger illisible : " + (err.message ?? "erreur"));
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const kpis = useMemo(
    () => ledgerKpis(txs, bm.activeBankroll?.initial ?? 0, bm.stats?.stats.profit ?? 0),
    [txs, bm.activeBankroll?.initial, bm.stats?.stats.profit]
  );

  const submit = async () => {
    if (!activeId) return toast.error("Sélectionne une bankroll.");
    const v = parseFloat(amount.replace(",", "."));
    if (!isFinite(v) || v === 0) return toast.error("Montant invalide.");
    setSaving(true);
    try {
      await bmApi.createTx(activeId, { kind, amount: v, at, note: note || undefined });
      setAmount("");
      setNote("");
      toast.success("Mouvement enregistré.");
      await reload();
    } catch (err: any) {
      toast.error("Échec : " + (err.message ?? "erreur"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (txId: string) => {
    if (!activeId) return;
    try {
      await bmApi.deleteTx(activeId, txId);
      await reload();
    } catch (err: any) {
      toast.error("Suppression impossible : " + (err.message ?? "erreur"));
    }
  };

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
              <Landmark className="h-4 w-4" />
            </span>
            Banque
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
        {/* KPIs ledger */}
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Kpi label="Initial" value={`${fmt(bm.activeBankroll?.initial ?? 0)} €`} />
          <Kpi label="Dépôts" value={`+${fmt(kpis.deposits)} €`} tone="good" />
          <Kpi label="Retraits" value={`${fmt(kpis.withdrawals)} €`} tone="bad" />
          <Kpi label="Bonus" value={`+${fmt(kpis.bonuses)} €`} tone="good" />
          <Kpi label="Ajustements" value={`${fmt(kpis.adjustments)} €`} />
          <Kpi
            label="Mouvement net"
            value={`${kpis.net >= 0 ? "+" : ""}${fmt(kpis.net)} €`}
            tone={kpis.net >= 0 ? "good" : "bad"}
          />
          <Kpi label="P/L des paris" value={`${(bm.stats?.stats.profit ?? 0) >= 0 ? "+" : ""}${fmt(bm.stats?.stats.profit ?? 0)} €`} tone={(bm.stats?.stats.profit ?? 0) >= 0 ? "good" : "bad"} />
          <Kpi label="Solde courant" value={`${fmt(kpis.current)} €`} tone="accent" />
        </section>

        {/* Formulaire de saisie */}
        <section className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-100">Nouveau mouvement</h2>
          <div className="grid gap-3 sm:grid-cols-[160px_140px_150px_1fr_auto] sm:items-end">
            <div>
              <Label className="text-[10px] text-zinc-400">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as BankrollTx["kind"])}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_META) as BankrollTx["kind"][]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_META[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-zinc-400">Montant (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                className="mt-1 h-9 font-mono"
              />
            </div>
            <div>
              <Label className="text-[10px] text-zinc-400">Date</Label>
              <Input type="date" value={at} onChange={(e) => setAt(e.target.value)} className="mt-1 h-9 font-mono" />
            </div>
            <div>
              <Label className="text-[10px] text-zinc-400">Note (optionnel)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ex : retrait Neteller"
                className="mt-1 h-9"
              />
            </div>
            <Button onClick={submit} disabled={saving || !activeId} className="h-9">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Ajouter
            </Button>
          </div>
        </section>

        {/* Table du ledger */}
        <section className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.03]">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-[#6B5B8D]">
                <th className="px-3 py-2.5 font-semibold">Date</th>
                <th className="px-3 py-2.5 font-semibold">Type</th>
                <th className="px-3 py-2.5 text-right font-semibold">Montant</th>
                <th className="px-3 py-2.5 font-semibold">Note</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-zinc-600">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </td>
                </tr>
              ) : txs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-zinc-600">
                    Aucun mouvement. Enregistre un dépôt pour démarrer le ledger.
                  </td>
                </tr>
              ) : (
                txs.map((t) => (
                  <tr key={t.id} className="group border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 font-mono text-[11px] text-[#6B5B8D]">{t.at.slice(0, 10)}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={
                          "inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] " +
                          KIND_META[(t.kind as BankrollTx["kind"]) ?? "adjustment"].className
                        }
                      >
                        {KIND_META[(t.kind as BankrollTx["kind"]) ?? "adjustment"].label}
                      </span>
                    </td>
                    <td
                      className={
                        "px-3 py-2.5 text-right font-mono font-semibold " +
                        (t.amount >= 0 ? "text-emerald-400" : "text-red-400")
                      }
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {fmt(t.amount)} €
                    </td>
                    <td className="max-w-64 truncate px-3 py-2.5 text-[#6B5B8D]">{t.note ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#6B5B8D] opacity-100 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                        title="Supprimer le mouvement"
                        aria-label="Supprimer le mouvement"
                        onClick={() => remove(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
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
