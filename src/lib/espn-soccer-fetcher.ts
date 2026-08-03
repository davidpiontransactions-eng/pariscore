// Connecteur ESPN public (gratuit, sans clé) pour la timeline momentum foot.
//
// Pipeline : scoreboard (résolution eventId par noms + date) → summary
// (commentary : tirs/corners/buts par minute + boxscore : totaux).
//
// Détails clés du payload ESPN :
//   - commentary[] { play.{type.text, team.displayName, clock.displayValue,
//     participants[], text} } → actions minute-par-minute.
//     Buts : type.text commence par "Goal", play.team = équipe qui marque,
//     participants[0] = buteur. Corner : play.team = équipe qui la concède,
//     le gagnant est dans le texte "Corner, <Team>."
//   - keyEvents[] → buts avec buteur (participants[0]) + assistant.
//   - boxscore.teams[].statistics[] → possessionPct, totalShots, shotsOnTarget,
//     wonCorners.
//
// Parser défensif : jamais de throw. Chaque fonction retourne null/[] en cas
// d'échec — l'appelant (route stats) bascule en fallback BSD.

import type { MatchEvent, MatchSide, TimelineTotals } from "./football-timeline";
import type { PressureBucketInput } from "./football-pressure-index";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const BUCKET_MIN = 5;
const MAX_MIN = 127;

// ─── Mapping BSD league id → slug ESPN (socle repris de server.js ESPN_SOCCER_SLUG) ──
const LEAGUE_SLUG: Record<number, string> = {
  61: "fra.1", 62: "fra.2",
  39: "eng.1", 40: "eng.2", 45: "eng.fa", 48: "eng.league_cup",
  140: "esp.1", 141: "esp.2",
  78: "ger.1", 79: "ger.2",
  135: "ita.1", 136: "ita.2",
  88: "ned.1", 94: "por.1", 203: "tur.1", 144: "bel.1",
  188: "sco.1", 207: "sui.1", 113: "swe.1", 283: "rou.1",
  103: "nor.1", 119: "den.1", 244: "fin.1", 192: "irl.1",
  71: "bra.1", 72: "bra.2", 128: "arg.1", 239: "col.1",
  240: "ecu.1", 253: "usa.1", 218: "mex.1",
  98: "jpn.1", 292: "kor.1", 900: "aus.1",
  2: "uefa.champions", 3: "uefa.europa",
  13: "conmebol.libertadores",
};

export function leagueToEspnSlug(leagueId: number | null | undefined): string | null {
  if (leagueId == null) return null;
  return LEAGUE_SLUG[Number(leagueId)] ?? null;
}

// ─── Matching de noms (défensif, tolère "Man United" ↔ "Manchester United") ──
const STOP = new Set(["fc", "cf", "club", "ac", "as", "de", "la", "el", "cd", "ud", "sc", "rc", "afc", "bk", "if", "sk", "fk"]);

function sig(n: unknown): string {
  return String(n || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .filter((w) => w.length >= 2)
    .join(" ");
}

function sigKey(n: unknown): string {
  return (
    String(n || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(" ")
      .filter((w) => w.length >= 3 && !STOP.has(w))
      .sort((a, b) => b.length - a.length)
      .join(" ") || sig(n)
  );
}

function namesMatch(a: unknown, b: unknown): boolean {
  const A = sig(a);
  const B = sig(b);
  if (!A || !B) return false;
  if (A === B) return true;
  const aKey = sigKey(a);
  const bKey = sigKey(b);
  if (aKey && aKey === bKey) return true;
  return (A.includes(B) || B.includes(A)) && Math.min(A.length, B.length) >= 5;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function howVal(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseMinute(clockDisplay: unknown): number | null {
  const raw = String(clockDisplay ?? "");
  if (!raw || raw.includes("--")) return null;
  const m = Number.parseInt(raw, 10);
  if (!Number.isFinite(m) || m < 0) return null;
  return Math.min(m, MAX_MIN);
}

function sideOf(homeName: string, awayName: string, displayName: unknown): MatchSide | null {
  if (namesMatch(displayName, homeName)) return "home";
  if (namesMatch(displayName, awayName)) return "away";
  return null;
}

function goalTypeOf(text: string): MatchEvent["goalType"] {
  if (/own goal/i.test(text)) return "own";
  if (/penalt|penal/i.test(text)) return "penalty";
  return "regular";
}

// ─── Cache scoreboard (multi-worker safe via globalThis) ─────────────────────
type BoardEntry = { at: number; events: { id: string; home: string; away: string }[] };
const g = globalThis as unknown as { __espnBoard?: Record<string, BoardEntry> };
function boardCache(): Record<string, BoardEntry> {
  if (!g.__espnBoard) g.__espnBoard = {};
  return g.__espnBoard;
}

async function espnFetch(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function formatDateYmd(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

function shiftDate(ymd: string, days: number): string {
  const dt = new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatDateYmd(dt);
}

async function fetchScoreboard(
  slug: string,
  ymd: string,
): Promise<{ id: string; home: string; away: string }[] | null> {
  const key = `${slug}|${ymd}`;
  const cache = boardCache();
  const hit = cache[key];
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.events;

  const url = `${ESPN_BASE}/${slug}/scoreboard/dates/${ymd}`;
  const data = (await espnFetch(url)) as { events?: unknown[] } | null;
  const events: { id: string; home: string; away: string }[] = [];
  for (const raw of Array.isArray(data?.events) ? data!.events : []) {
    const ev = raw as { id?: unknown; competitions?: unknown[] };
    if (!ev?.id) continue;
    const comp = ev.competitions?.[0] as { competitors?: unknown[] } | undefined;
    const competitors = (Array.isArray(comp?.competitors) ? comp.competitors : []) as {
      homeAway?: string;
      team?: { displayName?: string };
    }[];
    const home = competitors.find((c) => c.homeAway === "home")?.team?.displayName ?? "";
    const away = competitors.find((c) => c.homeAway === "away")?.team?.displayName ?? "";
    if (!home || !away) continue;
    events.push({ id: String(ev.id), home, away });
  }
  cache[key] = { at: Date.now(), events };
  return events.length ? events : null;
}

// ─── Résolution eventId ──────────────────────────────────────────────────────

export interface ESPNResolvedEvent {
  eventId: string;
  slug: string;
  homeEspnName: string;
  awayEspnName: string;
}

/**
 * Résout l'eventId ESPN d'un match par noms + date (scoreboard de la ligue,
 * avec repli sur j-1/j-2 pour les matchs terminés). null → fallback BSD.
 */
export async function resolveESPNEvent(ctx: {
  homeTeam: string;
  awayTeam: string;
  date?: string;
  leagueId: number | null | undefined;
}): Promise<ESPNResolvedEvent | null> {
  const slug = leagueToEspnSlug(ctx.leagueId);
  if (!slug || (!ctx.homeTeam && !ctx.awayTeam)) return null;

  const base = ctx.date ? new Date(ctx.date) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  const ymd = formatDateYmd(base);
  const candDates = [ymd, shiftDate(ymd, -1), shiftDate(ymd, -2)];

  for (const d of candDates) {
    const board = await fetchScoreboard(slug, d);
    if (!board?.length) continue;
    for (const ev of board) {
      const homeOk = ctx.homeTeam ? namesMatch(ev.home, ctx.homeTeam) : false;
      const awayOk = ctx.awayTeam ? namesMatch(ev.away, ctx.awayTeam) : false;
      if (homeOk && awayOk) {
        return { eventId: ev.id, slug, homeEspnName: ev.home, awayEspnName: ev.away };
      }
    }
  }
  return null;
}

// ─── Parsing summary → timeline ──────────────────────────────────────────────

export interface ESPNTimelineReport {
  buckets: PressureBucketInput[];
  events: MatchEvent[];
  totals: TimelineTotals;
  homeName: string;
  awayName: string;
}

interface LocalBucket {
  start: number;
  corners: { home: number; away: number };
  sot: { home: number; away: number };
  shots: { home: number; away: number };
}

const SHOT_TYPES = new Set([
  "Shot On Target",
  "Shot Off Target",
  "Shot Blocked",
  "Shot Hit Woodwork",
  "Shot Saved",
]);

/** Un play du commentary. */
interface PlayRecord {
  type?: { text?: string; type?: string };
  team?: { displayName?: string };
  clock?: { displayValue?: string };
  participants?: { athlete?: { displayName?: string } }[];
  text?: string;
}

/**
 * Récupère et parse la timeline ESPN d'un match (summary).
 * Retourne null si le payload est inexploitable (fallback appelant).
 */
export async function fetchESPNTimeline(event: ESPNResolvedEvent): Promise<ESPNTimelineReport | null> {
  const url = `${ESPN_BASE}/${event.slug}/summary?event=${event.eventId}`;
  const data = (await espnFetch(url)) as {
    header?: { competitions?: unknown };
    boxscore?: { teams?: unknown };
    commentary?: unknown;
    keyEvents?: unknown;
  } | null;

  const comp = data?.header?.competitions?.[0] as { competitors?: unknown } | undefined;
  if (!comp) return null;
  const competitors = (Array.isArray(comp.competitors) ? comp.competitors : []) as {
    homeAway?: string;
    team?: { displayName?: string };
  }[];
  const homeName = competitors.find((c) => c.homeAway === "home")?.team?.displayName ?? event.homeEspnName;
  const awayName = competitors.find((c) => c.homeAway === "away")?.team?.displayName ?? event.awayEspnName;
  if (!homeName || !awayName) return null;

  const buckets = new Map<number, LocalBucket>();
  const ensureBucket = (start: number): LocalBucket => {
    let b = buckets.get(start);
    if (!b) {
      b = { start, corners: { home: 0, away: 0 }, sot: { home: 0, away: 0 }, shots: { home: 0, away: 0 } };
      buckets.set(start, b);
    }
    return b;
  };

  const events: MatchEvent[] = [];

  // ── commentary : corners, buts, tirs par minute ──
  const commentary = Array.isArray(data?.commentary)
    ? (data!.commentary as PlayRecord[])
    : [];

  for (const play of commentary) {
    const text = play?.type?.text ?? play?.text ?? "";
    const minute = parseMinute(play?.clock?.displayValue);
    if (minute === null) continue;
    const side = sideOf(homeName, awayName, play?.team?.displayName);
    if (!side) continue;

    // Corner : play.team = équipe qui la concède → gagnant dans le texte.
    if (text.includes("Corner")) {
      const winnerInText = (text.match(/^Corner, ([^.]+)\./) ?? [])[1];
      const winnerSide = winnerInText ? sideOf(homeName, awayName, winnerInText) : null;
      const cornerSide = winnerSide ?? other(side);
      ensureBucket(Math.floor(minute / BUCKET_MIN) * BUCKET_MIN).corners[cornerSide] += 1;
      continue;
    }

    // But (commentary) — buteur = participants[0].
    if (text.startsWith("Goal") || (play?.type?.text ?? "").startsWith("Goal")) {
      events.push({
        minute,
        kind: "goal",
        side,
        scorer: play?.participants?.[0]?.athlete?.displayName ?? null,
        teamName: play?.team?.displayName ?? null,
        xg: null,
        score: null,
        goalType: goalTypeOf(text),
      });
      continue;
    }

    // Tirs (proxy SOT) : tirs cadrés = Shot On Target / buts / pénaltys convertis.
    const isSot = text === "Shot On Target" || text.startsWith("Goal") || text === "Penalty - Scored";
    if (SHOT_TYPES.has(text) || isSot || text.includes("Penalty")) {
      const b = ensureBucket(Math.floor(minute / BUCKET_MIN) * BUCKET_MIN);
      b.shots[side] += 1;
      if (isSot) b.sot[side] += 1;
    }
  }

  // ── keyEvents : synthèse des buts (dédoublonnée par minute+camp) ──
  const keyEvents = Array.isArray(data?.keyEvents)
    ? (data!.keyEvents as {
        type?: { text?: string };
        clock?: { displayValue?: string };
        team?: { displayName?: string };
        participants?: { athlete?: { displayName?: string } }[];
      }[])
    : [];

  const seenGoals = new Set(events.filter((e) => e.kind === "goal").map((e) => `${e.minute}:${e.side}`));
  for (const ke of keyEvents) {
    const text = ke.type?.text ?? "";
    if (!text.startsWith("Goal")) continue;
    const minute = parseMinute(ke.clock?.displayValue);
    if (minute === null) continue;
    const side = sideOf(homeName, awayName, ke.team?.displayName);
    if (!side) continue;
    if (seenGoals.has(`${minute}:${side}`)) continue;
    seenGoals.add(`${minute}:${side}`);
    events.push({
      minute,
      kind: "goal",
      side,
      scorer: ke.participants?.[0]?.athlete?.displayName ?? null,
      teamName: ke.team?.displayName ?? null,
      xg: null,
      score: null,
      goalType: goalTypeOf(text),
    });
  }

  // ── Totaux boxscore → possession, tirs, tirs cadrés, corners ──
  const totals: TimelineTotals = {
    possession: { home: 50, away: 50 },
    corners: { home: 0, away: 0 },
    shots: { home: 0, away: 0 },
    sot: { home: 0, away: 0 },
  };
  const boxTeams = Array.isArray(data?.boxscore?.teams)
    ? (data!.boxscore!.teams as {
        team?: { displayName?: string };
        statistics?: { name?: string; displayValue?: string }[];
      }[])
    : [];
  for (const t of boxTeams) {
    const side = sideOf(homeName, awayName, t.team?.displayName);
    if (!side) continue;
    const stats = t.statistics ?? [];
    const statOf = (name: string): number => {
      const row = stats.find((s) => s.name === name);
      return row != null ? howVal(row.displayValue) : 0;
    };
    totals.possession[side] = Math.round(statOf("possessionPct") * 10) / 10;
    totals.shots[side] = Math.round(statOf("totalShots"));
    totals.sot[side] = Math.round(statOf("shotsOnTarget"));
    totals.corners[side] = Math.round(statOf("wonCorners"));
  }

  // ── Danger proxy final (tirs + 1.8·corners) par bucket → contrat moteur ──
  const out: PressureBucketInput[] = [...buckets.values()]
    .sort((a, b) => a.start - b.start)
    .map((b) => ({
      start: b.start,
      danger: {
        home: b.shots.home + 1.8 * b.corners.home,
        away: b.shots.away + 1.8 * b.corners.away,
      },
      corners: { home: b.corners.home, away: b.corners.away },
      sot: { home: b.sot.home, away: b.sot.away },
    }));

  return { buckets: out, events, totals, homeName, awayName };
}

function other(s: MatchSide): MatchSide {
  return s === "home" ? "away" : "home";
}
