"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { Star, Sparkles, TrendingUp, Zap, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/components/dashboard/dashboard-data-provider";
import { useHockeyMatches } from "@/hooks/use-hockey-matches";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Factor = { label: string; value: string };

export type AIInsightCardProps = { className?: string; id?: string; activeSport?: string };

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
  sport: string;
  label: string;
  shortLabel: string;
  scheduledAt: string;
  icon: string;
};

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const DEMO: GeminiResponse = {
  analysis:
    "Sélectionnez un match dans la liste ci-dessus pour obtenir une analyse détaillée par Gemini AI. L'analyse couvre la value betting, les facteurs clés (H2H, forme récente, ranking), et un niveau de confiance.",
  factors: [
    { label: "Comment ça marche", value: "Sélection → Analyse" },
    { label: "Cache intelligent", value: "12h (cross-utilisateur)" },
    { label: "Modèle", value: "Gemini 2.0 Flash" },
    { label: "Filtrage", value: "Par sport actif" },
  ],
  edge: 0,
  confidence: 3,
  source: "gemini",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SPORT_ICONS: Record<string, string> = {
  tennis: "🎾", football: "⚽", basketball: "🏀", cs2: "🔫", darts: "🎯", hockey: "🏒",
};

function renderStars(rating: number, max = 5): React.ReactNode {
  return Array.from({ length: max }, (_, i) => (
    <Star
      key={i}
      className={cn(
        "h-3.5 w-3.5",
        i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-muted-foreground/20 text-muted-foreground/30",
      )}
    />
  ));
}

/** Dropdown select style FotMob. */
function MatchSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: MatchOption[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full appearance-none rounded-lg border border-border/60 bg-muted/40 px-3 py-2 pr-8 text-base sm:text-xs text-foreground",
          "focus:outline-none focus:ring-1 focus:ring-purple-500/50",
          "disabled:opacity-50",
          !value && "text-muted-foreground",
        )}
      >
        <option value="">{placeholder ?? "— Sélectionner un match —"}</option>
        {options.map((opt) => (
          <option key={`${opt.sport}-${opt.id}`} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIInsightCard({ className, id, activeSport }: AIInsightCardProps) {
  const { tennisData } = useDashboardData();
  const { footData } = useDashboardData();
  const { data: hockeyData } = useHockeyMatches();

  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [insight, setInsight] = useState<GeminiResponse | null>(null);
  const [insightB, setInsightB] = useState<GeminiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reset on sport change
  const prevSportRef = useRef(activeSport);
  if (prevSportRef.current !== activeSport) {
    prevSportRef.current = activeSport;
    setSelectedMatchId("");
    setCompareA("");
    setCompareB("");
    setInsight(null);
    setInsightB(null);
    setCompareMode(false);
    setError(null);
  }

  // Build match options — all sports
  const matchOptions = useMemo<MatchOption[]>(() => {
    const opts: MatchOption[] = [];
    for (const m of tennisData?.matches ?? []) {
      if (!activeSport || activeSport === "tennis") {
        opts.push({
          id: m.id, sport: "tennis",
          label: `🎾 ${m.playerA.shortName} vs ${m.playerB.shortName} (${m.tournament})`,
          shortLabel: `${m.playerA.shortName} vs ${m.playerB.shortName}`,
          scheduledAt: m.scheduledAt, icon: "🎾",
        });
      }
    }
    for (const m of footData?.matches ?? []) {
      if (!activeSport || activeSport === "football") {
        opts.push({
          id: m.id, sport: "football",
          label: `⚽ ${m.home.shortName} vs ${m.away.shortName} (${m.league.name})`,
          shortLabel: `${m.home.shortName} vs ${m.away.shortName}`,
          scheduledAt: m.scheduledAt, icon: "⚽",
        });
      }
    }
    for (const m of hockeyData?.matches ?? []) {
      if (!activeSport || activeSport === "hockey") {
        opts.push({
          id: m.id, sport: "hockey",
          label: `🏒 ${m.homeName} vs ${m.awayName} (${m.leagueName})`,
          shortLabel: `${m.homeName} vs ${m.awayName}`,
          scheduledAt: m.scheduledAt || "", icon: "🏒",
        });
      }
    }
    return opts.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [tennisData?.matches, footData?.matches, hockeyData?.matches, activeSport]);

  // Build matchData payload for API
  const buildMatchData = useCallback((option: MatchOption): Record<string, unknown> => {
    if (option.sport === "tennis") {
      const m = tennisData?.matches?.find((x) => x.id === option.id);
      if (!m) return {};
      return {
        sport: "tennis", matchId: m.id,
        playerA: { name: m.playerA.name, elo: m.playerA.elo, sps: m.playerA.sps },
        playerB: { name: m.playerB.name, elo: m.playerB.elo, sps: m.playerB.sps },
        eloGap: m.stats.eloGap, surface: m.stats.surface, confidence: m.stats.confidence,
        tournament: m.tournament, probA: m.probA, probB: m.probB,
      };
    }
    if (option.sport === "hockey") {
      const m = hockeyData?.matches?.find((x) => x.id === option.id);
      if (!m) return {};
      return {
        sport: "hockey", matchId: m.id,
        home: { name: m.homeName },
        away: { name: m.awayName },
        league: m.leagueName, country: m.countryName,
        odds: { home: m.oddsH, draw: m.oddsD, away: m.oddsA },
        source: m.source,
      };
    }
    const m = footData?.matches?.find((x) => x.id === option.id);
    if (!m) return {};
    return {
      sport: "football", matchId: m.id,
      home: { name: m.home.name, form: m.home.form, rank: m.home.rank },
      away: { name: m.away.name, form: m.away.form, rank: m.away.rank },
      prediction: m.prediction, league: m.league.name, round: m.round,
    };
  }, [tennisData?.matches, footData?.matches, hockeyData?.matches]);

  // Single match analysis
  const handleSelect = useCallback(async (matchId: string) => {
    if (!matchId) { setInsight(null); setError(null); setSelectedMatchId(""); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSelectedMatchId(matchId);
    setLoading(true);
    setError(null);
    try {
      const option = matchOptions.find((o) => o.id === matchId);
      if (!option) throw new Error("Match introuvable");
      const res = await fetch("/api/ai/gemini-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport: option.sport, matchId: option.id, matchData: buildMatchData(option) }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `Erreur ${res.status}`);
      }
      setInsight(await res.json());
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [matchOptions, buildMatchData]);

  // Compare: fire 2 parallel analyses
  const handleCompare = useCallback(async () => {
    if (!compareA || !compareB) return;
    setCompareMode(true);
    setLoading(true);
    setError(null);
    setInsight(null);
    setInsightB(null);
    const optA = matchOptions.find((o) => o.id === compareA);
    const optB = matchOptions.find((o) => o.id === compareB);
    if (!optA || !optB) { setError("Match introuvable"); setLoading(false); return; }
    try {
      const [resA, resB] = await Promise.all([
        fetch("/api/ai/gemini-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sport: optA.sport, matchId: optA.id, matchData: buildMatchData(optA) }),
        }),
        fetch("/api/ai/gemini-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sport: optB.sport, matchId: optB.id, matchData: buildMatchData(optB) }),
        }),
      ]);
      if (!resA.ok) throw new Error(`Match A: ${resA.status}`);
      if (!resB.ok) throw new Error(`Match B: ${resB.status}`);
      setInsight(await resA.json());
      setInsightB(await resB.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [compareA, compareB, matchOptions, buildMatchData]);

  const exitCompare = () => {
    setCompareMode(false);
    setInsight(null);
    setInsightB(null);
    setCompareA("");
    setCompareB("");
  };

  const display = insight ?? DEMO;
  const hasEdge = display.edge > 0;
  const selectedOption = matchOptions.find((o) => o.id === selectedMatchId);
  const canCompare = compareA && compareB && compareA !== compareB;

  return (
    <section id={id} className={cn("scroll-mt-20 space-y-3", className)}>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">🤖 GEMINI AI INSIGHT</h3>
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-card p-4">
        <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" />

        {/* ── Compare mode: side-by-side ── */}
        {compareMode && insight && insightB ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-400">
                🔬 Comparaison
              </span>
              <button onClick={exitCompare} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">✕ Quitter</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[insight, insightB].map((ins, idx) => {
                const opt = idx === 0 ? matchOptions.find((o) => o.id === compareA) : matchOptions.find((o) => o.id === compareB);
                return (
                  <div key={idx} className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                    <p className="text-[11px] font-semibold truncate">{opt?.label}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{ins.analysis}</p>
                    <div className="flex items-center justify-between pt-1 border-t border-border/30">
                      <span className={cn("text-[11px] font-mono font-bold", ins.edge > 0 ? "text-emerald-400" : "text-muted-foreground")}>
                        {ins.edge > 0 ? "+" : ""}{ins.edge}% edge
                      </span>
                      <div className="flex items-center gap-0.5">{renderStars(ins.confidence)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Factors side by side */}
            <div className="space-y-1">
              {insight.factors.map((f, i) => (
                <div key={f.label} className="flex items-center justify-between rounded bg-muted/30 px-2 py-1 text-[11px]">
                  <span className="text-muted-foreground shrink-0">{f.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-emerald-400">{f.value}</span>
                    {insightB.factors[i] && <span className="font-semibold text-blue-400">{insightB.factors[i].value}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── Header: badge + single select ── */}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-400 shrink-0">
                <Sparkles className="h-3 w-3" /> Gemini AI Insight
              </span>
              <div className="w-full sm:w-72">
                <MatchSelect value={selectedMatchId} onChange={handleSelect} options={matchOptions} disabled={loading} />
              </div>
            </div>

            {/* ── Compare: 2 dropdowns + button ── */}
            <div className="mb-3 rounded-lg border border-border/40 bg-muted/20 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">Comparer</span>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <MatchSelect value={compareA} onChange={setCompareA} options={matchOptions} placeholder="Match A" disabled={loading} />
                  <MatchSelect value={compareB} onChange={setCompareB} options={matchOptions} placeholder="Match B" disabled={loading} />
                </div>
              </div>
              {canCompare && (
                <button
                  onClick={handleCompare}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/20 px-3 py-1.5 text-xs font-semibold text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 transition-colors"
                >
                  <Zap className="h-3 w-3" /> Comparer les 2 matchs
                </button>
              )}
            </div>

            {/* ── Analysis result ── */}
            {selectedOption && (
              <h3 className="mb-2 text-sm font-semibold tracking-tight">{selectedOption.label}</h3>
            )}
            {loading && (
              <div className="flex items-center gap-2 py-4 text-sm text-purple-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours…
              </div>
            )}
            {error && !loading && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">{error}</div>
            )}
            {!loading && !error && (
              <>
                <p className="text-sm leading-relaxed text-muted-foreground">{display.analysis}</p>
                {display.source && (
                  <span className="mt-1 inline-block text-[11px] text-muted-foreground/50">
                    Source: {display.source}{display.cachedAt && ` · Cache: ${new Date(display.cachedAt).toLocaleTimeString("fr-FR")}`}
                  </span>
                )}
              </>
            )}
            {!loading && !error && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {display.factors.map((factor) => (
                  <div key={factor.label} className="flex flex-col rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5">
                    <span className="text-[11px] leading-tight text-muted-foreground">{factor.label}</span>
                    <span className="text-sm font-semibold text-emerald-400">{factor.value}</span>
                  </div>
                ))}
              </div>
            )}
            {!loading && !error && (
              <div className="mt-3 flex items-center justify-between border-t border-purple-500/10 pt-3">
                <div className="flex items-center gap-1.5">
                  {hasEdge ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
                      <TrendingUp className="h-3 w-3" /> Value détectée
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      <Zap className="h-3 w-3" />{insight ? "Aucune value" : "En attente"}
                    </span>
                  )}
                  <span className={cn("text-xs font-mono font-semibold", hasEdge ? "text-emerald-400" : "text-muted-foreground")}>
                    {hasEdge ? "+" : ""}{display.edge}% edge
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="mr-0.5 text-[11px] text-muted-foreground">Confiance</span>
                  <div className="flex items-center gap-0.5" aria-label={`${display.confidence}/5 confidence`}>
                    {renderStars(display.confidence)}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
