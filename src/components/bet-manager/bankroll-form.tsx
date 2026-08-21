"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, PiggyBank } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, initial: number, currency?: string) => Promise<void>;
};

export function BankrollForm({ open, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState("");
  const [initial, setInitial] = useState("1000");
  const [currency, setCurrency] = useState("EUR");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amount = parseFloat(initial);
    if (!name.trim()) {
      toast.error("Donne un nom à ta bankroll");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      toast.error("Capital initial invalide");
      return;
    }
    setBusy(true);
    try {
      await onCreate(name.trim(), amount, currency);
      toast.success(`Bankroll « ${name.trim()} » créée 🎉`);
      setName("");
      setInitial("1000");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Erreur à la création");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#0d1117] text-zinc-100 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PiggyBank className="h-4 w-4 text-emerald-400" /> Nouvelle bankroll
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-zinc-400">Nom</Label>
            <Input
              className="h-9 border-white/10 bg-white/5 text-xs text-zinc-100"
              placeholder="Ex : Bankroll principale"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-[1fr_84px] gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-zinc-400">Capital initial</Label>
              <Input
                className="h-9 border-white/10 bg-white/5 font-mono text-xs text-zinc-100"
                inputMode="decimal"
                value={initial}
                onChange={(e) => setInitial(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-zinc-400">Devise</Label>
              <Input
                className="h-9 border-white/10 bg-white/5 text-xs text-zinc-100"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="text-zinc-400">
              Annuler
            </Button>
          </DialogClose>
          <Button size="sm" className="gap-1.5 bg-emerald-500 text-emerald-950 hover:bg-emerald-400" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}