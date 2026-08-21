// Résultats automatiques — résolution des paris pending via API-Football.
// Stratégie : matcher le matchLabel du pari sur les fixtures d'une fenêtre
// de dates autour de la date de placement, puis évaluer le marché du pari.

import { prisma } from "@/lib/prisma";
import type { Bet } from "./types";

const AF_BASE = "https://v3.football.api-sports.io";
const FIXTURE_TTL_MS = 30 * 60 * 1000; // 30 min — les scores live évoluent

type AfFixture = {
  fixture: { id: number; date: string; status: { short: string } };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
  score: { halftime: { home: number | null; away: number | null } };
};

export type SettleOutcome = {
  betId: string;
  status: "won" | "lost" | "void" | "unresolved";
  reason: string;
};

/** Normalisation de nom d'équipe : minuscules, sans accents, sans tirets/points. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "PSG vs OM", "PSG - OM", "Paris Saint-Germain vs Olympique Marseille" → ["psg", "om"]. */
export function splitMatchLabel(label: string): [string, string] | null {
  const m = label.split(/\s+(?:vs\.?|v\.?|—|–|-)\s+/i);
  if (m.length !== 2) return null;
  const home = m[0].trim();
  const away = m[1].trim();
  if (!home || !away) return null;
  return [normalizeName(home), normalizeName(away)];
}

/** Inclusion souple : "psg" matche "paris saint germain". */
function nameMatches(query: string, teamName: string): boolean {
  const q = normalizeName(query);
  const t = normalizeName(teamName);
  if (!q || !t) return false;
  if (q === t) return true;
  // Initiales : "psg" ⊂ "paris saint germain" (mots complets)
  const words = t.split(" ");
  const initials = words.map((w) => w[0]).join("");
  if (q.length <= 5 && q === initials) return true;
  return t.includes(q) || q.includes(t);
}

async function afFetch(path: string): Promise<AfFixture[] | null> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${AF_BASE}${path}`, {
      headers: { "x-apisports-key": key },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429 || !res.ok) return null;
    const json: any = await res.json();
    return (json?.response ?? []) as AfFixture[];
  } catch {
    return null;
  }
}

/** Fixtures du jour ±1, avec cache KvStore (30 min). */
async function fixturesForDate(date: string): Promise<AfFixture[]> {
  const cacheKey = `bm:fixtures:${date}`;
  const cached = await prisma.kvStore.findUnique({ where: { key: cacheKey } });
  if (cached) {
    try {
      const parsed = JSON.parse(cached.value);
      if (Date.now() - new Date(parsed.at).getTime() < FIXTURE_TTL_MS) {
        return parsed.fixtures as AfFixture[];
      }
    } catch {
      /* cache corrompu → refetch */
    }
  }
  const fixtures = await afFetch(`/fixtures?date=${date}`);
  if (fixtures === null) return [];
  if (fixtures.length) {
    await prisma.kvStore.upsert({
      where: { key: cacheKey },
      create: { key: cacheKey, value: JSON.stringify({ at: new Date().toISOString(), fixtures }) },
      update: { value: JSON.stringify({ at: new Date().toISOString(), fixtures }) },
    });
  }
  return fixtures;
}

/** Cherche la fixture correspondant au pari (fenêtre J-2 → J+2 autour de placedAt). */
async function resolveFixture(bet: Bet): Promise<AfFixture | null> {
  const parts = splitMatchLabel(bet.matchLabel ?? "");
  if (!parts) return null;
  const [homeQ, awayQ] = parts;

  const base = new Date(bet.placedAt);
  const dates: string[] = [];
  for (let d = -2; d <= 2; d++) {
    const day = new Date(base.getTime() + d * 86400000);
    dates.push(day.toISOString().slice(0, 10));
  }

  for (const date of dates) {
    const fixtures = await fixturesForDate(date);
    for (const f of fixtures) {
      const homeOk = nameMatches(homeQ, f.teams.home.name) && nameMatches(awayQ, f.teams.away.name);
      const awayOk = nameMatches(awayQ, f.teams.home.name) && nameMatches(homeQ, f.teams.away.name);
      if (homeOk || awayOk) {
        // homeOk : le pari est dans le bon sens ; awayOk : les équipes sont inversées
        return awayOk && !homeOk ? { ...f, teams: { home: f.teams.away, away: f.teams.home } } : f;
      }
    }
  }
  return null;
}

const FINISHED = new Set(["FT", "AET", "PEN"]);

/** Évalue le marché d'un pari face au score final. Retourne won/lost/void, ou null si marché non supporté. */
export function evaluateMarket(bet: Bet, fixture: AfFixture): "won" | "lost" | "void" | null {
  const { home, away } = fixture.goals;
  if (home === null || away === null) return null;
  const total = home + away;
  const marketN = normalizeName(bet.market ?? "");
  const pickRaw = bet.pick ?? "";
  const pickN = normalizeName(pickRaw);

  // 1X2 / Match winner / Vainqueur — le pick est comparé aux équipes réelles
  // de la fixture puis, en repli, aux parties du matchLabel.
  const is1x2 =
    marketN.includes("1x2") ||
    marketN.includes("vainqueur") ||
    marketN.includes("match winner") ||
    marketN.includes("resultat") ||
    marketN === "";
  if (is1x2 && pickN) {
    const pickIsDraw = /^(x|n|nul|draw)$/.test(pickN);
    let pickIsHome = nameMatches(pickRaw, fixture.teams.home.name);
    let pickIsAway = nameMatches(pickRaw, fixture.teams.away.name);
    if (!pickIsHome && !pickIsAway && !pickIsDraw) {
      const parts = splitMatchLabel(bet.matchLabel ?? "");
      if (parts) {
        pickIsHome = nameMatches(pickN, parts[0]);
        pickIsAway = nameMatches(pickN, parts[1]);
      }
    }
    if (pickIsHome || pickIsAway || pickIsDraw) {
      const result = home > away ? "H" : home < away ? "A" : "D";
      const betOn = pickIsHome ? "H" : pickIsAway ? "A" : "D";
      return result === betOn ? "won" : "lost";
    }
  }

  // Over/Under — ligne lue sur le texte brut (la normalisation détruit le
  // point décimal), direction prioritairement depuis le pick.
  if (/over|under|plus de|moins de/.test(marketN + " " + pickN)) {
    const lineMatch = ((bet.market ?? "") + " " + pickRaw).match(/(\d+(?:[.,]\d+)?)/);
    const line = lineMatch ? parseFloat(lineMatch[1].replace(",", ".")) : 2.5;
    const pickDir = /over|plus/.test(pickN) ? "over" : /under|moins/.test(pickN) ? "under" : null;
    const marketDir =
      /over|plus/.test(marketN) && !/under|moins/.test(marketN)
        ? "over"
        : /under|moins/.test(marketN) && !/over|plus/.test(marketN)
          ? "under"
          : null;
    const dir = pickDir ?? marketDir;
    if (dir) {
      if (total === line) return "void"; // ligne entière exacte → remboursé
      return (total > line) === (dir === "over") ? "won" : "lost";
    }
  }

  // BTTS / Les deux équipes marquent
  if (/btts|les deux|both teams|deux equipes/.test(marketN + " " + pickN)) {
    const yes = /oui|yes|true/.test(pickN) || (/les deux marquent/.test(marketN) && !/non|no/.test(pickN));
    const both = home > 0 && away > 0;
    return both === yes ? "won" : "lost";
  }

  // Double chance (1X, X2, 12)
  if (/double chance/.test(marketN) || /^(1x|x2|12)$/.test(pickN)) {
    const result = home > away ? "H" : home < away ? "A" : "D";
    if (pickN === "1x") return result === "H" || result === "D" ? "won" : "lost";
    if (pickN === "x2") return result === "A" || result === "D" ? "won" : "lost";
    if (pickN === "12") return result !== "D" ? "won" : "lost";
  }

  return null; // marché non supporté — l'utilisateur règle manuellement
}

/**
 * Boucle d'auto-règlement : parcourt les paris pending (football),
 * résout la fixture, évalue le marché, écrit le résultat.
 */
export async function autoSettleBets(bankrollId?: string): Promise<{
  checked: number;
  settled: SettleOutcome[];
  unresolved: SettleOutcome[];
  skipped: string[];
}> {
  const pending = await prisma.bet.findMany({
    where: {
      status: "pending",
      sport: "football",
      ...(bankrollId ? { bankrollId } : {}),
    },
    orderBy: { placedAt: "desc" },
    take: 50,
  });

  const settled: SettleOutcome[] = [];
  const unresolved: SettleOutcome[] = [];
  const skipped: string[] = [];

  for (const bet of pending) {
    const fixture = await resolveFixture(bet as unknown as Bet);
    if (!fixture) {
      unresolved.push({ betId: bet.id, status: "unresolved", reason: "Fixture introuvable" });
      continue;
    }
    if (!FINISHED.has(fixture.fixture.status.short)) {
      unresolved.push({
        betId: bet.id,
        status: "unresolved",
        reason: `Match non terminé (${fixture.fixture.status.short})`,
      });
      continue;
    }
    const outcome = evaluateMarket(bet as unknown as Bet, fixture);
    if (!outcome) {
      skipped.push(bet.id);
      unresolved.push({ betId: bet.id, status: "unresolved", reason: "Marché non supporté en auto" });
      continue;
    }
    // void uniquement sur les règles de jeu (ligne exacte) — jamais de perte sur erreur
    const payout = outcome === "won" ? bet.stake * bet.odds : outcome === "void" ? bet.stake : 0;
    await prisma.bet.update({
      where: { id: bet.id },
      data: { status: outcome, payout, profit: payout - bet.stake, settledAt: new Date() },
    });
    settled.push({
      betId: bet.id,
      status: outcome,
      reason: `${fixture.teams.home.name} ${fixture.goals.home}-${fixture.goals.away} ${fixture.teams.away.name}`,
    });
  }

  return { checked: pending.length, settled, unresolved, skipped };
}