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
import { ProbabilityRing } from "@/components/tennis/probability-ring";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TeamProfile } from "@/lib/team-profile";

type Props = {
  leagueId: string | null;
  team: string | null;
  venue: "home" | "away";
  /** Probas fair modèle 0-100 (ex. prediction) — null = pas de value. */
  fair?: { home: number; draw: number; away: number } | null;
  /** Cotes décimales marché — null = pas de value. */
  odds?: { home: number; draw: number; away: number } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Header verdict 3 secondes : anneaux A/D + rang contexte + phrase auto. Sticky. */
function VerdictHeader({ profile, venueLabel }: { profile: TeamProfile; venueLabel: string }) {
  const phrase = profile.strengths[0] ?? profile.weaknesses[0] ?? "Profil équilibré";
  return (
    <section
      aria-label={`Verdict ${profile.team}`}
      className="sticky top-0 z-10 -mx-1 flex items-center gap-3 rounded-xl border border-border/40 bg-[#fafafa]/95 px-3 py-2 backdrop-blur"
    >
      <ProbabilityRing value={profile.attack.score} size={52} stroke={5} color="#10b981" animate={false}>
        <span className="text-sm font-black tabular-nums text-foreground">{profile.attack.score}</span>
      </ProbabilityRing>
      <ProbabilityRing value={profile.defense.score} size={52} stroke={5} color="#0ea5e9" animate={false}>
        <span className="text-sm font-black tabular-nums text-foreground">{profile.defense.score}</span>
      </ProbabilityRing>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black tabular-nums text-foreground">
          #{profile.standing.rank}
          <span className="font-normal text-muted-foreground">/{profile.standing.rankTotal} {venueLabel}</span>
        </p>
        <p className="truncate text-[11px] text-muted-foreground" title={phrase}>
          {phrase}
        </p>
      </div>
    </section>
  );
}

/** Heatmap des rangs intra-ligue : vert = top 3, rouge = bottom 3, texte redondant. */
function RankHeatmap({ profile }: { profile: TeamProfile }) {
  const cells = [
    {
      label: `PPG ${profile.venue === "home" ? "dom." : profile.venue === "away" ? "ext." : "gén."}`,
      rank: profile.standing.rank,
      total: profile.standing.rankTotal,
    },
    ...[...profile.attack.metrics, ...profile.defense.metrics].map((m) => ({
      label: m.label.replace(" (FBref)", "*"),
      rank: m.rank,
      total: profile.attack.rankTotal,
    })),
  ];
  return (
    <section aria-label="Rangs dans le championnat" className="rounded-xl border border-border/40 p-3">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Rangs championnat
      </h3>
      <div className="grid grid-cols-2 gap-1.5">
        {cells.map((c) => {
          const tone =
            c.rank == null
              ? "bg-muted/40 text-muted-foreground"
              : c.rank <= 3
                ? "bg-emerald-500/10 text-emerald-700"
                : c.rank >= c.total - 2
                  ? "bg-rose-500/10 text-rose-700"
                  : "bg-muted/40 text-foreground";
          return (
            <div key={c.label} className={`flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${tone}`}>
              <span className="truncate">{c.label}</span>
              <span className="shrink-0 tabular-nums">{c.rank != null ? `#${c.rank}/${c.total}` : "—"}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type MarketParams = {
  fair: { home: number; draw: number; away: number };
  odds: { home: number; draw: number; away: number };
};

/** Ligne metric : label + valeur brute + rang ligue. */
function MetricRow({
  label,
  display,
  rank,
  rankTotal,
}: {
  label: string;
  display: string;
  rank: number | null;
  rankTotal: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-semibold tabular-nums text-foreground">
        {display}
        {rank != null && (
          <span className="rounded bg-muted px-1 py-px text-[10px] tabular-nums text-muted-foreground">
            #{rank}/{rankTotal}
          </span>
        )}
      </span>
    </div>
  );
}

/** Bloc PowerScore (titre + score + rang + metrics). */
function PowerBlock({
  title,
  score,
  rank,
  rankTotal,
  metrics,
}: {
  title: string;
  score: number;
  rank: number;
  rankTotal: number;
  metrics: TeamProfile["attack"]["metrics"];
}) {
  return (
    <section className="rounded-xl border border-border/40 p-3">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <span className="flex items-center gap-1.5 text-sm font-black tabular-nums text-foreground">
          {score}
          <span className="rounded bg-emerald-500/15 px-1 py-px text-[10px] font-bold text-emerald-600">
            #{rank}/{rankTotal}
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${score}%` }} />
      </div>
      <div className="mt-1 divide-y divide-border/20">
        {metrics.map((m) => (
          <MetricRow
            key={m.key}
            label={m.label}
            display={m.display}
            rank={m.rank}
            rankTotal={rankTotal}
          />
        ))}
      </div>
    </section>
  );
}

export function TeamProfileDialog({ leagueId, team, venue, fair, odds, open, onOpenChange }: Props) {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Contexte d'affichage : initialisé sur le rôle dans le match cliqué.
  // Remonté à zéro via `key={team}` côté parent (pas de setState en effect).
  const [scope, setScope] = useState<"home" | "away" | "overall">(venue);
  const loading = open && team !== null && profile === null && error === null;
  // Clé marché stable (objets parent recréés à chaque render → pas en deps bruts).
  const marketKey = fair && odds ? JSON.stringify({ fair, odds }) : "";

  useEffect(() => {
    if (!open || !leagueId || !team) return;
    let cancelled = false;
    setProfile(null);
    setError(null);
    let url =
      `/api/football/teams/profile?league=${encodeURIComponent(leagueId)}` +
      `&team=${encodeURIComponent(team)}&venue=${scope}`;
    if (marketKey) {
      const m = JSON.parse(marketKey) as MarketParams;
      url +=
        `&fairH=${m.fair.home}&fairD=${m.fair.draw}&fairA=${m.fair.away}` +
        `&oddsH=${m.odds.home}&oddsD=${m.odds.draw}&oddsA=${m.odds.away}`;
    }
    console.log("[DEBUG-team-profile]", { leagueId, team, scope, url });
    fetch(url, { signal: AbortSignal.timeout(15000) })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { profile: TeamProfile };
      })
      .then((data) => {
        if (!cancelled) setProfile(data.profile);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err?.name === "TimeoutError" ? "délai dépassé" : err.message);
      });
    return () => {
      cancelled = true;
    };
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
      <DialogContent className="max-w-lg border-[#f0f0f0] bg-[#fafafa] text-[#222222]">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">
            {team ?? "Équipe"} <span className="font-normal text-muted-foreground">· {venueLabel}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Fiche saison {team} : classement, PowerScores, Elo, infirmerie
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(80vh-80px)] max-h-[calc(80dvh-80px)]">
          <div className="space-y-3 px-1 py-2">
            {loading && (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </>
            )}
            {error && <p className="text-xs text-rose-500">Données indisponibles ({error})</p>}
            {profile && (
              <>
                <ToggleGroup
                  type="single"
                  value={scope}
                  onValueChange={switchScope}
                  aria-label="Contexte du classement"
                  className="w-full justify-start gap-1"
                >
                  <ToggleGroupItem value="home" aria-label="Domicile" className="flex-1 text-xs">
                    Domicile
                  </ToggleGroupItem>
                  <ToggleGroupItem value="away" aria-label="Extérieur" className="flex-1 text-xs">
                    Extérieur
                  </ToggleGroupItem>
                  <ToggleGroupItem value="overall" aria-label="Général" className="flex-1 text-xs">
                    Général
                  </ToggleGroupItem>
                </ToggleGroup>
                <VerdictHeader profile={profile} venueLabel={venueLabel} />
                {profile.alerts.map((a) => (
                  <p
                    key={a}
                    className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[11px] font-bold text-violet-700"
                  >
                    ⚡ {a}
                  </p>
                ))}
                {profile.value && profile.value.edgePct > 5 && (
                  <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-700">
                    VALUE {profile.value.side === "home" ? "Domicile" : profile.value.side === "draw" ? "Nul" : "Extérieur"} +
                    {profile.value.edgePct.toFixed(1).replace(".", ",")} % vs marché
                  </p>
                )}
                {/* Classement contexte + général */}
                <section className="rounded-xl border border-border/40 p-3">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Classement {profile.season} · {venueLabel}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-muted/40 p-2">
                      <div className="text-xl font-black tabular-nums">
                        {profile.standing.rank}
                        <span className="text-xs font-normal text-muted-foreground">
                          /{profile.standing.rankTotal}
                        </span>
                      </div>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {venueLabel} · {profile.standing.points} pts ({profile.standing.gp} m)
                      </div>
                      <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                        {profile.standing.wins}V {profile.standing.draws}N {profile.standing.losses}D ·{" "}
                        {profile.standing.gf}-{profile.standing.ga}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2">
                      <div className="text-xl font-black tabular-nums">
                        {profile.overall.rank}
                        <span className="text-xs font-normal text-muted-foreground">
                          /{profile.overall.rankTotal}
                        </span>
                      </div>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        Général · PPG {profile.overall.ppg.toFixed(2).replace(".", ",")}
                      </div>
                      <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                        Elo {profile.elo ? `${profile.elo.elo} (#${profile.elo.rank})` : "—"}
                      </div>
                      <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                        SOS {profile.sos ?? "—"} · PPG ajusté{" "}
                        {profile.ppmAjuste != null ? profile.ppmAjuste.toFixed(2).replace(".", ",") : "—"}
                      </div>
                      <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                        Discipline ({profile.discipline ? `${profile.discipline.sample} derniers` : "—"}) :{" "}
                        {profile.discipline ? `${profile.discipline.yellows} J, ${profile.discipline.reds} R` : "—"}
                        {profile.discipline?.redLastMatch && (
                          <span className="ml-1 font-bold text-rose-600">· rouge au dernier match</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                        Repos : {profile.congestion.restDays ?? "—"} j · {profile.congestion.next14d} match(s)/14 j
                        {profile.congestion.congested && (
                          <span className="ml-1 font-bold text-amber-600">· calendrier chargé</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                        Steam marché :{" "}
                        {profile.clv
                          ? `${profile.clv.avgMovePct > 0 ? "+" : ""}${profile.clv.avgMovePct.toFixed(1).replace(".", ",")} % (${profile.clv.samples})`
                          : "—"}
                      </div>
                      <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                        Arbitre fréquent :{" "}
                        {profile.referee
                          ? `${profile.referee.name} (${profile.referee.avgCards.toFixed(1).replace(".", ",")} cartons/m, bilan ${profile.referee.teamW}V ${profile.referee.teamD}N ${profile.referee.teamL}D)`
                          : "—"}
                      </div>
                    </div>
                  </div>
                </section>

                <PowerBlock
                  title="PowerScore Attaque"
                  score={profile.attack.score}
                  rank={profile.attack.rank}
                  rankTotal={profile.attack.rankTotal}
                  metrics={profile.attack.metrics}
                />
                {profile.reversion && profile.xgDiff != null && (
                  <p
                    className={`rounded-xl border px-3 py-2 text-[11px] font-semibold ${
                      profile.reversion === "chaud"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                        : "border-sky-500/30 bg-sky-500/10 text-sky-700"
                    }`}
                  >
                    Finisher {profile.reversion} ({profile.xgDiff > 0 ? "+" : ""}
                    {profile.xgDiff.toFixed(2).replace(".", ",")} vs xG) — réversion probable
                  </p>
                )}
                <PowerBlock
                  title="PowerScore Défense"
                  score={profile.defense.score}
                  rank={profile.defense.rank}
                  rankTotal={profile.defense.rankTotal}
                  metrics={profile.defense.metrics}
                />

                {/* Heatmap rangs (remplace Forces/Faiblesses texte) */}
                <RankHeatmap profile={profile} />

                {/* Infirmerie */}
                <section className="rounded-xl border border-border/40 p-3">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Absents
                  </h3>
                  {!profile.injuriesCovered && (
                    <p className="text-[11px] text-muted-foreground">
                      Infirmerie non couverte pour ce championnat (5 grands championnats uniquement).
                    </p>
                  )}
                  {profile.injuriesCovered && profile.injuries!.list.length === 0 && (
                    <p className="text-[11px] text-emerald-600">Aucun absent signalé ✓</p>
                  )}
                  {profile.injuriesCovered &&
                    profile.injuries!.list.map((inj) => (
                      <div key={inj.player} className="flex items-center justify-between gap-2 py-1 text-xs">
                        <span className="font-semibold">{inj.player}</span>
                        <span className="text-right text-muted-foreground">
                          {[inj.position, inj.injury, inj.status].filter(Boolean).join(" · ")}
                          {inj.returnDate && (
                            <span className="block text-[10px] text-emerald-600">
                              retour ~{inj.returnDate.split("-").reverse().join("/")}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  {profile.injuriesCovered && (
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      Sources RotoWire + Transfermarkt · retour inconnu = non communiqué
                    </p>
                  )}
                </section>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
