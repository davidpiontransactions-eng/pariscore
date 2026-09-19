/**
 * Client ESPN "hidden API" — gratuit, sans clé.
 * Docs: https://site.web.api.espn.com/apis/site/v2/sports/{sport}/{leagueId}/scoreboard
 * Note: site.api.espn.com retourne 403 (Akamai CDN) — utiliser site.web.api.espn.com.
 *
 * Renvoie des matchs normalisés (scoreboard) pour une fenêtre de dates donnée.
 * Aucune donnée inventée : si un champ manque, il est null/vide.
 */

import type { MatchStatus, RugbyMatch, TeamRef } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
          Referer: "https://www.espn.com/rugby/",
          Origin: "https://www.espn.com",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-site",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`ESPN ${url} -> ${res.status}`);
      const text = await res.text();
      return JSON.parse(text);
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await sleep(600 * (attempt + 1));
    }
  }
}

function parseTeam(raw: any): TeamRef {
  const team = raw?.team ?? {};
  return {
    id: String(team.id ?? ""),
    name: team.displayName ?? team.name ?? "Inconnu",
    abbreviation: team.abbreviation ?? "",
    logo: team.logo ?? teamLogo(String(team.id ?? "")),
    color: team.color ? `#${team.color}` : "#14b8a6",
  };
}

function parseScore(s: any): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/** Garde uniquement les caractères W/L/D d'une chaîne de forme (ex: "WWLD"). */
function cleanForm(s: any): string {
  if (typeof s !== "string") return "";
  const cleaned = s.replace(/[^WLD]/g, "");
  return cleaned.length >= 2 ? cleaned : "";
}

/** Détecte les statuts "résiduels" ESPN à écarter (annulé / reporté). */
function isCancelledOrPostponed(comp: any): boolean {
  const detail = String(comp?.status?.type?.detail ?? "").toLowerCase();
  if (!detail) return false;
  return detail.includes("cancelled") || detail.includes("postponed") || detail.includes("suspended");
}

/** Parse un event scoreboard ESPN → match normalisé (null = à écarter). */
function parseEvent(ev: any, competitionSlug: string): RugbyMatch | null {
  const comp = ev?.competitions?.[0];
  if (!comp) return null;
  // Annulés / reportés : on ne les comptabilise ni comme passés ni comme à venir.
  if (isCancelledOrPostponed(comp)) return null;
  const competitors = comp.competitors ?? [];
  const homeRaw = competitors.find((c: any) => c.homeAway === "home");
  const awayRaw = competitors.find((c: any) => c.homeAway === "away");
  if (!homeRaw || !awayRaw) return null;

  const state = comp.status?.type?.state ?? "pre";
  const status: MatchStatus =
    state === "post" ? "finished" : state === "in" ? "inprogress" : "scheduled";

  return {
    id: String(ev.id),
    competitionSlug,
    date: ev.date ?? comp.date ?? "",
    status,
    home: parseTeam(homeRaw),
    away: parseTeam(awayRaw),
    homeScore: parseScore(homeRaw.score),
    awayScore: parseScore(awayRaw.score),
    venue: comp.venue?.fullName ?? "",
    neutral: !!comp.neutralSite,
    form: {
      home: cleanForm(homeRaw.form ?? homeRaw.records?.[0]?.summary),
      away: cleanForm(awayRaw.form ?? awayRaw.records?.[0]?.summary),
    },
  };
}

/** Récupère le scoreboard d'une fenêtre (max ~6 mois fiable). */
export async function fetchScoreboard(
  espnSport: string,
  leagueId: string,
  start: Date,
  end: Date,
  competitionSlug: string
): Promise<RugbyMatch[]> {
  // ESPN rejette les plages `dates=A-B` (400) mais accepte `dates=AAAA`
  // (année civile entière, ~200 events). On boucle sur les années couvertes
  // puis on filtre sur la fenêtre demandée — même signature, moteur inchangé.
  const years: number[] = [];
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) years.push(y);
  const t0 = start.getTime();
  const t1 = end.getTime();
  const out: RugbyMatch[] = [];

  for (const y of years) {
    const url = `https://site.web.api.espn.com/apis/site/v2/sports/${espnSport}/${leagueId}/scoreboard?dates=${y}&limit=500`;
    const data = await fetchJson(url);
    const events: any[] = data?.events ?? [];
    for (const ev of events) {
      const m = parseEvent(ev, competitionSlug);
      if (!m || !m.date) continue;
      const t = new Date(m.date).getTime();
      if (!Number.isFinite(t) || t < t0 || t > t1) continue;
      out.push(m);
    }
  }
  return out;
}

/**
 * Construit la liste de fenêtres (start,end) couvrant `historyMonths` de
 * résultats passés et `futureDays` de fixtures à venir.
 */
export function buildWindows(
  historyMonths: number,
  futureDays: number,
  windowDays = 92
): { start: Date; end: Date }[] {
  const windows: { start: Date; end: Date }[] = [];
  const now = new Date();
  const historyEnd = new Date(now);
  const historyStart = new Date(now);
  historyStart.setUTCMonth(historyStart.getUTCMonth() - historyMonths);

  let cursor = new Date(historyStart);
  while (cursor < historyEnd) {
    const end = new Date(cursor);
    end.setUTCDate(end.getUTCDate() + windowDays);
    const capped = end < historyEnd ? end : historyEnd;
    windows.push({ start: new Date(cursor), end: new Date(capped) });
    cursor = new Date(capped);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const futureEnd = new Date(now);
  futureEnd.setUTCDate(futureEnd.getUTCDate() + futureDays);
  cursor = new Date(now);
  while (cursor < futureEnd) {
    const end = new Date(cursor);
    end.setUTCDate(end.getUTCDate() + windowDays);
    const capped = end < futureEnd ? end : futureEnd;
    windows.push({ start: new Date(cursor), end: new Date(capped) });
    cursor = new Date(capped);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return windows;
}

/** Logo ESPN par id d'équipe (CDN public). */
export function teamLogo(espnId: string): string {
  if (!espnId) return "";
  return `https://a.espncdn.com/i/teamlogos/rugby/teams/500/${espnId}.png`;
}
