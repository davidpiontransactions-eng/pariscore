"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseBetsCSV } from "@/lib/bet-manager/calculators";

type Props = {
  onImport: (csv: string, fileName?: string) => Promise<number>;
};

const SAMPLE = `placedAt,sport,competition,match,market,pick,stake,odds,status,payout,bookmaker
2026-08-01T18:00:00,football,Ligue 1,"PSG vs OM",1X2,PSG,10,1.85,won,18.50,1xbet`;

export function CsvImport({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const detected = csv.trim() ? parseBetsCSV(csv).length : 0;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
  };

  const submit = async () => {
    if (!csv.trim()) return;
    setBusy(true);
    try {
      const n = await onImport(csv, fileName);
      toast.success(`${n} paris importés 🎉`);
      setOpen(false);
      setCsv("");
      setFileName(undefined);
    } catch (err: any) {
      toast.error(err.message ?? "Erreur à l'import");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-white/10 text-xs text-zinc-300 hover:bg-white/5">
          <FileUp className="h-3.5 w-3.5 text-sky-400" /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-[#0d1117] text-zinc-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Import CSV de paris</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-white/10 text-xs"
            onClick={() => fileRef.current?.click()}
          >
            <FileUp className="h-3.5 w-3.5" /> Choisir un fichier .csv
          </Button>
          <Textarea
            className="h-36 resize-none border-white/10 bg-white/5 font-mono text-xs text-zinc-200"
            placeholder={`Colle ton CSV ici…\n\nExemple :\n${SAMPLE}`}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>
              Colonnes : placedAt, sport, match, pick, stake, odds, status, payout, bookmaker…
            </span>
            {detected > 0 && (
              <span className="inline-flex items-center gap-1 font-mono text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> {detected} pari{detected > 1 ? "s" : ""} détecté{detected > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" className="text-zinc-400" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button size="sm" className="gap-1.5 bg-emerald-500 text-emerald-950 hover:bg-emerald-400" onClick={submit} disabled={busy || detected === 0}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
            Importer {detected > 0 ? `${detected}` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}