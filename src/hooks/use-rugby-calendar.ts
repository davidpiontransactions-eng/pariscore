"use client";

/**
 * useRugbyCalendar — Hook pour le calendrier rugby style FotMob.
 * Fetch toutes les compétitions featured en parallèle et retourne
 * un tableau plat de RugbyCalMatch.
 */

import useSWR from "swr";
import type { RugbyCalMatch } from "@/components/rugby/rugby-calendar-table";

const FEATURED_SLUGS = [
  "six-nations",
  "top-14",
  "pro-d2",
  "premiership",
  "super-rugby-pacific",
  "united-rugby-championship",
  "champions-cup",
  "rugby-championship",
  "currie-cup",
  "npc",
  "major-league-rugby",
  "test-match",
];

const COMP_NAMES: Record<string, string> = {
  "six-nations": "Six Nations",
  "top-14": "Top 14",
  "pro-d2": "Pro D2",
  "premiership": "Premiership",
  "super-rugby-pacific": "Super Rugby Pacific",
  "united-rugby-championship": "United Rugby Championship",
  "champions-cup": "Champions Cup",
  "rugby-championship": "Rugby Championship",
  "currie-cup": "Currie Cup",
  "npc": "NPC (Nouvelle-Zélande)",
  "major-league-rugby": "Major League Rugby",
  "test-match": "Test-matchs internationaux",
};

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

export function useRugbyCalendar() {
  const { data, isLoading, error } = useSWR(
    "rugby-calendar-all",
    async () => {
      const base = typeof window !== "undefined" ? "" : "http://localhost:3000";
      const results = await Promise.allSettled(
        FEATURED_SLUGS.map(async (slug) => {
          // Pro D2 a sa propre API de prédictions
          const url =
            slug === "pro-d2"
              ? `${base}/api/rugby/prod2/predictions`
              : `${base}/api/rugby/predictions?slug=${slug}`;
          // Timeout de 8 secondes par requête
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          try {
            const res = await fetch(url, { cache: "no-store", signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) return null;
            return res.json();
          } catch {
            clearTimeout(timeout);
            return null;
          }
        })
      );

      const matches: RugbyCalMatch[] = [];

      for (const r of results) {
        if (r.status !== "fulfilled" || !r.value) continue;
        const data = r.value;
        const slug = data.competition?.slug ?? data.matches?.[0]?.match?.competitionSlug ?? "";
        const compName = COMP_NAMES[slug] ?? slug;

        for (const item of data.matches ?? []) {
          const m = item.match;
          const pred = item.prediction;
          if (!m) continue;

          matches.push({
            id: m.id ?? `${slug}-${m.home?.name}-${m.away?.name}`,
            scheduledAt: m.date ?? "",
            home: { name: m.home?.name ?? "TBD", logo: m.home?.logo ?? undefined },
            away: { name: m.away?.name ?? "TBD", logo: m.away?.logo ?? undefined },
            status: m.status ?? "scheduled",
            homeScore: m.homeScore ?? null,
            awayScore: m.awayScore ?? null,
            minute: null, // ESPN ne fournit pas la minute dans l'API predictions
            competition: slug,
            competitionName: compName,
            probPct: pred ? Math.round(pred.homeWinProb * 100) : undefined,
            confLabel: pred?.verdict === "backing-home" || pred?.verdict === "backing-away"
              ? "Très Forte"
              : pred?.verdict?.startsWith("leaning")
              ? "Élevée"
              : pred?.verdict === "toss-up"
              ? "Moyenne"
              : undefined,
            verdict: pred?.verdict,
            expectedHomeScore: pred?.expectedHomeScore,
            expectedAwayScore: pred?.expectedAwayScore,
            expectedMargin: pred?.expectedMargin,
            mostLikelyScore: pred?.mostLikelyScore,
          });
        }
      }

      return matches;
    },
    {
      revalidateOnFocus: false,
      refreshInterval: 60_000, // 1 min
    }
  );

  return {
    matches: data ?? [],
    loading: isLoading,
    error,
  };
}
