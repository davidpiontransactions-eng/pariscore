"use client";

import { useState, useCallback } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MmaFight } from "./mma-fight-card";

type AnalysisResult = {
  text?: string;
  provider?: string;
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
        dr_prob_a: "0",
        dr_prob_b: "0",
        ev_a: String(fight.ev_a_pct ?? 0),
        ev_b: String(fight.ev_b_pct ?? 0),
        best_odds_a: String(fight.best_odds_a ?? 0),
        best_odds_b: String(fight.best_odds_b ?? 0),
        bet_a: String(fight.bet_a ?? false),
        bet_b: String(fight.bet_b ?? false),
      });
      const res = await fetch(`/api/mma/analysis?${qs}`);
      const data = (await res.json()) as AnalysisResult;
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
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
          "bg-purple-100 text-purple-700 hover:bg-purple-200",
          "dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Analyse IA
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-[80vh] sm:max-h-[80dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="mb-1 text-lg font-bold text-foreground">
              {fight.fighter_a} vs {fight.fighter_b}
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Analyse IA powered by Gemini
            </p>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Analyse en cours...
                </span>
              </div>
            )}

            {result?.error && (
              <p className="py-8 text-center text-sm text-red-500">
                {result.error}
              </p>
            )}

            {result?.text && (
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {result.text}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
