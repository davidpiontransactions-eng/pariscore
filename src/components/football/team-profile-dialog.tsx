"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { TeamProfile } from "@/lib/team-profile";

type Props = {
  leagueId: string | null;
  team: string | null;
  venue: "home" | "away";
  fair?: { home: number; draw: number; away: number } | null;
  odds?: { home: number; draw: number; away: number } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/* ─── Couleurs sémantiques ─── */
const COLORS = {
  attack: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/20", ring: "#10b981" },
  defense: { bg: "bg-sky-500/10", text: "text-sky-600", border: "border-sky-500/20", ring: "#0ea5e9" },
  rank: { top: "bg-emerald-500/15 text-emerald-700", mid: "bg-muted text-muted-foreground", bottom: "bg-rose-500/15 text-rose-700" },
  value: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700",
  alert: "bg-violet-500/10 border-violet-500/30 text-violet-700",
  warning: "bg-amber-500/10 border-amber-500/30 text-amber-700",
};

/* ─── Composant : Anneau de score ─── */
function ScoreRing({ value, color, size = 56 }: { value: number; color: string; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={5} className="text-muted/50" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-black tabular-nums">{value}</span>
      </div>
    </div>
  );
}

/* ─── Composant : Barre de progression ─── */
function ProgressBar({ value, color, className }: { value: number; color: string; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted/50", className)}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}

/* ─── Composant : Badge de rang ─── */
function RankBadge({ rank, total }: { rank: number | null; total: number }) {
  if (rank == null) return <span className="text-[10px] text-muted-foreground">—</span>;
  const tone = rank <= 3 ? COLORS.rank.top : rank >= total - 2 ? COLORS.rank.bottom : COLORS.rank.mid;
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums", tone)}>
      #{rank}/{total}
    </span>
  );
}

/* ─── Composant : Ligne de statistique ─── */
function StatLine({ label, value, rank, total }: { label: string; value: string; rank?: number | null; total?: number }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold tabular-nums">{value}</span>
        {rank != null && total != null && <RankBadge rank={rank} total={total} />}
      </div>
    </div>
  );
}

/* ─── Composant : Carte de section ─── */
function SectionCard({ title, icon, children, className }: { title: string; icon?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border/50 bg-card/50 p-4", className)}>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {icon && <span className="text-sm">{icon}</span>}
        {title}
      </h3>
      {children}
    </section>
  );
}

/* ─── Composant : Verdict Header (sticky) ─── */
function VerdictHeader({ profile, venueLabel }: { profile: TeamProfile; venueLabel: string }) {
  const phrase = profile.strengths[0] ?? profile.weaknesses[0] ?? "Profil équilibré";
  return (
    <div className="sticky top-0 z-10 -mx-1 rounded-xl border border-border/50 bg-background/95 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <ScoreRing value={profile.attack.score} color={COLORS.attack.ring} />
        <ScoreRing value={profile.defense.score} color={COLORS.defense.ring} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums">#{profile.standing.rank}</span>
            <span className="text-sm text-muted-foreground">/{profile.standing.rankTotal} {venueLabel}</span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={phrase}>
            {phrase}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Composant : Bilan V/N/D ─── */
function RecordDisplay({ wins, draws, losses }: { wins: number; draws: number; losses: number }) {
  const total = wins + draws + losses;
  if (total === 0) return null;
  const wPct = (wins / total) * 100;
  const dPct = (draws / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-emerald-600">{wins}V</span>
        <span className="font-semibold text-muted-foreground">{draws}N</span>
        <span className="font-semibold text-rose-600">{losses}D</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full">
        <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${wPct}%` }} />
        <div className="bg-muted-foreground/30 transition-all duration-500" style={{ width: `${dPct}%` }} />
        <div className="bg-rose-500 transition-all duration-500" style={{ width: `${100 - wPct - dPct}%` }} />
      </div>
    </div>
  );
}

/* ─── Composant : Forme récente ─── */
function FormDisplay({ form }: { form?: ("W" | "D" | "L")[] }) {
  if (!form || form.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      {form.map((result, i) => (
        <div
          key={i}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold",
            result === "W" ? "bg-emerald-500/20 text-emerald-700" :
            result === "D" ? "bg-muted text-muted-foreground" :
            "bg-rose-500/20 text-rose-700"
          )}
        >
          {result}
        </div>
      ))}
    </div>
  );
}

/* ─── Composant : PowerBlock ─── */
function PowerBlock({ title, score, rank, rankTotal, metrics, color }: {
  title: string; score: number; rank: number; rankTotal: number;
  metrics: TeamProfile["attack"]["metrics"]; color: typeof COLORS.attack;
}) {
  return (
    <SectionCard title={title}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScoreRing value={score} color={color.ring} size={48} />
          <div>
            <div className="text-2xl font-black tabular-nums">{score}</div>
            <RankBadge rank={rank} total={rankTotal} />
          </div>
        </div>
      </div>
      <ProgressBar value={score} color={color.ring} className="mb-3" />
      <div className="divide-y divide-border/30">
        {metrics.map((m) => (
          <StatLine key={m.key} label={m.label} value={m.display} rank={m.rank} total={rankTotal} />
        ))}
      </div>
    </SectionCard>
  );
}

/* ─── Composant : Header stade avec silhouettes ─── */
function StadiumHeader({ team, venueLabel }: { team: string; venueLabel: string }) {
  return (
    <div className="relative overflow-hidden rounded-t-xl">
      {/* Fond stade SVG */}
      <div className="absolute inset-0">
        <svg viewBox="0 0 800 200" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
          {/* Gradient ciel */}
          <defs>
            <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0c4a6e" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#164e63" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="field" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#15803d" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#166534" stopOpacity="0.9" />
            </linearGradient>
            {/* Flou lumineux projecteurs */}
            <filter id="blur">
              <feGaussianBlur stdDeviation="20" />
            </filter>
          </defs>

          {/* Ciel nocturne */}
          <rect width="800" height="200" fill="url(#sky)" />

          {/* Projecteurs (lumières) */}
          <circle cx="200" cy="30" r="60" fill="#fef08a" opacity="0.15" filter="url(#blur)" />
          <circle cx="600" cy="30" r="60" fill="#fef08a" opacity="0.15" filter="url(#blur)" />
          <circle cx="400" cy="20" r="80" fill="#fef08a" opacity="0.1" filter="url(#blur)" />

          {/* Terrain */}
          <rect x="50" y="120" width="700" height="80" rx="4" fill="url(#field)" />

          {/* Lignes du terrain */}
          <rect x="50" y="120" width="700" height="80" rx="4" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.4" />
          <line x1="400" y1="120" x2="400" y2="200" stroke="#fff" strokeWidth="1" opacity="0.3" />
          <circle cx="400" cy="160" r="25" fill="none" stroke="#fff" strokeWidth="1" opacity="0.3" />

          {/* Surface de réparation */}
          <rect x="50" y="140" width="80" height="60" fill="none" stroke="#fff" strokeWidth="1" opacity="0.25" />
          <rect x="670" y="140" width="80" height="60" fill="none" stroke="#fff" strokeWidth="1" opacity="0.25" />

          {/* Silhouettes joueurs */}
          {/* Joueur 1 — attaquant */}
          <g transform="translate(320, 135)" opacity="0.5">
            <circle cx="0" cy="0" r="5" fill="#fef9c3" />
            <line x1="0" y1="5" x2="0" y2="20" stroke="#fef9c3" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="0" y1="10" x2="-8" y2="18" stroke="#fef9c3" strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="10" x2="8" y2="18" stroke="#fef9c3" strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="20" x2="-6" y2="30" stroke="#fef9c3" strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="20" x2="6" y2="30" stroke="#fef9c3" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Joueur 2 — défenseur */}
          <g transform="translate(480, 140)" opacity="0.4">
            <circle cx="0" cy="0" r="5" fill="#fef9c3" />
            <line x1="0" y1="5" x2="0" y2="20" stroke="#fef9c3" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="0" y1="10" x2="-8" y2="18" stroke="#fef9c3" strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="10" x2="8" y2="18" stroke="#fef9c3" strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="20" x2="-6" y2="30" stroke="#fef9c3" strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="20" x2="6" y2="30" stroke="#fef9c3" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Joueur 3 — gardien */}
          <g transform="translate(100, 150)" opacity="0.35">
            <circle cx="0" cy="0" r="5" fill="#fef9c3" />
            <line x1="0" y1="5" x2="0" y2="20" stroke="#fef9c3" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="0" y1="10" x2="-10" y2="14" stroke="#fef9c3" strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="10" x2="10" y2="14" stroke="#fef9c3" strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="20" x2="-6" y2="30" stroke="#fef9c3" strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="20" x2="6" y2="30" stroke="#fef9c3" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Ballon */}
          <circle cx="350" cy="155" r="4" fill="#fff" opacity="0.6" />

          {/* Tribunes (silhouettes spectateurs) */}
          <g opacity="0.15">
            {[...Array(20)].map((_, i) => (
              <circle key={i} cx={60 + i * 35} cy={100 + Math.sin(i * 0.8) * 8} r="3" fill="#fef9c3" />
            ))}
          </g>
        </svg>
      </div>

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />

      {/* Contenu */}
      <div className="relative z-10 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary shadow-lg">
            <span className="text-xl">⚽</span>
          </div>
          <div>
            <h2 className="text-xl font-black text-white drop-shadow-lg">{team}</h2>
            <p className="text-xs font-medium text-white/80 drop-shadow">{venueLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Composant principal ─── */
export function TeamProfileDialog({ leagueId, team, venue, fair, odds, open, onOpenChange }: Props) {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"home" | "away" | "overall">(venue);
  const [playerStats, setPlayerStats] = useState<{
    topScorers: { name: string; team: string; teamCrest?: string; goals: number; assists: number; playedMatches: number; position?: string; nationality?: string }[];
    topAssisters: { name: string; team: string; teamCrest?: string; goals: number; assists: number; playedMatches: number; position?: string; nationality?: string }[];
  } | null>(null);
  const loading = open && team !== null && profile === null && error === null;
  const marketKey = fair && odds ? JSON.stringify({ fair, odds }) : "";

  useEffect(() => {
    if (!open || !leagueId || !team) return;
    let cancelled = false;
    setProfile(null);
    setError(null);
    setPlayerStats(null);

    const fetchProfile = async () => {
      const baseParams = `league=${encodeURIComponent(leagueId)}&team=${encodeURIComponent(team)}&venue=${scope}`;
      let url = `/api/football/teams/profile?${baseParams}`;
      if (marketKey) {
        const m = JSON.parse(marketKey) as { fair: { home: number; draw: number; away: number }; odds: { home: number; draw: number; away: number } };
        url += `&fairH=${m.fair.home}&fairD=${m.fair.draw}&fairA=${m.fair.away}&oddsH=${m.odds.home}&oddsD=${m.odds.draw}&oddsA=${m.odds.away}`;
      }

      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setProfile(data.profile);
          return;
        }
        if (res.status === 404) {
          const bsdUrl = `/api/football/teams/bsd-profile?${baseParams}`;
          const bsdRes = await fetch(bsdUrl, { signal: AbortSignal.timeout(10000) });
          if (bsdRes.ok) {
            const bsdData = await bsdRes.json();
            if (!cancelled) setProfile(bsdData.profile);
            return;
          }
        }
        throw new Error(`HTTP ${res.status}`);
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg === "TimeoutError" ? "délai dépassé" : msg);
        }
      }
    };

    const fetchPlayerStats = async () => {
      try {
        const url = `/api/football/players/stats?league=${encodeURIComponent(leagueId)}&team=${encodeURIComponent(team)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setPlayerStats(data);
        }
      } catch {
        // Silencieux — les stats joueurs sont optionnelles
      }
    };

    fetchProfile();
    fetchPlayerStats();
    return () => { cancelled = true; };
  }, [open, leagueId, team, scope, marketKey]);

  const venueLabel = scope === "home" ? "à domicile" : scope === "away" ? "à l'extérieur" : "général";

  const switchScope = (v: string) => {
    if (v !== "home" && v !== "away" && v !== "overall") return;
    setScope(v);
    setProfile(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/50 bg-background p-0 overflow-hidden max-h-[90vh] sm:max-h-[90dvh] flex flex-col max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:mt-auto max-sm:w-full">
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-zinc-300 sm:hidden" />
        {/* Header stade avec silhouettes */}
        <StadiumHeader team={team ?? "Équipe"} venueLabel={venueLabel} />

        <DialogHeader className="border-b border-border/50 px-6 py-4">
          <DialogTitle className="flex items-center gap-3 text-lg font-bold">
            <div>
              <div className="font-black">{team ?? "Équipe"}</div>
              <div className="text-xs font-normal text-muted-foreground">{venueLabel}</div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Fiche saison {team} : classement, PowerScores, Elo, infirmerie
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(80vh-120px)] sm:max-h-[calc(80dvh-120px)]">
          <div className="space-y-4 px-6 py-4">
            {/* Scope toggle */}
            <ToggleGroup
              type="single"
              value={scope}
              onValueChange={switchScope}
              aria-label="Contexte du classement"
              className="w-full rounded-lg border border-border/50 p-1"
            >
              <ToggleGroupItem value="home" className="flex-1 rounded-md text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Domicile
              </ToggleGroupItem>
              <ToggleGroupItem value="away" className="flex-1 rounded-md text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Extérieur
              </ToggleGroupItem>
              <ToggleGroupItem value="overall" className="flex-1 rounded-md text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Général
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Loading state */}
            {loading && (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center">
                <p className="text-sm font-semibold text-rose-600">Données indisponibles</p>
                <p className="mt-1 text-xs text-rose-500">{error}</p>
              </div>
            )}

            {/* Profile content */}
            {profile && (
              <div className="space-y-4">
                {/* Verdict Header */}
                <VerdictHeader profile={profile} venueLabel={venueLabel} />

                {/* Alerts */}
                {profile.alerts.map((a) => (
                  <div key={a} className={cn("rounded-xl border p-3 text-xs font-semibold", COLORS.alert)}>
                    ⚡ {a}
                  </div>
                ))}

                {/* Value */}
                {profile.value && profile.value.edgePct > 5 && (
                  <div className={cn("rounded-xl border p-3 text-xs font-semibold", COLORS.value)}>
                    VALUE {profile.value.side === "home" ? "Domicile" : profile.value.side === "draw" ? "Nul" : "Extérieur"} +
                    {profile.value.edgePct.toFixed(1).replace(".", ",")} % vs marché
                  </div>
                )}

                {/* Classement */}
                <SectionCard title="Classement" icon="📊">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Contexte */}
                    <div className="space-y-3">
                      <div className="text-center">
                        <div className="text-3xl font-black tabular-nums">{profile.standing.rank}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">
                          {venueLabel} · {profile.standing.points} pts
                        </div>
                      </div>
                      <RecordDisplay
                        wins={profile.standing.wins}
                        draws={profile.standing.draws}
                        losses={profile.standing.losses}
                      />
                      <div className="text-center text-xs text-muted-foreground">
                        {profile.standing.gf}-{profile.standing.ga} (GD {profile.standing.gd > 0 ? "+" : ""}{profile.standing.gd})
                      </div>
                    </div>

                    {/* Général */}
                    <div className="space-y-3">
                      <div className="text-center">
                        <div className="text-3xl font-black tabular-nums">{profile.overall.rank}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">
                          Général · PPG {profile.overall.ppg.toFixed(2).replace(".", ",")}
                        </div>
                      </div>
                      <RecordDisplay
                        wins={profile.overall.wins}
                        draws={profile.overall.draws}
                        losses={profile.overall.losses}
                      />
                      <div className="text-center text-xs text-muted-foreground">
                        {profile.overall.gf}-{profile.overall.ga} (GD {profile.overall.gd > 0 ? "+" : ""}{profile.overall.gd})
                      </div>
                    </div>
                  </div>
                </SectionCard>

                {/* PowerScore Attaque */}
                <PowerBlock
                  title="PowerScore Attaque"
                  score={profile.attack.score}
                  rank={profile.attack.rank}
                  rankTotal={profile.attack.rankTotal}
                  metrics={profile.attack.metrics}
                  color={COLORS.attack}
                />

                {/* Réversion xG */}
                {profile.reversion && profile.xgDiff != null && (
                  <div className={cn(
                    "rounded-xl border p-3 text-xs font-semibold",
                    profile.reversion === "chaud" ? COLORS.warning : COLORS.value
                  )}>
                    Finisher {profile.reversion} ({profile.xgDiff > 0 ? "+" : ""}
                    {profile.xgDiff.toFixed(2).replace(".", ",")} vs xG) — réversion probable
                  </div>
                )}

                {/* PowerScore Défense */}
                <PowerBlock
                  title="PowerScore Défense"
                  score={profile.defense.score}
                  rank={profile.defense.rank}
                  rankTotal={profile.defense.rankTotal}
                  metrics={profile.defense.metrics}
                  color={COLORS.defense}
                />

                {/* Metrics Avancées — Recherche Académique */}
                <SectionCard title="Metrics Avancées" icon="📈">
                  <div className="space-y-1 divide-y divide-border/30">
                    {/* xG metrics */}
                    {profile.attack.metrics.find(m => m.key === "xg") && (
                      <StatLine
                        label="xG par match"
                        value={profile.attack.metrics.find(m => m.key === "xg")?.display ?? "—"}
                        rank={profile.attack.metrics.find(m => m.key === "xg")?.rank}
                        total={profile.attack.rankTotal}
                      />
                    )}
                    {/* Buts marqués par match */}
                    <StatLine
                      label="Buts marqués/m"
                      value={`${profile.standing.gp > 0 ? (profile.standing.gf / profile.standing.gp).toFixed(2).replace(".", ",") : "—"}`}
                    />
                    {/* Buts encaissés par match */}
                    <StatLine
                      label="Buts encaissés/m"
                      value={`${profile.standing.gp > 0 ? (profile.standing.ga / profile.standing.gp).toFixed(2).replace(".", ",") : "—"}`}
                    />
                    {/* Différence de buts par match */}
                    <StatLine
                      label="Différence/m"
                      value={`${profile.standing.gp > 0 ? ((profile.standing.gf - profile.standing.ga) / profile.standing.gp).toFixed(2).replace(".", ",") : "—"}`}
                    />
                    {/* Taux de victoire */}
                    <StatLine
                      label="Taux victoire"
                      value={`${profile.standing.gp > 0 ? Math.round((profile.standing.wins / profile.standing.gp) * 100) : "—"} %`}
                    />
                    {/* Taux de clean sheets (approximation) */}
                    <StatLine
                      label="Clean sheets"
                      value={`${profile.defense.metrics.find(m => m.key === "cs")?.display ?? "—"}`}
                    />
                    {/* Buts par match (total) */}
                    <StatLine
                      label="Buts totaux/m"
                      value={`${profile.standing.gp > 0 ? ((profile.standing.gf + profile.standing.ga) / profile.standing.gp).toFixed(2).replace(".", ",") : "—"}`}
                    />
                    {/* Over 1.5 % */}
                    <StatLine
                      label="Over 1,5 buts"
                      value={profile.attack.metrics.find(m => m.key === "o15")?.display ?? "—"}
                    />
                    {/* Under 3.5 % */}
                    <StatLine
                      label="Under 3,5 buts"
                      value={profile.defense.metrics.find(m => m.key === "u35")?.display ?? "—"}
                    />
                    {/* BTTS % */}
                    <StatLine
                      label="Les 2 marquent"
                      value={profile.attack.metrics.find(m => m.key === "btts")?.display ?? "—"}
                    />
                  </div>
                  <p className="mt-3 text-[10px] text-muted-foreground italic">
                    Sources : FBref, BSD, StatsBomb. Metrics calculées selon les standards académiques (xG, SCA, PPDA).
                  </p>
                </SectionCard>

                {/* Top Buteurs & Passeurs */}
                {playerStats && (playerStats.topScorers.length > 0 || playerStats.topAssisters.length > 0) && (
                  <SectionCard title="Joueurs clés" icon="⭐">
                    {/* Top Buteurs */}
                    {playerStats.topScorers.length > 0 && (
                      <div className="mb-4">
                        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                          Top buteurs
                        </h4>
                        <div className="space-y-2">
                          {playerStats.topScorers.slice(0, 5).map((p, i) => (
                            <div key={p.name} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-700">
                                {i + 1}
                              </div>
                              {p.teamCrest && (
                                <img src={p.teamCrest} alt="" width="20" height="20" loading="lazy" className="size-5 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold">{p.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {p.position && `${p.position} · `}{p.playedMatches} matchs
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-black tabular-nums text-emerald-600">{p.goals}</div>
                                <div className="text-[10px] text-muted-foreground">buts</div>
                              </div>
                              {p.assists > 0 && (
                                <div className="text-right">
                                  <div className="text-sm font-black tabular-nums text-sky-600">{p.assists}</div>
                                  <div className="text-[10px] text-muted-foreground">passes</div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Passeurs */}
                    {playerStats.topAssisters.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-sky-600">
                          Top passeurs
                        </h4>
                        <div className="space-y-2">
                          {playerStats.topAssisters.slice(0, 5).map((p, i) => (
                            <div key={p.name} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-700">
                                {i + 1}
                              </div>
                              {p.teamCrest && (
                                <img src={p.teamCrest} alt="" width="20" height="20" loading="lazy" className="size-5 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold">{p.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {p.position && `${p.position} · `}{p.playedMatches} matchs
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-black tabular-nums text-sky-600">{p.assists}</div>
                                <div className="text-[10px] text-muted-foreground">passes</div>
                              </div>
                              {p.goals > 0 && (
                                <div className="text-right">
                                  <div className="text-sm font-black tabular-nums text-emerald-600">{p.goals}</div>
                                  <div className="text-[10px] text-muted-foreground">buts</div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="mt-3 text-[10px] text-muted-foreground italic">
                      Source : football-data.org · Mis à jour quotidiennement
                    </p>
                  </SectionCard>
                )}

                {/* Méta-données */}
                <SectionCard title="Contexte" icon="ℹ️">
                  <div className="divide-y divide-border/30">
                    <StatLine label="Elo" value={profile.elo ? `${profile.elo.elo}` : "—"} rank={profile.elo?.rank} total={profile.elo?.rankTotal} />
                    <StatLine label="SOS" value={profile.sos?.toString() ?? "—"} />
                    <StatLine label="PPG ajusté" value={profile.ppmAjuste != null ? profile.ppmAjuste.toFixed(2).replace(".", ",") : "—"} />
                    {profile.discipline && (
                      <StatLine label="Discipline" value={`${profile.discipline.yellows}J ${profile.discipline.reds}R`} />
                    )}
                    <StatLine label="Repos" value={profile.congestion.restDays != null ? `${profile.congestion.restDays}j` : "—"} />
                  </div>
                </SectionCard>

                {/* Forces & faiblesses */}
                {(profile.strengths.length > 0 || profile.weaknesses.length > 0) && (
                  <SectionCard title="Forces & faiblesses" icon="💪">
                    <div className="space-y-2">
                      {profile.strengths.map((s) => (
                        <div key={s} className="flex items-start gap-2 text-xs">
                          <span className="mt-0.5 text-emerald-500">✓</span>
                          <span>{s}</span>
                        </div>
                      ))}
                      {profile.weaknesses.map((w) => (
                        <div key={w} className="flex items-start gap-2 text-xs">
                          <span className="mt-0.5 text-rose-500">✗</span>
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* Infirmerie */}
                {profile.injuries && profile.injuries.list.length > 0 && (
                  <SectionCard title="Infirmerie" icon="🏥">
                    <div className="space-y-2">
                      {profile.injuries.list.map((inj) => (
                        <div key={inj.player} className="flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold">{inj.player}</span>
                            <span className="ml-2 text-muted-foreground">{inj.position}</span>
                          </div>
                          <span className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-bold",
                            inj.status === "OUT" ? "bg-rose-500/20 text-rose-700" : "bg-amber-500/20 text-amber-700"
                          )}>
                            {inj.status}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Mis à jour : {new Date(profile.injuries.updatedAt).toLocaleDateString("fr-FR")}
                    </p>
                  </SectionCard>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
