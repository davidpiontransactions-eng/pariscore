"use client";

import useSWR from "swr";
import type { SportNode } from "@/types/sports-sidebar";
import {
  baseballToRaw,
  basketballToRaw,
  cs2ToRaw,
  cyclingToRaw,
  emptySportNode,
  f1ToRaw,
  footballToRaw,
  groupRawMatches,
  mmaToRaw,
  rugbySportNode,
  sortSportsTree,
  tennisToRaw,
} from "@/lib/sports-tree";
import { todayParisIso } from "@/lib/baseball/timezone";

/**
 * Hook agrégateur de l'arborescence multi-sports (sidebar 1xBet).
 *
 * Un seul appel SWR declenche le chargement parallele (Promise.allSettled) des
 * endpoints de chaque sport ; chaque sport est isole — l'echec de l'un ne vide
 * pas l'arbre entier (noeud degrade sans matchs). Aucune cle API requise :
 * uniquement des routes internes deja utilisees par les onglets.
 */

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadFootball(): Promise<SportNode> {
  try {
    const legacy = await getJson("/api/football/matches");
    const raw = footballToRaw(legacy?.matches ?? []);
    if (raw.length > 0) return groupRawMatches("football", raw);
    // API OK mais aucun match → nœud vide (jamais de données factices).
    return emptySportNode("football");
  } catch {
    // legacy indisponible → nœud vide. Jamais de repli sur la DB Prisma :
    // elle a pu recevoir des seeds mock_fl* par le passé (mêmes ids que
    // les équipes réelles BSD) — zéro donnée factice dans la sidebar.
    return emptySportNode("football");
  }
}

async function loadTennis(): Promise<SportNode> {
  try {
    // Fetch both live and prematch tennis matches
    const [liveJson, prematchJson] = await Promise.all([
      getJson("/api/tennis/live").catch(() => ({ matches: [] })),
      getJson("/api/tennis/prematch").catch(() => ({ matches: [] }))
    ]);
    
    // Combine live and prematch matches
    const allMatches = [
      ...(liveJson?.matches ?? []),
      ...(prematchJson?.matches ?? [])
    ];
    
    return groupRawMatches("tennis", tennisToRaw(allMatches));
  } catch {
    // If both endpoints fail, return degraded node
    return { ...emptySportNode("tennis"), degraded: true };
  }
}

async function loadCs2(): Promise<SportNode> {
  try {
    const json = await getJson("/api/cs2/matches");
    const list = Array.isArray(json) ? json : (json?.matches ?? []);
    return groupRawMatches("cs2", cs2ToRaw(list));
  } catch {
    return emptySportNode("cs2");
  }
}

async function loadBasketball(): Promise<SportNode> {
  try {
    const [nbaJson, wnbaJson, fibaJson] = await Promise.all([
      getJson("/api/nba/matches").catch(() => ({ matches: [] })),
      getJson("/api/wnba/matches").catch(() => ({ matches: [] })),
      getJson("/api/fiba/scoreboard").catch(() => ({ matches: [] })),
    ]);
    const nbaRaw = basketballToRaw("NBA", nbaJson?.matches ?? []);
    const wnbaRaw = basketballToRaw("WNBA", wnbaJson?.matches ?? []);
    // Normaliser les matchs FIBA pour le sidebar
    const fibaRaw = (fibaJson?.matches ?? []).map((m: any, i: number) => ({
      id: `fiba-${m.id ?? i}`,
      homeName: m.home?.name ?? m.home?.abbr ?? "TBD",
      awayName: m.away?.name ?? m.away?.abbr ?? "TBD",
      scheduledAt: m.date ?? null,
      isLive: m.status === "in",
      leagueId: "fiba-wc",
      leagueName: "FIBA WC",
      countryName: "International",
      countryCode: "INT",
    }));
    const node = groupRawMatches("basketball", [...nbaRaw, ...wnbaRaw, ...fibaRaw]);

    // Toujours inclure la structure ligue NBA/WNBA/FIBA même hors saison
    if (node.countries.length === 0) {
      return {
        ...node,
        countries: [
          {
            id: "USA",
            name: "USA",
            countryCode: "US",
            leagues: [
              { id: "NBA", name: "NBA", matchCount: 0, sportId: "basketball" as const, matches: [] },
              { id: "WNBA", name: "WNBA", matchCount: 0, sportId: "basketball" as const, matches: [] },
            ],
          },
        ],
      };
    }
    // Ajouter FIBA WC si pas déjà présent
    const hasFiba = node.countries.some((c) =>
      c.leagues.some((l) => l.id === "basketball:fiba-wc"),
    );
    if (!hasFiba && fibaRaw.length > 0) {
      node.countries.push({
        id: "basketball:international",
        name: "International",
        countryCode: "INT",
        leagues: [
          {
            id: "basketball:fiba-wc",
            name: "FIBA WC",
            matchCount: fibaRaw.length,
            sportId: "basketball" as const,
            matches: fibaRaw.map((m: any) => ({
              id: m.id,
              homeName: m.homeName,
              awayName: m.awayName,
              scheduledAt: m.scheduledAt,
              isLive: m.isLive,
              edgePct: undefined,
            })),
          },
        ],
      });
    }
    return node;
  } catch {
    return {
      ...emptySportNode("basketball"),
      countries: [
        {
          id: "USA",
          name: "USA",
          countryCode: "US",
          leagues: [
            { id: "NBA", name: "NBA", matchCount: 0, sportId: "basketball" as const, matches: [] },
            { id: "WNBA", name: "WNBA", matchCount: 0, sportId: "basketball" as const, matches: [] },
          ],
        },
      ],
    };
  }
}

async function loadMma(): Promise<SportNode> {
  try {
    const json = await getJson("/api/mma/fights");
    return groupRawMatches("mma", mmaToRaw(json?.fights ?? []));
  } catch {
    return emptySportNode("mma");
  }
}

async function loadCycling(): Promise<SportNode> {
  try {
    const json = await getJson("/api/cycling");
    return groupRawMatches("cycling", cyclingToRaw(json));
  } catch {
    return emptySportNode("cycling");
  }
}

async function loadF1(): Promise<SportNode> {
  try {
    const json = await getJson("/api/f1");
    return groupRawMatches("f1", f1ToRaw(json?.races ?? [], json?.race ?? null));
  } catch {
    return emptySportNode("f1");
  }
}

async function loadBaseball(): Promise<SportNode> {
  try {
    const json = await getJson(
      `/api/baseball/schedule?date=${encodeURIComponent(todayParisIso())}&league=ALL`,
    );
    return groupRawMatches("baseball", baseballToRaw(json?.matches ?? []));
  } catch {
    return emptySportNode("baseball");
  }
}

async function loadRugby(): Promise<SportNode> {
  try {
    const json = await getJson("/api/rugby/competitions");
    return rugbySportNode(json?.competitions ?? []);
  } catch {
    return emptySportNode("rugby");
  }
}

async function buildTree(): Promise<SportNode[]> {
  const [football, tennis, cs2, basketball, mma, cycling, f1, baseball, rugby] =
    await Promise.all([
      loadFootball(),
      loadTennis(),
      loadCs2(),
      loadBasketball(),
      loadMma(),
      loadCycling(),
      loadF1(),
      loadBaseball(),
      loadRugby(),
    ]);
  return sortSportsTree([
    football,
    tennis,
    cs2,
    basketball,
    mma,
    cycling,
    f1,
    baseball,
    rugby,
  ]);
}

export function useSportsTree() {
  return useSWR<SportNode[]>("sports-tree", buildTree, {
    refreshInterval: 60_000, // 1 min — données live plus fraîches
    revalidateOnFocus: true, // revalider quand l'utilisateur revient sur l'onglet
    revalidateOnReconnect: true,
    dedupingInterval: 30_000,
    errorRetryCount: 1,
    keepPreviousData: true,
  });
}
