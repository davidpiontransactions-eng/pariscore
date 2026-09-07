// Service de synchronisation snooker → Prisma (upsert atomique).
// Consomme le JSON produit par scripts/scrape_cuetracker.py (+ fallback snooker.org)
// et écrit dans les modèles SnookerPlayer / SnookerMatch.
//
// Robustesse : chaque enregistrement est isolé (try/catch) — une ligne en erreur
// est loggée et n'interrompt jamais la synchronisation des autres enregistrements.
// Idempotent : les upserts sont basés sur l'id (slug) ; relancer est sans effet.

import { prisma } from "../prisma";

export type CuetrackerPlayer = {
  id?: string;
  name: string;
  nationality?: string | null;
  ranking?: number | null;
  matches_played?: number;
  wins?: number;
  losses?: number;
  centuries?: number;
  max_break?: number | null;
  decider_win_pct?: number | null;
};

export type CuetrackerMatch = {
  source?: string;
  player_a?: string;
  player_b?: string;
  score_a?: number | string;
  score_b?: number | string;
  status?: string;
};

export type CuetrackerFile = {
  scraped_at?: string;
  source?: string;
  season?: number;
  players?: CuetrackerPlayer[];
  matches?: CuetrackerMatch[];
};

export type SyncResult = {
  ok: boolean;
  errors: number;
  players: { upserted: number; failed: number };
  matches: { upserted: number; failed: number };
};

/** Slug snooker (même convention que le scraper) : "Ronnie O'Sullivan" → "ronnie-osullivan". */
export function slug(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, "-")
    .trim();
}

function clampElo(n: number): number {
  return Math.max(400, Math.min(2200, n));
}

/** Champs dérivés calculables depuis les données CueTracker (même logique que la route /api/v1/snooker/players). */
function toPlayerData(p: CuetrackerPlayer) {
  const wins = p.wins ?? 0;
  const losses = p.losses ?? 0;
  const played = p.matches_played ?? wins + losses;
  const eloRating = clampElo(1500 + (wins - losses) * 15);

  return {
    name: p.name,
    eloRating,
    ...(p.nationality ? { nationality: p.nationality } : {}),
    ...(p.ranking != null ? { ranking: p.ranking } : {}),
    ...(played > 0 ? { winPct: (wins / played) * 100 } : {}),
    ...(p.centuries != null && played > 0 ? { centuryRate: (p.centuries / played) * 100 } : {}),
    ...(p.decider_win_pct != null ? { deciderWinPct: p.decider_win_pct * 100 } : {}),
    ...(p.max_break != null ? { avgBreak: p.max_break } : {}),
  };
}

/** Upsert atomique des joueurs (isolé par enregistrement). */
export async function syncPlayers(players: CuetrackerPlayer[] | undefined): Promise<SyncResult["players"]> {
  const counts = { upserted: 0, failed: 0 };
  for (const p of players ?? []) {
    try {
      if (!p.name) continue;
      const id = p.id || slug(p.name);
      const data = toPlayerData(p);
      await prisma.snookerPlayer.upsert({
        where: { id },
        update: data,
        create: { id, ...data },
      });
      counts.upserted++;
    } catch (e) {
      counts.failed++;
      if (counts.failed <= 5) console.warn(`  ⚠ joueur ${p.name}: ${(e as Error).message}`);
    }
  }
  return counts;
}

/** Upsert atomique des matchs (joueurs FK créés en amont si absents). */
export async function syncMatches(
  matches: CuetrackerMatch[] | undefined,
  fallbackDate = new Date(),
): Promise<SyncResult["matches"]> {
  const counts = { upserted: 0, failed: 0 };

  for (const m of matches ?? []) {
    try {
      const p1 = (m.player_a || "").trim();
      const p2 = (m.player_b || "").trim();
      if (!p1 || !p2) continue;

      // FK : garantit que les deux joueurs existent (création minimale si absents).
      const id1 = slug(p1);
      const id2 = slug(p2);
      await prisma.snookerPlayer.upsert({
        where: { id: id1 },
        update: {},
        create: { id: id1, name: p1 },
      });
      await prisma.snookerPlayer.upsert({
        where: { id: id2 },
        update: {},
        create: { id: id2, name: p2 },
      });

      const scoreA = Number(m.score_a) || 0;
      const scoreB = Number(m.score_b) || 0;
      const rawStatus = (m.status || "scheduled").toLowerCase();
      const status = ["live", "finished", "scheduled"].includes(rawStatus) ? rawStatus : "scheduled";
      const winnerId = status === "finished" ? (scoreA > scoreB ? id1 : scoreB > scoreA ? id2 : null) : null;

      const id = `${id1}_vs_${id2}`;
      const source = m.source || "cuetracker";
      const tournament = source === "snooker.org" ? "World Tour" : "";

      await prisma.snookerMatch.upsert({
        where: { id },
        update: { scoreA, scoreB, status, winnerId, source },
        create: {
          id,
          playerAId: id1,
          playerBId: id2,
          tournament,
          bestOf: 9,
          scoreA,
          scoreB,
          winnerId,
          scheduledAt: fallbackDate,
          status,
          source,
        },
      });
      counts.upserted++;
    } catch (e) {
      counts.failed++;
      if (counts.failed <= 5) console.warn(`  ⚠ match ${m.player_a} vs ${m.player_b}: ${(e as Error).message}`);
    }
  }
  return counts;
}

/** Pipeline complet : lit un fichier CueTracker JSON et synchronise joueurs + matchs. */
export async function syncFromJson(file: CuetrackerFile, fallbackDate = new Date()): Promise<SyncResult> {
  const players = await syncPlayers(file.players);
  const matches = await syncMatches(file.matches, fallbackDate);
  const errors = players.failed + matches.failed;
  return { ok: errors === 0, errors, players, matches };
}
