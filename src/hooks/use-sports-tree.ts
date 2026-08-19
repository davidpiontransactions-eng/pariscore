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
    const json = await getJson("/api/tennis/prematch");
    return groupRawMatches("tennis", tennisToRaw(json?.matches ?? []));
  } catch {
    // /api/tennis/prematch en erreur (503 : BSD+odds-api indisponibles, cache
    // périmé) → nœud marqué `degraded` plutôt qu'un « Tennis | 0 » trompeur.
    // Les matchs réels restent lisibles via l'onglet tennis (usePrematchMatches
    // gère son propre état de charge) — on ne prétend pas ici qu'il n'y a rien.
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

async function loadBasketball(kind: "nba" | "wnba"): Promise<SportNode> {
  try {
    const json = await getJson(`/api/${kind}/matches`);
    return groupRawMatches(
      kind,
      basketballToRaw(kind === "nba" ? "NBA" : "WNBA", json?.matches ?? []),
    );
  } catch {
    return emptySportNode(kind);
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
  const [football, tennis, cs2, nba, wnba, mma, cycling, f1, baseball, rugby] =
    await Promise.all([
      loadFootball(),
      loadTennis(),
      loadCs2(),
      loadBasketball("nba"),
      loadBasketball("wnba"),
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
    nba,
    wnba,
    mma,
    cycling,
    f1,
    baseball,
    rugby,
  ]);
}

export function useSportsTree() {
  return useSWR<SportNode[]>("sports-tree", buildTree, {
    refreshInterval: 300_000, // 5 min — economie VPS
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60_000,
    errorRetryCount: 1,
    keepPreviousData: true,
  });
}
