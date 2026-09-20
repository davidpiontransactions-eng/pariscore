"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { FormTimeline } from "@/components/shared/form-timeline";
import { MmaRadarChart, type MmaRadarData } from "./mma-radar-chart";
import { cn } from "@/lib/utils";

export type MmaFighterProfile = {
  name: string;
  photo?: string | null;
  record?: { wins: number; losses: number; draws: number } | null;
  form?: ("W" | "L" | "D")[];
  stats?: MmaRadarData;
  reach?: number | null;
  height?: number | null;
  age?: number | null;
  stance?: string | null;
  nationality?: string | null;
};

type Props = {
  fighter: MmaFighterProfile | null;
  opponent?: MmaFighterProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatRecord(r: MmaFighterProfile["record"]): string {
  if (!r) return "—";
  return `${r.wins}W - ${r.losses}L${r.draws ? ` - ${r.draws}D` : ""}`;
}

function StatRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value ?? "—"}</span>
    </div>
  );
}

export function MmaFighterProfileDialog({
  fighter,
  opponent,
  open,
  onOpenChange,
}: Props) {
  if (!fighter) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:mt-auto max-sm:w-full">
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-zinc-300 sm:hidden" />
        <DialogHeader>
          <DialogTitle>{fighter.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {/* Photo + basic info */}
          <div className="flex items-center gap-4">
            <PlayerAvatar
              name={fighter.name}
              photoUrl={fighter.photo}
              size="xl"
              sport="mma"
            />
            <div className="text-left">
              <p className="text-lg font-bold text-foreground">{fighter.name}</p>
              {fighter.nationality && (
                <p className="text-xs text-muted-foreground">{fighter.nationality}</p>
              )}
              {fighter.record && (
                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                  {formatRecord(fighter.record)}
                </p>
              )}
            </div>
          </div>

          {/* Form */}
          {fighter.form && fighter.form.length > 0 && (
            <div className="text-center">
              <p className="mb-1 text-xs text-muted-foreground">Forme récente</p>
              <FormTimeline form={fighter.form} color="#7B3FA0" size="md" ariaLabel={`Forme de ${fighter.name}`} />
            </div>
          )}

          {/* Physical stats */}
          <div className="w-full divide-y divide-border rounded-xl border border-border">
            <StatRow label="Taille" value={fighter.height ? `${fighter.height} cm` : null} />
            <StatRow label="Reach" value={fighter.reach ? `${fighter.reach} cm` : null} />
            <StatRow label="Âge" value={fighter.age ?? null} />
            <StatRow label="Stance" value={fighter.stance ?? null} />
          </div>

          {/* Radar */}
          {fighter.stats && (
            <div className="w-full">
              <p className="mb-2 text-center text-xs text-muted-foreground">Stats EWMA</p>
              <MmaRadarChart
                dataA={fighter.stats}
                dataB={opponent?.stats}
                fighterA={fighter.name}
                fighterB={opponent?.name ?? "Adversaire"}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
