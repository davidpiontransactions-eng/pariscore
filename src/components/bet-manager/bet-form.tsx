"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, ChevronsUpDown, Loader2, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { parseTicketText, type OcrTicket } from "@/lib/bet-manager/ocr";
import { ingest1xbet, type Import1xbetBet } from "@/lib/bet-manager/import-1xbet";
import { useTodayMatches } from "@/hooks/use-today-matches";

const SPORTS = ["football", "tennis", "basketball", "hockey", "handball", "mma", "rugby", "cs2", "cycling", "f1", "baseball", "other"];

type LegRow = { matchLabel: string; market: string; pick: string; odds: string };

type Props = {
  bankrollId: string | null;
  defaultBookmaker?: string;
  onAdd: (input: any) => Promise<void>;
};

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
  const [externalRef, setExternalRef] = useState<string | null>(null);
  const [placedAt, setPlacedAt] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Combobox matchs du jour (mission k044) : liste par défaut, bascule libre.
  const [matchMode, setMatchMode] = useState<"list" | "free">("list");
  const [comboOpen, setComboOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pasteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Matchs du jour du sport sélectionné (SWR : refetch auto au changement de sport)
  const todayMatches = useTodayMatches(sport);

  useEffect(() => () => { if (pasteTimer.current) clearTimeout(pasteTimer.current); }, []);

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
    setExternalRef(null); // scan image : pas de № parsé côté HTML
    setPlacedAt(null);
    if (t.legs.length > 1) {
      setBetType("combo");
      setLegs(t.legs.map((l) => ({ matchLabel: l.matchLabel, market: l.market ?? "", pick: l.pick ?? "", odds: String(l.odds ?? "") })));
    }
  }, []);

  /** Aperçu avant sauvegarde : le coupon importé remplit le formulaire éditable. */
  const applyImportBets = useCallback((bets: Import1xbetBet[]) => {
    if (bets.length === 0) {
      toast.error("Aucun pari reconnu dans ce contenu.");
      return;
    }
    if (bets.length > 1) {
      toast.info(`${bets.length} coupons détectés — aperçu du dernier. Sélectionne et importe un par un.`);
    }
    const b = bets[bets.length - 1];
    setBetType(b.betType);
    setMatchLabel(b.matchLabel);
    setMarket(b.market ?? "");
    setPick(b.pick ?? "");
    setOdds(b.odds > 1 ? String(b.odds) : "");
    setStake(b.stake > 0 ? String(b.stake) : "");
    setBookmaker(b.bookmaker);
    setCompetition(b.competition ?? "");
    setSport(SPORTS.includes(b.sport) ? b.sport : "other");
    if (b.legs.length > 1) {
      setLegs(b.legs.map((l) => ({ matchLabel: l.matchLabel, market: l.market ?? "", pick: l.pick ?? "", odds: String(l.odds) })));
    }
    setExternalRef(b.externalRef);
    setPlacedAt(b.placedAt);
    toast.success(`Ticket importé${b.externalRef ? ` — réf ${b.externalRef}` : ""} : vérifie les champs puis valide.`);
  }, []);

  /** Fichier déposé/sélectionné : image → OCR, HTML/ZIP/TXT → parseur 1xBet. */
  const ingestFile = useCallback(
    async (file: File) => {
      const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name);
      setOcrBusy(true);
      try {
        if (isImage) {
          const ticket = await ocrTicketImage(file);
          if (!ticket.matchLabel && !ticket.odds && !ticket.stake) {
            toast.error("Aucun pari reconnu dans l'image. Colle le texte du ticket ci-dessous.");
          } else {
            applyTicket(ticket);
          }
        } else {
          const buf = await file.arrayBuffer();
          const res = await ingest1xbet(buf);
          if (res.duplicates > 0) toast.warning(`${res.duplicates} ticket déjà importé — ignoré.`);
          applyImportBets(res.bets);
        }
      } catch (err: any) {
        toast.error("Import en échec : " + (err.message ?? "erreur inconnue"));
      } finally {
        setOcrBusy(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [applyImportBets, applyTicket]
  );

  /** Texte collé (coupon copié depuis l'historique 1xBet). */
  const ingestText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      try {
        const res = await ingest1xbet(text);
        if (res.duplicates > 0) toast.warning(`${res.duplicates} ticket déjà importé — ignoré.`);
        if (res.bets.length > 0) applyImportBets(res.bets);
        else toast.error("Aucun coupon reconnu dans le collage.");
      } catch (err: any) {
        toast.error("Lecture du collage en échec : " + (err.message ?? "erreur inconnue"));
      }
    },
    [applyImportBets]
  );

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await ingestFile(file);
    },
    [ingestFile]
  );

  /** Collage : hijack seulement hors champ éditable (debounce 300 ms, cf. suivi-paris). */
  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const editable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
      const file = e.clipboardData.files?.[0];
      if (file) {
        e.preventDefault();
        void ingestFile(file);
        return;
      }
      const html = e.clipboardData.getData("text/html");
      if (editable || !html) return; // texte brut en clair dans un champ = collage normal
      e.preventDefault();
      if (pasteTimer.current) clearTimeout(pasteTimer.current);
      pasteTimer.current = setTimeout(() => void ingestText(html), 300);
    },
    [ingestFile, ingestText]
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
        externalRef: externalRef || undefined,
        placedAt: placedAt || undefined,
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
      setExternalRef(null);
      setPlacedAt(null);
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
      <DialogContent
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) {
            void ingestFile(f);
            return;
          }
          const html = e.dataTransfer.getData("text/html");
          if (html) void ingestText(html);
        }}
        onPaste={onPaste}
        className={cn(
          "max-w-2xl max-h-[90vh] sm:max-h-[90dvh] overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:mt-auto max-sm:w-full",
          dragOver && "ring-2 ring-emerald-500/60"
        )}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-zinc-300 sm:hidden" />
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
              <Select value={betType} onValueChange={(v) => setBetType(v as BetType)}>
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
                <div className="flex items-center justify-between">
                  <Label className="mb-0">Match / Événement</Label>
                  <button
                    type="button"
                    aria-label={matchMode === "list" ? "saisie libre" : "liste du jour"}
                    onClick={() => setMatchMode((m) => (m === "list" ? "free" : "list"))}
                    className="text-[11px] text-primary underline-offset-2 hover:underline"
                  >
                    {matchMode === "list" ? "Saisie libre" : "Liste du jour"}
                  </button>
                </div>
                {matchMode === "list" ? (
                  <Popover open={comboOpen} onOpenChange={setComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-label="Sélectionner un match du jour"
                        className="mt-1 h-9 w-full justify-between px-3 font-normal"
                      >
                        <span
                          className={
                            "truncate " + (matchLabel ? "text-foreground" : "text-muted-foreground")
                          }
                        >
                          {matchLabel ||
                            (todayMatches.isLoading
                              ? "Chargement des matchs du jour…"
                              : "Choisir un match du jour…")}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-[--radix-popover-trigger-width] min-w-[320px] bg-background border-border p-0"
                    >
                      <Command>
                        <CommandInput placeholder="Rechercher une équipe, une ligue…" />
                        <CommandList>
                          {todayMatches.matches.length === 0 && !todayMatches.isLoading ? (
                            <CommandEmpty className="px-3 py-3 text-sm">
                              Aucun match de « {sport} » répertorié aujourd'hui.
                              <button
                                type="button"
                                aria-label="saisie libre"
                                onClick={() => setMatchMode("free")}
                                className="ml-1 text-primary underline underline-offset-2"
                              >
                                Passer en saisie libre
                              </button>
                            </CommandEmpty>
                          ) : (
                            <CommandGroup heading={`${sport} — matchs du jour`}>
                              {todayMatches.matches.map((m, i) => (
                                <CommandItem
                                  key={`${m.home}-${m.away}-${m.time}-${i}`}
                                  value={`${m.home} ${m.away} ${m.league} ${m.time}`}
                                  onSelect={() => {
                                    setMatchLabel(`${m.home} vs ${m.away}`);
                                    if (m.league) setCompetition(m.league);
                                    setComboOpen(false);
                                  }}
                                >
                                  <span className="truncate">
                                    {`[${m.league || m.sport}] ${m.time || "—"} — ${m.home} vs ${m.away}`}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Input
                    className="mt-1"
                    value={matchLabel}
                    onChange={(e) => setMatchLabel(e.target.value)}
                    placeholder="ex: PSG vs OM"
                  />
                )}
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

          <p className="text-[11px] leading-snug text-muted-foreground">
            Import 1xBet : glisse-dépose un fichier <strong>.html/.zip</strong> d'historique, colle un coupon
            copié, ou scanne une image — dédup par № de coupon.
          </p>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={ocrBusy}>
              <Camera className="h-4 w-4 mr-2" />
              {ocrBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scanner ou importer"}
            </Button>
            <input
              type="file"
              ref={fileRef}
              accept="image/*,.html,.htm,.zip,.txt"
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