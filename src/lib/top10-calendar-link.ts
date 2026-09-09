// ─── Corrélation calendrier ↔ Top10 stratégies (E pill) ───
// Jointure : id normalisé d'abord (`bsd-12` ↔ `12`), repli noms normalisés
// home+away (même `normalizeTeamName` que `dedupeFootballMatches`).
// Top10 = prematch seul → pas de tag sur les matchs live.
import { normalizeTeamName } from "@/lib/normalize-team-name";
import { stratTag, type TopStratTag } from "@/components/football/fotmob-calendar-table";
import type { StrategyMatchEntry, StrategyTop5Key } from "@/lib/football-strategy-top5";
import type { FotmobCalMatch } from "@/components/football/fotmob-calendar-table";

const STRAT_IS_PROB: Record<string, boolean> = {
  bestTeam: false, bestTeam1x2: true, gagnant: true, bestAttack: false,
  bestDefense: false, doubleChance1X: true, doubleChance2X: true,
  doubleChance12: true, over15: true, under35: true, bttsYes: true,
  over65Corners: false,
};

const normId = (id: string) => id.replace(/^bsd-/, "");

export type TopTagsIndex = {
  byId: Map<string, TopStratTag[]>;
  byNames: Map<string, TopStratTag[]>;
};

export function buildTopTags(
  strategies: Partial<Record<StrategyTop5Key, StrategyMatchEntry[]>> | undefined,
): TopTagsIndex {
  const byId = new Map<string, TopStratTag[]>();
  const byNames = new Map<string, TopStratTag[]>();
  if (!strategies) return { byId, byNames };
  for (const [key, entries] of Object.entries(strategies)) {
    if (!Array.isArray(entries)) continue;
    for (const e of entries as StrategyMatchEntry[]) {
      const tag = stratTag(key, e.value, STRAT_IS_PROB[key] ?? true);
      const id = normId(String(e.matchId ?? ""));
      if (id) {
        const prev = byId.get(id);
        if (prev) prev.push(tag); else byId.set(id, [tag]);
      }
      const nk = `${normalizeTeamName(e.home?.teamName ?? "")}|${normalizeTeamName(e.away?.teamName ?? "")}`;
      if (nk !== "|") {
        const prev = byNames.get(nk);
        if (prev) prev.push(tag); else byNames.set(nk, [tag]);
      }
    }
  }
  return { byId, byNames };
}

export function topTagsForMatch(idx: TopTagsIndex | undefined, m: FotmobCalMatch): TopStratTag[] {
  if (!idx) return [];
  // Pas de tag sur le live : Top10 = prematch uniquement.
  if (m.live?.status === "LIVE" || m.live?.status === "HT") return [];
  const hit = idx.byId.get(normId(m.id));
  if (hit) return hit;
  return idx.byNames.get(`${normalizeTeamName(m.home.name)}|${normalizeTeamName(m.away.name)}`) ?? [];
}