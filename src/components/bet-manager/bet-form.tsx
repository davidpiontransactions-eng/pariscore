"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Plus, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { BetType } from "@/lib/bet-manager/types";
import type { OcrTicket } from "@/lib/bet-manager/ocr";

const SPORTS = ["football", "tennis", "basketball", "mma", "rugby", "cs2", "nba", "wnba", "cycling", "f1", "baseball", "other"];

type LegRow = { matchLabel: string; market: string; pick: string; odds: string };

type Props = {
  bankrollId: string | null;
  defaultBookmaker?: string;
  onAdd: (input: any) => Promise<void>;
  onClose: () => void;
};

export function BetForm({ bankrollId, defaultBookmaker = "1xbet", onAdd, onClose }: Props) {
  const [sport, setSport] = useState("football");
  const [betType, setBetType] = useState<BetType>("single");
  const [bookmaker, setBookmaker] = useState(defaultBookmaker);
  const [matchLabel, setMatchLabel] = useState("");
  const [market, setMarket] = useState("");
  const [pick, setPick] = useState("");
  const [stake, setStake] = useState("");
  const [odds, setOdds] = useState("");
  const [placedAt, setPlacedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [tipster, setTipster] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [legs, setLegs] = useState<LegRow[]>([{ matchLabel: "", market: "", pick: "", odds: "" }]);
  const [saving, setSaving] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const comboOdds = legs.reduce((acc, l) => acc * (parseFloat(l.odds) || 1), 1);
  const effOdds = betType === "combo" ? comboOdds : parseFloat(odds) || 0;

  const applyTicket = useCallback((t: OcrTicket) => {
    if (t.matchLabel) setMatchLabel(t.matchLabel);
    if (t.pick) setPick(t.pick);
    if (t.market) setMarket(t.market);
    if (t.odds) setOdds(String(t.odds));
    if (t.stake) setStake(String(t.stake));
    if (t.bookmaker) setBookmaker(t.bookmaker);
    if (t.legs.length > 1) {
      setBetType("combo");
      setLegs(
        t.legs.map((l) => ({
          matchLabel: l.matchLabel ?? "",
          market: l.market ?? "",
          pick: l.pick ?? "",
          odds: l.odds !== undefined ? String(l.odds) : "",
        }))
      );
      toast.success(`${t.legs.length} sélections reconnues (combiné) — vérifie les valeurs`);
    } else if (t.legs.length === 1 && t.legs[0].matchLabel) {
      setMatchLabel(t.legs[0].matchLabel);
      setPick(t.legs[0].pick ?? "");
      if (t.legs[0].market) setMarket(t.legs[0].market);
      toast.success("Ticket reconnu — vérifie les valeurs ci-dessous");
    } else {
      toast.success("Ticket reconnu — vérifie les valeurs ci-dessous");
    }
  }, []);

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setOcrBusy(true);
      try {
        // Import dynamique : tesseract.js (~2 Mo) ne charge qu'au premier scan
        const { ocrTicketImage } = await import("@/lib/bet-manager/ocr");
        const ticket = await ocrTicketImage(file);
        if (!ticket.matchLabel && !ticket.odds && !ticket.stake) {
          toast.error("Aucun pari reconnu dans l'image. Colle le texte du ticket ci-dessous.");
        }
        applyTicket(ticket);
      } catch (err: any) {
        toast.error("OCR en échec : " + (err.message ?? "erreur inconnue"));
      } finally {
        setOcrBusy(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [applyTicket]
  );

  const setLeg = (i: number, key: keyof LegRow, value: string) =>
    setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)));

  const submit = async () => {
    if (!bankrollId) {
      toast.error("Sélectionne une bankroll d'abord.");
      return;
    }
    const stakeNum = parseFloat(stake);
    if (!stakeNum || stakeNum <= 0) {
      toast.error("Mise invalide");
      return;
    }
    if (effOdds <= 1) {
      toast.error("Cote invalide (doit être > 1)");
      return;
    }
    setSaving(true);
    try {
      await onAdd({
        bankrollId,
        betType,
        sport,
        competition: undefined,
        matchLabel: matchLabel || undefined,
        market: market || undefined,
        pick: pick || undefined,
        stake: stakeNum,
        odds: effOdds,
        bookmaker: bookmaker || undefined,
        tipster: tipster || undefined,
        category: category || undefined,
        tags: tags || undefined,
        note: note || undefined,
        placedAt: new Date(placedAt).toISOString(),
        legs:
          betType === "combo"
            ? legs
                .filter((l) => l.matchLabel.trim())
                .map((l) => ({
                  matchLabel: l.matchLabel,
                  market: l.market || undefined,
                  pick: l.pick || undefined,
                  odds: parseFloat(l.odds) || 1,
                }))
            : undefined,
      });
      toast.success("Pari ajouté ✅");
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Erreur à l'ajout du pari");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-white/10 bg-[#0d1117] text-zinc-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Ajouter un pari
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <Button
              variant="outline"
              size="sm"
              className="ml-auto gap-1.5 border-white/10 text-xs text-zinc-300"
              onClick={() => fileRef.current?.click()}
              disabled={ocrBusy}
            >
              {ocrBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5 text-emerald-400" />}
              {ocrBusy ? "Lecture…" : "Scanner un ticket"}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-zinc-400">Sport</Label>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger className="h-9 border-white/10 bg-white/5 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#101420] text-zinc-100">
                  {SPORTS.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-zinc-400">Type</Label>
              <Select value={betType} onValueChange={(v) => setBetType(v as BetType)}>
                <SelectTrigger className="h-9 border-white/10 bg-white/5 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#101420] text-zinc-100">
                  <SelectItem value="single">Simple</SelectItem>
                  <SelectItem value="combo">Combiné</SelectItem>
                  <SelectItem value="system">Système</SelectItem>
                  <SelectItem value="back">Back</SelectItem>
                  <SelectItem value="lay">Lay</SelectItem>
                  <SelectItem value="dutch">Dutching</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-zinc-400">Match / Ticket</Label>
              <Input
                className="h-9 border-white/10 bg-white/5 text-xs text-zinc-100"
                placeholder="PSG vs OM"
                value={matchLabel}
                onChange={(e) => setMatchLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-zinc-400">Bookmaker</Label>
              <Input
                className="h-9 border-white/10 bg-white/5 text-xs text-zinc-100"
                placeholder="1xbet"
                value={bookmaker}
                onChange={(e) => setBookmaker(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-zinc-400">Marché</Label>
              <Input
                className="h-9 border-white/10 bg-white/5 text-xs text-zinc-100"
                placeholder="1X2"
                value={market}
                onChange={(e) => setMarket(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-zinc-400">Sélection</Label>
              <Input
                className="h-9 border-white/10 bg-white/5 text-xs text-zinc-100"
                placeholder="PSG"
                value={pick}
                onChange={(e) => setPick(e.target.value)}
              />
            </div>
          </div>

          {betType === "combo" ? (
            <div className="space-y-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-zinc-400">Legs du combiné</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-xs text-emerald-400"
                  onClick={() => setLegs((p) => [...p, { matchLabel: "", market: "", pick: "", odds: "" }])}
                >
                  <Plus className="h-3 w-3" /> Leg
                </Button>
              </div>
              {legs.map((leg, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_64px_24px] items-center gap-1.5">
                  <Input
                    className="h-8 border-white/10 bg-white/5 text-xs text-zinc-100"
                    placeholder="Match"
                    value={leg.matchLabel}
                    onChange={(e) => setLeg(i, "matchLabel", e.target.value)}
                  />
                  <Input
                    className="h-8 border-white/10 bg-white/5 text-xs text-zinc-100"
                    placeholder="Sélection"
                    value={leg.pick}
                    onChange={(e) => setLeg(i, "pick", e.target.value)}
                  />
                  <Input
                    className="h-8 border-white/10 bg-white/5 text-xs text-zinc-100"
                    placeholder="1.85"
                    value={leg.odds}
                    onChange={(e) => setLeg(i, "odds", e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-6 text-zinc-500 hover:bg-white/10"
                    onClick={() => setLegs((p) => p.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-zinc-400">Mise (€)</Label>
              <Input
                className="h-9 border-white/10 bg-white/5 font-mono text-xs text-zinc-100"
                placeholder="10"
                inputMode="decimal"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-zinc-400">Cote</Label>
              <Input
                className={cn(
                  "h-9 border-white/10 bg-white/5 font-mono text-xs",
                  betType === "combo" ? "text-emerald-400" : "text-zinc-100"
                )}
                placeholder="1.85"
                inputMode="decimal"
                value={betType === "combo" ? (comboOdds > 0 ? comboOdds.toFixed(2) : "") : odds}
                onChange={(e) => setOdds(e.target.value)}
                readOnly={betType === "combo"}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-zinc-400">Date de placement</Label>
            <Input
              type="datetime-local"
              className="h-9 border-white/10 bg-white/5 text-xs text-zinc-100 [color-scheme:dark]"
              value={placedAt}
              onChange={(e) => setPlacedAt(e.target.value)}
            />
          </div>

          <details className="group">
            <summary className="cursor-pointer select-none text-[11px] font-medium text-zinc-500 hover:text-zinc-300">
              Options avancées (tipster, catégorie, tags, note)
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-zinc-400">Tipster</Label>
                <Input className="h-8 border-white/10 bg-white/5 text-xs" value={tipster} onChange={(e) => setTipster(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-zinc-400">Catégorie</Label>
                <Input className="h-8 border-white/10 bg-white/5 text-xs" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-zinc-400">Tags (CSV)</Label>
                <Input className="h-8 border-white/10 bg-white/5 text-xs" placeholder="montante,closing" value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-zinc-400">Note</Label>
                <Input className="h-8 border-white/10 bg-white/5 text-xs" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
          </details>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="text-zinc-400">
              Annuler
            </Button>
          </DialogClose>
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
            onClick={submit}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Ajouter le pari
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}