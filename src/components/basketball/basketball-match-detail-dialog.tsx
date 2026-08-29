"use client";

import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Activity, DollarSign, Users, Target, Percent } from "lucide-react";
import { BasketballFourFactors } from "./basketball-four-factors";
import { useBasketballH2H } from "@/hooks/use-basketball-h2h";
import type { BasketballBookmakerOdd, OddsSnapshot } from "@/lib/basketball-odds";

const BasketballOddsComparator = lazy(() =>
  import("./basketball-odds-comparator").then((m) => ({ default: m.BasketballOddsComparator })),
);

const BasketballOddsChart = lazy(() =>
  import("./basketball-odds-chart").then((m) => ({ default: m.BasketballOddsChart })),
);

/** Match basketball léger (depuis useBasketballMatches). */
type LightMatch = {
  id: string;
  league: string;
  status: string;
  home: { id: string; abbr: string; name: string; score: number | null; record: string | null };
  away: { id: string; abbr: string; name: string; score: number | null; record: string | null };
  pHome: number | null;
  pAway: number | null;
  edgeElo: number | null;
  kelly: { side: string; fraction: number; capped: number; note: string; ev: number | null } | null;
  value: { fair_home: number; fair_away: number; vig_pct: number; ev_home: number | null; ev_away: number | null; edge_home: number | null; edge_away: number | null } | null;
  spreadUqd: { exp_margin: number; ats_pick: string | null; ou_lean: string | null } | null;
  totalEdge: { line: number; lean: string | null } | null;
  injuries: { home: { nOut: number; starsOut: string[]; penaltyPts: number }; away: { nOut: number; starsOut: string[]; penaltyPts: number } };
  rest: { home: { restDays: number; b2b: boolean; penaltyPts: number } | null; away: { restDays: number; b2b: boolean; penaltyPts: number } | null };
  consensus: { meanPHome: number; stddev: number; nModels: number; label: string; crossesFifty: boolean } | null;
  predictions?: {
    four_factors?: {
      p_home: number;
      efg_home: number | null; efg_away: number | null;
      tov_home: number | null; tov_away: number | null;
      orb_home: number | null; orb_away: number | null;
      ft_home: number | null; ft_away: number | null;
      off_rating_home: number | null; off_rating_away: number | null;
      def_rating_home: number | null; def_rating_away: number | null;
      net_rating_home: number | null; net_rating_away: number | null;
      pace_home: number | null; pace_away: number | null;
      complete: boolean;
    } | null;
  } | null;
};

type Props = {
  match: LightMatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const LEAGUE_LABELS: Record<string, string> = {
  nba: "NBA",
  wnba: "WNBA",
  NBA: "NBA",
  WNBA: "WNBA",
  euroleague: "EuroLeague",
  eurocup: "EuroCup",
  lnb: "Betclic Elite",
  acb: "Liga ACB",
  lba: "LBA",
  bsl: "BSL",
  bbl: "BBL",
  aba: "ABA League",
  greek: "Greek League",
  EuroLeague: "EuroLeague",
  EuroCup: "EuroCup",
};

export function BasketballMatchDetailDialog({ match, open, onOpenChange }: Props) {
  const pHome = match?.pHome ?? null;
  const pAway = match?.pAway ?? null;
  const fourFactors = match?.predictions?.four_factors ?? null;

  // H2H (NBA/WNBA uniquement)
  const league = match?.league?.toLowerCase() as "nba" | "wnba" | null;
  const isEspn = league === "nba" || league === "wnba";
  const { h2h, isLoading: h2hLoading } = useBasketballH2H(
    isEspn ? league : null,
    isEspn && match?.home?.id ? match.home.id : null,
    isEspn && match?.away?.id ? match.away.id : null,
  );
  const h2hMatches = useMemo(() => h2h?.matches?.slice(0, 5) ?? [], [h2h]);
  const split = h2h?.split ?? null;

  // Odds multi-bookmakers (lazy fetch)
  const [odds, setOdds] = useState<BasketballBookmakerOdd[]>([]);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [oddsHistory, setOddsHistory] = useState<OddsSnapshot[]>([]);

  useEffect(() => {
    if (!open || !match) {
      setOdds([]);
      setOddsHistory([]);
      return;
    }
    // Seulement NBA/WNBA (The Odds API supporte ces ligues)
    const league = match.league.toLowerCase();
    if (league !== "nba" && league !== "wnba") return;

    let cancelled = false;
    setOddsLoading(true);
    const params = new URLSearchParams({
      league,
      home: match.home.name,
      away: match.away.name,
    });
    // Fetch current odds
    fetch(`/api/basketball/odds?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setOdds(data.odds ?? []);
      })
      .catch(() => {
        if (!cancelled) setOdds([]);
      })
      .finally(() => {
        if (!cancelled) setOddsLoading(false);
      });
    // Fetch odds history (line movement)
    const histParams = new URLSearchParams({
      league,
      home: match.home.name,
      away: match.away.name,
      history: "true",
    });
    fetch(`/api/basketball/odds?${histParams}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setOddsHistory(data.snapshots ?? []);
      })
      .catch(() => {
        if (!cancelled) setOddsHistory([]);
      });
    return () => { cancelled = true; };
  }, [open, match]);

  if (!match) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {LEAGUE_LABELS[match.league] ?? match.league}
            </Badge>
            {match.status === "in-progress" && (
              <Badge variant="default" className="bg-emerald-500 text-[10px]">
                LIVE
              </Badge>
            )}
            {(match.status === "post" || match.status === "finished") && (
              <Badge variant="secondary" className="text-[10px]">
                Final
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-4 p-1">
            {/* Team Header */}
            <div className="flex items-center justify-between">
              <TeamBlock
                name={match.home.name}
                abbr={match.home.abbr}
                record={match.home.record}
                score={match.home.score}
                prob={pHome}
                side="home"
              />
              <div className="text-center px-4">
                <span className="text-xs text-muted-foreground">vs</span>
                {match.edgeElo != null && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Elo Δ {match.edgeElo > 0 ? "+" : ""}{match.edgeElo.toFixed(0)}
                  </div>
                )}
              </div>
              <TeamBlock
                name={match.away.name}
                abbr={match.away.abbr}
                record={match.away.record}
                score={match.away.score}
                prob={pAway}
                side="away"
              />
            </div>

            {/* Win Probability Bar */}
            {pHome != null && pAway != null && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span className="font-semibold text-emerald-400">{pHome.toFixed(1)}%</span>
                  <span className="text-muted-foreground">Win Probability</span>
                  <span className="font-semibold text-rose-400">{pAway.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${pHome}%` }}
                  />
                </div>
              </div>
            )}

            {/* Four Factors */}
            {fourFactors && (
              <div className="rounded-lg border p-3">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Four Factors
                </h3>
                <BasketballFourFactors
                  fourFactors={fourFactors}
                  homeAbbr={match.home.abbr}
                  awayAbbr={match.away.abbr}
                />
              </div>
            )}

            {/* Odds Comparator (NBA/WNBA only) */}
            {(match.league.toLowerCase() === "nba" || match.league.toLowerCase() === "wnba") && (
              <div className="rounded-lg border p-3">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Cotes Multi-Bookmakers
                </h3>
                {oddsLoading && (
                  <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                    <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Chargement des cotes...
                  </div>
                )}
                {!oddsLoading && odds.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Aucune cote disponible pour ce match.
                  </p>
                )}
                {!oddsLoading && odds.length > 0 && (
                  <Suspense fallback={null}>
                    <BasketballOddsComparator
                      odds={odds}
                      homeName={match.home.name}
                      awayName={match.away.name}
                      modelProbHome={pHome}
                    />
                  </Suspense>
                )}
                {!oddsLoading && oddsHistory.length > 1 && (
                  <Suspense fallback={null}>
                    <BasketballOddsChart
                      snapshots={oddsHistory}
                      homeName={match.home.name}
                      awayName={match.away.name}
                    />
                  </Suspense>
                )}
              </div>
            )}

            {/* H2H History (NBA/WNBA) */}
            {isEspn && (
              <div className="rounded-lg border p-3">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Confrontations directes
                  {split && (
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      ({split.aWins}-{split.bWins} sur {split.total})
                    </span>
                  )}
                </h3>
                {h2hLoading && (
                  <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
                    <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Chargement H2H...
                  </div>
                )}
                {!h2hLoading && h2hMatches.length > 0 && (
                  <div className="space-y-1.5">
                    {h2hMatches.map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{m.date}</span>
                        <span className="font-semibold">
                          {m.home.abbr} {m.homeScore} - {m.awayScore} {m.away.abbr}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {!h2hLoading && h2hMatches.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Aucun historique H2H disponible.
                  </p>
                )}
              </div>
            )}

            {/* Value & Kelly Recommendation */}
            {(match.kelly || match.value || match.spreadUqd || match.totalEdge) && (
              <div className="rounded-lg border p-3">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Recommandation & Value
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Kelly */}
                  {match.kelly && match.kelly.fraction > 0 && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Kelly Criterion</span>
                      <div className="flex items-center gap-1">
                        <Badge variant={match.kelly.side === "home" ? "default" : "secondary"} className="text-xs">
                          {match.kelly.side === "home" ? match.home.abbr : match.away.abbr}
                        </Badge>
                        <span className="font-semibold">{(match.kelly.capped * 100).toFixed(1)}%</span>
                      </div>
                      {match.kelly.ev != null && match.kelly.ev > 0 && (
                        <span className="text-green-400">
                          EV: +{(match.kelly.ev * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                  {/* Value */}
                  {match.value && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Value Bet</span>
                      {match.value.edge_home != null && match.value.edge_home > 0 && (
                        <div>
                          <Badge variant="default" className="text-xs">{match.home.abbr}</Badge>
                          <span className="ml-1 text-green-400">+{(match.value.edge_home * 100).toFixed(1)}%</span>
                        </div>
                      )}
                      {match.value.edge_away != null && match.value.edge_away > 0 && (
                        <div>
                          <Badge variant="secondary" className="text-xs">{match.away.abbr}</Badge>
                          <span className="ml-1 text-green-400">+{(match.value.edge_away * 100).toFixed(1)}%</span>
                        </div>
                      )}
                      <span className="text-muted-foreground">
                        Vig: {(match.value.vig_pct * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {/* Spread */}
                  {match.spreadUqd && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Spread</span>
                      <div>
                        <span className="font-semibold">
                          {match.spreadUqd.exp_margin > 0 ? "+" : ""}
                          {match.spreadUqd.exp_margin.toFixed(1)}
                        </span>
                        {match.spreadUqd.ats_pick && (
                          <span className="ml-2 text-muted-foreground">
                            → {match.spreadUqd.ats_pick}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Total */}
                  {match.totalEdge && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Total O/U</span>
                      <div>
                        <span className="font-semibold">{match.totalEdge.line}</span>
                        {match.totalEdge.lean && (
                          <span className={`ml-2 ${match.totalEdge.lean === "Over" ? "text-green-400" : "text-orange-400"}`}>
                            {match.totalEdge.lean}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {match.kelly && match.kelly.note && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {match.kelly.note}
                  </p>
                )}
              </div>
            )}

            {/* Consensus Panel */}
            {match.consensus && (
              <div className="rounded-lg border p-3">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  Consensus Modèles
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Probabilité moyenne</span>
                    <div className="font-semibold">
                      {match.consensus.meanPHome.toFixed(1)}%
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Écart-type</span>
                    <div className="font-semibold">
                      ±{match.consensus.stddev.toFixed(1)}%
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Modèles</span>
                    <div className="font-semibold">{match.consensus.nModels}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Label</span>
                    <Badge variant={match.consensus.crossesFifty ? "default" : "secondary"} className="text-xs">
                      {match.consensus.label}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Injury & Rest Info */}
            {(match.injuries.home.nOut > 0 || match.injuries.away.nOut > 0 ||
              match.rest.home || match.rest.away) && (
              <div className="rounded-lg border p-3">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Blessures & Repos
                </h3>
                <div className="space-y-2 text-xs">
                  {/* Injuries */}
                  {match.injuries.home.nOut > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-[10px]">
                        {match.home.abbr}
                      </Badge>
                      <span>{match.injuries.home.nOut} joueur{match.injuries.home.nOut > 1 ? "s" : ""} absent{match.injuries.home.nOut > 1 ? "s" : ""}</span>
                      {match.injuries.home.starsOut.length > 0 && (
                        <span className="text-muted-foreground">
                          ({match.injuries.home.starsOut.join(", ")})
                        </span>
                      )}
                      <span className="text-orange-400 ml-auto">
                        -{match.injuries.home.penaltyPts} pts
                      </span>
                    </div>
                  )}
                  {match.injuries.away.nOut > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-[10px]">
                        {match.away.abbr}
                      </Badge>
                      <span>{match.injuries.away.nOut} joueur{match.injuries.away.nOut > 1 ? "s" : ""} absent{match.injuries.away.nOut > 1 ? "s" : ""}</span>
                      {match.injuries.away.starsOut.length > 0 && (
                        <span className="text-muted-foreground">
                          ({match.injuries.away.starsOut.join(", ")})
                        </span>
                      )}
                      <span className="text-orange-400 ml-auto">
                        -{match.injuries.away.penaltyPts} pts
                      </span>
                    </div>
                  )}
                  {/* Rest */}
                  {match.rest.home && (
                    <div className="flex items-center gap-2">
                      <Badge variant={match.rest.home.b2b ? "destructive" : "outline"} className="text-[10px]">
                        {match.home.abbr}
                      </Badge>
                      <span>
                        {match.rest.home.b2b ? "Back-to-Back" : `${match.rest.home.restDays} jour${match.rest.home.restDays > 1 ? "s" : ""} de repos`}
                      </span>
                      {match.rest.home.penaltyPts > 0 && (
                        <span className="text-orange-400 ml-auto">
                          -{match.rest.home.penaltyPts} pts
                        </span>
                      )}
                    </div>
                  )}
                  {match.rest.away && (
                    <div className="flex items-center gap-2">
                      <Badge variant={match.rest.away.b2b ? "destructive" : "outline"} className="text-[10px]">
                        {match.away.abbr}
                      </Badge>
                      <span>
                        {match.rest.away.b2b ? "Back-to-Back" : `${match.rest.away.restDays} jour${match.rest.away.restDays > 1 ? "s" : ""} de repos`}
                      </span>
                      {match.rest.away.penaltyPts > 0 && (
                        <span className="text-orange-400 ml-auto">
                          -{match.rest.away.penaltyPts} pts
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No data state */}
            {pHome == null && !fourFactors && (
              <div className="rounded-lg border p-4 text-center text-xs text-muted-foreground">
                <Activity className="h-5 w-5 mx-auto mb-2 opacity-50" />
                Données de prédiction indisponibles pour ce match.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function TeamBlock({
  name,
  abbr,
  record,
  score,
  prob,
  side,
}: {
  name: string;
  abbr: string;
  record: string | null;
  score: number | null;
  prob: number | null;
  side: "home" | "away";
}) {
  const accent = side === "home" ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="flex flex-col items-center text-center min-w-[100px]">
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold mb-1">
        {abbr.slice(0, 2)}
      </div>
      <span className={`text-sm font-semibold ${accent}`}>{abbr}</span>
      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{name}</span>
      {record && <span className="text-[10px] text-muted-foreground">{record}</span>}
      {score != null && (
        <span className="text-lg font-bold tabular-nums mt-0.5">{score}</span>
      )}
      {prob != null && (
        <span className="text-[10px] text-muted-foreground mt-0.5">{prob.toFixed(1)}%</span>
      )}
    </div>
  );
}
