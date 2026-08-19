"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTennisLiveStats, type TennisLiveStats, type TennisSetStats } from "@/hooks/use-tennis-live-stats";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatStatPercent } from "@/lib/tennis-format";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import type { LiveMatchState } from "@/hooks/use-live-matches";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  playerAName: string;
  playerBName: string;
  playerAPhoto?: string | null;
  playerBPhoto?: string | null;
  playerAColor?: string;
  playerBColor?: string;
  playerACountry?: string | null;
  playerBCountry?: string | null;
  liveState?: LiveMatchState | null;
}; 

// ─── Stat definitions ──────────────────────────────────────────────────

type StatBarDef = {
  p1Key: keyof TennisLiveStats; p2Key: keyof TennisLiveStats;
  label: string; suffix?: string; higherWins: boolean;
  category: "service" | "return" | "points";
};

const STAT_BARS: StatBarDef[] = [
  { p1Key: "p1_aces", p2Key: "p2_aces", label: "Aces", higherWins: true, category: "service" },
  { p1Key: "p1_df", p2Key: "p2_df", label: "Doubles fautes", higherWins: false, category: "service" },
  { p1Key: "p1_first_pct", p2Key: "p2_first_pct", label: "% 1er service", suffix: "%", higherWins: true, category: "service" },
  { p1Key: "p1_first_won", p2Key: "p2_first_won", label: "% pts 1er service", suffix: "%", higherWins: true, category: "service" },
  { p1Key: "p1_bp_saved", p2Key: "p2_bp_saved", label: "Balles de break sauvées", higherWins: true, category: "return" },
  { p1Key: "p1_ret_won", p2Key: "p2_ret_won", label: "% pts retour", suffix: "%", higherWins: true, category: "return" },
  { p1Key: "p1_total_pts", p2Key: "p2_total_pts", label: "% points gagnés", suffix: "%", higherWins: true, category: "points" },
];

const CATEGORY_LABELS: Record<string, string> = {
  service: "Service", return: "Retour & Break", points: "Points",
};

// ─── Helpers ────────────────────────────────────────────────────────────

function formatSetScore(liveState?: LiveMatchState | null): string {
  if (!liveState?.scoreA?.sets?.length) return "—";
  return liveState.scoreA.sets.map((s, i) => `${s}-${liveState.scoreB.sets[i] ?? 0}`).join("  ");
}

// ─── StatBar ────────────────────────────────────────────────────────────

function StatBar({ label, v1, v2, suffix = "", higherWins }: {
  label: string; v1: number | null; v2: number | null; suffix?: string; higherWins: boolean;
}) {
  if (v1 === null && v2 === null) return null;
  const p1Wins = v1 !== null && v2 !== null ? (higherWins ? v1 > v2 : v1 < v2) : null;
  const p2Wins = p1Wins !== null ? !p1Wins : null;
  const maxVal = Math.max(v1 ?? 0, v2 ?? 0, 1);
  const p1Pct = v1 !== null ? (v1 / maxVal) * 100 : 0;
  const p2Pct = v2 !== null ? (v2 / maxVal) * 100 : 0;
  const fmt = (v: number | null) => v !== null ? (suffix ? formatStatPercent(v) : String(v)) : "—";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cn("font-mono tabular-nums font-semibold min-w-[3rem] text-right", p1Wins ? "text-emerald-400" : "text-muted-foreground")}>{fmt(v1)}</span>
        <span className="text-[11px] font-medium text-muted-foreground text-center flex-1">{label}</span>
        <span className={cn("font-mono tabular-nums font-semibold min-w-[3rem] text-left", p2Wins ? "text-emerald-400" : "text-muted-foreground")}>{fmt(v2)}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full transition-all rounded-l-full", p1Wins ? "bg-emerald-500" : "bg-muted-foreground/40")} style={{ width: `${p1Pct}%` }} />
        <div className="w-px bg-background" />
        <div className={cn("h-full transition-all rounded-r-full", p2Wins ? "bg-emerald-500" : "bg-muted-foreground/40")} style={{ width: `${p2Pct}%` }} />
      </div>
    </div>
  );
}


// ─── Skeleton ───────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="space-y-6 p-1">
      {["service", "return", "points"].map((cat) => (
        <div key={cat} className="space-y-3">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: cat === "service" ? 4 : 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between"><Skeleton className="h-3 w-12" /><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-12" /></div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── StatsContent ───────────────────────────────────────────────────────

function StatsContent({
  matchId, playerAName, playerBName,
  playerAPhoto, playerBPhoto, playerAColor, playerBColor,
  playerACountry, playerBCountry, liveState,
}: Omit<Props, "open" | "onOpenChange">) {
  const { stats, loading, error, isDemo } = useTennisLiveStats(matchId);
  const [activeSet, setActiveSet] = useState<number>(0);
  const sets = stats?.perSet ?? [];
  const currentStats: TennisLiveStats | TennisSetStats | null = activeSet === 0 ? stats : (sets[activeSet - 1] ?? null);

  return (
    <div className="flex flex-col h-full max-h-[85vh] overflow-y-auto">
      {/* Header: players + score */}
      <div className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col items-center gap-1 min-w-0">
            <PlayerAvatar name={playerAName} photoUrl={playerAPhoto} color={playerAColor} size="md" countryCode={playerACountry} />
            <span className="text-xs font-semibold truncate max-w-[100px]">{playerAName}</span>
          </div>
          <div className="flex flex-col items-center">
            {liveState && (
              <span className="font-mono text-lg font-black tabular-nums">
                {liveState.scoreA.sets.map((s, i) => (
                  <span key={i}>
                    <span className={s > (liveState.scoreB.sets[i] ?? 0) ? "text-emerald-400" : ""}>{s}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className={(liveState.scoreB.sets[i] ?? 0) > s ? "text-emerald-400" : ""}>{liveState.scoreB.sets[i] ?? 0}</span>
                    {i < liveState.scoreA.sets.length - 1 && " "}
                  </span>
                ))}
              </span>
            )}
            {liveState && (
              <span className="text-[11px] text-muted-foreground mt-0.5">
                Jeu {liveState.scoreA.games}-{liveState.scoreB.games}
              </span>
            )}
            {isDemo && <Badge variant="outline" className="mt-1 text-[11px] border-amber-500/50 text-amber-500">Démo</Badge>}
          </div>
          <div className="flex flex-col items-center gap-1 min-w-0">
            <PlayerAvatar name={playerBName} photoUrl={playerBPhoto} color={playerBColor} size="md" countryCode={playerBCountry} />
            <span className="text-xs font-semibold truncate max-w-[100px]">{playerBName}</span>
          </div>
        </div>
      </div>

      {/* Set tabs */}
      {sets.length > 0 && (
        <div className="flex gap-1 border-b border-border px-4 py-2 overflow-x-auto">
          <button type="button" onClick={() => setActiveSet(0)} className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-semibold", activeSet === 0 ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:text-foreground")}>Global</button>
          {sets.map((_, i) => (
            <button key={i} type="button" onClick={() => setActiveSet(i + 1)} className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-semibold", activeSet === i + 1 ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:text-foreground")}>Set {i + 1}</button>
          ))}
        </div>
      )}

      {/* Stats body */}
      <div className="flex-1 px-4 py-4 space-y-6">
        {loading && <StatsSkeleton />}
        {error && !stats && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">Statistiques live non disponibles pour ce match</p>
          </div>
        )}
        {!loading && currentStats && (
          <>
            {(["service", "return", "points"] as const).map((cat) => {
              const bars = STAT_BARS.filter((b) => b.category === cat);
              if (!bars.some((b) => (currentStats as any)[b.p1Key] != null || (currentStats as any)[b.p2Key] != null)) return null;
              return (
                <div key={cat} className="space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{CATEGORY_LABELS[cat]}</h4>
                  <div className="space-y-4">
                    {bars.map((bar) => (
                      <StatBar key={bar.p1Key} label={bar.label} v1={(currentStats as any)[bar.p1Key] ?? null} v2={(currentStats as any)[bar.p2Key] ?? null} suffix={bar.suffix} higherWins={bar.higherWins} />
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="text-center text-[11px] text-muted-foreground pt-2 border-t border-border">
              {stats?._mock ? "Données de démonstration" : "Statistiques live · BSD"}
            </div>
          </>
        )}
        {!loading && !currentStats && !error && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">En attente des données live...</div>
        )}
      </div>
    </div>
  );
}

// ─── Trigger button ─────────────────────────────────────────────────────

export function LiveStatsTrigger({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors", className)}>
      <BarChart3 className="h-3.5 w-3.5" /> Stats live
    </button>
  );
}

// ─── Main component (responsive: vaul mobile / sheet desktop) ───────────

export function LiveTennisStatsDrawer(props: Props) {
  const { open, onOpenChange, ...rest } = props;
  const isMobile = useIsMobile();
  const content = <StatsContent {...rest} />;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4 text-emerald-400" />Statistiques live</DrawerTitle>
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
          <SheetTitle className="flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4 text-emerald-400" />Statistiques live</SheetTitle>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}