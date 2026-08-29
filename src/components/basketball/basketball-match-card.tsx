"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type MatchTeam = {
  abbr: string;
  name: string;
  score: number | null;
  record: string | null;
};

type MatchOdds = {
  ml_home: number | null;
  spread: number | null;
  over_under: number | null;
} | null;

type MatchPredictions = {
  blended?: { p_home: number | null; p_away: number | null } | null;
  win_prob?: { p_home: number | null; p_away: number | null } | null;
  four_factors?: {
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

type BasketballMatchCardMatch = {
  id: string;
  league: string;
  status: string;
  home: MatchTeam;
  away: MatchTeam;
  odds?: MatchOdds;
  predictions?: MatchPredictions;
  injuries?: { home: { nOut: number; starsOut: string[] }; away: { nOut: number; starsOut: string[] } };
  rest?: { home: { restDays: number; b2b: boolean } | null; away: { restDays: number; b2b: boolean } | null };
  consensus?: { label: string; nModels: number } | null;
};

type BasketballMatchCardProps = {
  match: BasketballMatchCardMatch;
  onClick?: (match: BasketballMatchCardMatch) => void;
  onDetailRequest?: (matchId: string) => void;
  className?: string;
};

const LEAGUE_LABELS: Record<string, string> = {
  nba: "NBA",
  wnba: "WNBA",
  euroleague: "EuroLeague",
  eurocup: "EuroCup",
  lnb: "Betclic Élite",
  acb: "Liga ACB",
  lba: "LBA",
  bsl: "BSL",
  bbl: "BBL",
  aba: "ABA League",
  greek: "Greek League",
  NBA: "NBA",
  WNBA: "WNBA",
  EuroLeague: "EuroLeague",
  EuroCup: "EuroCup",
};

export function BasketballMatchCard({ match, onClick, onDetailRequest, className }: BasketballMatchCardProps) {
  const isLive = match.status === "in-progress";
  const isPost = match.status === "post" || match.status === "finished";
  const pHome = match.predictions?.blended?.p_home ?? match.predictions?.win_prob?.p_home ?? null;
  const pAway = match.predictions?.blended?.p_away ?? match.predictions?.win_prob?.p_away ?? null;

  const handleClick = () => {
    onClick?.(match);
    onDetailRequest?.(match.id);
  };

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm",
        isLive && "border-emerald-500/30",
        className,
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <Badge variant="outline" className="text-[10px]">
          {LEAGUE_LABELS[match.league] ?? match.league}
        </Badge>
        {isLive && (
          <Badge variant="default" className="bg-emerald-500 text-[10px]">
            LIVE
          </Badge>
        )}
        {isPost && (
          <Badge variant="secondary" className="text-[10px]">
            Final
          </Badge>
        )}
      </div>

      {/* Teams */}
      <div className="mb-2 flex items-center justify-between">
        <TeamRow team={match.home} pHome={pHome} />
        <span className="mx-2 text-xs text-muted-foreground">@</span>
        <TeamRow team={match.away} pHome={pAway} />
      </div>

      {/* Win probability bar */}
      {pHome != null && pAway != null && (
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
            <span>{pHome.toFixed(1)}%</span>
            <span>{pAway.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pHome}%` }}
            />
          </div>
        </div>
      )}

      {/* Four Factors */}
      {match.predictions?.four_factors && (
        <FourFactorsRow ff={match.predictions.four_factors} />
      )}

      {/* Injury + Rest badges */}
      <div className="mt-2 flex flex-wrap gap-1">
        {match.injuries?.home.nOut != null && match.injuries.home.nOut > 0 && (
          <Badge variant="destructive" className="text-[9px] px-1 py-0">
            {match.home.abbr}: {match.injuries.home.nOut} OUT
            {match.injuries.home.starsOut.length > 0 && ` (${match.injuries.home.starsOut[0]})`}
          </Badge>
        )}
        {match.injuries?.away.nOut != null && match.injuries.away.nOut > 0 && (
          <Badge variant="destructive" className="text-[9px] px-1 py-0">
            {match.away.abbr}: {match.injuries.away.nOut} OUT
            {match.injuries.away.starsOut.length > 0 && ` (${match.injuries.away.starsOut[0]})`}
          </Badge>
        )}
        {match.rest?.home?.b2b && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-orange-500/50 text-orange-500">
            {match.home.abbr}: B2B
          </Badge>
        )}
        {match.rest?.away?.b2b && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-orange-500/50 text-orange-500">
            {match.away.abbr}: B2B
          </Badge>
        )}
        {match.consensus && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0">
            {match.consensus.nModels} models: {match.consensus.label}
          </Badge>
        )}
      </div>

      {/* Odds */}
      {match.odds && (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
          {match.odds.ml_home != null && (
            <span>ML: {match.odds.ml_home > 0 ? "+" : ""}{match.odds.ml_home}</span>
          )}
          {match.odds.spread != null && (
            <span>Spread: {match.odds.spread}</span>
          )}
          {match.odds.over_under != null && (
            <span>O/U: {match.odds.over_under}</span>
          )}
        </div>
      )}
    </div>
  );
}

function TeamRow({ team, pHome }: { team: MatchTeam; pHome: number | null }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1">
        <span className="text-sm font-semibold">{team.abbr}</span>
        {team.score != null && (
          <span className="text-lg font-bold tabular-nums">{team.score}</span>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
        {team.name}
      </span>
      {team.record && (
        <span className="text-[10px] text-muted-foreground">{team.record}</span>
      )}
    </div>
  );
}

function FourFactorsRow({ ff }: { ff: NonNullable<BasketballMatchCardMatch["predictions"]>["four_factors"] }) {
  if (!ff) return null;
  return (
    <div className="mt-2 rounded bg-muted/50 px-2 py-1 text-[10px]">
      <div className="flex justify-between text-muted-foreground">
        <span>eFG%: {ff.efg_home?.toFixed(1) ?? "—"} vs {ff.efg_away?.toFixed(1) ?? "—"}</span>
        <span>ORtg: {ff.off_rating_home?.toFixed(1) ?? "—"} vs {ff.off_rating_away?.toFixed(1) ?? "—"}</span>
      </div>
    </div>
  );
}

export function BasketballMatchCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-3", className)}>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      {/* Teams */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-3 w-3" />
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {/* Win prob bar */}
      <div className="mb-2">
        <div className="flex justify-between mb-0.5">
          <Skeleton className="h-2.5 w-8" />
          <Skeleton className="h-2.5 w-8" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      {/* Four Factors */}
      <Skeleton className="h-6 w-full rounded" />
      {/* Badges */}
      <div className="mt-2 flex gap-1">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
    </div>
  );
}
