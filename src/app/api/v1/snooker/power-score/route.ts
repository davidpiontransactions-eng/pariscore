// GET /api/v1/snooker/power-score?player=<id|id1,id2>&limit=<n>&since=<YYYY-MM-DD>
// PowerScore L5 / L10 par joueur, calculé sur data/snooker_history.db.
//
// DEUX FENÊTRES, DEUX SCORES : `l5` = les 5 derniers matchs, `l10` = les 10
// derniers. Aucune moyenne entre les deux.
//
// Crash-proof, comme `/api/v1/snooker/backtest` : toujours HTTP 200, base
// absente → payload vide + `error`. Le SW ne doit jamais planter sur une route
// de statistiques.
//
// RATIONALE DE `since` — mesuré sur la base : la colonne `scores` (score par
// frame) est vide sur 43 % des matchs AVANT 2015 mais couvre 90-100 % depuis
// 2015 (100 % en 2021/2025/2026). Sans `since`, un joueur dont les 10 derniers
// matchs sont anciens se voit amputé de 3 métriques sur 7 (points/frame,
// centuries, écart de points) — coverage 0.56 au lieu de 1.
//
// ⚠️ `since` borne la FENÊTRE D'AFFICHAGE, jamais l'historique Élo : le
// rating est itératif, donc tronquer le corpus en 2015 ferait repartir chaque
// joueur de 1500 et le même joueur changerait de score selon l'URL.

import { NextResponse } from "next/server";
import { loadSnookerL10Rows } from "@/lib/snooker/snooker-history-l10";
import { computeSnookerPowerScores, type SnookerPowerResult } from "@/lib/snooker/power-score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL = 30 * 60_000; // 30 min : un match terminé ne change pas le passé
const DEFAULT_SINCE = "2015-01-01";
const MAX_LIMIT = 500;

type PublicResult = {
  player: string;
  rating: number;
  l5: SnookerPowerResult["l5"];
  l10: SnookerPowerResult["l10"];
};

export type SnookerPowerScoreResponse = {
  players: PublicResult[];
  /** Fenêtre d'analyse retenue (début ISO). */
  since: string;
  nMatches: number;
  source: "snookerdb";
  attribution: string;
  computedAt: string;
  error: string | null;
};

const _cache = new Map<string, { at: number; payload: SnookerPowerScoreResponse }>();

function emptyPayload(since: string, error: string): SnookerPowerScoreResponse {
  return {
    players: [],
    since,
    nMatches: 0,
    source: "snookerdb",
    attribution: "SnookerDB / CueTracker (GPL-3.0)",
    computedAt: new Date().toISOString(),
    error,
  };
}

const clampInt = (raw: string | null, fallback: number, min: number, max: number): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const playerParam = url.searchParams.get("player");
  const limit = clampInt(url.searchParams.get("limit"), 100, 1, MAX_LIMIT);
  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw === null ? DEFAULT_SINCE : sinceRaw === "" ? "" : sinceRaw;

  const cacheKey = `${playerParam ?? ""}|${limit}|${since}`;
  const hit = _cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return NextResponse.json(hit.payload);
  }

  try {
    const rows = loadSnookerL10Rows();
    if (rows.length === 0) {
      return NextResponse.json(
        emptyPayload(since, "Base absente — lancez node scripts/fetch-snooker-history.mjs"),
      );
    }

    const all = computeSnookerPowerScores(rows, since === "" ? undefined : { since });

    // Un joueur demandé → réponse ciblée (fiche joueur, H2H).
    if (playerParam) {
      const wanted = playerParam
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const players: PublicResult[] = [];
      for (const slug of wanted) {
        const found = all.get(slug);
        if (found) {
          players.push({ player: found.player, rating: Math.round(found.rating), l5: found.l5, l10: found.l10 });
        }
      }
      const payload: SnookerPowerScoreResponse = {
        players,
        since,
        nMatches: rows.length,
        source: "snookerdb",
        attribution: "SnookerDB / CueTracker (GPL-3.0)",
        computedAt: new Date().toISOString(),
        error: players.length < wanted.length ? `${wanted.length - players.length} joueur(s) introuvable(s) dans l'historique` : null,
      };
      _cache.set(cacheKey, { at: Date.now(), payload });
      return NextResponse.json(payload);
    }

    // Sinon : classement général, les fenêtres pleines d'abord (les plus
    // fiables), puis par L10 décroissant.
    const players: PublicResult[] = [...all.values()]
      .filter((v) => v.l10.matches >= 5)
      .sort((a, b) => {
        if (b.l10.matches !== a.l10.matches) return b.l10.matches - a.l10.matches;
        return b.l10.score - a.l10.score;
      })
      .slice(0, limit)
      .map((v) => ({ player: v.player, rating: Math.round(v.rating), l5: v.l5, l10: v.l10 }));

    const payload: SnookerPowerScoreResponse = {
      players,
      since,
      nMatches: rows.length,
      source: "snookerdb",
      attribution: "SnookerDB / CueTracker (GPL-3.0)",
      computedAt: new Date().toISOString(),
      error: null,
    };
    _cache.set(cacheKey, { at: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      emptyPayload(since, err instanceof Error ? err.message : "erreur power-score snooker"),
    );
  }
}