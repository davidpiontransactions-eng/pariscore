"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock, Zap } from "lucide-react";
import { PRIORITY_MARKETS, type OddAlertsLiveOddsParsed } from "@/lib/oddalerts/live-odds-types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

function FreshnessIndicator({ ageSeconds, label }: { ageSeconds: number | null; label: string }) {
  if (ageSeconds === null) return <span className="text-xs text-muted-foreground">{label}: —</span>;
  const isFresh = ageSeconds <= 10;
  const isWarning = ageSeconds <= 30;
  return (
    <span className={`text-xs flex items-center gap-1 ${isFresh ? 'text-emerald-600' : isWarning ? 'text-amber-600' : 'text-rose-600'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isFresh ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500'}`} />
      {label}: {ageSeconds}s
    </span>
  );
}

function MarketRow({ market }: { market: OddAlertsLiveOddsParsed & { titleFr: string; oddsFormatted: Array<{ label: string; value: string }>; dataFreshness: string; oddsFreshness: string } }) {
  const isGrid = market.marketType === 'grid';
  return (
    <div className="border border-border/50 rounded-lg p-3 bg-card/50">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{market.titleFr}</span>
        <div className="flex items-center gap-2 text-[11px]">
          <FreshnessIndicator ageSeconds={market.dataAgeSeconds} label="Score" />
          <FreshnessIndicator ageSeconds={market.oddsAgeSeconds} label="Cotes" />
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{market.marketType}</Badge>
        </div>
      </div>
      <div className={isGrid ? "grid grid-cols-2 gap-1.5" : "flex flex-wrap gap-2"}>
        {market.oddsFormatted.map((o, i) => (
          <div
            key={i}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 rounded text-sm font-mono"
          >
            <span className="text-muted-foreground text-[11px]">{o.label}</span>
            <span className="font-bold tabular-nums">{o.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OddAlertsLiveOddsPanel() {
  const { smid } = useParams<{ smid: string }>();
  const smidNum = smid ? parseInt(smid, 10) : null;

  const { data, error, isLoading, mutate } = useSWR(
    smidNum ? `/api/v1/oddalerts/live/game/${smidNum}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10_000, refreshInterval: 15_000 }
  );

  const game = data?.game;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Chargement live odds...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !game) {
    return (
      <Card className="border-rose-500/30">
        <CardContent className="py-6 text-center text-sm text-rose-600 dark:text-rose-400">
          Aucune cote live disponible pour ce match
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Zap className="h-4 w-4 text-emerald-500" />
            Cotes Live OddAlerts (Bet365)
          </CardTitle>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {game.elapsed ? `${game.elapsed}'` : '—'}
            </span>
            <span className="flex items-center gap-1">
              {game.homeGoals !== null && game.awayGoals !== null && (
                <span className="font-bold tabular-nums">{game.homeGoals} - {game.awayGoals}</span>
              )}
            </span>
            <button
              onClick={() => mutate()}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
          <FreshnessIndicator ageSeconds={game.dataAgeSeconds} label="Données score" />
          <FreshnessIndicator ageSeconds={game.oddsAgeSeconds} label="Données cotes" />
          <span>Serveur: {new Date(game.serverTime * 1000).toLocaleTimeString()}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {game.markets.map((market) => (
          <MarketRow key={market.id} market={market} />
        ))}
      </CardContent>
    </Card>
  );
}