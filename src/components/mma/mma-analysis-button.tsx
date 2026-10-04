"use client";

import { useState, useCallback } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MmaFight } from "./mma-fight-card";

type AnalysisResult = {
  text?: string;
  provider?: string;
  model?: string;
  error?: string;
};

type Props = {
  fight: MmaFight;
};

export function MmaAnalysisButton({ fight }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const fetchAnalysis = useCallback(async () => {
    if (result?.text) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setOpen(true);
    try {
      const qs = new URLSearchParams({
        fa: fight.fighter_a,
        fb: fight.fighter_b,
        prob_a: String(fight.prob_a ?? 0),
        prob_b: String(fight.prob_b ?? 0),
        // DRatings est fourni par l'API mais etait envoye en dur a 0 : le prompt
        // analysait donc un combat dont le signal DRatings valait zero.
        dr_prob_a: String(fight.dr_prob_a ?? 0),
        dr_prob_b: String(fight.dr_prob_b ?? 0),
        ev_a: String(fight.ev_a_pct ?? 0),
        ev_b: String(fight.ev_b_pct ?? 0),
        best_odds_a: String(fight.best_odds_a ?? 0),
        best_odds_b: String(fight.best_odds_b ?? 0),
        bet_a: String(fight.bet_a ?? false),
        bet_b: String(fight.bet_b ?? false),
      });
      const res = await fetch(`/api/mma/analysis?${qs}`);
      const data = (await res.json()) as AnalysisResult;
      // Sans ce test, un corps { error } est traite comme un succes : c'est
      // exactement ce qui affichait « Gemini 404 » dans la modale au lieu
      // d'indiquer une panne.
      if (!res.ok) {
        setResult({ error: data.error || `Analyse indisponible (${res.status})` });
        return;
      }
      if (!data.text) {
        setResult({ error: "Analyse vide" });
        return;
      }
      setResult(data);
    } catch {
      setResult({ error: "Analyse indisponible" });
    } finally {
      setLoading(false);
    }
  }, [fight, result]);

  return (
    <>
      <button
        onClick={fetchAnalysis}
        className={cn(
          // min-h-11 : la cible tactile faisait ~28px, sous le seuil 44px du
          // projet (flashscore-match-list.tsx:228).
          "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all",
          "bg-purple-100 text-purple-700 hover:bg-purple-200",
          "dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Analyse IA
      </button>

      {/* Radix Dialog : role="dialog", aria-modal, fermeture Escape, piege de
          focus et blocage du scroll — la modale maison n'en avait aucun. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:mt-auto max-sm:w-full">
          <DialogHeader>
            <DialogTitle>
              {fight.fighter_a} vs {fight.fighter_b}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12" aria-busy="true">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                Analyse en cours...
              </span>
            </div>
          ) : (
            <>
              <p className="mb-4 text-xs text-muted-foreground">
                Analyse IA{result?.model ? ` · ${result.model}` : ""}
              </p>

              {result?.error && (
                <p role="alert" className="py-8 text-center text-sm text-red-500">
                  {result.error}
                </p>
              )}

              {result?.text && (
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                  {result.text}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
