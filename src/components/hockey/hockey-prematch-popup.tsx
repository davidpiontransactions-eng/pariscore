"use client";

/**
 * HockeyPrematchPopup — Popup prematch pour un match hockey.
 * Affiche: 1x2, 12, Total Goals, Goals For/Against, BTTS, Goal Diff, Goal Average, Standings.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { X, TrendingUp, Target, BarChart3, Radar } from "lucide-react";
import { SpiderMatch, computeSpiderMetrics, summarizeStrengths, type TeamStandingForSpider } from "./hockey-spider-match";

type StatBlock = {
  oneXtwo?: {
    homeWins: number;
    draws: number;
    awayWins: number;
    pcts: number[];
    odds: number[];
  };
  oneTwo?: {
    homeWins: number;
    awayWins: number;
    pcts: number[];
    odds: number[];
  };
  totalGoals?: { line: number; underPct: number; overPct: number };
  goalsFor?: { goals: number; pct: number }[];
  goalsAgainst?: { goals: number; pct: number }[];
  btts?: number;
  goalDiff?: { diff: number; pct: number }[];
  goalAverage?: { home: number; away: number; total: number };
};

type Standing = {
  rank: number;
  name: string;
  gp: number;
  all: { w: number; otw: number; otl: number; l: number; pts: number };
  home: { w: number; otw: number; otl: number; l: number; pts: number };
  away: { w: number; otw: number; otl: number; l: number; pts: number };
  highlighted: boolean;
};

type MatchData = {
  team1Name: string;
  team2Name: string;
  odds1X2?: { home: number; draw: number; away: number } | null;
  h2h?: {
    homeTeam: string;
    awayTeam: string;
    date: string;
    summaryHome: StatBlock | null;
    summaryAway: StatBlock | null;
    h2hStats: StatBlock | null;
    standings: Standing[];
  } | null;
  summary?: { overUnderLines: { line: number; underPct: number; overPct: number; underOdds: number; overOdds: number }[] } | null;
};

type HockeyPrematchPopupProps = {
  match: MatchData;
  onClose: () => void;
  /** Standings eliteprospects en fallback si Annabet indisponible */
  standingsOverride?: {
    name: string;
    gp: number;
    w: number;
    t: number;
    l: number;
    otw: number;
    otl: number;
    gf: number;
    ga: number;
    plusMinus: number;
    tp: number;
    ppg: number;
  }[];
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatRow({ label, values, colors }: { label: string; values: string[]; colors?: string[] }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-[10px] text-white/40 w-8 text-right shrink-0">{label}</span>
      <div className="flex gap-1 flex-1">
        {values.map((v, i) => (
          <span
            key={i}
            className={cn("text-xs font-mono", colors?.[i] || "text-white/70")}
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function OddsBadges({ home, draw, away }: { home: number; draw: number; away: number }) {
  return (
    <div className="flex items-center gap-2 justify-center py-1">
      <div className="text-center">
        <div className="text-[10px] text-white/40">1</div>
        <div className="text-sm font-bold text-[#00e676]">{home.toFixed(2)}</div>
      </div>
      <div className="text-center">
        <div className="text-[10px] text-white/40">X</div>
        <div className="text-sm font-bold text-[#ffd93d]">{draw.toFixed(2)}</div>
      </div>
      <div className="text-center">
        <div className="text-[10px] text-white/40">2</div>
        <div className="text-sm font-bold text-[#5fbfff]">{away.toFixed(2)}</div>
      </div>
    </div>
  );
}

function GoalsDistribution({ label, data }: { label: string; data: { goals: number; pct: number }[] }) {
  if (!data || data.length === 0) return null;
  const maxPct = Math.max(...data.map((d) => d.pct));

  return (
    <div>
      <div className="text-[10px] text-white/40 mb-1">{label}</div>
      <div className="flex items-end gap-0.5 h-12">
        {data.map((d) => (
          <div key={d.goals} className="flex-1 flex flex-col items-center gap-0.5">
            <span className="text-[8px] text-white/30">{d.pct}%</span>
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${maxPct > 0 ? (d.pct / maxPct) * 32 : 0}px`,
                backgroundColor: d.pct > 0 ? "rgba(0,230,118,0.6)" : "transparent",
              }}
            />
            <span className="text-[8px] text-white/50">{d.goals === 6 ? "6+" : d.goals}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalDiffBars({ data }: { data: { diff: number; pct: number }[] }) {
  if (!data || data.length === 0) return null;
  const maxPct = Math.max(...data.map((d) => d.pct));

  return (
    <div className="space-y-0.5">
      {data.map((d) => (
        <div key={d.diff} className="flex items-center gap-2">
          <span className={cn("text-[10px] w-6 text-right font-mono",
            d.diff > 0 ? "text-[#00e676]" : d.diff < 0 ? "text-red-400" : "text-[#ffd93d]"
          )}>
            {d.diff > 0 ? "+" : ""}{d.diff}
          </span>
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${maxPct > 0 ? (d.pct / maxPct) * 100 : 0}%`,
                backgroundColor: d.diff > 0 ? "#00e676" : d.diff < 0 ? "#ff6b6b" : "#ffd93d",
              }}
            />
          </div>
          <span className="text-[10px] text-white/40 w-8">{d.pct}%</span>
        </div>
      ))}
    </div>
  );
}

function StandingsTable({ standings }: { standings: Standing[] }) {
  if (!standings || standings.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-white/40 border-b border-white/10">
            <th className="py-1 px-1 text-left w-6">#</th>
            <th className="py-1 px-1 text-left">Team</th>
            <th className="py-1 px-1 text-center">GP</th>
            <th className="py-1 px-1 text-center">W</th>
            <th className="py-1 px-1 text-center">OTW</th>
            <th className="py-1 px-1 text-center">OTL</th>
            <th className="py-1 px-1 text-center">L</th>
            <th className="py-1 px-1 text-center font-bold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((t) => (
            <tr
              key={t.name}
              className={cn(
                "border-b border-white/5",
                t.highlighted && "bg-[#00e676]/10"
              )}
            >
              <td className="py-0.5 px-1 text-white/40">{t.rank}</td>
              <td className={cn("py-0.5 px-1 font-semibold", t.highlighted ? "text-[#00e676]" : "text-white/80")}>
                {t.name}
              </td>
              <td className="py-0.5 px-1 text-center text-white/50">{t.gp}</td>
              <td className="py-0.5 px-1 text-center text-white/60">{t.all.w}</td>
              <td className="py-0.5 px-1 text-center text-white/50">{t.all.otw}</td>
              <td className="py-0.5 px-1 text-center text-white/50">{t.all.otl}</td>
              <td className="py-0.5 px-1 text-center text-white/50">{t.all.l}</td>
              <td className="py-0.5 px-1 text-center font-bold text-[#5fbfff]">{t.all.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatBlockView({ block, title }: { block: StatBlock | null; title: string }) {
  if (!block) return null;

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold text-white/60 uppercase tracking-wider">{title}</div>

      {/* 1x2 */}
      {block.oneXtwo && (
        <div className="bg-white/5 rounded-md p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/40">1X2</span>
            <span className="text-[10px] text-white/30">
              {block.oneXtwo.homeWins}W-{block.oneXtwo.draws}D-{block.oneXtwo.awayWins}L
            </span>
          </div>
          <OddsBadges
            home={block.oneXtwo.odds[0]}
            draw={block.oneXtwo.odds[1]}
            away={block.oneXtwo.odds[2]}
          />
          <div className="flex justify-center gap-3 text-[10px] text-white/40">
            <span>{block.oneXtwo.pcts[0]}%</span>
            <span>{block.oneXtwo.pcts[1]}%</span>
            <span>{block.oneXtwo.pcts[2]}%</span>
          </div>
        </div>
      )}

      {/* 12 */}
      {block.oneTwo && (
        <div className="bg-white/5 rounded-md p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/40">12 (Home/Away)</span>
            <span className="text-[10px] text-white/30">
              {block.oneTwo.homeWins}W-{block.oneTwo.awayWins}L
            </span>
          </div>
          <div className="flex justify-center gap-4">
            <div className="text-center">
              <div className="text-[10px] text-white/40">1</div>
              <div className="text-sm font-bold text-[#00e676]">{block.oneTwo.odds[0].toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-white/40">2</div>
              <div className="text-sm font-bold text-[#5fbfff]">{block.oneTwo.odds[1].toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Total Goals */}
      {block.totalGoals && (
        <div className="bg-white/5 rounded-md p-2 text-center">
          <span className="text-[10px] text-white/40">Total Goals U/O </span>
          <span className="text-xs font-bold text-[#5fbfff]">{block.totalGoals.line}</span>
          <span className="text-[10px] text-white/30"> : {block.totalGoals.underPct}% - {block.totalGoals.overPct}%</span>
        </div>
      )}

      {/* Goals Distribution */}
      <div className="grid grid-cols-2 gap-2">
        <GoalsDistribution label="Goals For" data={block.goalsFor || []} />
        <GoalsDistribution label="Goals Against" data={block.goalsAgainst || []} />
      </div>

      {/* BTTS */}
      {block.btts !== undefined && (
        <div className="text-center text-[10px] text-white/40">
          Both Teams To Score: <span className="text-[#00e676] font-bold">{block.btts}%</span>
        </div>
      )}

      {/* Goal Difference */}
      {block.goalDiff && block.goalDiff.length > 0 && (
        <GoalDiffBars data={block.goalDiff} />
      )}

      {/* Goal Average */}
      {block.goalAverage && (
        <div className="text-center text-[10px] text-white/40">
          Goal Average: <span className="text-[#5fbfff] font-bold">{block.goalAverage.home} - {block.goalAverage.away}</span>
          <span className="text-white/30"> ({block.goalAverage.total})</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function HockeyPrematchPopup({ match, onClose, standingsOverride }: HockeyPrematchPopupProps) {
  const [tab, setTab] = useState<"home" | "away" | "h2h" | "standings" | "spider">("home");

  const h2h = match.h2h;
  const summaryHome = h2h?.summaryHome || null;
  const summaryAway = h2h?.summaryAway || null;
  const h2hStats = h2h?.h2hStats || null;
  const standings = h2h?.standings || [];

  // Spider match: calculer les métriques depuis les standings (Annabet OU eliteprospects)
  const spiderData = useMemo(() => {
    // Normaliser les standings depuis les deux sources
    type NormalizedStanding = {
      name: string; gp: number; w: number; l: number;
      otw: number; otl: number; gf: number; ga: number; tp: number;
    };

    type EPStanding = {
      name: string; gp: number; w: number; t: number; l: number;
      otw: number; otl: number; gf: number; ga: number;
      plusMinus: number; tp: number; ppg: number;
    };

    const normalizeFromAnnabet = (s: typeof standings[0]): NormalizedStanding => ({
      name: s.name, gp: s.gp, w: s.all.w, l: s.all.l,
      otw: s.all.otw, otl: s.all.otl, gf: 0, ga: 0, tp: s.all.pts,
    });

    const normalizeFromEP = (s: EPStanding): NormalizedStanding => ({
      name: s.name, gp: s.gp, w: s.w, l: s.l,
      otw: s.otw, otl: s.otl, gf: s.gf, ga: s.ga, tp: s.tp,
    });

    // Source 1: standings Annabet (si dispo)
    let sourceStandings: NormalizedStanding[] = [];
    if (standings.length >= 2) {
      sourceStandings = standings.map(normalizeFromAnnabet);
    }
    // Source 2: fallback eliteprospects
    if (sourceStandings.length < 2 && standingsOverride && standingsOverride.length >= 2) {
      sourceStandings = standingsOverride.map(normalizeFromEP);
    }
    if (sourceStandings.length < 2) return null;

    const findTeam = (name: string) => sourceStandings.find(
      (s) => s.name === name || s.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(s.name.toLowerCase())
    );
    const homeS = findTeam(match.team1Name);
    const awayS = findTeam(match.team2Name);
    if (!homeS || !awayS) return null;

    const toSpider = (s: NormalizedStanding): TeamStandingForSpider => ({
      name: s.name,
      gp: s.gp,
      w: s.w,
      t: s.otw + s.otl,
      l: s.l,
      otw: s.otw,
      otl: s.otl,
      gf: s.gf || Math.round((s.w * 2.8 + s.otw * 2.5) * s.gp / Math.max(s.gp, 1)),
      ga: s.ga || Math.round((s.l * 2.8 + s.otl * 2.5) * s.gp / Math.max(s.gp, 1)),
      tp: s.tp,
    });

    const homeForSpider = toSpider(homeS);
    const awayForSpider = toSpider(awayS);
    const metrics = computeSpiderMetrics(homeForSpider, awayForSpider);
    const summary = summarizeStrengths(metrics);
    return { metrics, summary, homeTeam: match.team1Name, awayTeam: match.team2Name };
  }, [standings, standingsOverride, match.team1Name, match.team2Name]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0a1628] border border-white/10 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-[#00e676]" />
            <div>
              <h3 className="text-sm font-bold text-white">
                {match.team1Name} vs {match.team2Name}
              </h3>
              {h2h?.date && (
                <span className="text-[10px] text-white/40">{h2h.date}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-md transition-colors">
            <X className="w-4 h-4 text-white/40" />
          </button>
        </div>

        {/* Odds bar */}
        {match.odds1X2 && (
          <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02]">
            <OddsBadges home={match.odds1X2.home} draw={match.odds1X2.draw} away={match.odds1X2.away} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5 overflow-x-auto">
          {(["home", "away", "h2h", "standings", "spider"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap",
                tab === t ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
              )}
            >
              {t === "home" ? match.team1Name : t === "away" ? match.team2Name : t === "h2h" ? "H2H" : t === "standings" ? "Classement" : "⚔ Spider"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === "home" && <StatBlockView block={summaryHome} title={`Derniers 30 matchs — ${match.team1Name}`} />}
          {tab === "away" && <StatBlockView block={summaryAway} title={`Derniers 30 matchs — ${match.team2Name}`} />}
          {tab === "h2h" && <StatBlockView block={h2hStats} title="Confrontations directes" />}
          {tab === "standings" && (
            <div>
              <div className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-2">Classement</div>
              <StandingsTable standings={standings} />
            </div>
          )}
          {tab === "spider" && spiderData && (
            <div className="space-y-4">
              <div className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-2">
                ⚔ Spider Match — Forces & Faiblesses
              </div>
              <SpiderMatch
                homeTeam={spiderData.homeTeam}
                awayTeam={spiderData.awayTeam}
                metrics={spiderData.metrics}
                height={300}
              />
              {/* Résumé forces/faiblesses */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-[#00e676]/5 border border-[#00e676]/10 rounded-lg p-3">
                  <div className="text-[10px] font-bold text-[#00e676] mb-1.5">🟢 {spiderData.homeTeam}</div>
                  <div className="space-y-1">
                    {spiderData.summary.homeStrengths.length > 0 && (
                      <div className="text-[10px]">
                        <span className="text-white/40">Forces: </span>
                        <span className="text-[#00e676]">{spiderData.summary.homeStrengths.join(", ")}</span>
                      </div>
                    )}
                    {spiderData.summary.homeWeaknesses.length > 0 && (
                      <div className="text-[10px]">
                        <span className="text-white/40">Faiblesses: </span>
                        <span className="text-red-400">{spiderData.summary.homeWeaknesses.join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-[#448aff]/5 border border-[#448aff]/10 rounded-lg p-3">
                  <div className="text-[10px] font-bold text-[#448aff] mb-1.5">🔵 {spiderData.awayTeam}</div>
                  <div className="space-y-1">
                    {spiderData.summary.awayStrengths.length > 0 && (
                      <div className="text-[10px]">
                        <span className="text-white/40">Forces: </span>
                        <span className="text-[#448aff]">{spiderData.summary.awayStrengths.join(", ")}</span>
                      </div>
                    )}
                    {spiderData.summary.awayWeaknesses.length > 0 && (
                      <div className="text-[10px]">
                        <span className="text-white/40">Faiblesses: </span>
                        <span className="text-red-400">{spiderData.summary.awayWeaknesses.join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-center text-[10px] text-white/40 mt-2 italic">
                {spiderData.summary.verdict}
              </div>
            </div>
          )}
          {tab === "spider" && !spiderData && (
            <div className="text-center py-8 text-white/30 text-xs">
              Données insuffisantes pour le Spider Match (standings requis)
            </div>
          )}
        </div>

        {/* Summary table */}
        {match.summary?.overUnderLines && match.summary.overUnderLines.length > 0 && (
          <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02]">
            <div className="text-[10px] text-white/40 mb-1">Total Goals Under/Over</div>
            <div className="flex gap-2 flex-wrap">
              {match.summary.overUnderLines.map((l) => (
                <div key={l.line} className="text-[10px] bg-white/5 rounded px-2 py-1">
                  <span className="text-[#5fbfff] font-bold">{l.line}</span>
                  <span className="text-white/30"> U:{l.underPct}% O:{l.overPct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
