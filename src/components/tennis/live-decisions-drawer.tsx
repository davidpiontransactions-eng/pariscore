"use client";

import { TrendingUp, Zap, Shield, AlertTriangle, Target, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import type { CalculatedLiveMetrics, DrResult } from "@/lib/tennis-live-metrics";
import type { LiveMatchState } from "@/hooks/use-live-matches";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerAName: string;
  playerBName: string;
  metrics: CalculatedLiveMetrics;
  liveState?: LiveMatchState | null;
};

// ─── DR Bar ──────────────────────────────────────────────────────────────

function DrBar({ drA, drB, labelA, labelB, levelA }: DrResult) {
  const pct = Math.round((drA / (drA + drB)) * 100);
  const drc = (lvl: string) =>
    lvl === "dominant" ? "bg-emerald-500" : lvl === "favorable" ? "bg-emerald-400" :
    lvl === "unfavorable" ? "bg-amber-400" : lvl === "dominated" ? "bg-red-500" : "bg-muted-foreground/30";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-emerald-400">{labelA}</span>
        <span className="font-mono tabular-nums text-muted-foreground">DR {drA.toFixed(2)} — {drB.toFixed(2)}</span>
        <span className="font-semibold text-amber-400">{labelB}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", drc(levelA))} style={{ width: `${Math.max(5, Math.min(95, pct))}%` }} />
      </div>
    </div>
  );
}

// ─── Alert row ───────────────────────────────────────────────────────────

function AlertRow({ icon: Icon, label, value, level }: {
  icon: React.ElementType; label: string; value: string; level?: "critical" | "warning" | "ok";
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-xs">
        <Icon className={cn("h-3.5 w-3.5", level === "critical" ? "text-red-400" : level === "warning" ? "text-amber-400" : "text-muted-foreground")} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className={cn("text-xs font-semibold font-mono tabular-nums", level === "critical" ? "text-red-400" : level === "warning" ? "text-amber-400" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

// ─── Gauge ───────────────────────────────────────────────────────────────

function GaugeRow({ label, value, max = 100, icon: Icon }: { label: string; value: number; max?: number; icon: React.ElementType }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 70 ? "text-emerald-400" : pct >= 40 ? "text-amber-400" : "text-red-400";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3 w-3" /> {label}</span>
        <span className={cn("font-mono font-semibold tabular-nums", color)}>{value}%</span>
      </div>
      <Progress value={Math.max(2, Math.min(100, pct))} className="h-1.5" />
    </div>
  );
}

// ─── Content ─────────────────────────────────────────────────────────────

function DecisionsContent({ metrics, liveState, playerAName, playerBName }: {
  metrics: CalculatedLiveMetrics; liveState?: LiveMatchState | null; playerAName: string; playerBName: string;
}) {
  const server = liveState?.server;
  const serverName = server === "A" ? playerAName : server === "B" ? playerBName : null;
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
      {/* DR */}
      <section>
        <h4 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Dominance Ratio (set courant)
        </h4>
        <DrBar {...metrics.dr} />
      </section>
      {/* DPI */}
      <section>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Target className="inline h-3.5 w-3.5 mr-1.5 text-amber-400" /> Indice de Pression
        </h4>
        <GaugeRow label="DPI" value={metrics.pressureIndex} icon={Target} />
        {metrics.pressureIndex > 65 && (
          <p className="mt-1 text-[11px] text-red-400/80">Zone de danger — le serveur est sous pression constante</p>
        )}
      </section>
      {/* Alerte fatigue */}
      {metrics.fatigueAlert.level !== "none" && (
        <section>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <AlertTriangle className="inline h-3.5 w-3.5 mr-1.5 text-red-400" /> Alerte
          </h4>
          <div className={cn("rounded-lg border p-3 text-xs",
            metrics.fatigueAlert.level === "break_imminent" ? "border-red-500/30 bg-red-500/5 text-red-400" : "border-amber-500/30 bg-amber-500/5 text-amber-400")}>
            {metrics.fatigueAlert.message}
          </div>
        </section>
      )}
      {/* Signaux */}
      <section className="space-y-1">
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Zap className="inline h-3.5 w-3.5 mr-1.5" /> Signaux Live
        </h4>
        {serverName && <AlertRow icon={Target} label="Au service" value={serverName} />}
        {metrics.secondServeAlert.player && (
          <AlertRow icon={Zap}
            label={`2nd service (${metrics.secondServeAlert.player === "A" ? playerAName : playerBName})`}
            value={`${Math.round(metrics.secondServeAlert.pct)}%`} level={metrics.secondServeAlert.level} />
        )}
        {metrics.bpExposure.p1SavePct != null && (
          <AlertRow icon={Shield} label={`BP sauvées (${playerAName})`} value={`${Math.round(metrics.bpExposure.p1SavePct)}%`}
            level={metrics.bpExposure.p1SavePct < 50 ? "critical" : metrics.bpExposure.p1SavePct < 70 ? "warning" : "ok"} />
        )}
        {metrics.bpExposure.p2SavePct != null && (
          <AlertRow icon={Shield} label={`BP sauvées (${playerBName})`} value={`${Math.round(metrics.bpExposure.p2SavePct)}%`}
            level={metrics.bpExposure.p2SavePct < 50 ? "critical" : metrics.bpExposure.p2SavePct < 70 ? "warning" : "ok"} />
        )}
        {metrics.holdProbA != null && <AlertRow icon={TrendingUp} label={`Hold prob (${playerAName})`} value={`${metrics.holdProbA}%`} />}
        {metrics.holdProbB != null && <AlertRow icon={TrendingUp} label={`Hold prob (${playerBName})`} value={`${metrics.holdProbB}%`} />}
      </section>
      <div className="text-center text-[11px] text-muted-foreground/50 pt-2 border-t border-border">Métriques calculées · BSD Live</div>
    </div>
  );
}

// ─── Trigger button ──────────────────────────────────────────────────────

export function LiveDecisionsTrigger({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn(
      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold",
      "bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors", className)}>
      <Brain className="h-3.5 w-3.5" /> Décisions
    </button>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────

export function LiveDecisionsDrawer(props: Props) {
  const { open, onOpenChange, ...rest } = props;
  const isMobile = useIsMobile();
  const content = <DecisionsContent {...rest} />;
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2 text-sm"><Brain className="h-4 w-4 text-violet-400" />Décisions Live · {rest.playerAName} vs {rest.playerBName}</DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-sm"><Brain className="h-4 w-4 text-violet-400" />Décisions Live</SheetTitle>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}
