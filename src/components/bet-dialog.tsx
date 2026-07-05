"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Trophy, Check } from "lucide-react";
import { useBankroll } from "@/hooks/use-bankroll";
import { useAnalytics } from "@/components/analytics-provider";
import { cn } from "@/lib/utils";

type Props = {
  match: {
    id: string;
    playerA: { name: string; color: string };
    playerB: { name: string; color: string };
    probA: number;
    probB: number;
    odds?: { bookmaker: string; decimalA: number; decimalB: number };
    // Optional context captured for advanced bankroll stats. Sourced from
    // TennisMatch.tournament and TennisMatch.stats.surface — absent on the
    // simplified mock match shape, hence optional.
    tournament?: string;
    surface?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BetDialog({ match, open, onOpenChange }: Props) {
  const t = useTranslations("bankroll.bet");
  const { addBet, stats } = useBankroll();
  const { track } = useAnalytics();

  const [betOn, setBetOn] = useState<"A" | "B">("A");
  const [stake, setStake] = useState("10");

  const handlePlaceBet = () => {
    if (!match) return;
    const stakeNum = parseFloat(stake);
    if (isNaN(stakeNum) || stakeNum <= 0) return;

    const isA = betOn === "A";
    const odd = match.odds
      ? isA
        ? match.odds.decimalA
        : match.odds.decimalB
      : 1 / (isA ? match.probA / 100 : match.probB / 100);

    addBet({
      matchId: match.id,
      playerA: match.playerA.name,
      playerB: match.playerB.name,
      betOn,
      betOnName: isA ? match.playerA.name : match.playerB.name,
      stake: stakeNum,
      odd,
      bookmaker: match.odds?.bookmaker,
      surface: match.surface,
      tournament: match.tournament,
    });

    track("bet_placed", {
      match_id: match.id,
      bet_on: betOn,
      bet_on_name: isA ? match.playerA.name : match.playerB.name,
      stake: stakeNum,
      odd,
      bookmaker: match.odds?.bookmaker,
    });

    onOpenChange(false);
    // Reset
    setBetOn("A");
    setStake("10");
  };

  if (!match) return null;

  const isA = betOn === "A";
  const potentialPayout = (parseFloat(stake) || 0) * (match.odds
    ? isA ? match.odds.decimalA : match.odds.decimalB
    : 1 / (isA ? match.probA / 100 : match.probB / 100));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-emerald-600" />
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {match.playerA.name} vs {match.playerB.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          {/* Bankroll status */}
          <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">{t("currentBankroll")}</span>
            <span className="font-mono font-bold tabular-nums">{stats.current.toFixed(2)} €</span>
          </div>

          {/* Bet on selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("betOn")}
            </Label>
            <RadioGroup
              value={betOn}
              onValueChange={(v) => setBetOn(v as "A" | "B")}
              className="grid grid-cols-2 gap-2"
            >
              <button
                type="button"
                onClick={() => setBetOn("A")}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-3 text-left transition-colors",
                  isA ? "border-emerald-500 bg-emerald-500/5" : "border-border/60 hover:bg-muted/40"
                )}
              >
                <RadioGroupItem value="A" id="bet-a" className="sr-only" />
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: match.playerA.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-semibold">{match.playerA.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {t("odds")} {match.odds?.decimalA.toFixed(2) ?? (100 / match.probA).toFixed(2)} · {match.probA}%
                  </div>
                </div>
                {isA && <Check className="h-4 w-4 text-emerald-600" />}
              </button>
              <button
                type="button"
                onClick={() => setBetOn("B")}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-3 text-left transition-colors",
                  !isA ? "border-emerald-500 bg-emerald-500/5" : "border-border/60 hover:bg-muted/40"
                )}
              >
                <RadioGroupItem value="B" id="bet-b" className="sr-only" />
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: match.playerB.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-semibold">{match.playerB.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {t("odds")} {match.odds?.decimalB.toFixed(2) ?? (100 / match.probB).toFixed(2)} · {match.probB}%
                  </div>
                </div>
                {!isA && <Check className="h-4 w-4 text-emerald-600" />}
              </button>
            </RadioGroup>
          </div>

          {/* Stake input */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("stake")}
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                min="0"
                step="1"
                className="flex-1"
              />
              {[5, 10, 25, 50].map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  onClick={() => setStake(String(q))}
                  className="px-2 text-xs"
                >
                  {q}€
                </Button>
              ))}
            </div>
          </div>

          {/* Potential payout */}
          <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {t("potentialPayout")}
            </span>
            <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {potentialPayout.toFixed(2)} €
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handlePlaceBet}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Check className="mr-1.5 h-3 w-3" />
              {t("placeBet")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
