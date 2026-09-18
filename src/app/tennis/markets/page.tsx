"use client";

// Page marchés tennis — /tennis/markets
//
// Mode prematch : paramètres manuels pServe A/B
// Mode live : sélection d'un match live, auto-refresh 8s, blend bayésien

import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Target, RefreshCw, Wifi, WifiOff, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TennisMarketGrid } from "@/components/tennis/tennis-market-grid";
import { TennisMarketFilters } from "@/components/tennis/tennis-market-filters";
import { useTennisMarkets } from "@/hooks/use-tennis-markets";
import type { LiveMatchState } from "@/hooks/use-live-matches";

type MarketCategory =
  | "match-winner"
  | "set-score"
  | "set-handicap"
  | "game-handicap"
  | "total-games"
  | "aces"
  | "tiebreak"
  | "first-set"
  | "double-result"
  | "live";

type MarketResult = {
  id: string;
  label: string;
  category: string;
  probA: number;
  probB: number;
  edge?: number;
  kelly?: number;
  recommended: boolean;
};

type ApiResponse = {
  markets: MarketResult[];
  totalMarkets: number;
  computedMarkets: number;
  params: { pServeA: number; pServeB: number; surface: string; bestOf: number };
};

export default function TennisMarketsPage() {
  const t = useTranslations("tennis.markets");

  // Mode
  const [mode, setMode] = useState<"prematch" | "live">("prematch");

  // Paramètres prematch
  const [pServeA, setPServeA] = useState(0.67);
  const [pServeB, setPServeB] = useState(0.62);
  const [surface, setSurface] = useState<"Hard" | "Clay" | "Grass">("Hard");
  const [bestOf, setBestOf] = useState<3 | 5>(3);

  // Filtres
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory | "all">("all");
  const [minProb, setMinProb] = useState(0);
  const [showLiveOnly, setShowLiveOnly] = useState(false);

  // État prematch
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // État live (placeholder — en production, utiliser use-live-matches)
  const [liveState, setLiveState] = useState<LiveMatchState | null>(null);

  // Hook live
  const liveMarkets = useTennisMarkets(
    mode === "live" ? liveState : null,
    pServeA,
    pServeB,
  );

  // Fetch prematch
  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        pServeA: String(pServeA),
        pServeB: String(pServeB),
        surface,
        bestOf: String(bestOf),
      });

      const res = await fetch(`/api/v1/tennis/markets?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [pServeA, pServeB, surface, bestOf]);

  // Filtrer les marchés
  const filteredMarkets = useMemo(() => {
    const source = mode === "live" ? liveMarkets.markets : (data?.markets ?? []);
    let markets = source;

    if (selectedCategory !== "all") {
      markets = markets.filter(m => m.category === selectedCategory);
    }
    if (minProb > 0) {
      markets = markets.filter(m => Math.max(m.probA, m.probB) >= minProb);
    }
    if (showLiveOnly) {
      markets = markets.filter(m => m.category === "live");
    }

    return markets;
  }, [mode, liveMarkets.markets, data, selectedCategory, minProb, showLiveOnly]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            {t("title", { defaultMessage: "Marchés Tennis" })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "live"
              ? t("subtitleLive", { defaultMessage: "Mode live — blend bayésien modèle + marché" })
              : t("subtitle", { defaultMessage: "Probabilités calculées par modèle Markov + Poisson" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle mode */}
          <Button
            variant={mode === "live" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode(mode === "live" ? "prematch" : "live")}
          >
            {mode === "live" ? <Wifi className="mr-1 h-3.5 w-3.5" /> : <WifiOff className="mr-1 h-3.5 w-3.5" />}
            {mode === "live" ? "Live" : "Prematch"}
          </Button>
          {mode === "prematch" && (
            <Button onClick={fetchMarkets} disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              {t("calculate", { defaultMessage: "Calculer" })}
            </Button>
          )}
        </div>
      </div>

      {/* Blend info (live) */}
      {mode === "live" && liveState && (
        <div className="flex items-center gap-4 mb-4 p-3 rounded-lg border bg-card text-sm">
          <div className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="font-medium">Blend:</span>
          </div>
          <span>Modèle {Math.round(liveMarkets.modelWeight * 100)}%</span>
          <span>Marché {Math.round(liveMarkets.marketWeight * 100)}%</span>
          <span className="text-muted-foreground">
            ({liveMarkets.dominant === "model" ? "modèle domine" : liveMarkets.dominant === "market" ? "marché domine" : "équilibré"})
          </span>
          <span className="text-muted-foreground ml-auto">
            Progression: {Math.round(liveMarkets.matchProgress * 100)}%
          </span>
          {liveMarkets.lastUpdate && (
            <span className="text-xs text-muted-foreground">
              {liveMarkets.lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Paramètres */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 p-4 rounded-lg border bg-card">
        <div>
          <label className="text-xs font-medium text-muted-foreground">pServe A</label>
          <input
            type="number"
            step="0.01"
            min="0.4"
            max="0.85"
            value={pServeA}
            onChange={e => setPServeA(Number(e.target.value))}
            className="w-full mt-1 rounded border px-2 py-1 text-sm bg-background"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">pServe B</label>
          <input
            type="number"
            step="0.01"
            min="0.4"
            max="0.85"
            value={pServeB}
            onChange={e => setPServeB(Number(e.target.value))}
            className="w-full mt-1 rounded border px-2 py-1 text-sm bg-background"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Surface</label>
          <select
            value={surface}
            onChange={e => setSurface(e.target.value as "Hard" | "Clay" | "Grass")}
            className="w-full mt-1 rounded border px-2 py-1 text-sm bg-background"
          >
            <option value="Hard">Hard</option>
            <option value="Clay">Clay</option>
            <option value="Grass">Grass</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Format</label>
          <select
            value={bestOf}
            onChange={e => setBestOf(Number(e.target.value) as 3 | 5)}
            className="w-full mt-1 rounded border px-2 py-1 text-sm bg-background"
          >
            <option value="3">Best of 3</option>
            <option value="5">Best of 5</option>
          </select>
        </div>
      </div>

      {/* Filtres */}
      <TennisMarketFilters
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        minProb={minProb}
        onMinProbChange={setMinProb}
        showLiveOnly={showLiveOnly}
        onShowLiveOnlyChange={setShowLiveOnly}
        className="mb-4"
      />

      {/* Erreur */}
      {(error ?? liveMarkets.error) && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400 mb-4">
          {error ?? liveMarkets.error}
        </div>
      )}

      {/* Résultats */}
      {mode === "prematch" && data && (
        <div className="mb-4 text-sm text-muted-foreground">
          {data.computedMarkets} marchés calculés / {data.totalMarkets} disponibles
          {filteredMarkets.length !== data.computedMarkets && (
            <span> — {filteredMarkets.length} affichés après filtres</span>
          )}
        </div>
      )}
      {mode === "live" && liveMarkets.markets.length > 0 && (
        <div className="mb-4 text-sm text-muted-foreground">
          {filteredMarkets.length} marchés live
        </div>
      )}

      {/* Grille */}
      {mode === "live" ? (
        liveMarkets.markets.length > 0 ? (
          <TennisMarketGrid markets={filteredMarkets} />
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Wifi className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">{t("noLive", { defaultMessage: "Aucun match live sélectionné" })}</p>
            <p className="text-sm mt-2">{t("liveHint", { defaultMessage: "Passez en mode live depuis un match tennis pour voir les marchés en temps réel" })}</p>
          </div>
        )
      ) : data ? (
        <TennisMarketGrid markets={filteredMarkets} />
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">{t("configure", { defaultMessage: "Configurez les paramètres et cliquez Calculer" })}</p>
          <p className="text-sm mt-2">{t("hint", { defaultMessage: "pServe = probabilité de gagner un point au service (ATP ~0.64)" })}</p>
        </div>
      )}
    </main>
  );
}
