// GET /api/tennis/player-stats
//
// Retourne les stats enrichies (Elo, ranking ATP/WTA, Elo Surface, rang
// surface, SPS, rang SPS) pour un batch de joueurs, lus directement depuis
// pariscore.db (via lib/tennis-stats/db.ts).
//
// Query params:
//   names=P1,P2,P3   — noms de joueurs séparés par virgule (requis, cap 50)
//   surface=Dur       — surface du match (Dur / Terre battue / Gazon / Hard / Clay / Grass)
//
// Réponse: { [normalizedName]: PlayerStats }
//
// Conception défensive — cette route ne lève JAMAIS de 500 : si la base est
// absente en local dev, elle renvoie 200 avec un objet vide `{}` et le UI
// dégrade en affichant `—` pour les valeurs manquantes.

import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { ValidationError } from "@/lib/api-error";
import { getPlayerStatsBatch } from "@/lib/tennis-stats/db";
import { fetchPlayers } from "@/lib/bsd-tennis-service";
import { computeL10SurfaceFromDb } from "@/lib/tennis-elo/l10-surface";
import { prisma } from "@/lib/prisma";
import type { PlayerStats } from "@/lib/tennis-stats/types";

/** Surface UI (FR) → surface L10 (EN, format TennisAbstract). */
function toL10Surface(surface: string): string {
  const s = surface?.trim().toLowerCase();
  if (!s) return "Hard";
  if (s.startsWith("terre") || s.startsWith("clay")) return "Clay";
  if (s.startsWith("gazon") || s.startsWith("grass")) return "Grass";
  return "Hard";
}

const CACHE_TTL_MS = 60_000; // 1 min — cohérent avec /api/tennis/prematch

const BSD_LOOKUP_CAP = 5; // max recherches BSD par requête (anti-abus)

type CacheEntry = { map: Record<string, unknown>; at: number; key: string };
let cache: CacheEntry | null = null;

/**
 * Repli BSD en second : quand un joueur est absent de la DB (aucun Elo ni
 * rang), on interroge l'API BSD par nom pour récupérer au moins son rang
 * officiel ATP/WTA courant — l'UI affiche `—` pour le reste.
 */
function hasAnyData(s: PlayerStats | undefined): boolean {
  if (!s) return false;
  return (
    s.elo != null ||
    s.atpRank != null ||
    s.wtaRank != null ||
    s.eloSurface != null ||
    s.sps != null
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const namesParam = searchParams.get("names") ?? "";
    const surface = searchParams.get("surface") ?? "Dur";

    const names = namesParam
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .slice(0, 50); // cap anti-abus

    if (names.length === 0) {
      throw new ValidationError("Missing 'names' param");
    }

    const cacheKey = `${names.join("|")}@${surface}`;
    const now = Date.now();
    if (cache && cache.key === cacheKey && now - cache.at < CACHE_TTL_MS) {
      return NextResponse.json(cache.map);
    }

    const map = getPlayerStatsBatch(names, surface) as Record<string, PlayerStats>;

    // Enrichissement L10 Surface (#12) : pour chaque joueur, calcule le score
    // L10 sur la surface du match depuis les tables Prisma (TennisPlayerMatch
    // + TennisEloSnapshot, cron hebdo). Dégradation gracieuse : si la table
    // est absente ou vide, `l10Surface` reste null et l'UI masque le badge.
    const l10Surface = toL10Surface(surface);
    for (const name of names) {
      try {
        const norm = name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9 ]/gi, " ")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        // Clé de sortie : norm avec espaces (index du map, cohérent avec
        // getPlayerStatsBatch). Clé DB : underscores (playerKey Prisma).
        const outKey = norm.replace(/\s+/g, " ");
        const playerKey = norm.replace(/\s+/g, "_");
        const res = await computeL10SurfaceFromDb(playerKey, l10Surface, prisma);
        if (res) {
          map[outKey] = { ...(map[outKey] ?? {}), l10Surface: res };
        }
      } catch {
        // Prisma KO → l10Surface reste null, l'UI masque le badge.
      }
    }

    // Repli BSD : joueurs absents de la DB → rang officiel courant via l'API
    // (cap 5 recherches pour ne pas exploser le budget requêtes du prematch).
    const missing = names.filter((n) => !hasAnyData(map[n]));
    if (missing.length > 0) {
      try {
        for (const name of missing.slice(0, BSD_LOOKUP_CAP)) {
          const res = await fetchPlayers({ search: name, limit: 5 });
          const nl = name.toLowerCase();
          const hit = (res.results ?? []).find(
            (p) =>
              p.name.toLowerCase() === nl ||
              p.name.toLowerCase().includes(nl) ||
              nl.includes(p.name.toLowerCase())
          );
          if (!hit) continue;
          const rank = hit.current_ranking?.position ?? null;
          const type = hit.current_ranking?.type ?? (hit.gender === "F" ? "WTA" : "ATP");
          if (rank != null) {
            map[name] = {
              ...(map[name] ?? {}),
              ...(type === "WTA" ? { wtaRank: rank } : { atpRank: rank }),
            };
          }
        }
      } catch {
        // BSD KO → les joueurs restent absents, l'UI affiche `—`.
      }
    }

    cache = { map, at: now, key: cacheKey };
    return NextResponse.json(map);
  } catch (err) {
    // Dégradation gracieuse — on ne casse jamais le prematch.
    return apiErrorHandler(err, "tennis/player-stats", () =>
      NextResponse.json({}, { status: 200 })
    );
  }
}
