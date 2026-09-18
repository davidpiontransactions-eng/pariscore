// ─── Corrélation calendrier rugby ↔ Top10 stratégies (pill) ───
// Jointure : id normalisé + repli noms normalisés home+away.
// Top10 = prematch seul → pas de tag sur les matchs live.

import type { RugbyStrategyMatch, RugbyStrategyKey } from "@/lib/rugby-strategy-top";
import type { RugbyCalMatch } from "@/components/rugby/rugby-calendar-table";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type RugbyTopStratTag = {
  key: RugbyStrategyKey;
  label: string;
  emoji: string;
  value: string;
};

export type RugbyTopTagsIndex = {
  byId: Map<string, RugbyTopStratTag[]>;
  byNames: Map<string, RugbyTopStratTag[]>;
};

/* ------------------------------------------------------------------ */
/* Stratégies labels                                                   */
/* ------------------------------------------------------------------ */

const STRAT_SHORT: Record<RugbyStrategyKey, { label: string; emoji: string }> = {
  homeWin: { label: "Victoire dom.", emoji: "🏠" },
  awayWin: { label: "Victoire ext.", emoji: "✈️" },
  over415: { label: "Over 41,5", emoji: "🔥" },
  under515: { label: "Under 51,5", emoji: "❄️" },
  handicapHome: { label: "HCP -3,5", emoji: "📊" },
  handicapAway: { label: "HCP +3,5", emoji: "📊" },
  bttsYes: { label: "2 marquent", emoji: "🏉" },
  marginBand: { label: "Marge ≤7", emoji: "📏" },
  bestAttack: { label: "Attaque", emoji: "⚡" },
  bestDefense: { label: "Défense", emoji: "🧱" },
};

const STRAT_IS_PROB: Record<RugbyStrategyKey, boolean> = {
  homeWin: true,
  awayWin: true,
  over415: true,
  under515: true,
  handicapHome: true,
  handicapAway: true,
  bttsYes: true,
  marginBand: true,
  bestAttack: false,
  bestDefense: false,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

export function rugbyStratTag(key: RugbyStrategyKey, value: number): RugbyTopStratTag {
  const s = STRAT_SHORT[key] ?? { label: key, emoji: "★" };
  const isProb = STRAT_IS_PROB[key] ?? true;
  return { key, label: s.label, emoji: s.emoji, value: isProb ? `${Math.round(value)}%` : String(value) };
}

/* ------------------------------------------------------------------ */
/* Index builder                                                       */
/* ------------------------------------------------------------------ */

export function buildRugbyTopTags(
  strategies: Partial<Record<RugbyStrategyKey, RugbyStrategyMatch[]>> | undefined,
): RugbyTopTagsIndex {
  const byId = new Map<string, RugbyTopStratTag[]>();
  const byNames = new Map<string, RugbyTopStratTag[]>();
  if (!strategies) return { byId, byNames };

  for (const [key, entries] of Object.entries(strategies)) {
    if (!Array.isArray(entries)) continue;
    for (const e of entries as RugbyStrategyMatch[]) {
      const tag = rugbyStratTag(key as RugbyStrategyKey, e.value);
      // Index by match ID
      const id = String(e.matchId ?? "");
      if (id) {
        const prev = byId.get(id);
        if (prev) prev.push(tag);
        else byId.set(id, [tag]);
      }
      // Index by normalized team names
      const nk = `${normalizeTeamName(e.home?.name ?? "")}|${normalizeTeamName(e.away?.name ?? "")}`;
      if (nk !== "|") {
        const prev = byNames.get(nk);
        if (prev) prev.push(tag);
        else byNames.set(nk, [tag]);
      }
    }
  }
  return { byId, byNames };
}

/* ------------------------------------------------------------------ */
/* Lookup                                                              */
/* ------------------------------------------------------------------ */

export function rugbyTopTagsForMatch(
  idx: RugbyTopTagsIndex | undefined,
  m: RugbyCalMatch,
): RugbyTopStratTag[] {
  if (!idx) return [];
  // Pas de tag sur le live : Top10 = prematch uniquement.
  if (m.status === "inprogress") return [];

  // Recherche par ID
  const hit = idx.byId.get(m.id);
  if (hit) return hit;

  // Repli par noms normalisés
  return idx.byNames.get(
    `${normalizeTeamName(m.home.name)}|${normalizeTeamName(m.away.name)}`
  ) ?? [];
}
