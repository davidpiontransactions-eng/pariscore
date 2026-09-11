"use client";

/**
 * Onglet Hockey PariScore.
 * - NHL : Standings projections (hockeystats.com)
 * - KHL : Standings + Top joueurs (eliteprospects.com)
 * - Ligue Magnus : Standings + Top joueurs (eliteprospects.com)
 * - Projection graph pour chaque ligue
 */

import { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Trophy, TrendingUp, Flame, Info, BarChart3, Users, FileText } from "lucide-react";
import { HockeyProjectionGraph } from "./hockey-projection-graph";
import { HockeyTopPlayers } from "./hockey-top-players";
import { HockeyPrematchPopup } from "./hockey-prematch-popup";
import { useHockeyPrematch, type MatchPrematch } from "@/hooks/use-hockey-prematch";

// ─── Types ───────────────────────────────────────────────────────────────────

type TeamProjection = {
  id: string;
  abbr: string;
  name: string;
  logoUrl: string;
  conf: "west" | "east";
  div: string;
  winR1: number;
  winR2: number;
  makeFinal: number;
  winCup: number;
};

type ProjectionsData = {
  updatedAt: string;
  source: string;
  season: string;
  conferences: { west: TeamProjection[]; east: TeamProjection[] };
  teams: TeamProjection[];
};

type TeamStanding = {
  rank: number;
  name: string;
  teamId: string | null;
  teamSlug: string | null;
  conf: string;
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
};

type LeagueData = {
  name: string;
  country: string;
  season: string;
  teams: TeamStanding[];
};

type StandingsPayload = {
  updatedAt: string;
  source: string;
  season: string;
  leagues: Record<string, LeagueData>;
};

type PlayerStat = {
  rank: number;
  name: string;
  position: string;
  playerId: string | null;
  playerSlug: string | null;
  photoUrl: string | null;
  team: string;
  gp: number;
  g: number;
  a: number;
  tp: number;
  ppg: number;
  pim: number;
  plusMinus: number;
};

type PlayerStatsPayload = {
  updatedAt: string;
  source: string;
  season: string;
  leagues: Record<string, {
    name: string;
    season: string;
    players: PlayerStat[];
    topScorers: PlayerStat[];
    topAssists: PlayerStat[];
    topPoints: PlayerStat[];
  }>;
};

// ─── League selector ─────────────────────────────────────────────────────────

type LeagueId = "nhl" | "khl" | "magnus";

const LEAGUES: { id: LeagueId; label: string; flag: string }[] = [
  { id: "nhl", label: "NHL", flag: "🇺🇸" },
  { id: "khl", label: "KHL", flag: "🇷🇺" },
  { id: "magnus", label: "Magnus", flag: "🇫🇷" },
];

type SubView = "standings" | "projection" | "top10" | "prematch";

const SEASON_LENGTHS: Record<LeagueId, number> = {
  nhl: 82,
  khl: 68,
  magnus: 44,
};

// ─── NHL Helpers ─────────────────────────────────────────────────────────────

const DIVISIONS: Record<string, string[]> = {
  west: ["PAC", "CEN", "WC"],
  east: ["MET", "ATL", "WC"],
};

const DIV_LABELS: Record<string, string> = {
  PAC: "Pacific", CEN: "Central", WC: "Wild Card",
  MET: "Metropolitan", ATL: "Atlantic",
};

function getOddsColor(value: number): string {
  if (value >= 100) return "bg-[#5fbfff] text-[#0a1628]";
  if (value >= 75) return "bg-[#3d8fd9] text-white";
  if (value >= 50) return "bg-[#2563eb] text-white";
  if (value >= 25) return "bg-[#1e40af] text-white/90";
  if (value > 0) return "bg-[#1e3a5f] text-white/70";
  return "bg-white/5 text-white/40";
}

function getPointsColor(tp: number, gp: number): string {
  if (gp === 0) return "text-white/40";
  const ppg = tp / gp;
  if (ppg >= 1.8) return "text-[#00e676]";
  if (ppg >= 1.5) return "text-[#5fbfff]";
  if (ppg >= 1.2) return "text-white";
  return "text-white/40";
}

// ─── NHL Components ──────────────────────────────────────────────────────────

function OddsBadge({ value, label }: { value: number; label: string }) {
  return (
    <td className="py-1 px-1 text-center" title={`${label}: ${value}%`}>
      <div className={cn("text-xs font-bold py-0.5 px-1.5 rounded-sm w-11 mx-auto flex items-center justify-center", getOddsColor(value))}>
        {value}%
      </div>
    </td>
  );
}

function NhlTeamRow({ team }: { team: TeamProjection }) {
  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
      <td className="py-1.5 px-2">
        <div className="flex items-center gap-2">
          <img src={team.logoUrl} alt="" className="w-6 h-6 object-contain" loading="lazy" />
          <span className="text-sm font-semibold text-white">{team.abbr}</span>
        </div>
      </td>
      <OddsBadge value={team.winR1} label={`${team.name} R1`} />
      <OddsBadge value={team.winR2} label={`${team.name} R2`} />
      <OddsBadge value={team.makeFinal} label={`${team.name} Final`} />
      <OddsBadge value={team.winCup} label={`${team.name} Cup`} />
    </tr>
  );
}

function NhlDivisionSection({ teams, division }: { teams: TeamProjection[]; division: string }) {
  if (teams.length === 0) return null;
  return (
    <tbody>
      <tr><td colSpan={5} className="py-1.5 px-2 text-xs font-bold text-white/60 uppercase tracking-wider bg-white/5">{DIV_LABELS[division] || division}</td></tr>
      {teams.map((t) => <NhlTeamRow key={t.id} team={t} />)}
    </tbody>
  );
}

function NhlConferenceTable({ conf, teams }: { conf: "west" | "east"; teams: TeamProjection[] }) {
  const label = conf === "west" ? "Western Conference" : "Eastern Conference";
  const grouped = useMemo(() => {
    const r: Record<string, TeamProjection[]> = {};
    for (const d of DIVISIONS[conf]) r[d] = teams.filter((t) => t.div === d);
    return r;
  }, [conf, teams]);

  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Trophy className="w-4 h-4 text-[#00e676]" /> {label}</h3>
      <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/10 text-[10px] uppercase text-white/50">
            <th className="py-1.5 px-2 text-left">Team</th>
            <th className="py-1.5 px-1 text-center">R1</th>
            <th className="py-1.5 px-1 text-center">R2</th>
            <th className="py-1.5 px-1 text-center">Final</th>
            <th className="py-1.5 px-1 text-center">Cup</th>
          </tr></thead>
          {DIVISIONS[conf].map((d) => <NhlDivisionSection key={d} division={d} teams={grouped[d] || []} />)}
        </table>
      </div>
    </div>
  );
}

// ─── Standings Table (KHL / Magnus) ──────────────────────────────────────────

function StandingsTable({ league }: { league: LeagueData }) {
  const teams = useMemo(() => {
    const confs = new Map<string, TeamStanding[]>();
    for (const t of league.teams) {
      const c = t.conf || "default";
      if (!confs.has(c)) confs.set(c, []);
      confs.get(c)!.push(t);
    }
    if (confs.size <= 1) return [{ conf: "", teams: league.teams.sort((a, b) => a.rank - b.rank) }];
    return Array.from(confs.entries()).map(([conf, t]) => ({ conf, teams: t.sort((a, b) => a.rank - b.rank) }));
  }, [league]);

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.02]">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-white/10 text-[10px] uppercase text-white/50">
          <th className="py-1.5 px-2 text-left w-8">#</th>
          <th className="py-1.5 px-2 text-left">Team</th>
          <th className="py-1.5 px-1 text-center">GP</th>
          <th className="py-1.5 px-1 text-center">W</th>
          <th className="py-1.5 px-1 text-center">L</th>
          <th className="py-1.5 px-1 text-center">OTW</th>
          <th className="py-1.5 px-1 text-center">OTL</th>
          <th className="py-1.5 px-1 text-center">GF</th>
          <th className="py-1.5 px-1 text-center">GA</th>
          <th className="py-1.5 px-1 text-center">+/-</th>
          <th className="py-1.5 px-1 text-center font-bold">TP</th>
          <th className="py-1.5 px-1 text-center">PPG</th>
        </tr></thead>
        {teams.map(({ conf, teams: confTeams }) => (
          <tbody key={conf || "all"}>
            {conf && <tr><td colSpan={12} className="py-1.5 px-2 text-xs font-bold text-white/60 uppercase tracking-wider bg-white/5">{conf}</td></tr>}
            {confTeams.map((t) => (
              <tr key={t.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="py-1.5 px-2 text-white/40 text-xs">{t.rank}</td>
                <td className="py-1.5 px-2"><span className="text-sm font-semibold text-white">{t.name}</span></td>
                <td className="py-1.5 px-1 text-center text-white/60">{t.gp}</td>
                <td className="py-1.5 px-1 text-center text-white/70">{t.w}</td>
                <td className="py-1.5 px-1 text-center text-white/50">{t.l}</td>
                <td className="py-1.5 px-1 text-center text-white/60">{t.otw}</td>
                <td className="py-1.5 px-1 text-center text-white/50">{t.otl}</td>
                <td className="py-1.5 px-1 text-center text-white/60">{t.gf}</td>
                <td className="py-1.5 px-1 text-center text-white/50">{t.ga}</td>
                <td className={cn("py-1.5 px-1 text-center text-xs", t.plusMinus > 0 ? "text-[#00e676]" : t.plusMinus < 0 ? "text-red-400" : "text-white/40")}>
                  {t.plusMinus > 0 ? "+" : ""}{t.plusMinus}
                </td>
                <td className={cn("py-1.5 px-1 text-center font-bold", getPointsColor(t.tp, t.gp))}>{t.tp}</td>
                <td className="py-1.5 px-1 text-center text-white/60">{t.ppg.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

// ─── Spotlights ──────────────────────────────────────────────────────────────

function NhlSpotlight({ teams }: { teams: TeamProjection[] }) {
  const top = useMemo(() => [...teams].sort((a, b) => b.winCup - a.winCup)[0], [teams]);
  if (!top || top.winCup === 0) return null;
  return (
    <div className="rounded-xl border border-[#00e676]/30 bg-[#00e676]/5 p-4 mb-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#00e676]/20 flex items-center justify-center"><Flame className="w-5 h-5 text-[#00e676]" /></div>
        <div>
          <p className="text-xs text-white/50 uppercase tracking-wider">Stanley Cup Favorite</p>
          <p className="text-sm font-bold text-white">{top.name} — <span className="text-[#00e676]">{top.winCup}%</span></p>
        </div>
      </div>
    </div>
  );
}

function KhlSpotlight({ teams }: { teams: TeamStanding[] }) {
  const top = useMemo(() => [...teams].sort((a, b) => b.ppg - a.ppg || b.tp - a.tp)[0], [teams]);
  if (!top || top.gp === 0) return null;
  return (
    <div className="rounded-xl border border-[#00e676]/30 bg-[#00e676]/5 p-4 mb-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#00e676]/20 flex items-center justify-center"><Trophy className="w-5 h-5 text-[#00e676]" /></div>
        <div>
          <p className="text-xs text-white/50 uppercase tracking-wider">KHL Leader</p>
          <p className="text-sm font-bold text-white">{top.name} — <span className="text-[#00e676]">{top.tp} pts</span> ({top.ppg.toFixed(2)} PPG)</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function HockeyTabContent() {
  const [activeLeague, setActiveLeague] = useState<LeagueId>("nhl");
  const [subView, setSubView] = useState<SubView>("standings");
  const [projections, setProjections] = useState<ProjectionsData | null>(null);
  const [standings, setStandings] = useState<StandingsPayload | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStatsPayload | null>(null);
  const [loadingProj, setLoadingProj] = useState(true);
  const [loadingStand, setLoadingStand] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const { prematch } = useHockeyPrematch();
  const [selectedMatch, setSelectedMatch] = useState<MatchPrematch | null>(null);

  useEffect(() => {
    fetch("/api/hockey/projections")
      .then((r) => r.ok ? r.json() : fetch("/data/hockeystats_nhl_projections.json").then((r2) => r2.json()))
      .then((data: ProjectionsData) => { setProjections(data); setLoadingProj(false); })
      .catch(() => setLoadingProj(false));
  }, []);

  useEffect(() => {
    fetch("/api/hockey/standings")
      .then((r) => r.ok ? r.json() : null)
      .then((data: StandingsPayload | null) => { setStandings(data); setLoadingStand(false); })
      .catch(() => setLoadingStand(false));
  }, []);

  useEffect(() => {
    fetch("/api/hockey/player-stats")
      .then((r) => r.ok ? r.json() : null)
      .then((data: PlayerStatsPayload | null) => { setPlayerStats(data); setLoadingPlayers(false); })
      .catch(() => setLoadingPlayers(false));
  }, []);

  const westTeams = useMemo(() => projections?.conferences.west ?? [], [projections]);
  const eastTeams = useMemo(() => projections?.conferences.east ?? [], [projections]);
  const khlData = standings?.leagues?.khl;
  const magnusData = standings?.leagues?.["ligue-magnus"];
  const khlPlayers = playerStats?.leagues?.khl;
  const nhlPlayers = playerStats?.leagues?.nhl;
  const magnusPlayers = playerStats?.leagues?.["ligue-magnus"];

  const loading = activeLeague === "nhl" ? loadingProj : (loadingStand || loadingPlayers);

  // Donnees pour projection graph
  const projectionTeams = activeLeague === "nhl"
    ? [...westTeams, ...eastTeams].map((t) => ({ rank: 0, name: t.abbr, gp: 0, tp: 0, ppg: 0 }))
    : activeLeague === "khl"
    ? khlData?.teams ?? []
    : magnusData?.teams ?? [];

  // Joueurs pour top 10
  const players = activeLeague === "nhl" ? nhlPlayers : activeLeague === "khl" ? khlPlayers : magnusPlayers;

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-16 sm:px-5">
      {/* Header */}
      <div className="pt-6 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#00e676]" /> Hockey
          </h2>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            {LEAGUES.map((l) => (
              <button key={l.id} onClick={() => setActiveLeague(l.id)}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  activeLeague === l.id ? "bg-[#00e676] text-[#0a1628]" : "text-white/60 hover:text-white hover:bg-white/10"
                )}>
                <span className="mr-1">{l.flag}</span>{l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-views */}
        <div className="flex items-center gap-1 mt-3">
          <button onClick={() => setSubView("standings")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              subView === "standings" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
            )}>
            <Trophy className="w-3.5 h-3.5" /> Classement
          </button>
          <button onClick={() => setSubView("projection")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              subView === "projection" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
            )}>
            <BarChart3 className="w-3.5 h-3.5" /> Projection
          </button>
          <button onClick={() => setSubView("top10")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              subView === "top10" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
            )}>
            <Users className="w-3.5 h-3.5" /> Top 10
          </button>
          <button onClick={() => setSubView("prematch")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              subView === "prematch" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
            )}>
            <FileText className="w-3.5 h-3.5" /> Pré-match
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-48" />
          <div className="h-64 bg-white/5 rounded-lg" />
        </div>
      )}

      {/* ─── NHL ──────────────────────────────────────────────────────── */}
      {!loading && activeLeague === "nhl" && (
        <>
          {subView === "standings" && projections && (
            <>
              <p className="text-xs text-white/40 mb-3">
                Saison {projections.season} — Source: {projections.source} — {new Date(projections.updatedAt).toLocaleDateString("fr-FR")}
              </p>
              <NhlSpotlight teams={[...westTeams, ...eastTeams]} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NhlConferenceTable conf="west" teams={westTeams} />
                <NhlConferenceTable conf="east" teams={eastTeams} />
              </div>
            </>
          )}
          {subView === "projection" && (
            <HockeyProjectionGraph teams={projectionTeams} leagueName="NHL" seasonLength={SEASON_LENGTHS.nhl} />
          )}
          {subView === "top10" && nhlPlayers && (
            <HockeyTopPlayers topScorers={nhlPlayers.topScorers} topAssists={nhlPlayers.topAssists} topPoints={nhlPlayers.topPoints} leagueName="NHL" />
          )}
          {subView === "top10" && !nhlPlayers && (
            <div className="text-center text-white/40 text-sm py-8">Stats NHL indisponibles — saison pas encore commencee</div>
          )}
        </>
      )}

      {/* ─── KHL ──────────────────────────────────────────────────────── */}
      {!loading && activeLeague === "khl" && (
        <>
          {subView === "standings" && khlData && (
            <>
              <p className="text-xs text-white/40 mb-3">
                Saison {khlData.season} — Source: {standings?.source} — {new Date(standings?.updatedAt ?? "").toLocaleDateString("fr-FR")}
              </p>
              <KhlSpotlight teams={khlData.teams} />
              <StandingsTable league={khlData} />
            </>
          )}
          {subView === "projection" && khlData && (
            <HockeyProjectionGraph teams={khlData.teams} leagueName="KHL" seasonLength={SEASON_LENGTHS.khl} />
          )}
          {subView === "top10" && khlPlayers && (
            <HockeyTopPlayers topScorers={khlPlayers.topScorers} topAssists={khlPlayers.topAssists} topPoints={khlPlayers.topPoints} leagueName="KHL" />
          )}
        </>
      )}

      {/* ─── MAGNUS ───────────────────────────────────────────────────── */}
      {!loading && activeLeague === "magnus" && (
        <>
          {subView === "standings" && magnusData && (
            <>
              <p className="text-xs text-white/40 mb-3">
                Saison {magnusData.season} — Source: {standings?.source} — {new Date(standings?.updatedAt ?? "").toLocaleDateString("fr-FR")}
              </p>
              {magnusData.teams[0]?.gp === 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 mb-4">
                  <p className="text-sm text-white/50 text-center">La saison Ligue Magnus 2026-27 n&apos;a pas encore commence.</p>
                </div>
              )}
              <StandingsTable league={magnusData} />
            </>
          )}
          {subView === "projection" && magnusData && (
            <HockeyProjectionGraph teams={magnusData.teams} leagueName="Ligue Magnus" seasonLength={SEASON_LENGTHS.magnus} />
          )}
          {subView === "top10" && magnusPlayers && (
            <HockeyTopPlayers topScorers={magnusPlayers.topScorers} topAssists={magnusPlayers.topAssists} topPoints={magnusPlayers.topPoints} leagueName="Magnus" />
          )}
          {subView === "top10" && !magnusPlayers && (
            <div className="text-center text-white/40 text-sm py-8">Stats Magnus indisponibles — saison pas encore commencee</div>
          )}
        </>
      )}

      {/* Error */}
      {!loading && activeLeague !== "nhl" && !standings && (
        <div className="text-center text-white/50 text-sm py-10">
          <Info className="w-5 h-5 mx-auto mb-2 text-white/30" />
          Donnees indisponibles. Lancez les scrapers.
        </div>
      )}

      {/* ─── PREMATCH ────────────────────────────────────────────────── */}
      {!loading && subView === "prematch" && (
        <>
          {prematch?.leagues?.[activeLeague]?.matches?.length ? (
            <div className="space-y-2">
              <p className="text-xs text-white/40 mb-3">
                Source: annabet.com — {prematch.leagues[activeLeague].matches.length} matchs à venir
              </p>
              {prematch.leagues[activeLeague].matches.map((m, i) => (
                <button
                  key={`${m.team1Id}-${m.team2Id}-${i}`}
                  onClick={() => setSelectedMatch(m)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">{m.team1Name}</span>
                    <span className="text-xs text-white/30">vs</span>
                    <span className="text-sm font-semibold text-white">{m.team2Name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {m.odds1X2 && (
                      <div className="flex gap-2 text-[10px]">
                        <span className="text-[#00e676]">{m.odds1X2.home.toFixed(2)}</span>
                        <span className="text-[#ffd93d]">{m.odds1X2.draw.toFixed(2)}</span>
                        <span className="text-[#5fbfff]">{m.odds1X2.away.toFixed(2)}</span>
                      </div>
                    )}
                    {m.h2h ? (
                      <span className="text-[10px] text-[#00e676]">✓ Stats</span>
                    ) : m.error ? (
                      <span className="text-[10px] text-red-400">✗ Erreur</span>
                    ) : (
                      <span className="text-[10px] text-white/30">—</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center text-white/50 text-sm py-10">
              <FileText className="w-5 h-5 mx-auto mb-2 text-white/30" />
              {prematch?.leagues?.[activeLeague]?.error
                ? "Erreur de chargement — IP potentiellement bloquee par Annabet"
                : "Aucun match prematch disponible. Lancez scrape-annabet-hockey-prematch.mjs"}
            </div>
          )}
        </>
      )}

      {/* Prematch Popup */}
      {selectedMatch && (
        <HockeyPrematchPopup
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
          standingsOverride={standings?.leagues?.[activeLeague]?.teams ?? []}
        />
      )}
    </div>
  );
}
