"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { bmApi, type BetInput } from "@/lib/bet-manager/api";
import {
  capitalCurve,
  computeBankrollStats,
  groupStats,
  monthKey,
  oddsBucket,
} from "@/lib/bet-manager/stats";
import type { Bet, BetStatus } from "@/lib/bet-manager/types";

const ACTIVE_KEY = "bm-active-bankroll";

type StatsBundle = {
  stats: ReturnType<typeof computeBankrollStats>;
  bySport: ReturnType<typeof groupStats>;
  byBookmaker: ReturnType<typeof groupStats>;
  byType: ReturnType<typeof groupStats>;
  byMonth: ReturnType<typeof groupStats>;
  byOdds: ReturnType<typeof groupStats>;
  curve: ReturnType<typeof capitalCurve>;
};

function useActiveBankrollId(bankrolls: { id: string }[] | undefined) {
  // Hydration-safe : null au premier render (SSR + client), résolu en effet.
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (!bankrolls?.length) return;
    const saved = localStorage.getItem(ACTIVE_KEY);
    const valid = bankrolls.some((b) => b.id === saved);
    setActiveId(valid ? saved : bankrolls[0].id);
  }, [bankrolls]);
  const select = useCallback((id: string) => {
    localStorage.setItem(ACTIVE_KEY, id);
    setActiveId(id);
  }, []);
  return { activeId, select };
}

export function useBetManager() {
  const { data: bankrollsRes } = useSWR("/bm/bankrolls", () => bmApi.listBankrolls(), {
    revalidateOnFocus: false,
  });
  const bankrolls = bankrollsRes?.bankrolls ?? [];
  const { activeId, select } = useActiveBankrollId(bankrolls);

  const { data: betsRes, mutate: mutateBets, isLoading: betsLoading } = useSWR(
    activeId ? `/bm/bets?bankrollId=${activeId}` : null,
    () => bmApi.listBets({ bankrollId: activeId!, limit: 500 }),
    { revalidateOnFocus: false }
  );
  const bets = betsRes?.bets ?? [];

  const activeBankroll = bankrolls.find((b) => b.id === activeId) ?? null;
  const statsBundle: StatsBundle | null = activeBankroll
    ? {
        stats: computeBankrollStats(bets, activeBankroll.initial),
        bySport: groupStats(bets, (b) => b.sport || "—"),
        byBookmaker: groupStats(bets, (b) => b.bookmaker?.trim() || "—"),
        byType: groupStats(bets, (b) => b.betType || "single"),
        byMonth: groupStats(bets, (b) => monthKey(b.placedAt)),
        byOdds: groupStats(bets, (b) => oddsBucket(b.odds)),
        curve: capitalCurve(bets, activeBankroll.initial),
      }
    : null;

  const refresh = useCallback(() => {
    void mutateBets();
  }, [mutateBets]);

  const createBankroll = useCallback(
    async (name: string, initial: number, currency?: string) => {
      const res = await bmApi.createBankroll(name, initial, currency);
      return res.bankroll;
    },
    []
  );

  const deleteBankroll = useCallback(async (id: string) => {
    await bmApi.deleteBankroll(id);
    if (localStorage.getItem(ACTIVE_KEY) === id) localStorage.removeItem(ACTIVE_KEY);
    window.location.reload();
  }, []);

  const addBet = useCallback(
    async (input: BetInput) => {
      await bmApi.createBet(input);
      void refresh();
    },
    [refresh]
  );

  const settleBet = useCallback(
    async (id: string, status: BetStatus, payout?: number) => {
      await bmApi.settleBet(id, status, payout);
      void refresh();
    },
    [refresh]
  );

  const deleteBet = useCallback(
    async (id: string) => {
      await bmApi.deleteBet(id);
      void refresh();
    },
    [refresh]
  );

  const importCSV = useCallback(
    async (csv: string, fileName?: string) => {
      if (!activeId) return 0;
      const res = await bmApi.importCSV(activeId, csv, fileName);
      void refresh();
      return res.imported;
    },
    [activeId, refresh]
  );

  const autoSettle = useCallback(async (): Promise<{ settled: number; unresolved: number } | null> => {
    try {
      const res = await bmApi.autoSettle(activeId ?? undefined);
      void refresh();
      return { settled: res.settled, unresolved: res.unresolved };
    } catch (err: any) {
      toast.error("Auto-règlement impossible : " + (err.message ?? "erreur inconnue"));
      return null;
    }
  }, [activeId, refresh]);

  return {
    bankrolls,
    activeId,
    activeBankroll,
    selectBankroll: select,
    bets,
    betsLoading,
    stats: statsBundle,
    refresh,
    createBankroll,
    deleteBankroll,
    addBet,
    settleBet,
    deleteBet,
    importCSV,
    autoSettle,
  };
}

// Stats dérivées pour un lot de paris arbitraire (page Outils)
export function useBetsStats(bets: Bet[], initial: number): StatsBundle {
  return {
    stats: computeBankrollStats(bets, initial),
    bySport: groupStats(bets, (b) => b.sport || "—"),
    byBookmaker: groupStats(bets, (b) => b.bookmaker?.trim() || "—"),
    byType: groupStats(bets, (b) => b.betType || "single"),
    byMonth: groupStats(bets, (b) => monthKey(b.placedAt)),
    byOdds: groupStats(bets, (b) => oddsBucket(b.odds)),
    curve: capitalCurve(bets, initial),
  };
}