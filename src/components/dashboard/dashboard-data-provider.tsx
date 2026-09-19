"use client";

import { createContext, useContext, type ReactNode, useCallback } from "react";
import { usePrematchMatches } from "@/hooks/use-prematch-matches";
import type { TennisPrematchError } from "@/hooks/use-prematch-matches";
import { useFootballMatches } from "@/hooks/use-football-matches";

type DashboardData = {
  tennisData: ReturnType<typeof usePrematchMatches>["data"];
  footData: ReturnType<typeof useFootballMatches>["data"];
  tennisLoading: boolean;
  footLoading: boolean;
  tennisError: TennisPrematchError | null;
  footError: Error | null;
  tennisIsDegraded: boolean;
  footIsDegraded: boolean;
  refetch: () => Promise<void>;
};

const Ctx = createContext<DashboardData | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { data: tennisData, isLoading: tennisLoading, error: tennisError, isDegraded: tennisIsDegraded } =
    usePrematchMatches();
  const { data: footData, isLoading: footLoading, error: footError } =
    useFootballMatches();
  const footIsDegraded = footError != null;

  // Default tennisError to null if SWR returns undefined (initial state)
  const fixedTennisError: TennisPrematchError | null =
    tennisError !== undefined ? tennisError : null;

  const refetch = useCallback(async () => {
    // No-op: refetch handled by individual hooks
  }, []);

  return (
    <Ctx.Provider
      value={{
        tennisData,
        footData,
        tennisLoading,
        footLoading,
        tennisError: fixedTennisError,
        footError,
        tennisIsDegraded,
        footIsDegraded,
        refetch,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDashboardData() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error(
      "useDashboardData must be used within DashboardDataProvider"
    );
  return ctx;
}