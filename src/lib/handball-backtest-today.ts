// Backtest quotidien des stratégies handball — picks du jour réglés sur les résultats du jour.
//
// Réutilisation du moteur existant :
// - Picks : computeHandballStrategyTop8 (handball-strategy-top8.ts), appelé match par match
//   avec une forme construite UNIQUEMENT sur les matchs terminés antérieurs au coup d'envoi
//   (walk-forward, aucun lookahead intrajour — mirror du walk-forward de runHandballBacktest).
// - Cotes / règlement : miroir de SPECS de handball-backtest.ts. Justification du satellite :
//   SPECS n'est pas exporté et runHandballBacktest n'expose ni fenêtre « jour » ni picks
//   individuels (il n'agrège que des totaux par stratégie) → le règlement est re-déclaré ici,
//   une seule fois, avec les constantes importées du moteur (aucune logique de pick dupliquée).
//
// Fuseau : toutes les dates sont calculées sur Europe/Paris (jour civil local), pas sur UTC.

import type { HandballMatch } from "./handball-data";
import {
  HANDBALL_STRATEGY_DEFS,
  computeHandballStrategyTop8,
  type HandballSide,
  type HandballStrategyKey,
} from "./handball-strategy-top8";
import {
  AVG_ODDS_BTTS_30,
  AVG_ODDS_FAV_1X2,
  AVG_ODDS_HANDICAP,
  AVG_ODDS_HT_LEADER,
  AVG_ODDS_OVER_55_5,
  AVG_ODDS_UNDER_62_5,
  LINE_BTTS,
  LINE_HANDICAP,
  LINE_OVER,
  LINE_UNDER,
} from "./handball-backtest";

// ─── Fuseau / dates ───

export const HANDBALL_RESULTS_TZ = "Europe/Paris";

/** Formatteur « AAAA-MM-JJ » sur Europe/Paris (en-CA = ISO). */
const PARIS_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: HANDBALL_RESULTS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Jour civil Europe/Paris (« 2026-09-24 ») d'un instant.
 * Gère le DST via Intl (CET +1 / CEST +2) — pas d'offset fixe.
 * Date invalide → "" (le match est alors exclu des filtres du jour).
 */
export function parisDateOf(iso: string | Date | number): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return PARIS_DAY_FORMATTER.format(d);
}

// ─── Types ───

export type DailyBetResult = "won" | "lost" | "void";

export type DailyPick = {
  match: {
    id: number;
    kickoff: string;
    home: string;
    away: string;
    league: string;
    /** Score final « 28 - 26 » */
    score: string | null;
    /** Score mi-temps « 14 - 13 » */
    ht: string | null;
  };
  /** Côté joué si la stratégie porte sur un côté, sinon null (marché de total) */
  pick: HandballSide | null;
  /** Libellé affiché du pick (« Domicile », « Over 55.5 », …) */
  pickLabel: string;
  /** Cote simulée jouée (flat 1u, miroir handball-backtest.ts) */
  odds: number;
  result: DailyBetResult;
  /** Profit net en unités : odds-1 si gagné, -1 si perdu, 0 si nul */
  profitU: number;
};

export type DailyStrategyRow = {
  strategy: HandballStrategyKey;
  label: string;
  emoji: string;
  market: string;
  odds: number;
  /** Paris règlementés (les nuls exclus : mise retournée) */
  nBets: number;
  won: number;
  lost: number;
  /** Picks annulés (ex. mi-temps absente) */
  voids: number;
  profitU: number;
  roiPct: number | null;
  hitRate: number | null;
  picks: DailyPick[];
  /** Raison quand 0 pari */
  note?: string;
};

export type DailyStrategyBacktest = {
  /** Jour civil Europe/Paris des matchs considérés */
  date: string;
  timezone: string;
  /** Matchs du jour terminés avec score (picks réglés) */
  nFinishedToday: number;
  /** Matchs du jour encore en cours / à venir au moment du calcul */
  nPendingToday: number;
  strategies: DailyStrategyRow[];
  global: {
    nBets: number;
    won: number;
    lost: number;
    voids: number;
    profitU: number;
    roiPct: number | null;
    hitRate: number | null;
  };
  methodology: string;
  computed_at: string;
};

// ─── Constantes de règlement (miroir SPECS, handball-backtest.ts) ───

type Settlement = { odds: number; market: string };

const SETTLEMENT: Record<HandballStrategyKey, Settlement> = {
  bestTeam: { odds: AVG_ODDS_FAV_1X2, market: "1X2 favori (forme L5/L10)" },
  bestTeam1x2: { odds: AVG_ODDS_FAV_1X2, market: "1X2 favori (forces CMP)" },
  over55: { odds: AVG_ODDS_OVER_55_5, market: `Over ${LINE_OVER}` },
  under62: { odds: AVG_ODDS_UNDER_62_5, market: `Under ${LINE_UNDER}` },
  handicap: { odds: AVG_ODDS_HANDICAP, market: `Handicap favori -${LINE_HANDICAP}` },
  btts30: { odds: AVG_ODDS_BTTS_30, market: `Les deux à ${LINE_BTTS}+` },
  htLeader: { odds: AVG_ODDS_HT_LEADER, market: "Leader MT (pick forme)" },
  valueBet: { odds: AVG_ODDS_FAV_1X2, market: "EV+ vs cote moyenne" },
};

const STRATEGY_KEYS = Object.keys(SETTLEMENT) as HandballStrategyKey[];

const METHODOLOGY =
  "Backtest du jour : pour chaque match du jour terminé (Europe/Paris), le pick de chaque " +
  "stratégie est généré par le moteur Top 8 avec une forme construite uniquement sur les " +
  "matchs terminés antérieurs au coup d'envoi (aucun lookahead, walk-forward comme " +
  "runHandballBacktest). Règlement identique au moteur walk-forward : match nul = pari 1X2 " +
  "perdant, Over/Under aux lignes fixes, nul de mi-temps = perdant, mi-temps absente = annulé " +
  "(mise retournée, exclue des paris). Cotes moyennes 1xbet simulées (favori 1X2 @1.55, " +
  "Over @1.90, Under @1.85, handicap -4.5 @1.90, BTTS 30+ @1.80, leader MT @1.70), mise flat 1u. " +
  "Échantillon d'une journée : ROI à lire comme un instantané, pas comme une tendance.";

// ─── Règlement ───

function winnerOf(m: HandballMatch): HandballSide | "draw" {
  const s = m.score;
  if (!s || s.home === s.away) return "draw";
  return s.home > s.away ? "home" : "away";
}

/** Règle le pick d'une stratégie sur le score final (miroir SPECS de handball-backtest.ts). */
function settleDailyPick(
  key: HandballStrategyKey,
  m: HandballMatch,
  pick: HandballSide | null,
): DailyBetResult {
  const s = m.score;
  if (!s) return "void";
  switch (key) {
    case "bestTeam":
    case "bestTeam1x2":
    case "valueBet": {
      if (!pick) return "void";
      const w = winnerOf(m);
      if (w === "draw") return "lost"; // nul = perdant : on joue le 1 ou le 2, jamais le X
      return w === pick ? "won" : "lost";
    }
    case "over55":
      return s.home + s.away > LINE_OVER ? "won" : "lost";
    case "under62":
      return s.home + s.away < LINE_UNDER ? "won" : "lost";
    case "handicap": {
      if (!pick) return "void";
      const margin = pick === "home" ? s.home - s.away : s.away - s.home;
      return margin > LINE_HANDICAP ? "won" : "lost";
    }
    case "btts30":
      return s.home >= LINE_BTTS && s.away >= LINE_BTTS ? "won" : "lost";
    case "htLeader": {
      if (!pick) return "void";
      const hh = s.homeHalf;
      const ha = s.awayHalf;
      if (hh == null || ha == null) return "void"; // MT absente → annulé
      if (hh === ha) return "lost"; // MT à égalité = perdant (miroir SPECS)
      return (pick === "home") === (hh > ha) ? "won" : "lost";
    }
    default:
      return "void";
  }
}

/** Libellé affiché du pick. */
function pickLabelFor(key: HandballStrategyKey, pick: HandballSide | null): string {
  const side = pick === "home" ? "Domicile" : pick === "away" ? "Extérieur" : null;
  switch (key) {
    case "over55":
      return `Over ${LINE_OVER}`;
    case "under62":
      return `Under ${LINE_UNDER}`;
    case "btts30":
      return `Les deux à ${LINE_BTTS}+`;
    case "handicap":
      return `Favori -${LINE_HANDICAP} (${side?.toLowerCase() ?? "—"})`;
    case "htLeader":
      return `Leader MT ${side?.toLowerCase() ?? "—"}`;
    default:
      return side ?? "—";
  }
}

function scoreStr(m: HandballMatch): string | null {
  const s = m.score;
  return s ? `${s.home} - ${s.away}` : null;
}

function htStr(m: HandballMatch): string | null {
  const s = m.score;
  return s?.homeHalf != null && s.awayHalf != null ? `${s.homeHalf} - ${s.awayHalf}` : null;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

// ─── Calcul ───

/**
 * Backtest des 8 stratégies sur les matchs du jour.
 *
 * @param matches — snapshot complet (terminés + à venir) ; la forme est construite
 *   sur les terminés, les picks sur les terminés du jour uniquement (leur résultat
 *   est déjà connu — l'anti-lookahead porte sur la forme, pas sur le fixture).
 * @param opts.date — jour cible « AAAA-MM-JJ » Europe/Paris (défaut : aujourd'hui).
 * @param opts.now — instant de référence pour le défaut (injectable pour les tests).
 */
export function computeDailyStrategyBacktest(
  matches: HandballMatch[],
  opts?: { date?: string; now?: Date },
): DailyStrategyBacktest {
  const date = opts?.date || parisDateOf(opts?.now ?? new Date());

  const finished = matches
    .filter((m) => m.status === "finished" && m.score)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const todayFinished = finished.filter((m) => parisDateOf(m.kickoff) === date);
  const todayAll = matches.filter((m) => parisDateOf(m.kickoff) === date);

  const picksByKey = new Map<HandballStrategyKey, DailyPick[]>();
  for (const key of STRATEGY_KEYS) picksByKey.set(key, []);

  for (const m of todayFinished) {
    // Walk-forward : forme uniquement sur les matchs terminés avant ce coup d'envoi.
    const prior = finished.filter((f) => f.kickoff < m.kickoff);
    const top8 = computeHandballStrategyTop8(prior, [m]);

    for (const key of STRATEGY_KEYS) {
      const entry = top8.strategies[key][0];
      if (!entry) continue; // stratégie sans signal (pas de forme / marché absent)
      const { odds } = SETTLEMENT[key];
      const result = settleDailyPick(key, m, entry.pick);
      const profitU = result === "void" ? 0 : result === "won" ? odds - 1 : -1;
      picksByKey.get(key)!.push({
        match: {
          id: m.id,
          kickoff: m.kickoff,
          home: m.home.name,
          away: m.away.name,
          league: m.league.name,
          score: scoreStr(m),
          ht: htStr(m),
        },
        pick: entry.pick,
        pickLabel: pickLabelFor(key, entry.pick),
        odds,
        result,
        profitU,
      });
    }
  }

  const strategies: DailyStrategyRow[] = STRATEGY_KEYS.map((key) => {
    const def = HANDBALL_STRATEGY_DEFS[key];
    const { odds, market } = SETTLEMENT[key];
    const picks = picksByKey.get(key)!;
    const won = picks.filter((p) => p.result === "won").length;
    const lost = picks.filter((p) => p.result === "lost").length;
    const voids = picks.filter((p) => p.result === "void").length;
    const nBets = won + lost;
    const profitU = round2(picks.reduce((n, p) => n + p.profitU, 0));
    const row: DailyStrategyRow = {
      strategy: key,
      label: def.label,
      emoji: def.emoji,
      market,
      odds,
      nBets,
      won,
      lost,
      voids,
      profitU,
      roiPct: nBets > 0 ? round2((profitU / nBets) * 100) : null,
      hitRate: nBets > 0 ? round2((won / nBets) * 100) : null,
      picks,
    };
    if (nBets === 0) {
      row.note =
        voids > 0
          ? `${voids} pick(s) annulé(s) — pas de résultat exploitable`
          : todayFinished.length === 0
            ? "Aucun match terminé aujourd'hui"
            : "Aucun signal sur les matchs du jour (forme insuffisante)";
    }
    return row;
  });

  // Tri ROI décroissant (stratégies sans pari en fin)
  strategies.sort(
    (a, b) => (b.roiPct ?? Number.NEGATIVE_INFINITY) - (a.roiPct ?? Number.NEGATIVE_INFINITY),
  );

  const nBets = strategies.reduce((n, s) => n + s.nBets, 0);
  const won = strategies.reduce((n, s) => n + s.won, 0);
  const lost = strategies.reduce((n, s) => n + s.lost, 0);
  const voids = strategies.reduce((n, s) => n + s.voids, 0);
  const profitU = round2(strategies.reduce((n, s) => n + s.profitU, 0));

  return {
    date,
    timezone: HANDBALL_RESULTS_TZ,
    nFinishedToday: todayFinished.length,
    nPendingToday: Math.max(0, todayAll.length - todayFinished.length),
    strategies,
    global: {
      nBets,
      won,
      lost,
      voids,
      profitU,
      roiPct: nBets > 0 ? round2((profitU / nBets) * 100) : null,
      hitRate: nBets > 0 ? round2((won / nBets) * 100) : null,
    },
    methodology: METHODOLOGY,
    computed_at: new Date().toISOString(),
  };
}
