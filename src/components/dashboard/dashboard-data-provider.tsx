"use client";

import { createContext, useContext, type ReactNode, useCallback } from "react";
import { usePrematchMatches } from "@/hooks/use-prematch-matches";
import { useFootballMatches } from "@/hooks/use-football-matches";

type DashboardData = {
  tennisData: ReturnType<typeof usePrematchMatches>["data"];
  footData: ReturnType<typeof useFootballMatches>["data"];
  tennisLoading: boolean;
  footLoading: boolean;
  tennisError: ReturnType<typeof usePrematchMatches>["error"];
  footError: ReturnType<typeof useFootballMatches>["error"];
  refetch: () => Promise<void>;
};

const Ctx = createContext<DashboardData | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { data: tennisData, isLoading: tennisLoading, error: tennisError, refetch: refetchTennis } =
    usePrematchMatches();
  const { data: footData, isLoading: footLoading, error: footError, refetch: refetchFoot } =
    useFootballMatches();

  const refetch = useCallback(async () => {
    await Promise.all([refetchTennis(), refetchFoot()]);
  }, [refetchTennis, refetchFoot]);

  return (
    <Ctx.Provider
      value={{
        tennisData,
        footData,
        tennisLoading,
        footLoading,
        tennisError,
        footError,
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
