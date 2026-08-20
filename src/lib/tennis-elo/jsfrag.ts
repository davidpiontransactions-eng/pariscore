/**
 * jsfrag.ts — parsing des matchs individuels des fichiers jsfrags TennisAbstract.
 *
 * Chaque joueur ATP/WTA expose `https://tennisabstract.com/jsfrags/{Key}.js`
 * contenant `var player_frag = \`...\`` : les tables HTML récentes du joueur.
 * Les matchs individuels vivent dans `recent-results` (+ `recent-finals`
 * qui chevauche partiellement — dédoublonnage par clé).
 *
 * Colonnes (recent-results) : Date | Tournament | Surface | Rd | Rk | vRk |
 * Match | Score | DR | A% | DF% | 1stIn | 1st% | 2nd% | BPSvd | Time
 *
 * Cellule Match :
 *   - `<b>Joueur</b> d. <a href="...?p=X">Adversaire</a> [CZE]` → victoire
 *   - `<b>Joueur</b> lost to <a ...>Adversaire</a>` → défaite
 *   - `<b>Joueur</b> vs <a ...>Adversaire</a>` → match en cours (LIVE)
 */
import { normalizeKey } from "./scraper";

export type JsfragMatch = {
  date: string; // "13-Aug-2026"
  dateObj: Date;
  weekIso: string; // "2026-W34"
  tournament: string;
  surface: string; // "Hard" | "Clay" | "Grass"
  round: string;
  playerName: string;
  opponentName: string;
  opponentKey: string; // clé normalisée tennisabstract ("" si inconnu)
  result: "W" | "L" | "LIVE";
  score: string;
};

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

export function parseAbstractDate(s: string): Date | null {
  const m = s.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const mo = MONTHS[m[2]];
  if (mo === undefined) return null;
  return new Date(Date.UTC(+m[3], mo, +m[1]));
}

/** Semaine ISO (ex: "2026-W34") depuis une date UTC. */
export function weekIso(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // lundi = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // jeudi de la semaine ISO
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function strip(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parse tous les matchs individuels d'un fichier jsfrags.
 * Les tables récapitulatives (tour-years, chall-years, career-splits…) sont
 * ignorées car leurs cellules ne matchent pas la structure Date|Tournament|Surface.
 */
export function parseJsfragMatches(jsText: string, playerName: string): JsfragMatch[] {
  const out: JsfragMatch[] = [];
  for (const tbM of jsText.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)) {
    for (const rm of tbM[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const cells = rm[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
      if (!cells || cells.length < 8) continue;
      const dateStr = strip(cells[0]);
      const dateObj = parseAbstractDate(dateStr);
      if (!dateObj) continue; // pas une ligne de match individuel

      const surface = strip(cells[2]);
      const round = strip(cells[3]);
      const html = cells[6];
      const score = cells[7] ? strip(cells[7]) : "";

      const a = html.match(/<a[^>]*>([\s\S]*?)<\/a>/);
      const opponentName = a ? strip(a[1]) : "";
      const oppKey = a ? ((a[0].match(/p=([^&"']+)/) || [])[1] || "") : "";
      if (!opponentName) continue;

      const plain = html.replace(/<[^>]+>/g, " ");
      let result: JsfragMatch["result"];
      if (/ vs /.test(plain)) result = "LIVE";
      else if (/ d\. /.test(plain)) result = "W";
      else if (/ lost to /.test(plain)) result = "L";
      else continue; // ligne inconnue (retrait, WO…) — ignorée

      out.push({
        date: dateStr,
        dateObj,
        weekIso: weekIso(dateObj),
        tournament: strip(cells[1]),
        surface,
        round,
        playerName,
        opponentName,
        opponentKey: oppKey ? normalizeKey(opponentName) : "",
        result,
        score,
      });
    }
  }

  // Dédoublonnage (recent-finals chevauche recent-results sur les finales).
  const seen = new Set<string>();
  return out.filter((r) => {
    const k = `${r.date}|${r.round}|${r.opponentName}|${r.score}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}