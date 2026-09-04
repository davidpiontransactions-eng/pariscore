import useSWR from "swr";
import type { TennisTop10Payload } from "@/lib/tennis-top10";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<TennisTop10Payload>;
  });

/**
 * Top 10 joueurs tennis par métrique (zone centrale).
 *
 * SWR avec 60s dedup (même TTL que le top5 sidebar).
 */
export function useTennisTop10(
  metric: string,
  surface: string,
  period: string,
) {
  const qs = new URLSearchParams({ metric, surface, period });
  const { data, error, isLoading } = useSWR<TennisTop10Payload>(
    `/api/tennis/top10?${qs.toString()}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  return {
    entries: data?.entries ?? [],
    meta: data?.meta,
    error,
    isLoading,
    isReady: data != null,
  };
}
