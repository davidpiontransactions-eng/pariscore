"use client";

/**
 * Connexion du composant `LivePredictiveBetsWidget` aux flux réels.
 *
 * Le widget ne lit QUE le contrat `LiveBetsBundle` — il ne connaît aucune
 * route, aucun hook, aucun sport. Ce module fait le travail du plumbing :
 *
 *   route live du sport → adaptateur (`live-adapters.ts`) → moteur du sport →
 *   `LiveBetsBundle`
 *
 * Trois états, tous distincts et tous affichables :
 *   - `isLoading`  : premier fetch, on affiche un skeleton ;
 *   - `unavailable`: le flux répond mais ne porte pas les champs REQUIS
 *                    (hockey sans période, snooker sans points de frame) —
 *                    message explicite, jamais des probabilités de repli ;
 *   - `error`      : le flux est cassé, on garde le DERNIER bundle connu pour
 *                    ne pas faire clignoter le panneau, et on le signale.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adaptLivePayload,
  LIVE_UNAVAILABLE_REASON,
  type AnyLiveInput,
} from "@/lib/prediction/live-adapters";
import { footballLiveMarkets } from "@/lib/prediction/live-football";
import { basketballLiveMarkets } from "@/lib/prediction/live-basketball";
import { hockeyLiveMarkets } from "@/lib/prediction/live-hockey";
import { baseballLiveMarkets } from "@/lib/prediction/live-baseball";
import { handballLiveMarkets } from "@/lib/prediction/live-handball";
import { snookerLiveMarkets } from "@/lib/prediction/live-snooker";
import type { LiveBetsBundle } from "@/lib/prediction/live-common";

/** Intervalle de polling : 8 s, aligné sur la réactivité live du tennis. */
const POLL_MS = 8_000;

/** Route live de référence par sport — la SEIQUE carte sport → flux. */
export const LIVE_ROUTE_BY_SPORT: Record<string, string> = {
  football: "/api/football/live",
  basketball: "/api/fiba/scoreboard",
  hockey: "/api/hockey/live",
  baseball: "/api/baseball/live",
  handball: "/api/handball/live",
  snooker: "/api/v1/snooker/matches",
};

/**
 * Applique le moteur du sport à son entrée.
 *
 * Le `switch` est explicite plutôt qu'un registre indexé : TypeScript vérifie
 * alors le couplage entrée ↔ moteur. Un `Record<string, (i: AnyLiveInput) => …>`
 * accepterait n'importe quelle entrée avec n'importe quel moteur, et une
 * régression de dispatch (baseball envoyé au moteur hockey) ne serait visible
 * qu'à l'exécution, sur un match réel.
 */
function runEngine(sport: string, input: AnyLiveInput): LiveBetsBundle | null {
  switch (sport) {
    case "football":
      return footballLiveMarkets(input as Parameters<typeof footballLiveMarkets>[0]);
    case "basketball":
      return basketballLiveMarkets(input as Parameters<typeof basketballLiveMarkets>[0]);
    case "hockey":
      return hockeyLiveMarkets(input as Parameters<typeof hockeyLiveMarkets>[0]);
    case "baseball":
      return baseballLiveMarkets(input as Parameters<typeof baseballLiveMarkets>[0]);
    case "handball":
      return handballLiveMarkets(input as Parameters<typeof handballLiveMarkets>[0]);
    case "snooker":
      return snookerLiveMarkets(input as Parameters<typeof snookerLiveMarkets>[0]);
    default:
      return null;
  }
}

export type LiveBetsStatus = "loading" | "ready" | "unavailable" | "error";

export type UseLivePredictiveBets = {
  /** Bundle calculé — `null` tant qu'aucun flux exploitable n'est arrivé. */
  bundle: LiveBetsBundle | null;
  status: LiveBetsStatus;
  /** Message affichable, non nul seulement pour `unavailable` / `error`. */
  message: string | null;
  /** Timestamp du dernier SUCCESS (ms epoch) — null avant le premier. */
  updatedAt: number | null;
  /** Déclenche un refetch immédiat (utile au retour sur l'onglet). */
  refresh: () => void;
};

/**
 * Extrait le match live du payload d'une route.
 *
 * Les routes n'ont pas la même enveloppe : `{ matches: [...] }` (football,
 * handball, hockey, snooker) ou `{ liveGames: [...] }` (baseball) ou
 * `{ games: [...] }` (basketball FIBA). On essaie les trois puis, à défaut,
 * un tableau nu. Le match visé est celui dont l'id correspond, sinon le
 * PREMIER match live de la liste.
 */
export function extractLiveMatch(payload: unknown, matchId?: string | null): unknown | null {
  if (Array.isArray(payload)) {
    return matchId ? payload.find((m) => readId(m) === matchId) ?? null : payload[0] ?? null;
  }
  const root = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : null;
  if (!root) return null;
  const list = ["matches", "liveGames", "games", "data"].map((k) => root[k]).find(Array.isArray);
  if (!Array.isArray(list)) return null;
  return extractLiveMatch(list, matchId);
}

function readId(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as Record<string, unknown>;
  const v = m.id ?? m.gamePk ?? m.gameId ?? m.smid;
  return typeof v === "string" || typeof v === "number" ? String(v) : null;
}

/**
 * Construit le bundle depuis un payload brut, sans état ni réseau.
 *
 * Exporté pour être testé directement : c'est la fonction qui décide si un
 * match est affichable, et elle doit l'être SANS hook ni fetch.
 */
export function buildBundle(sport: string, payload: unknown, matchId?: string | null): {
  bundle: LiveBetsBundle | null;
  reason: string | null;
} {
  const route = LIVE_ROUTE_BY_SPORT[sport];
  if (!route) return { bundle: null, reason: `Sport « ${sport} » non pris en charge.` };

  const match = extractLiveMatch(payload, matchId);
  if (match === null) {
    return { bundle: null, reason: "Aucun match live dans le flux." };
  }

  const input = adaptLivePayload(sport, match);
  if (input === null) {
    return {
      bundle: null,
      reason:
        LIVE_UNAVAILABLE_REASON[sport] ??
        "Le flux live ne fournit pas les champs nécessaires au calcul (score, période, horloge).",
    };
  }

  try {
    const bundle = runEngine(sport, input);
    if (!bundle) return { bundle: null, reason: "Moteur introuvable pour ce sport." };
    return { bundle, reason: null };
  } catch (err) {
    // Un flux corrompu ne doit pas monter une exception jusqu'à la boundary
    // de l'onglet (même protection que `predictive-bets.tsx`, bug 9eo6).
    console.error(`[live-bets] moteur ${sport} en échec:`, err);
    return { bundle: null, reason: "Erreur de calcul sur les données live." };
  }
}

/**
 * Hook de connexion live pour un sport.
 *
 * @param sport - Slug du sport ("football" | "basketball" | …).
 * @param matchId - Id du match ciblé ; `null` = premier match live du flux.
 * @param options.enabled - `false` pour ne déclencher aucun fetch (panneau fermé).
 * @param options.route - Surcharge la route par défaut du sport. Utile quand la
 *   carte hôte affiche un flux différent de celui du moteur (basketball : la
 *   carte ESPN sert NBA/WNBA, le scoreboard FIBA sert l'international) — sans
 *   quoi le widget chercherait le match dans le mauvais flux.
 */
export function useLivePredictiveBets(
  sport: string,
  matchId?: string | null,
  options: { enabled?: boolean; route?: string } = {}
): UseLivePredictiveBets {
  const enabled = options.enabled ?? true;
  const routeOverride = options.route;
  const [bundle, setBundle] = useState<LiveBetsBundle | null>(null);
  const [status, setStatus] = useState<LiveBetsStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  // Le dernier bundle réussi est conservé pour qu'une coupure réseau breve
  // n'efface pas les marché affichés (clignotement à chaque tick raté).
  const lastGood = useRef<LiveBetsBundle | null>(null);

  const load = useCallback(async () => {
    const target = routeOverride ?? LIVE_ROUTE_BY_SPORT[sport];
    if (!target) {
      setStatus("unavailable");
      setMessage(`Sport « ${sport} » non pris en charge.`);
      return;
    }
    try {
      const res = await fetch(target, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload: unknown = await res.json();
      const built = buildBundle(sport, payload, matchId);
      if (built.bundle) {
        lastGood.current = built.bundle;
        setBundle(built.bundle);
        setStatus("ready");
        setMessage(null);
        setUpdatedAt(Date.now());
      } else {
        setBundle(lastGood.current);
        setStatus("unavailable");
        setMessage(built.reason);
      }
    } catch (err) {
      setBundle(lastGood.current);
      setStatus("error");
      setMessage(
        err instanceof Error && err.message
          ? `Flux live indisponible (${err.message}).`
          : "Flux live indisponible."
      );
    }
  }, [sport, matchId, routeOverride]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, load]);

  // Changement de match ou de sport : on repart d'un état neutre, sinon le
  // bundle du match précédent resterait affiché une seconde.
  useEffect(() => {
    lastGood.current = null;
    setBundle(null);
    setStatus("loading");
    setMessage(null);
    setUpdatedAt(null);
  }, [sport, matchId]);

  return useMemo(
    () => ({ bundle, status, message, updatedAt, refresh: () => void load() }),
    [bundle, status, message, updatedAt, load]
  );
}