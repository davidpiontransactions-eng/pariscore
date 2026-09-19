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

/* ─── Composant principal ─── */
export function TeamProfileDialog({ leagueId, team, venue, fair, odds, open, onOpenChange }: Props) {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"home" | "away" | "overall">(venue);
  const loading = open && team !== null && profile === null && error === null;
  const marketKey = fair && odds ? JSON.stringify({ fair, odds }) : "";

  useEffect(() => {
    if (!open || !leagueId || !team) return;
    let cancelled = false;
    setProfile(null);
    setError(null);

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

    fetchProfile();
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
      <DialogContent className="max-w-md border-border/50 bg-background p-0">
        <DialogHeader className="border-b border-border/50 px-6 py-4">
          <DialogTitle className="flex items-center gap-3 text-lg font-bold">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="text-lg">⚽</span>
            </div>
            <div>
              <div className="font-black">{team ?? "Équipe"}</div>
              <div className="text-xs font-normal text-muted-foreground">{venueLabel}</div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Fiche saison {team} : classement, PowerScores, Elo, infirmerie
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(80vh-120px)]">
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
