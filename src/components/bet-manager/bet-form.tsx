"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
};

function cleanNumber(s: string): number | undefined {
  const n = parseFloat(s.replace(/[^\d.,]/g, "").replace(/\s/g, "").replace(",", "."));
  return isNaN(n) ? undefined : n;
}

function parseTicketText(raw: string): OcrTicket {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const oddsMatches = raw.match(/(?<![\d.])([1-9]\d{0,1}[.,]\d{2})(?![\d.])/g);
  const odds = oddsMatches?.length
    ? Math.max(...oddsMatches.map((x) => parseFloat(x.replace(",", "."))))
    : undefined;
  let stake: number | undefined;
  for (const l of lines) {
    const m = l.match(/([\d\s.,]+)\s*[€$£]/i);
    if (m) {
      const v = cleanNumber(m[1]);
      if (v !== undefined && v > 0) stake = v;
    }
  }
  const participants = lines
    .filter(
      (l) =>
        !/^(total|gain|cote|mise|solde|date|réf|coupon|montant)/i.test(l) &&
        !/[€$£]/.test(l) &&
        !/\d{2,}[.,]\d{2}/.test(l) &&
        l.length > 2
    )
    .slice(-2);
  return {
    rawText: raw,
    matchLabel: participants.length >= 2 ? participants.join(" vs ") : participants[0],
    pick: participants[participants.length - 1],
    odds,
    stake,
    bookmaker: "1xbet",
    legs: [],
    betType: "single",
  };
}

async function loadTesseractFromCDN(): Promise<any> {
  if (typeof window === "undefined") throw new Error("Pas de window");
  // @ts-ignore
  if (window.Tesseract) return window.Tesseract;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      resolve(window.Tesseract);
    };
    script.onerror = () => reject(new Error("Échec chargement tesseract.js depuis CDN"));
    document.head.appendChild(script);
  });
}

async function ocrTicketImage(image: Blob): Promise<OcrTicket> {
  if (typeof window === "undefined") throw new Error("OCR uniquement disponible côté client");
  const Tesseract = await loadTesseractFromCDN();
  const worker = await Tesseract.createWorker("fra", 1, { logger: () => {} });
  try {
    const { data } = await worker.recognize(image);
    return parseTicketText(data.text);
  } finally {
    await worker.terminate();
  }
}

export function BetForm({ bankrollId, defaultBookmaker, onAdd }: Props) {
  const [betType, setBetType] = useState<BetType>("single");
  const [sport, setSport] = useState(SPORTS[0]);
  const [competition, setCompetition] = useState("");
  const [matchLabel, setMatchLabel] = useState("");
  const [market, setMarket] = useState("");
  const [pick, setPick] = useState("");
  const [stake, setStake] = useState("");
  const [odds, setOdds] = useState("");
  const [bookmaker, setBookmaker] = useState(defaultBookmaker || "");
  const [tipster, setTipster] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [legs, setLegs] = useState<LegRow[]>([{ matchLabel: "", market: "", pick: "", odds: "" }]);
  const [ocrBusy, setOcrBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const effOdds = betType === "combo"
    ? legs.reduce((acc, l) => acc * (parseFloat(l.odds) || 1), 1)
    : parseFloat(odds) || 0;

  const applyTicket = useCallback((t: OcrTicket) => {
    if (t.matchLabel) setMatchLabel(t.matchLabel);
    if (t.market) setMarket(t.market);
    if (t.pick) setPick(t.pick);
    if (t.odds) setOdds(String(t.odds));
    if (t.stake) setStake(String(t.stake));
    if (t.bookmaker) setBookmaker(t.bookmaker);
    if (t.legs.length > 1) {
      setBetType("combo");
      setLegs(t.legs.map((l) => ({ matchLabel: l.matchLabel, market: l.market ?? "", pick: l.pick ?? "", odds: String(l.odds ?? "") })));
    }
  }, []);

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setOcrBusy(true);
      try {
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
        competition: competition || undefined,
        matchLabel: betType === "combo" ? legs[0]?.matchLabel : matchLabel || undefined,
        market: betType === "combo" ? undefined : market || undefined,
        pick: betType === "combo" ? undefined : pick || undefined,
        stake: stakeNum,
        odds: effOdds,
        bookmaker: bookmaker || undefined,
        tipster: tipster || undefined,
        category: category || undefined,
        tags: tags || undefined,
        note: note || undefined,
        legs: betType === "combo"
          ? legs.filter((l) => l.matchLabel && l.odds).map((l) => ({
              matchLabel: l.matchLabel,
              market: l.market || undefined,
              pick: l.pick || undefined,
              odds: parseFloat(l.odds),
            }))
          : undefined,
      });
      setStake("");
      setOdds("");
      setMatchLabel("");
      setMarket("");
      setPick("");
      setLegs([{ matchLabel: "", market: "", pick: "", odds: "" }]);
    } catch (err: any) {
      toast.error("Erreur : " + (err.message ?? "inconnue"));
    } finally {
      setSaving(false);
    }
  };

  const addLeg = () =>
    setLegs((prev) => [...prev, { matchLabel: "", market: "", pick: "", odds: "" }]);

  const removeLeg = (i: number) =>
    setLegs((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            {betType === "combo" ? "Pari combiné" : "Nouveau pari"}
            <span className="text-xs text-muted-foreground">
              {betType === "combo" ? `${legs.length} sélection(s)` : `Cote effective ~${effOdds?.toFixed(2) ?? "—"}`}
            </span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Type</Label>
              <Select value={betType} onValueChange={setBetType}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Simple</SelectItem>
                  <SelectItem value="combo">Combiné</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sport</Label>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger>
                  <SelectValue placeholder="Sport" />
                </SelectTrigger>
                <SelectContent>
                  {SPORTS.map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Compétition (optionnel)</Label>
              <Input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="ex: Ligue 1, ATP 500, NBA" />
            </div>
          </div>

          {betType === "single" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Match / Événement</Label>
                <Input value={matchLabel} onChange={(e) => setMatchLabel(e.target.value)} placeholder="ex: PSG vs OM" />
              </div>
              <div>
                <Label>Marché</Label>
                <Input value={market} onChange={(e) => setMarket(e.target.value)} placeholder="ex: 1X2, Over 2.5, BTTS" />
              </div>
              <div>
                <Label>Pronostic</Label>
                <Input value={pick} onChange={(e) => setPick(e.target.value)} placeholder="ex: PSG, Over, Oui" />
              </div>
              <div>
                <Label>Cote</Label>
                <Input type="number" step="0.01" min="1.01" value={odds} onChange={(e) => setOdds(e.target.value)} placeholder="1.85" />
              </div>
            </div>
          ) : (
            <div className="space-y-2 border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <Label className="mb-0">Sélections ({legs.length})</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLeg}><Plus className="h-3 w-3" /></Button>
              </div>
              {legs.map((leg, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] items-end">
                  <Input value={leg.matchLabel} onChange={(e) => setLeg(i, "matchLabel", e.target.value)} placeholder="Match" />
                  <Input value={leg.market} onChange={(e) => setLeg(i, "market", e.target.value)} placeholder="Marché" />
                  <Input value={leg.pick} onChange={(e) => setLeg(i, "pick", e.target.value)} placeholder="Pick" />
                  <Input type="number" step="0.01" min="1.01" value={leg.odds} onChange={(e) => setLeg(i, "odds", e.target.value)} placeholder="Cote" style={{ width: "80px" }} />
                  {legs.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLeg(i)}><X className="h-3 w-3" /></Button>
                  )}
                </div>
              ))}
              <div className="text-sm text-muted-foreground">
                Cote totale effective : <strong>{effOdds.toFixed(2)}</strong>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Bookmaker</Label>
              <Input value={bookmaker} onChange={(e) => setBookmaker(e.target.value)} placeholder="ex: 1xbet, Winamax, Betclic" />
            </div>
            <div>
              <Label>Mise (€)</Label>
              <Input type="number" step="0.01" min="0.01" value={stake} onChange={(e) => setStake(e.target.value)} placeholder="10" />
            </div>
            <div>
              <Label>Tipster (optionnel)</Label>
              <Input value={tipster} onChange={(e) => setTipster(e.target.value)} placeholder="ex: @paris_expert" />
            </div>
            <div>
              <Label>Catégorie (optionnel)</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ex: value, fun, system" />
            </div>
            <div className="sm:col-span-2">
              <Label>Tags (optionnel, séparés par des virgules)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ex: live, weekend, favori" />
            </div>
            <div className="sm:col-span-2">
              <Label>Note (optionnel)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Raison du pari, contexte..." />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={ocrBusy}>
              <Camera className="h-4 w-4 mr-2" />
              {ocrBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scanner un ticket"}
            </Button>
            <input
              type="file"
              ref={fileRef}
              accept="image/*"
              capture="environment"
              onChange={onFile}
              className="hidden"
            />
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}