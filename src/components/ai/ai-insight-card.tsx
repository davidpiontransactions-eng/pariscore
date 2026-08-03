"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { Star, Sparkles, TrendingUp, Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrematchMatches } from "@/hooks/use-prematch-matches";
import { useFootballMatches } from "@/hooks/use-football-matches";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Factor = {
  label: string;
  value: string;
};

export type AIInsightCardProps = {
  className?: string;
  id?: string;
};

type GeminiResponse = {
  analysis: string;
  factors: Factor[];
  edge: number;
  confidence: number;
  source: "cache" | "gemini";
  cachedAt?: string;
};

type MatchOption = {
  id: string;
  sport: "tennis" | "football";
  label: string;
  scheduledAt: string;
};

// ---------------------------------------------------------------------------
// Demo data (French) — fallback quand aucun match sélectionné
// ---------------------------------------------------------------------------

const DEMO: GeminiResponse = {
  analysis:
    "Sélectionnez un match dans la liste ci-dessous pour obtenir une analyse détaillée par Gemini AI. L'analyse couvre la value betting, les facteurs clés (H2H, surface/domicile, forme récente), et un niveau de confiance.",
  factors: [
    { label: "Comment ça marche", value: "Sélection → Analyse" },
    { label: "Cache intelligent", value: "12h (cross-utilisateur)" },
    { label: "Modèle", value: "Gemini 2.0 Flash" },
    { label: "Sports couverts", value: "Tennis + Football" },
  ],
  edge: 0,
  confidence: 3,
  source: "gemini",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderStars(rating: number, max = 5): React.ReactNode {
  return Array.from({ length: max }, (_, i) => (
    <Star
      key={i}
      className={cn(
        "h-3.5 w-3.5",
        i < Math.round(rating)
          ? "fill-amber-400 text-amber-400"
          : "fill-muted-foreground/20 text-muted-foreground/30"
      )}
    />
  ));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIInsightCard({ className, id }: AIInsightCardProps) {
  const { data: tennisData } = usePrematchMatches();
  const { data: footData } = useFootballMatches();

  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [insight, setInsight] = useState<GeminiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Build match options list
  const matchOptions = useMemo<MatchOption[]>(() => {
    const opts: MatchOption[] = [];
    for (const m of tennisData?.matches ?? []) {
      opts.push({ id: m.id, sport: "tennis",
        label: `🎾 ${m.playerA.shortName} vs ${m.playerB.shortName} (${m.tournament})`,
        scheduledAt: m.scheduledAt });
    }
    for (const m of footData?.matches ?? []) {
      opts.push({ id: m.id, sport: "football",
        label: `⚽ ${m.home.shortName} vs ${m.away.shortName} (${m.league.name})`,
        scheduledAt: m.scheduledAt });
    }
    return opts.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [tennisData?.matches, footData?.matches]);

  // Trigger Gemini
  const handleSelect = useCallback(async (matchId: string) => {
    if (!matchId) { setInsight(null); setError(null); return; }
    // Cancel previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSelectedMatchId(matchId); setLoading(true); setError(null);
    try {
      const option = matchOptions.find((o) => o.id === matchId);
      if (!option) throw new Error("Match introuvable");
      let matchData: Record<string, unknown> = { sport: option.sport, matchId: option.id };
      if (option.sport === "tennis") {
        const m = tennisData?.matches?.find((x) => x.id === matchId);
        if (m) matchData = { sport: "tennis", matchId: m.id,
          playerA: { name: m.playerA.name, elo: m.playerA.elo, sps: m.playerA.sps },
          playerB: { name: m.playerB.name, elo: m.playerB.elo, sps: m.playerB.sps },
          eloGap: m.stats.eloGap, surface: m.stats.surface, confidence: m.stats.confidence,
          tournament: m.tournament, probA: m.probA, probB: m.probB };
      } else {
        const m = footData?.matches?.find((x) => x.id === matchId);
        if (m) matchData = { sport: "football", matchId: m.id,
          home: { name: m.home.name, form: m.home.form, rank: m.home.rank },
          away: { name: m.away.name, form: m.away.form, rank: m.away.rank },
          prediction: m.prediction, league: m.league.name, round: m.round };
      }
      const res = await fetch("/api/ai/gemini-insight", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport: option.sport, matchId: option.id, matchData }),
        signal: controller.signal });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Erreur ${res.status}`); }
      setInsight(await res.json());
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message);
    }
    finally { setLoading(false); }
  }, [matchOptions, tennisData?.matches, footData?.matches]);

  const display = insight ?? DEMO;
  const hasEdge = display.edge > 0;
  const selectedOption = matchOptions.find((o) => o.id === selectedMatchId);

  return (
    <section id={id} className={cn("space-y-3", className)}>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">🤖 GEMINI AI INSIGHT</h3>
      <div className={cn("relative overflow-hidden rounded-2xl border border-purple-500/20 bg-card p-4")}>
        <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" />
        {/* Header + Selector */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-400 shrink-0"><Sparkles className="h-3 w-3" /> Gemini AI Insight</span>
          <select value={selectedMatchId} onChange={(e) => handleSelect(e.target.value)} className="w-full sm:w-auto rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/50">
            <option value="">— Sélectionner un match —</option>
            {matchOptions.map((opt) => <option key={`${opt.sport}-${opt.id}`} value={opt.id}>{opt.label}</option>)}
          </select>
        </div>
        {selectedOption && <h3 className="mb-2 text-sm font-semibold tracking-tight">{selectedOption.label}</h3>}
        {loading && <div className="flex items-center gap-2 py-4 text-sm text-purple-400"><Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours...</div>}
        {error && !loading && <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">{error}</div>}
        {!loading && !error && <>
          <p className="text-sm leading-relaxed text-muted-foreground">{display.analysis}</p>
          {display.source && <span className="mt-1 inline-block text-[10px] text-muted-foreground/50">Source: {display.source}{display.cachedAt && ` · Cache: ${new Date(display.cachedAt).toLocaleTimeString("fr-FR")}`}</span>}
        </>}
        {!loading && !error && <div className="mt-3 grid grid-cols-2 gap-2">
          {display.factors.map((factor) => <div key={factor.label} className="flex flex-col rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5"><span className="text-[11px] leading-tight text-muted-foreground">{factor.label}</span><span className="text-sm font-semibold text-emerald-400">{factor.value}</span></div>)}
        </div>}
        {!loading && !error && <div className="mt-3 flex items-center justify-between border-t border-purple-500/10 pt-3">
          <div className="flex items-center gap-1.5">
            {hasEdge ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400"><TrendingUp className="h-3 w-3" /> Value détectée</span>
              : <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"><Zap className="h-3 w-3" />{insight ? "Aucune value" : "En attente"}</span>}
            <span className={cn("text-xs font-mono font-semibold", hasEdge ? "text-emerald-400" : "text-muted-foreground")}>{hasEdge ? "+" : ""}{display.edge}% edge</span>
          </div>
          <div className="flex items-center gap-1"><span className="mr-0.5 text-[11px] text-muted-foreground">Confiance</span><div className="flex items-center gap-0.5" aria-label={`${display.confidence}/5 confidence`}>{renderStars(display.confidence)}</div></div>
        </div>}
      </div>
    </section>
  );
}
