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
import { xlsxToBetCsv, type XlsxImportResult } from "@/lib/bet-manager/xlsx-import";

type Props = {
  onImport: (csv: string, fileName?: string) => Promise<number>;
};

const SAMPLE = `placedAt,sport,competition,match,market,pick,stake,odds,status,payout,bookmaker
2026-08-01T18:00:00,football,Ligue 1,"PSG vs OM",1X2,PSG,10,1.85,won,18.50,1xbet`;

// N.B. : /\.xlsm?$/ ne matcherait PAS .xlsx — étendre explicitement les 3 extensions Excel.
const XLSX_RE = /\.(xlsx|xlsm|xls)$/i;

export function CsvImport({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [excelInfo, setExcelInfo] = useState<XlsxImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const detected = csv.trim() ? parseBetsCSV(csv).length : 0;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      if (XLSX_RE.test(file.name)) {
        // Conversion Excel → CSV Bet (mapping synonymes + colonnes en note)
        const res = await xlsxToBetCsv(await file.arrayBuffer());
        setCsv(res.csv);
        setExcelInfo(res);
        const dropped = res.droppedRows > 0 ? ` · ${res.droppedRows} ligne(s) sans cote/mise ignorée(s)` : "";
        toast.success(`Excel lu : feuille « ${res.sheetName} », ${res.rowCount} ligne(s), ${res.headers.length} colonne(s)${dropped}`);
      } else {
        setCsv(await file.text());
        setExcelInfo(null);
      }
    } catch (err: any) {
      // Trace console : garde l'erreur visible même si le Toaster n'est pas monté.
      console.error("[xlsx-import]", err);
      toast.error("Lecture Excel impossible : " + (err.message ?? "erreur inconnue"));
      setCsv("");
      setExcelInfo(null);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
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
      setExcelInfo(null);
    } catch (err: any) {
      toast.error(err.message ?? "Erreur à l'import");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-white/10 text-xs text-[#7B3FA0] hover:bg-white/5">
          <FileUp className="h-3.5 w-3.5 text-sky-400" /> Import CSV / Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-white text-[#1A1145] sm:max-w-lg max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:mt-auto max-sm:w-full">
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-zinc-300 sm:hidden" />
        <DialogHeader>
          <DialogTitle className="text-base">Import CSV / Excel de paris</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={onFile}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => fileRef.current?.click()}
          >
            <FileUp className="h-3.5 w-3.5" /> Choisir un fichier .csv ou .xlsx
          </Button>
          <Textarea
            className="h-36 resize-none border-white/10 bg-white/5 font-mono text-xs text-zinc-200"
            placeholder={`Colle ton CSV ici…\n\nExemple :\n${SAMPLE}`}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <div className="flex items-center justify-between text-[11px] text-[#6B5B8D]">
            <span>
              {excelInfo
                ? `Excel « ${excelInfo.sheetName} » : ${excelInfo.headers.length} colonnes lues` +
                  (excelInfo.intoNote.length > 0 ? `, ${excelInfo.intoNote.length} en note (${excelInfo.intoNote.join(", ")})` : "")
                : "Colonnes : placedAt, sport, match, pick, stake, odds, status, payout, bookmaker…"}
            </span>
            {detected > 0 && (
              <span className="inline-flex items-center gap-1 font-mono text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> {detected} pari{detected > 1 ? "s" : ""} détecté{detected > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" className="text-[#6B5B8D]" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button size="sm" className="gap-1.5 bg-[#7B3FA0] text-white hover:bg-[#6B5B8D]" onClick={submit} disabled={busy || detected === 0}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
            Importer {detected > 0 ? `${detected}` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}