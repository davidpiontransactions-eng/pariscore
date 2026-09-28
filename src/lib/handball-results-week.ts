// Fenêtre de résultats terminés — SOURCE UNIQUE partagée par :
//   1. /api/handball/results-today (table des 7 derniers jours, onglet
//      « Résultats ») ;
//   2. /api/handball/backtest-today (recalcul « live » = LA table remplit le
//      backtest quotidien au lieu du seul snapshot — cf. route).
// Fusion de 2 sources avec dédup (snapshot prioritaire sur l'historique) :
//   - `handball_match_history` : profondeur hebdo (cron PM2 lundi + runs) ;
//   - snapshot Flashscore (cron quotidien) : J-1 + finis du jour, le plus frais.
// Les flags live périmés sont reclassés « finished » par `toHandballMatch`
// (resolveHandballLifecycle — bead 4pvy).

import { readFileSync } from "fs";
import {
  isFlashscoreFresh,
  resolveHandballDataFile,
  teamHashId,
  toHandballMatch,
  type FlashscoreMatch,
} from "@/lib/handball-flashscore";
import { parisDateOf } from "@/lib/handball-backtest-today";
import { loadRecentTotals } from "@/lib/handball-history-db";
import type { HistoryMatch } from "@/lib/handball-history-stats";
import type { HandballMatch } from "@/lib/handball-data";

export type ResultsSource = "history+flashscore" | "flashscore" | "history" | "none";

export type FinishedWindow = {
  matches: HandballMatch[];
  scrapedAt: string | null;
  source: ResultsSource;
  stale: boolean;
  /** Fenêtre : première journée incluse (ISO). */
  since: string;
  /** Jour courant Europe/Paris (ISO). */
  today: string;
};

/**
 * Clé de dédup insensible casse/accents — supprime AUSSI les codes pays entre
 * parenthèses des noms d'équipes d'une source : « Al Ahly (Egy) » ≡ « Al Ahly »
 * (sinon le même match apparaît 2× dans la semaine : feedback visuel user).
 */
export function resultsDedupKey(home: string, away: string, date: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\([^)]*\)/g, "") // codes pays « (Egy) », « (Ger) »…
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  return `${norm(home)}|${norm(away)}|${date}`;
}

/** Ligne `handball_match_history` → HandballMatch « finished ». */
function historyToMatch(h: HistoryMatch): HandballMatch {
  // time_utc souvent absent (source snapshot) → midi par défaut (affichage seule).
  const t =
    h.timeUtc && /^\d{2}:\d{2}/.test(h.timeUtc)
      ? h.timeUtc.length === 5
        ? `${h.timeUtc}:00`
        : h.timeUtc.slice(0, 8)
      : "12:00:00";
  return {
    id: teamHashId(`hist|${h.date}|${h.home}|${h.away}`),
    league: {
      id: teamHashId(h.league || "Handball"),
      name: h.league || "Handball",
      country: h.country || "",
      countryCode: "",
    },
    home: { id: teamHashId(h.home), name: h.home },
    away: { id: teamHashId(h.away), name: h.away },
    kickoff: `${h.date}T${t}Z`,
    status: "finished",
    score: {
      home: h.homeGoals,
      away: h.awayGoals,
      ...(h.homeHalf != null && h.awayHalf != null
        ? { homeHalf: h.homeHalf, awayHalf: h.awayHalf }
        : {}),
    },
  };
}

/**
 * Matchs terminés des `days` derniers jours (Europe/Paris, défaut 7),
 * fusionnés et dédupés, tri kickoff DESC.
 * `days = 1` → uniquement la journée courante (usage backtest quotidien).
 */
export function loadFinishedWindow(days = 7): FinishedWindow {
  const clamped = Math.min(7, Math.max(1, Math.floor(days)));
  const today = parisDateOf(new Date());
  const since = parisDateOf(new Date(Date.now() - (clamped - 1) * 86_400_000));

  const merged = new Map<string, HandballMatch>();
  let historyCount = 0;
  for (const h of loadRecentTotals(clamped - 1)) {
    if (h.date < since || h.date > today) continue;
    merged.set(resultsDedupKey(h.home, h.away, h.date), historyToMatch(h));
    historyCount++;
  }

  let scrapedAt: string | null = null;
  let snapshotCount = 0;
  try {
    const filePath = resolveHandballDataFile("flashscore_handball.json");
    if (filePath) {
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      scrapedAt = typeof data.scraped_at === "string" ? data.scraped_at : null;
      const raw = (data.matches || []) as FlashscoreMatch[];
      for (let i = 0; i < raw.length; i++) {
        const m = raw[i];
        if (!m.home || !m.away) continue;
        const hm = toHandballMatch(m, i);
        if (hm.status !== "finished" || !hm.score) continue;
        const d = parisDateOf(hm.kickoff);
        if (d < since || d > today) continue;
        merged.set(resultsDedupKey(m.home, m.away, d), hm); // le snapshot écrase
        snapshotCount++;
      }
    }
  } catch {
    // Snapshot illisible : l'historique seul porte la fenêtre.
  }

  const source: ResultsSource =
    historyCount > 0 && snapshotCount > 0
      ? "history+flashscore"
      : snapshotCount > 0
        ? "flashscore"
        : historyCount > 0
          ? "history"
          : "none";

  return {
    matches: [...merged.values()].sort((a, b) => b.kickoff.localeCompare(a.kickoff)),
    scrapedAt,
    source,
    stale: scrapedAt != null ? !isFlashscoreFresh(scrapedAt) : false,
    since,
    today,
  };
}
