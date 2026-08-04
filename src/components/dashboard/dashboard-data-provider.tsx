"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePrematchMatches } from "@/hooks/use-prematch-matches";
import { useFootballMatches } from "@/hooks/use-football-matches";

type DashboardData = {
  tennisData: ReturnType<typeof usePrematchMatches>["data"];
  footData: ReturnType<typeof useFootballMatches>["data"];
  tennisLoading: boolean;
  footLoading: boolean;
  tennisError: ReturnType<typeof usePrematchMatches>["error"];
  footError: ReturnType<typeof useFootballMatches>["error"];
};

const Ctx = createContext<DashboardData | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { data: tennisData, isLoading: tennisLoading, error: tennisError } =
    usePrematchMatches();
  const { data: footData, isLoading: footLoading, error: footError } =
    useFootballMatches();

  return (
    <Ctx.Provider
      value={{
        tennisData,
        footData,
        tennisLoading,
        footLoading,
        tennisError,
        footError,
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
