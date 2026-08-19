"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { Star, Sparkles, TrendingUp, Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/components/dashboard/dashboard-data-provider";

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
  const { tennisData } = useDashboardData();
  const { footData } = useDashboardData();

  // Single match mode
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  // Compare mode — jusqu'à 2 matchs sélectionnés
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [insight, setInsight] = useState<GeminiResponse | null>(null);
  const [insightB, setInsightB] = useState<GeminiResponse | null>(null);
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

  // Compare 2 matchs
  const toggleCompare = useCallback((matchId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(matchId)) return prev.filter((id) => id !== matchId);
      if (prev.length >= 2) return [prev[1], matchId];
      return [...prev, matchId];
    });
  }, []);

  const handleCompare = useCallback(async () => {
    if (compareIds.length !== 2) return;
    setCompareMode(true);
    setLoading(true); setError(null);
    setInsight(null); setInsightB(null);
    const [idA, idB] = compareIds;
    const optA = matchOptions.find((o) => o.id === idA);
    const optB = matchOptions.find((o) => o.id === idB);
    if (!optA || !optB) { setError("Match introuvable"); setLoading(false); return; }
    try {
      // Fetch les deux analyses en parallèle
      const buildData = (option: MatchOption) => {
        if (option.sport === "tennis") {
          const m = tennisData?.matches?.find((x) => x.id === option.id);
          return m ? { sport: "tennis", matchId: m.id,
            playerA: { name: m.playerA.name, elo: m.playerA.elo, sps: m.playerA.sps },
            playerB: { name: m.playerB.name, elo: m.playerB.elo, sps: m.playerB.sps },
            eloGap: m.stats.eloGap, surface: m.stats.surface, tournament: m.tournament } : {};
        }
        const m = footData?.matches?.find((x) => x.id === option.id);
        return m ? { sport: "football", matchId: m.id,
          home: { name: m.home.name, form: m.home.form },
          away: { name: m.away.name, form: m.away.form },
          prediction: m.prediction, league: m.league.name } : {};
      };
      const [resA, resB] = await Promise.all([
        fetch("/api/ai/gemini-insight", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sport: optA.sport, matchId: optA.id, matchData: buildData(optA) }) }),
        fetch("/api/ai/gemini-insight", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sport: optB.sport, matchId: optB.id, matchData: buildData(optB) }) }),
      ]);
      if (!resA.ok) throw new Error(`Match A: ${resA.status}`);
      if (!resB.ok) throw new Error(`Match B: ${resB.status}`);
      setInsight(await resA.json());
      setInsightB(await resB.json());
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, [compareIds, matchOptions, tennisData?.matches, footData?.matches]);

  const display = insight ?? DEMO;
  const hasEdge = display.edge > 0;
  const selectedOption = matchOptions.find((o) => o.id === selectedMatchId);
  const optA = matchOptions.find((o) => o.id === compareIds[0]);
  const optB = matchOptions.find((o) => o.id === compareIds[1]);

  const exitCompare = () => { setCompareMode(false); setInsight(null); setInsightB(null); setCompareIds([]); };

  return (
    <section id={id} className={cn("scroll-mt-20 space-y-3", className)}>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">🤖 GEMINI AI INSIGHT</h3>
      <div className={cn("relative overflow-hidden rounded-2xl border border-purple-500/20 bg-card p-4")}>
        <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" />

        {/* Compare mode: side-by-side */}
        {compareMode && insight && insightB ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-400">🔬 Comparaison</span>
              <button onClick={exitCompare} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">✕ Quitter</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                <p className="text-[11px] font-semibold truncate">{optA?.label}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{insight.analysis}</p>
                <div className="flex items-center justify-between pt-1 border-t border-border/30">
                  <span className={cn("text-[11px] font-mono font-bold", insight.edge > 0 ? "text-emerald-400" : "text-muted-foreground")}>{insight.edge > 0 ? "+" : ""}{insight.edge}% edge</span>
                  <div className="flex items-center gap-0.5">{renderStars(insight.confidence)}</div>
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                <p className="text-[11px] font-semibold truncate">{optB?.label}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{insightB.analysis}</p>
                <div className="flex items-center justify-between pt-1 border-t border-border/30">
                  <span className={cn("text-[11px] font-mono font-bold", insightB.edge > 0 ? "text-emerald-400" : "text-muted-foreground")}>{insightB.edge > 0 ? "+" : ""}{insightB.edge}% edge</span>
                  <div className="flex items-center gap-0.5">{renderStars(insightB.confidence)}</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {insight.factors.map((f, i) => (
                <div key={f.label} className="flex justify-between rounded bg-muted/30 px-2 py-1 text-[11px]">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-semibold text-emerald-400">{f.value}</span>
                  {insightB.factors[i] && <span className="font-semibold text-blue-400 ml-2">{insightB.factors[i].value}</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Header + Selector */}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-400 shrink-0"><Sparkles className="h-3 w-3" /> Gemini AI Insight</span>
              <select value={selectedMatchId} onChange={(e) => handleSelect(e.target.value)} className="w-full sm:w-auto rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/50">
                <option value="">— Sélectionner un match —</option>
                {matchOptions.map((opt) => <option key={`${opt.sport}-${opt.id}`} value={opt.id}>{opt.label}</option>)}
              </select>
            </div>

            {/* Checkboxes compare */}
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground mr-1">Comparer (2 max):</span>
              {matchOptions.slice(0, 8).map((opt) => (
                <label key={`chk-${opt.sport}-${opt.id}`} className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] cursor-pointer transition-colors",
                  compareIds.includes(opt.id)
                    ? "border-purple-500/50 bg-purple-500/10 text-purple-400"
                    : "border-border/40 bg-muted/30 text-muted-foreground hover:border-purple-500/30",
                )}>
                  <input type="checkbox" checked={compareIds.includes(opt.id)} onChange={() => toggleCompare(opt.id)} className="sr-only" />
                  {opt.sport === "tennis" ? "🎾" : "⚽"} {opt.label.split("(")[0].trim().slice(0, 20)}
                </label>
              ))}
            </div>

            {compareIds.length === 2 && (
              <button onClick={handleCompare} disabled={loading}
                className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-purple-500/20 px-3 py-1.5 text-xs font-semibold text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 transition-colors">
                <Zap className="h-3 w-3" /> Comparer les 2 matchs
              </button>
            )}
        {selectedOption && <h3 className="mb-2 text-sm font-semibold tracking-tight">{selectedOption.label}</h3>}
        {loading && <div className="flex items-center gap-2 py-4 text-sm text-purple-400"><Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours...</div>}
        {error && !loading && <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">{error}</div>}
        {!loading && !error && <>
          <p className="text-sm leading-relaxed text-muted-foreground">{display.analysis}</p>
          {display.source && <span className="mt-1 inline-block text-[11px] text-muted-foreground/50">Source: {display.source}{display.cachedAt && ` · Cache: ${new Date(display.cachedAt).toLocaleTimeString("fr-FR")}`}</span>}
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
          </>
        )}
      </div>
    </section>
  );
}
