"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2, GitCompareArrows, Sparkles, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/components/dashboard/dashboard-data-provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Sport = "tennis" | "football";

type CompareFactor = {
  dimension: string;
  matchA: string;
  matchB: string;
  advantage: "A" | "B" | "egal";
};

type CompareResponse = {
  summary: string;
  matchA: {
    matchId: string;
    label: string;
    analysis: string;
    edge: number;
    probability: number;
  };
  matchB: {
    matchId: string;
    label: string;
    analysis: string;
    edge: number;
    probability: number;
  };
  factors: CompareFactor[];
  recommendation: { side: "matchA" | "matchB" | "aucun"; reason: string };
  confidence: number;
  source: "cache" | "gemini";
  cachedAt?: string;
};

type MatchOption = {
  id: string;
  label: string;
  data: Record<string, unknown>;
};

export type AICompareDialogProps = {
  className?: string;
  triggerLabel?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Construit le matchData allégé envoyé à Gemini (mêmes champs que la mono). */
function buildMatchData(
  option: MatchOption & { sport: Sport },
  tennis: any,
  foot: any,
): Record<string, unknown> {
  if (option.sport === "tennis") {
    const m = tennis?.matches?.find((x: any) => x.id === option.id);
    if (!m) return { sport: "tennis", matchId: option.id };
    return {
      sport: "tennis",
      matchId: m.id,
      playerA: { name: m.playerA.name, elo: m.playerA.elo, sps: m.playerA.sps },
      playerB: { name: m.playerB.name, elo: m.playerB.elo, sps: m.playerB.sps },
      eloGap: m.stats?.eloGap,
      surface: m.stats?.surface,
      confidence: m.stats?.confidence,
      tournament: m.tournament,
      probA: m.probA,
      probB: m.probB,
    };
  }
  const m = foot?.matches?.find((x: any) => x.id === option.id);
  if (!m) return { sport: "football", matchId: option.id };
  return {
    sport: "football",
    matchId: m.id,
    home: { name: m.home.name, form: m.home.form, rank: m.home.rank },
    away: { name: m.away.name, form: m.away.form, rank: m.away.rank },
    prediction: m.prediction,
    league: m.league?.name,
    round: m.round,
  };
}

/** Rendu "markdown-like" simple : découpe en paragraphes, sans dépendance MD. */
function renderParagraphs(text: string): React.ReactNode[] {
  return text
    .split(/\n{2,}/)
    .filter((p) => p.trim().length > 0)
    .map((p, i) => (
      <p key={i} className="mb-2 text-xs leading-relaxed text-muted-foreground">
        {p.trim()}
      </p>
    ));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AICompareDialog({
  className,
  triggerLabel = "Comparer 2 matchs",
}: AICompareDialogProps) {
  const { tennisData, footData } = useDashboardData();

  const [open, setOpen] = useState(false);
  const [sport, setSport] = useState<Sport>("tennis");
  const [matchAId, setMatchAId] = useState<string>("");
  const [matchBId, setMatchBId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResponse | null>(null);

  // Options du sport sélectionné (même source que l'AIInsightCard mono)
  const options = useMemo<MatchOption[]>(() => {
    if (sport === "tennis") {
      return (tennisData?.matches ?? []).map((m: any) => ({
        id: m.id,
        label: `${m.playerA.shortName} vs ${m.playerB.shortName} — ${m.tournament}`,
        data: {},
      }));
    }
    return (footData?.matches ?? []).map((m: any) => ({
      id: m.id,
      label: `${m.home.shortName} vs ${m.away.shortName} — ${m.league?.name ?? ""}`,
      data: {},
    }));
  }, [sport, tennisData?.matches, footData?.matches]);

  const ready = matchAId !== "" && matchBId !== "" && matchAId !== matchBId;

  const reset = () => {
    setMatchAId("");
    setMatchBId("");
    setResult(null);
    setError(null);
    setLoading(false);
  };

  // Soumet la comparaison à la route dédiée
  const handleCompare = useCallback(async () => {
    if (!ready || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const optA = options.find((o) => o.id === matchAId);
      const optB = options.find((o) => o.id === matchBId);
      if (!optA || !optB) throw new Error("Match introuvable dans la liste");

      const res = await fetch("/api/ai/gemini-insight/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport,
          matches: [
            { matchId: optA.id, label: optA.label, matchData: buildMatchData({ ...optA, sport }, tennisData, footData) },
            { matchId: optB.id, label: optB.label, matchData: buildMatchData({ ...optB, sport }, tennisData, footData) },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          body?.error ??
          body?.message ??
          (res.status === 429
            ? "Quota Gemini dépassé (429). Réessayez dans quelques minutes."
            : `Erreur ${res.status} — réessayez.`);
        throw new Error(msg);
      }

      setResult(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ready, loading, sport, matchAId, matchBId, options, tennisData, footData]);

  const sportLabel = sport === "tennis" ? "🎾 Tennis" : "⚽ Football";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:text-purple-200",
            className,
          )}
        >
          <GitCompareArrows className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto border-purple-500/20 bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-purple-400" />
            Comparer 2 matchs — Gemini
          </DialogTitle>
        </DialogHeader>

        {/* Sélecteur de sport : garantit 2 matchs du même sport */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Sport</span>
          <div className="flex gap-1.5">
            {(["tennis", "football"] as Sport[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSport(s);
                  setMatchAId("");
                  setMatchBId("");
                  setResult(null);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  sport === s
                    ? "border-purple-500/50 bg-purple-500/15 text-purple-300"
                    : "border-border/50 bg-muted/30 text-muted-foreground hover:border-purple-500/30",
                )}
              >
                {s === "tennis" ? "🎾 Tennis" : "⚽ Football"}
              </button>
            ))}
          </div>
        </div>

        {/* Sélection des 2 matchs */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Match A
            </label>
            <Select value={matchAId} onValueChange={(v) => { setMatchAId(v); setResult(null); }}>
              <SelectTrigger className="w-full bg-muted/30 text-xs">
                <SelectValue placeholder="— Sélectionner —" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Match B
            </label>
            <Select value={matchBId} onValueChange={(v) => { setMatchBId(v); setResult(null); }}>
              <SelectTrigger className="w-full bg-muted/30 text-xs">
                <SelectValue placeholder="— Sélectionner —" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem
                    key={o.id}
                    value={o.id}
                    disabled={o.id === matchAId}
                    className="text-xs"
                  >
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            {sportLabel} · comparaison cote-à-cote générée par Gemini 2.0 Flash
            (cache 12 h)
          </p>
          <Button
            onClick={handleCompare}
            disabled={!ready || loading}
            size="sm"
            className="bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitCompareArrows className="h-4 w-4" />
            )}
            {loading ? "Analyse en cours…" : "Comparer"}
          </Button>
        </div>

        {/* Erreur (429 / réseau / Gemini) */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                {error.includes("429") || error.includes("Quota")
                  ? "Quota Gemini dépassé"
                  : "Erreur lors de l'analyse"}
              </p>
              <p className="mt-0.5 text-red-400/80">{error}</p>
            </div>
          </div>
        )}

        {/* Résultat : analyse comparative */}
        {result && !loading && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-foreground">
              {result.summary}
            </p>

            {/* Cote-à-cote des 2 matchs */}
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { side: "matchA" as const, m: result.matchA },
                { side: "matchB" as const, m: result.matchB },
              ].map(({ side, m }) => {
                const recommended = result.recommendation.side === side;
                return (
                  <div
                    key={side}
                    className={cn(
                      "space-y-2 rounded-xl border p-3",
                      recommended
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-border/60 bg-muted/20",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[11px] font-semibold">
                        {m.label}
                      </p>
                      {recommended && (
                        <Badge className="shrink-0 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20">
                          Recommandé
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {m.analysis}
                    </p>
                    <div className="flex items-center gap-3 border-t border-border/30 pt-2 text-[11px]">
                      <span
                        className={cn(
                          "font-mono font-bold",
                          m.edge > 0 ? "text-emerald-400" : "text-muted-foreground",
                        )}
                      >
                        {m.edge > 0 ? "+" : ""}
                        {m.edge}% edge
                      </span>
                      <span className="text-muted-foreground">
                        Proba {m.probability}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Facteurs comparatifs */}
            {result.factors.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-border/60">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground">
                      <th className="px-3 py-1.5 font-semibold">Dimension</th>
                      <th className="px-3 py-1.5 font-semibold">Match A</th>
                      <th className="px-3 py-1.5 font-semibold">Match B</th>
                      <th className="px-3 py-1.5 font-semibold">Avantage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.factors.map((f) => (
                      <tr
                        key={f.dimension}
                        className="border-t border-border/40"
                      >
                        <td className="px-3 py-1.5 font-medium">{f.dimension}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {f.matchA}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {f.matchB}
                        </td>
                        <td className="px-3 py-1.5">
                          <span
                            className={cn(
                              "font-semibold",
                              f.advantage === "A" && "text-emerald-400",
                              f.advantage === "B" && "text-blue-400",
                              f.advantage === "egal" && "text-muted-foreground",
                            )}
                          >
                            {f.advantage === "A"
                              ? "A"
                              : f.advantage === "B"
                                ? "B"
                                : "="}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Recommandation + confiance */}
            {result.recommendation.side !== "aucun" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                <p className="text-xs font-bold text-emerald-400">
                  🎯 Recommandation :{" "}
                  {result.recommendation.side === "matchA"
                    ? result.matchA.label
                    : result.matchB.label}
                </p>
                {result.recommendation.reason && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {result.recommendation.reason}
                  </p>
                )}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground/60">
              Confiance {result.confidence}/5 · Source : {result.source}
              {result.cachedAt &&
                ` · Cache : ${new Date(result.cachedAt).toLocaleTimeString("fr-FR")}`}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
