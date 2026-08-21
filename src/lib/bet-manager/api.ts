// Client API du module Bet Manager — fetch wrapper simple

import type { Bankroll, Bet, BetStatus, BetType } from "./types";

const BASE = "/api/v1/bm";

async function j<T>(p: Promise<Response>): Promise<T> {
  const res = await p;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `Erreur HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type BetInput = {
  bankrollId: string;
  betType?: BetType;
  sport?: string;
  competition?: string;
  matchLabel?: string;
  market?: string;
  pick?: string;
  stake: number;
  odds?: number;
  status?: BetStatus;
  bookmaker?: string;
  tipster?: string;
  category?: string;
  tags?: string;
  closingOdd?: number;
  placedAt?: string;
  note?: string;
  legs?: { matchLabel: string; market?: string; pick?: string; odds: number }[];
};

export const bmApi = {
  // Bankrolls
  listBankrolls: () => j<{ bankrolls: (Bankroll & { _count: { bets: number } })[] }>(fetch(`${BASE}/bankrolls`)),
  createBankroll: (name: string, initial: number, currency = "EUR") =>
    j<{ bankroll: Bankroll }>(
      fetch(`${BASE}/bankrolls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, initial, currency }),
      })
    ),
  updateBankroll: (id: string, data: Partial<Pick<Bankroll, "name" | "initial" | "note">>) =>
    j<{ bankroll: Bankroll }>(
      fetch(`${BASE}/bankrolls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    ),
  deleteBankroll: (id: string) => j<{ ok: true }>(fetch(`${BASE}/bankrolls/${id}`, { method: "DELETE" })),

  // Paris
  listBets: (params: { bankrollId?: string; status?: string; sport?: string; search?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.bankrollId) q.set("bankrollId", params.bankrollId);
    if (params.status) q.set("status", params.status);
    if (params.sport) q.set("sport", params.sport);
    if (params.search) q.set("search", params.search);
    if (params.limit) q.set("limit", String(params.limit));
    return j<{ bets: Bet[]; total: number }>(fetch(`${BASE}/bets?${q}`));
  },
  createBet: (input: BetInput) =>
    j<{ bet: Bet }>(
      fetch(`${BASE}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
    ),
  updateBet: (id: string, data: Partial<BetInput & { payout?: number }>) =>
    j<{ bet: Bet }>(
      fetch(`${BASE}/bets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    ),
  settleBet: (id: string, status: BetStatus, payout?: number) =>
    j<{ bet: Bet }>(
      fetch(`${BASE}/bets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, payout }),
      })
    ),
  deleteBet: (id: string) => j<{ ok: true }>(fetch(`${BASE}/bets/${id}`, { method: "DELETE" })),

  // Import
  importCSV: (bankrollId: string, csv: string, fileName?: string) =>
    j<{ imported: number }>(
      fetch(`${BASE}/import/csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankrollId, csv, fileName }),
      })
    ),

  // Auto-règlement via API-Football
  autoSettle: (bankrollId?: string) =>
    j<{
      ok: boolean;
      checked: number;
      settled: number;
      unresolved: number;
      details: {
        settled: { betId: string; status: string; reason: string }[];
        unresolved: { betId: string; status: string; reason: string }[];
      };
    }>(
      fetch(`${BASE}/auto-settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankrollId }),
      })
    ),
};