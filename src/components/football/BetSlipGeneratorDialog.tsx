"use client";

import { useMemo, useState } from "react";
import { Lock, LockOpen, RefreshCw, Shuffle, TicketPercent } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { FootballMatch } from "@/lib/football-data";
import { cn } from "@/lib/utils";
import { pickScore, pickLabel } from "@/lib/football-pick-utils";

/**
 * Générateur de combinés — Phase 6. Construit un bulletin (tréble) selon un profil
 * de risque, avec Swap (remplacer une jambe) et Lock (figer une sélection).
 * Les cotes affichées sont des cotes modèle (100 / proba) — pas des cotes bookmaker.
 */

export type RiskProfile = "prudent" | "equilibre" | "value";

const PROFILES: Record<RiskProfile, { label: string; threshold: number; legs: number }> = {
  prudent: { label: "Prudent", threshold: 80, legs: 3 },
  equilibre: { label: "Équilibré", threshold: 72, legs: 3 },
  value: { label: "Value / Agressif", threshold: 62, legs: 4 },
};

type SlipLeg = {
  matchId: string;
  match: FootballMatch;
  pick: string;
  prob: number;
  odds: number;
  locked: boolean;
};

function buildLeg(match: FootballMatch): SlipLeg | null {
  const p = pickLabel(match);
  if (!p) return null;
  return {
    matchId: match.id,
    match,
    pick: p.leg,
    prob: p.prob,
    odds: p.prob > 0 ? 100 / p.prob : 1,
    locked: false,
  };
}

export function BetSlipGeneratorDialog({
  open,
  onOpenChange,
  matches,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: FootballMatch[];
}) {
  const [profile, setProfile] = useState<RiskProfile>("equilibre");
  const [legs, setLegs] = useState<SlipLeg[]>([]);

  // Pool classé selon le profil (score de pick décroissant).
  const pool = useMemo(() => {
    const cfg = PROFILES[profile];
    return matches
      .filter((m) => !m.live && pickScore(m) >= cfg.threshold)
      .sort((a, b) => pickScore(b) - pickScore(a));
  }, [matches, profile]);

  const generate = () => {
    const cfg = PROFILES[profile];
    const kept = legs.filter((l) => l.locked);
    const keptIds = new Set(kept.map((l) => l.matchId));
    const fresh: SlipLeg[] = [];
    for (const m of pool) {
      if (fresh.length + kept.length >= cfg.legs) break;
      if (keptIds.has(m.id)) continue;
      const leg = buildLeg(m);
      if (leg) fresh.push(leg);
    }
    setLegs([...kept, ...fresh]);
  };

  const toggleLock = (matchId: string) => {
    setLegs((prev) => prev.map((l) => (l.matchId === matchId ? { ...l, locked: !l.locked } : l)));
  };

  const swapLeg = (matchId: string) => {
    const inSlip = new Set(legs.map((l) => l.matchId));
    const alternative = pool.find((m) => !inSlip.has(m.id));
    if (!alternative) return;
    const newLeg = buildLeg(alternative);
    if (!newLeg) return;
    setLegs((prev) => prev.map((l) => (l.matchId === matchId ? { ...newLeg, locked: l.locked } : l)));
  };

  const totalOdds = legs.reduce((a, l) => a * l.odds, 1);
  const combinedProb = legs.reduce((a, l) => a * (l.prob / 100), 1) * 100;

  const handleClose = (next: boolean) => {
    if (!next) setLegs([]);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TicketPercent className="h-4 w-4 text-emerald-400" aria-hidden />
            Générateur de combiné
          </DialogTitle>
          <DialogDescription>
            Sélection automatique selon le profil de risque. Verrouillez ou remplacez chaque jambe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Profil de risque */}
          <div className="flex gap-1.5">
            {(Object.keys(PROFILES) as RiskProfile[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProfile(p)}
                className={cn(
                  "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors",
                  profile === p
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {PROFILES[p].label}
              </button>
            ))}
          </div>

          {/* Générer */}
          <button
            type="button"
            onClick={generate}
            disabled={pool.length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            <Shuffle className="h-4 w-4" aria-hidden />
            {legs.length > 0 ? "Régénérer (garde les verrous)" : "Générer le combiné"}
          </button>

          {pool.length === 0 && (
            <p className="rounded-lg bg-muted/30 px-3 py-3 text-center text-xs text-muted-foreground">
              Pas assez de matchs avec un pick assez fort pour ce profil.
            </p>
          )}

          {/* Jambes */}
          {legs.length > 0 && (
            <ul className="space-y-1.5">
              {legs.map((leg) => (
                <li
                  key={leg.matchId}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-2",
                    leg.locked ? "border-emerald-500/50 bg-emerald-500/5" : "border-border/50 bg-background",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold">
                      {leg.match.home.shortName} – {leg.match.away.shortName}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {leg.pick} · {leg.prob}% · cote {leg.odds.toFixed(2)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => swapLeg(leg.matchId)}
                    className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
                    title="Remplacer cette sélection"
                    aria-label="Remplacer"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLock(leg.matchId)}
                    className={cn(
                      "shrink-0 rounded-md border p-1.5 transition-colors",
                      leg.locked
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                    title={leg.locked ? "Déverrouiller" : "Verrouiller"}
                    aria-label={leg.locked ? "Déverrouiller" : "Verrouiller"}
                  >
                    {leg.locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Totaux */}
          {legs.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">
                {legs.length} sélections · prob. combinée {combinedProb.toFixed(1)}%
              </span>
              <span className="text-sm font-bold tabular-nums text-emerald-400">
                cote {totalOdds.toFixed(2)}
              </span>
            </div>
          )}
          <p className="text-[9px] text-muted-foreground">
            Cotes modèle (100 / proba) — indicatives, hors cotes bookmaker.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
