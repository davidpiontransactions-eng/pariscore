"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

type PlayerDetail = {
  id: string;
  name: string;
  nationality?: string;
  ranking?: number;
  eloRating: number;
  winPct: number;
  centuryRate: number;
  deciderWinPct: number;
  avgBreak: number;
  photoUrl?: string;
  cuetrackerUrl: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  centuries: number;
  maxBreak: number | null;
  winStreak: number;
  lossStreak: number;
  formLast10: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type PlayerListItem = {
  id: string;
  name: string;
  eloRating: number;
  winPct: number;
  centuryRate: number;
  deciderWinPct: number;
  avgBreak: number;
};

/* ─── Power Score Ring ──────────────────────────────────────────────────── */
function PowerScoreRing({ score }: { score: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const offset = c - (pct / 100) * c;

  const grade =
    score >= 80 ? { label: "ÉLITE", color: "#00985f", glow: "rgba(0,152,95,.35)" }
    : score >= 60 ? { label: "SOLID", color: "#3b82f6", glow: "rgba(59,130,246,.3)" }
    : score >= 40 ? { label: "MOYEN", color: "#f59e0b", glow: "rgba(245,158,11,.3)" }
    : { label: "FAIBLE", color: "#ef4444", glow: "rgba(239,68,68,.3)" };

  return (
    <div className="relative flex flex-col items-center">
      {/* Glow ring */}
      <div
        className="absolute top-1/2 h-[110px] w-[110px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle, ${grade.glow} 0%, transparent 70%)`,
          filter: "blur(20px)",
        }}
      />
      <div className="relative">
        <svg width="110" height="110" viewBox="0 0 110 110" className="-rotate-90 drop-shadow-lg">
          {/* Track */}
          <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(0,0,0,.06)" strokeWidth="9" />
          {/* Progress */}
          <circle
            cx="55"
            cy="55"
            r={r}
            fill="none"
            stroke={grade.color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${grade.glow})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold tabular-nums" style={{ color: grade.color }}>
            {score}
          </span>
          <span className="mt-0.5 rounded-full bg-black/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
            {grade.label}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── 3D Stat Card ──────────────────────────────────────────────────────── */
function StatCard3D({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-white/60 p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
      style={{
        background: "linear-gradient(145deg, #ffffff 0%, #f8fafb 100%)",
        boxShadow: "4px 4px 12px rgba(0,0,0,.07), -2px -2px 8px rgba(255,255,255,.9), inset 0 1px 0 rgba(255,255,255,.8)",
      }}
    >
      {/* Top accent line */}
      <div className="absolute left-0 top-0 h-[3px] w-full rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="mb-2 flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: `${color}15`, color }}
        >
          {icon}
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-extrabold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

/* ─── 3D Progress Bar ───────────────────────────────────────────────────── */
function ProgressBar3D({
  label,
  value,
  max = 100,
  color,
  suffix = "%",
  rank,
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
  suffix?: string;
  rank?: number | null;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="group">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-600">{label}</span>
        <div className="flex items-center gap-1.5">
          {rank != null && (
            <span
              className="rounded px-1 py-0.5 text-[9px] font-bold tabular-nums"
              style={{
                background: rank <= 10 ? "linear-gradient(135deg, #fbbf24, #f59e0b)" : rank <= 50 ? "rgba(0,0,0,.06)" : "transparent",
                color: rank <= 10 ? "#78350f" : rank <= 50 ? "#64748b" : "#9ca3af",
              }}
            >
              #{rank}
            </span>
          )}
          <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-[11px] font-bold tabular-nums" style={{ color }}>
            {value.toFixed(1)}{suffix}
          </span>
        </div>
      </div>
      <div
        className="relative h-3 w-full overflow-hidden rounded-full"
        style={{
          background: "linear-gradient(180deg, #e9ecef 0%, #f1f3f5 100%)",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,.12), 0 1px 0 rgba(255,255,255,.8)",
        }}
      >
        {/* 3D fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(180deg, ${color}dd 0%, ${color} 50%, ${color}cc 100%)`,
            boxShadow: `inset 0 -1px 2px rgba(0,0,0,.2), inset 0 1px 1px rgba(255,255,255,.4), 0 0 8px ${color}40`,
          }}
        />
        {/* Shine */}
        <div
          className="absolute inset-y-0 left-0 rounded-full opacity-40"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(180deg, rgba(255,255,255,.5) 0%, transparent 50%)",
          }}
        />
      </div>
    </div>
  );
}

/* ─── Form Badge 3D ──────────────────────────────────────────────────────── */
function FormBadge3D({ char, index }: { char: string; index: number }) {
  const isWin = char === "W";
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-xl text-[10px] font-extrabold transition-all duration-200 hover:scale-110"
      style={{
        background: isWin
          ? "linear-gradient(145deg, #34d399, #10b981)"
          : "linear-gradient(145deg, #f87171, #ef4444)",
        color: "white",
        boxShadow: isWin
          ? "2px 2px 6px rgba(16,185,129,.4), -1px -1px 4px rgba(52,211,153,.3)"
          : "2px 2px 6px rgba(239,68,68,.4), -1px -1px 4px rgba(248,113,113,.3)",
      }}
    >
      {char}
    </div>
  );
}

/* ─── Main Popup ──────────────────────────────────────────────────────────── */
export function SnookerPlayerPopup({
  playerId,
  onClose,
}: {
  playerId: string;
  onClose: () => void;
}) {
  const { data: player, isLoading } = useSWR<PlayerDetail>(
    playerId ? `/api/v1/snooker/players/${playerId}` : null,
    fetcher,
  );

  // Ranking PowerScore: charger tous les joueurs (top 200)
  const { data: allPlayersData } = useSWR<{ players: PlayerListItem[] }>(
    "/api/v1/snooker/players?limit=200",
    fetcher,
  );

  const powerScoreOf = (p: PlayerListItem) =>
    Math.round(
      (p.eloRating / 1800) * 30 +
      p.winPct * 0.25 +
      Math.min(100, (p.centuryRate / 30) * 100) * 0.20 +
      p.deciderWinPct * 0.15 +
      Math.min(100, ((p.avgBreak - 20) / 60) * 100) * 0.10
    );

  const psRank = (() => {
    if (!player || !allPlayersData?.players) return null;
    const sorted = [...allPlayersData.players]
      .map((p) => ({ ...p, _ps: powerScoreOf(p) }))
      .sort((a, b) => b._ps - a._ps);
    const idx = sorted.findIndex((p) => p.id === player.id);
    return idx >= 0 ? idx + 1 : null;
  })();

  // Ranks par métrique (top 200)
  const metricRanks = (() => {
    if (!player || !allPlayersData?.players) return { winRate: null, centuryRate: null, deciderWin: null };
    const ps = allPlayersData.players;
    const rankBy = (key: "winPct" | "centuryRate" | "deciderWinPct") => {
      const sorted = [...ps].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
      const idx = sorted.findIndex((p) => p.id === player.id);
      return idx >= 0 ? idx + 1 : null;
    };
    return { winRate: rankBy("winPct"), centuryRate: rankBy("centuryRate"), deciderWin: rankBy("deciderWinPct") };
  })();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const powerScore = player
    ? Math.round(
        (player.eloRating / 1800) * 30 +
        player.winPct * 0.25 +
        Math.min(100, (player.centuryRate / 30) * 100) * 0.20 +
        player.deciderWinPct * 0.15 +
        Math.min(100, ((player.avgBreak - 20) / 60) * 100) * 0.10
      )
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-md sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative mx-0 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-3xl sm:mx-4 sm:max-h-[72vh] sm:rounded-3xl sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(180deg, #ffffff 0%, #f6f8fa 100%)",
          boxShadow: "0 25px 60px rgba(0,0,0,.25), 0 8px 20px rgba(0,0,0,.15), inset 0 1px 0 rgba(255,255,255,.9)",
        }}
      >
        {/* ─── Header ──────────────────────────────────────────────── */}
        <div
          className="relative px-5 pt-5 pb-4"
          style={{
            background: "linear-gradient(135deg, #00985f 0%, #007a4d 50%, #005c3a 100%)",
          }}
        >
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/5" />
          <div className="absolute right-12 bottom-2 h-12 w-12 rounded-full bg-white/5" />

          <div className="relative flex items-center gap-3.5">
            {/* Photo */}
            <div
              className="shrink-0 rounded-full p-[3px]"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,.6), rgba(255,255,255,.2))",
                boxShadow: "0 4px 16px rgba(0,0,0,.25)",
              }}
            >
              {isLoading ? (
                <div className="h-14 w-14 animate-pulse rounded-full bg-white/20" />
              ) : player?.photoUrl ? (
                <img
                  src={player.photoUrl}
                  alt={player.name}
                  className="h-14 w-14 rounded-full object-cover object-top"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-2xl font-bold text-white">
                  {player?.name?.charAt(0) ?? "?"}
                </div>
              )}
            </div>

            {/* Name + badges */}
            <div className="min-w-0 flex-1">
              {isLoading ? (
                <div className="h-5 w-32 animate-pulse rounded bg-white/20" />
              ) : (
                <>
                  <h2 className="truncate text-lg font-bold text-white drop-shadow-md">
                    {player?.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-white/80">
                    {player?.nationality && <span>{player.nationality}</span>}
                    {player?.ranking != null && (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                        #{player.ranking}
                      </span>
                    )}
                    <span className="tabular-nums">Elo {player?.eloRating}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
            aria-label="Fermer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ─── Body ────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : player ? (
          <div className="space-y-4 px-5 pb-5">
            {/* Power Score */}
            <div>
              <div
                className="mx-auto w-fit rounded-2xl bg-white px-5 py-4"
                style={{
                  boxShadow: "0 8px 30px rgba(0,0,0,.1), 0 2px 8px rgba(0,0,0,.05)",
                }}
              >
                <PowerScoreRing score={powerScore} />
                <div className="mt-3 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    Power Score
                  </div>
                  {psRank && (
                    <div className="mt-1.5 flex items-center justify-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                        style={{
                          background: psRank <= 10 ? "linear-gradient(135deg, #fbbf24, #f59e0b)" : psRank <= 50 ? "linear-gradient(135deg, #94a3b8, #64748b)" : "rgba(0,0,0,.06)",
                          color: psRank <= 10 ? "#78350f" : psRank <= 50 ? "#fff" : "#64748b",
                          boxShadow: psRank <= 10 ? "0 2px 8px rgba(245,158,11,.4)" : psRank <= 50 ? "0 2px 6px rgba(0,0,0,.15)" : "none",
                        }}
                      >
                        {psRank <= 10 && (
                          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        )}
                        #{psRank} / 200
                      </span>
                    </div>
                  )}
                  <div className="mt-1 text-[9px] text-gray-300">
                    Elo {(player.eloRating / 1800 * 30).toFixed(0)} · Win {player.winPct.toFixed(0)} · C{player.centuryRate.toFixed(0)} · D{player.deciderWinPct.toFixed(0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Métriques Betting — 3D Bars */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <span className="inline-block h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" />
                Métriques Betting
                <span className="inline-block h-px flex-1 bg-gradient-to-l from-gray-200 to-transparent" />
              </h3>
              <div className="space-y-3">
                <ProgressBar3D label="Win Rate" value={player.winPct} color="#00985f" rank={metricRanks.winRate} />
                <ProgressBar3D label="Century Rate" value={player.centuryRate} max={40} color="#3b82f6" rank={metricRanks.centuryRate} />
                <ProgressBar3D label="Decider Win%" value={player.deciderWinPct} color="#8b5cf6" rank={metricRanks.deciderWin} />
              </div>
            </div>

            {/* Stats Clés — 3D Cards */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <span className="inline-block h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" />
                Stats Clés
                <span className="inline-block h-px flex-1 bg-gradient-to-l from-gray-200 to-transparent" />
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <StatCard3D
                  label="Matchs"
                  value={player.matchesPlayed}
                  color="#64748b"
                  icon={<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
                />
                <StatCard3D
                  label="Victoires"
                  value={player.wins}
                  color="#10b981"
                  icon={<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
                />
                <StatCard3D
                  label="Défaites"
                  value={player.losses}
                  color="#ef4444"
                  icon={<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
                />
                <StatCard3D
                  label="Centuries"
                  value={player.centuries}
                  color="#3b82f6"
                  icon={<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
                />
                <StatCard3D
                  label="Max Break"
                  value={player.maxBreak ?? "—"}
                  color="#f59e0b"
                  icon={<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
                />
                <StatCard3D
                  label="Elo"
                  value={player.eloRating}
                  color="#6366f1"
                  icon={<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>}
                />
              </div>
            </div>

            {/* Win/Loss ratio bar */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <span className="inline-block h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" />
                Ratio Victoires / Défaites
                <span className="inline-block h-px flex-1 bg-gradient-to-l from-gray-200 to-transparent" />
              </h3>
              <div
                className="relative h-6 w-full overflow-hidden rounded-full"
                style={{
                  background: "linear-gradient(180deg, #e9ecef 0%, #f1f3f5 100%)",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,.12), 0 1px 0 rgba(255,255,255,.8)",
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${player.winPct}%`,
                    background: "linear-gradient(180deg, #34d399 0%, #10b981 50%, #059669 100%)",
                    boxShadow: "inset 0 -1px 2px rgba(0,0,0,.2), inset 0 1px 1px rgba(255,255,255,.4)",
                  }}
                />
                <div
                  className="absolute inset-y-0 right-0 rounded-full"
                  style={{
                    width: `${100 - player.winPct}%`,
                    background: "linear-gradient(180deg, #fca5a5 0%, #f87171 50%, #ef4444 100%)",
                    boxShadow: "inset 0 -1px 2px rgba(0,0,0,.15), inset 0 1px 1px rgba(255,255,255,.3)",
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-3">
                  <span className="text-[9px] font-bold text-white drop-shadow-sm">
                    {player.winPct.toFixed(0)}% W
                  </span>
                  <span className="text-[9px] font-bold text-white/80 drop-shadow-sm">
                    {(100 - player.winPct).toFixed(0)}% L
                  </span>
                </div>
              </div>
            </div>

            {/* Forme récente */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <span className="inline-block h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" />
                Forme (10 derniers)
                <span className="inline-block h-px flex-1 bg-gradient-to-l from-gray-200 to-transparent" />
              </h3>
              <div className="flex items-center justify-center gap-1.5">
                {player.formLast10.split("").map((char, i) => (
                  <FormBadge3D key={i} char={char} index={i} />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-center gap-4 text-[10px]">
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-emerald-700">
                    +{player.winStreak} série
                  </span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <span className="font-semibold text-red-600">
                    -{player.lossStreak} série
                  </span>
                </div>
              </div>
            </div>

            {/* Lien CueTracker */}
            <a
              href={player.cuetrackerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-2 rounded-2xl border border-gray-200/80 py-2.5 text-[11px] font-semibold text-gray-500 transition-all hover:-translate-y-0.5 hover:border-[#00985f]/30 hover:text-[#00985f] hover:shadow-lg"
              style={{
                background: "linear-gradient(180deg, #fff 0%, #f8fafb 100%)",
                boxShadow: "2px 2px 8px rgba(0,0,0,.04), -1px -1px 4px rgba(255,255,255,.8)",
              }}
            >
              <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15,3 21,3 21,9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Voir sur CueTracker
            </a>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-gray-400">
            Joueur introuvable
          </div>
        )}
      </div>
    </div>
  );
}
