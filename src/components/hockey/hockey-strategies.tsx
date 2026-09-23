"use client";

/**
 * HockeyStrategies — Top 10 matchs par stratégie avec tableau complet Under/Over.
 * Affiche le tableau de style Annabet: home/away/all pour chaque ligne de buts.
 * Thème: FotMob light mode (carte blanche, encre #222, bordures #f0f0f0).
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Target, Trophy, Zap, Search } from "lucide-react";
import { parisDayLabel, parisKickoff } from "@/lib/football-time";
import { FOT } from "@/components/football/fotmob-theme";
import type { MatchPrematch, OverUnderLine } from "@/hooks/use-hockey-prematch";
import type { PlayerStat } from "@/components/hockey/hockey-top-players";

type LeagueId = "nhl" | "khl" | "magnus";

type StrategyMatch = {
  id: string;
  leagueId: string;
  homeName: string;
  awayName: string;
  scheduledAt: string | null;
  overUnderLines: OverUnderLine[];
  winner: { side: "home" | "away"; pct: number; label: string } | null;
};

// ─── Couleurs thème ──────────────────────────────────────────
const C = {
  card: FOT.card,
  border: FOT.border,
  soft: FOT.soft,
  ink: FOT.ink,
  muted: FOT.muted,
  home: FOT.home,
  away: FOT.away,
  live: FOT.live,
  under: "#1a73e8",
  underBg: "rgba(26,115,232,0.08)",
  over: "#e53935",
  overBg: "rgba(229,57,53,0.08)",
  winner: "#00985f",
  winnerBg: "rgba(0,152,95,0.08)",
  accent: "#ffd93d",
};

// ─── Helpers ──────────────────────────────────────────────────

function oddsToProb(odd: number | null): number {
  if (!odd || odd <= 0) return 0;
  return Math.min(100, (1 / odd) * 100);
}

function getWinnerRecommendation(match: MatchPrematch): StrategyMatch["winner"] {
  const stats = match.h2h?.h2hStats;
  if (stats?.oneXtwo && stats.oneXtwo.pcts.length >= 3) {
    const pcts = stats.oneXtwo.pcts;
    // Winner = meilleur des 2 côtés (nul ignoré pour la reco vainqueur)
    const side = pcts[2] > pcts[0] ? "away" : "home";
    const maxPct = side === "home" ? pcts[0] : pcts[2];
    const label = side === "home" ? match.team1Name : match.team2Name;
    return { side, pct: maxPct, label };
  }
  if (match.odds1X2) {
    const homePct = oddsToProb(match.odds1X2.home);
    const awayPct = oddsToProb(match.odds1X2.away);
    const side = awayPct > homePct ? "away" : "home";
    const maxPct = side === "home" ? homePct : awayPct;
    const label = side === "home" ? match.team1Name : match.team2Name;
    return { side, pct: maxPct, label };
  }
  return null;
}

function getBestUnderOver(match: MatchPrematch): { line: number; side: "under" | "over"; pct: number; odds: number | null } | null {
  const lines = match.summary?.overUnderLines;
  if (!lines || lines.length === 0) return null;
  let best: { line: number; side: "under" | "over"; pct: number; odds: number | null } | null = null;
  for (const l of lines) {
    if (l.underPct >= l.overPct) {
      if (!best || l.underPct > best.pct) best = { line: l.line, side: "under", pct: l.underPct, odds: l.underOdds };
    }
    if (l.overPct >= l.underPct) {
      if (!best || l.overPct > best.pct) best = { line: l.line, side: "over", pct: l.overPct, odds: l.overOdds };
    }
  }
  return best;
}

// ─── Composants UI ────────────────────────────────────────────

function formatPerc(p: { under: number; over: number } | null): string {
  if (!p) return "—";
  return `${p.under}%-${p.over}%`;
}

function formatOdds(o: number | null): string {
  if (!o) return "—";
  return o.toFixed(2);
}

function UnderOverBreakdownTable({ lines }: { lines: OverUnderLine[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ fontSize: "8pt" }}>
        <thead>
          <tr className="border-b" style={{ borderColor: C.border }}>
            <th className="py-1 px-0.5 text-left font-normal" style={{ color: C.muted }}>Buts</th>
            <th className="py-1 px-0.5 text-center font-normal" style={{ color: C.muted }}>Dom. Sous</th>
            <th className="py-1 px-0.5 text-center font-normal" style={{ color: C.muted }}>Ext. Sous</th>
            <th className="py-1 px-0.5 text-center font-normal" style={{ color: C.muted }}>Total Sous</th>
            <th className="py-1 px-0.5 text-center font-normal" style={{ color: C.muted }}>Ligne</th>
            <th className="py-1 px-0.5 text-center font-normal" style={{ color: C.muted }}>Dom. Sur</th>
            <th className="py-1 px-0.5 text-center font-normal" style={{ color: C.muted }}>Ext. Sur</th>
            <th className="py-1 px-0.5 text-center font-normal" style={{ color: C.muted }}>Total Sur</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const isUnder = l.underPct >= l.overPct;
            return (
              <tr key={l.line} className="border-b transition-colors" style={{ borderColor: C.border }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.soft)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                <td className="py-1 px-0.5 font-bold" style={{ color: C.ink }}>{l.line}</td>
                <td className="py-1 px-0.5 text-center">
                  <span className="font-bold" style={{ color: isUnder ? C.under : C.muted }}>
                    {formatPerc(l.homeUnderPct)}
                  </span>
                </td>
                <td className="py-1 px-0.5 text-center">
                  <span className="font-bold" style={{ color: isUnder ? C.under : C.muted }}>
                    {formatPerc(l.awayUnderPct)}
                  </span>
                </td>
                <td className="py-1 px-0.5 text-center">
                  <span className="font-bold" style={{ color: isUnder ? C.under : C.muted }}>
                    {formatPerc(l.allUnderPct)}
                  </span>
                </td>
                <td className="py-1 px-0.5 text-center">
                  <span className="font-bold" style={{ color: C.ink }}>{l.line}</span>
                </td>
                <td className="py-1 px-0.5 text-center">
                  <span className="font-bold" style={{ color: !isUnder ? C.over : C.muted }}>
                    {formatPerc(l.homeOverPct)}
                  </span>
                </td>
                <td className="py-1 px-0.5 text-center">
                  <span className="font-bold" style={{ color: !isUnder ? C.over : C.muted }}>
                    {formatPerc(l.awayOverPct)}
                  </span>
                </td>
                <td className="py-1 px-0.5 text-center">
                  <span className="font-bold" style={{ color: !isUnder ? C.over : C.muted }}>
                    {formatPerc(l.allOverPct)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Ligne de stratégie principale ────────────────────────────

function StrategyRow({ match }: { match: StrategyMatch }) {
  const bestUe = match.overUnderLines.length > 0
    ? getBestUnderOver({ team1Name: match.homeName, team2Name: match.awayName, summary: { overUnderLines: match.overUnderLines }, h2h: null, odds1X2: null } as MatchPrematch)
    : null;

  const timeStr = match.scheduledAt ? parisKickoff(match.scheduledAt) : "";
  const dateStr = match.scheduledAt ? parisDayLabel(match.scheduledAt) : "";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-medium" style={{ color: C.muted }}>{match.leagueId}</span>
          <span className="text-xs font-semibold" style={{ color: C.ink }}>{match.homeName}</span>
          <span className="text-[10px]" style={{ color: C.muted }}>vs</span>
          <span className="text-xs font-semibold" style={{ color: C.ink }}>{match.awayName}</span>
        </div>
        <div className="flex items-center gap-2">
          {dateStr && <span className="text-[10px] font-mono" style={{ color: C.muted }}>{dateStr}</span>}
          {timeStr && <span className="text-[10px] font-mono" style={{ color: C.muted }}>{timeStr}</span>}
          {bestUe && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: bestUe.side === "over" ? C.overBg : C.underBg, color: bestUe.side === "over" ? C.over : C.under }}
            >
              {bestUe.side === "over" ? "Sur" : "Sous"} {bestUe.line} ({Math.round(bestUe.pct)}%)
            </span>
          )}
          {match.winner && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: C.winnerBg, color: C.winner }}
            >
              {match.winner.label} ({Math.round(match.winner.pct)}%)
            </span>
          )}
        </div>
      </div>
      <div className="rounded-lg p-2" style={{ backgroundColor: C.soft, border: `1px solid ${C.border}` }}>
        <UnderOverBreakdownTable lines={match.overUnderLines} />
      </div>
    </div>
  );
}

// ─── Section Top buteurs/assists ──────────────────────────────

function PlayerPills({ players, label, icon: Icon, statKey, color }: {
  players: PlayerStat[];
  label: string;
  icon: typeof Target;
  statKey: "g" | "a";
  color: string;
}) {
  const top = players.slice(0, 10);
  if (top.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {top.map((p, i) => (
          <span
            key={`${p.name}-${i}`}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium"
            style={{ backgroundColor: C.soft, border: `1px solid ${C.border}`, color: C.ink }}
          >
            <span style={{ color: C.muted }}>{i + 1}.</span>
            <span className="font-semibold">{p.name}</span>
            <span style={{ color: C.muted }}>{p.team}</span>
            <span className="font-bold" style={{ color }}>{p[statKey]}{statKey === "g" ? "b" : "p"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Composant principal ────────────────────────────────────

export function HockeyStrategies({
  matches,
  prematch,
  playerStats,
  activeLeague,
}: {
  matches: { id: string; homeName: string; awayName: string; oddsH: number | null; oddsD: number | null; oddsA: number | null; scheduledAt: string | null; isLive: boolean; leagueId: string; source: string }[];
  prematch: { leagues: Record<string, { matches: MatchPrematch[] }> } | null;
  playerStats: { leagues: Record<string, { topScorers: PlayerStat[]; topAssists: PlayerStat[] }> } | null;
  activeLeague: LeagueId;
}) {
  const leaguePrematch = prematch?.leagues[activeLeague === "magnus" ? "ligue-magnus" : activeLeague]?.matches ?? [];
  const leaguePlayers = playerStats?.leagues[activeLeague === "magnus" ? "ligue-magnus" : activeLeague];

  const strategyData = useMemo(() => {
    const results: StrategyMatch[] = [];
    for (const match of leaguePrematch) {
      const winner = getWinnerRecommendation(match);
      const hasOverUnder = match.summary?.overUnderLines && match.summary.overUnderLines.length > 0;
      if (winner || hasOverUnder) {
        results.push({
          id: String(match.team1Id) + "-" + String(match.team2Id),
          leagueId: activeLeague,
          homeName: match.team1Name,
          awayName: match.team2Name,
          scheduledAt: match.date ?? null,
          overUnderLines: match.summary?.overUnderLines ?? [],
          winner,
        });
      }
    }
    results.sort((a, b) => {
      const aBest = getBestUnderOver({ team1Name: a.homeName, team2Name: a.awayName, summary: { overUnderLines: a.overUnderLines }, h2h: null, odds1X2: null } as MatchPrematch);
      const bBest = getBestUnderOver({ team1Name: b.homeName, team2Name: b.awayName, summary: { overUnderLines: b.overUnderLines }, h2h: null, odds1X2: null } as MatchPrematch);
      const aPct = aBest?.pct ?? 0;
      const bPct = bBest?.pct ?? 0;
      if (bPct !== aPct) return bPct - aPct;
      return (b.winner?.pct ?? 0) - (a.winner?.pct ?? 0);
    });
    return {
      matches: results.slice(0, 10),
      topScorers: leaguePlayers?.topScorers ?? [],
      topAssists: leaguePlayers?.topAssists ?? [],
    };
  }, [leaguePrematch, leaguePlayers, activeLeague]);

  if (strategyData.matches.length === 0 && strategyData.topScorers.length === 0) {
    return (
      <div className="text-center text-sm py-10" style={{ color: C.muted }}>
        <Search className="w-5 h-5 mx-auto mb-2" style={{ color: C.muted }} />
        Aucune strategie disponible pour {activeLeague.toUpperCase()}.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs mb-1" style={{ color: C.muted }}>
        Strategies {activeLeague.toUpperCase()} — Source: Annabet
      </p>
      <div>
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: C.ink }}>
          <Zap className="w-4 h-4" style={{ color: C.accent }} /> Top 10 — Tableau Under/Over & Winner
        </h3>
        <div className="space-y-3">
          {strategyData.matches.map((m) => (
            <StrategyRow key={m.id} match={m} />
          ))}
        </div>
      </div>
      <PlayerPills players={strategyData.topScorers} label="Buteurs" icon={Target} statKey="g" color={C.over} />
      <PlayerPills players={strategyData.topAssists} label="Assists" icon={Trophy} statKey="a" color={C.winner} />
    </div>
  );
}
