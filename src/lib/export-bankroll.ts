// Bankroll export utilities — client-side download via Blob

import type { Bet } from "@/hooks/use-bankroll";

type BankrollStats = {
  initial: number;
  current: number;
  profit: number;
  roi: number;
  winRate: number;
  totalBets: number;
  settledCount: number;
  pendingCount: number;
  wonCount: number;
  lostCount: number;
  totalStaked: number;
  totalReturned: number;
};

/**
 * Convert bets to CSV string.
 * Columns: Date, Match, Bet On, Stake, Odd, Status, Payout, Profit, Bookmaker
 */
export function betsToCSV(bets: Bet[]): string {
  const header = "Date,Match,Bet On,Stake,Odd,Status,Payout,Profit,Bookmaker";
  const rows = bets.map((b) => {
    const match = `${b.playerA} vs ${b.playerB}`;
    const profit = b.payout !== undefined ? b.payout - b.stake : 0;
    const payout = b.payout ?? 0;
    // Escape commas in strings by wrapping in quotes
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
      b.placedAt,
      escape(match),
      escape(b.betOnName),
      b.stake.toFixed(2),
      b.odd.toFixed(2),
      b.status,
      payout.toFixed(2),
      profit.toFixed(2),
      b.bookmaker ? escape(b.bookmaker) : "",
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

/**
 * Build full JSON export with stats + bets + timestamp.
 */
export function betsToJSON(bets: Bet[], stats: BankrollStats): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      stats,
      bets,
    },
    null,
    2
  );
}

/**
 * Trigger a browser download of the given content.
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke after a delay to ensure download started
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Get a date string for filenames: 2026-07-05
 */
export function getDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
