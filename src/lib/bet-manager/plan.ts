// Moteur du plan quotidien — port pur et testé de public/suivi-paris.html
// (computeTheoretical / betPL / computeReal, entrées RAPPORT 126/126b du 2026-10-02).
// Modèle : chaque jour, gain visé G = targetPct % du capital de début de journée,
// dont bankPct % part en banque, le reste est réinvesti (×1,10/j aux défauts).
//
// Contrat d'arrondi (identique à la source) : la valeur ARRONDIE (2 décimales)
// est reportée sur le jour suivant — le tableau doit être vérifiable à la main.
// Chiffres de référence (30 j, défauts) : C₃₀ ≈ 3489.88 · B₃₀ ≈ 3289.88 · T₃₀ ≈ 6779.76.

export type PlanParams = {
  /** Capital en début de période. */
  capital: number;
  /** Gain visé par jour, en % du capital de début de journée (ex. 20). */
  targetPct: number;
  /** Part du gain versée en banque, en % (ex. 50). */
  bankPct: number;
  /** Date de départ AAAA-MM-JJ. */
  startDate: string;
  /** Nombre de jours de la période. */
  days: number;
  /** Paris max par jour (n). */
  maxBets: number;
  /** Capital engagé par jour, en % du capital (ex. 20). */
  stakePct: number;
  /** Cote cible affichée (paramètre UI). */
  oddsTarget: number;
  /** Probabilité de réussite retenue (0-1) → cote d'espérance nulle = 1/q. */
  winProb: number;
  /** Virement auto en banque sur gains réels positifs. */
  autoBank: boolean;
};

/** Défauts = DEFAULTS de suivi-paris.html :422 (et calc.xlsx : C = D = 10 %). */
export const PLAN_DEFAULTS: PlanParams = {
  capital: 200,
  targetPct: 20,
  bankPct: 50,
  startDate: "2026-10-02",
  days: 30,
  maxBets: 11,
  stakePct: 20,
  oddsTarget: 2.0,
  winProb: 0.5,
  autoBank: true,
};

/** Clé de persistance des paramètres du plan (localStorage). */
export const PLAN_STORAGE_KEY = "bm-plan-params";

/**
 * Emprunt banque (bead v1v8) : capital pris en banque à amortir en PLUS des
 * gains quotidiens (ex. 200 € pris le 07/10 sur 24 j → 8,33 €/j).
 * `amount = 0` = pas d'emprunt.
 */
export type BankLoan = {
  amount: number;
  /** Date de contractualisation AAAA-MM-JJ. */
  startDate: string;
  /** Durée d'amortissement en jours (24 → 24 remboursements égaux). */
  days: number;
};

/** Clé de persistance de l'emprunt (localStorage). */
export const LOAN_STORAGE_KEY = "bm-plan-loan";

/** Ligne de journal minimal — Bet (types.ts) est structurellement compatible. */
export type PlanBet = {
  stake: number;
  odds: number;
  status: string;
  payout?: number | null;
};

export type PlanRow = {
  /** Jour 1-indexé. */
  d: number;
  /** Clé AAAA-MM-JJ. */
  key: string;
  /** Capital en début de journée. */
  cStart: number;
  /** Gain théorique du jour = targetPct % × cStart. */
  G: number;
  /** Part versée en banque. */
  toBank: number;
  /** Part réinvestie en capital. */
  reinvest: number;
  /** Capital en fin de journée (arrondi, reporté tel quel). */
  C: number;
  /** Banque cumulée. */
  B: number;
  /** Total = C + B. */
  T: number;
  /** Évolution en % depuis le capital initial. */
  cumPct: number;
  /** Capital engagé ce jour = stakePct % × cStart. */
  stake: number;
  /** Cote moyenne requise : 1 + G / stake. */
  oReq: number | null;
  /** Cote d'espérance nulle : 1 / winProb. */
  oNeutral: number | null;
  /** Mise moyenne par pari = stake / n. */
  miseParPari: number;
  /** Gain visé par pari = G / n. */
  gainParPari: number;
};

const R = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* Dates : clés "AAAA-MM-JJ" manipulées en UTC (immunisé DST). */
export function dFromKey(k: string): Date {
  const p = k.split("-").map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
}
export function addDaysKey(k: string, n: number): string {
  const d = dFromKey(k);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function diffDays(a: string, b: string): number {
  return Math.round((dFromKey(b).getTime() - dFromKey(a).getTime()) / 86400000);
}
export function todayKey(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())).toISOString().slice(0, 10);
}

/** Projection théorique jour par jour (port exact de computeTheoretical). */
export function computeTheoretical(p: PlanParams): PlanRow[] {
  const rows: PlanRow[] = [];
  const n = Math.max(1, p.maxBets | 0);
  let C = p.capital;
  let B = 0;
  for (let d = 1; d <= p.days; d++) {
    const cStart = C;
    const G = (cStart * p.targetPct) / 100;
    const toBank = R(Math.max(0, G) * (p.bankPct / 100));
    C = R(cStart + R(G - toBank));
    B = R(B + toBank);
    const S = R(cStart * (p.stakePct / 100));
    rows.push({
      d,
      key: addDaysKey(p.startDate, d - 1),
      cStart,
      G,
      toBank,
      reinvest: R(G - toBank),
      C,
      B,
      T: R(C + B),
      cumPct: p.capital ? ((C + B - p.capital) / p.capital) * 100 : 0,
      stake: S,
      oReq: S > 0 ? 1 + G / S : null,
      oNeutral: p.winProb > 0 ? 1 / p.winProb : null,
      miseParPari: S / n,
      gainParPari: G / n,
    });
  }
  return rows;
}

/** Source de vérité d'une ligne de journal (port exact de betPL). */
export function betPL(b: PlanBet): { pl: number | null; src: string } {
  if (b.status === "pending") return { pl: null, src: "en cours" };
  if (b.status === "cashout") return { pl: b.payout != null ? b.payout - b.stake : null, src: "payout" };
  if (b.status === "void") return { pl: 0, src: "annulé" };
  if (b.payout != null && isFinite(b.payout)) return { pl: b.payout - b.stake, src: "payout" };
  if (b.status === "won") return { pl: b.stake * (Math.max(1, b.odds || 1) - 1), src: "calculé" };
  if (b.status === "lost") return { pl: -b.stake, src: "calculé" };
  return { pl: null, src: "statut inconnu" };
}

export type RealRow = {
  d: number;
  key: string;
  bets: PlanBet[];
  n: number;
  staked: number;
  settled: number;
  pending: number;
  won: number;
  lost: number;
  voids: number;
  /** Gain réel du jour (somme des P/L réglés). */
  gRe: number;
  /** Virement banque du jour (si autoBank et gain positif). */
  toBank: number;
  /** Capital cumulé réel. */
  cap: number;
  /** Banque cumulée réelle. */
  bank: number;
  /** Total réel = cap + bank. */
  tRe: number;
  /** Objectif théorique du jour. */
  thG: number;
  /** Total théorique du jour. */
  thT: number;
  /** Réel − théorique (positif = au-dessus). */
  ecartJour: number;
  /** Théorique − réel (positif = en retard) — « Montant de retard ». */
  ecartCum: number;
  /** Écart signé porté sur la ligne (null si « à venir »). */
  retard: number | null;
  /** Jours restants, jour courant inclus (null si « à venir »). */
  jrest: number | null;
  /** max(0, retard) / jrest — jamais négatif (null si « à venir »). */
  retardJour: number | null;
  /** Jour au-delà de la dernière journée écoulée : pas de retard. */
  future: boolean;
};

export type PlanReal = {
  rows: RealRow[];
  /** Dernière journée écoulée (1-indexé, 0 = période pas encore commencée). */
  lastDay: number;
  /** Dernière clé de la période. */
  endKey: string;
  /** Ligne du jour courant (null si hors période). */
  live: RealRow | null;
  /** Mise cumulée sur les jours écoulés. */
  cumStaked: number;
  /** Jours restants aujourd'hui (null si période finie). */
  liveJrest: number | null;
};

/**
 * Suivi réel vs théorique (port exact de computeReal) — `today` est injectable
 * pour que les tests figent la date.
 */
export function computeReal(
  p: PlanParams,
  th: PlanRow[],
  days: Record<string, PlanBet[]>,
  today = todayKey()
): PlanReal {
  const rows: RealRow[] = [];
  let cap = p.capital;
  let bank = 0;
  for (let i = 0; i < th.length; i++) {
    const t = th[i];
    const bets = days[t.key] || [];
    let gRe = 0;
    let staked = 0;
    let settled = 0;
    let pending = 0;
    let won = 0;
    let lost = 0;
    let vd = 0;
    for (const b of bets) {
      const r = betPL(b);
      if (r.pl === null) {
        pending++;
        continue;
      }
      settled++;
      staked += b.stake;
      gRe += r.pl;
      if (b.status === "won") won++;
      else if (b.status === "lost") lost++;
      else vd++;
    }
    const toBank = p.autoBank && gRe > 0 ? R(gRe * (p.bankPct / 100)) : 0;
    bank = R(bank + toBank);
    cap = R(cap + R(gRe - toBank));
    rows.push({
      d: t.d,
      key: t.key,
      bets,
      n: bets.length,
      staked,
      settled,
      pending,
      won,
      lost,
      voids: vd,
      gRe,
      toBank,
      cap,
      bank,
      tRe: cap + bank,
      thG: t.G,
      thT: t.T,
      ecartJour: cap + bank - t.T,
      ecartCum: t.T - (cap + bank),
      retard: null,
      jrest: null,
      retardJour: null,
      future: false,
    });
  }
  /* Dernière journée écoulée : le jour le plus tardif entre aujourd'hui et le
     dernier jour ayant au moins un pari. Au-delà : « à venir », pas de retard. */
  const endKey = addDaysKey(p.startDate, p.days - 1);
  let lastBet = 0;
  for (const r of rows) if (r.n > 0) lastBet = r.d;
  const dd = diffDays(p.startDate, today);
  const todayIdx = dd < 0 ? 0 : dd > p.days - 1 ? p.days : dd + 1;
  const lastDay = clamp(Math.max(lastBet, todayIdx), 0, p.days);
  for (const r of rows) {
    if (r.d > lastDay) {
      r.future = true;
      continue;
    }
    r.retard = r.ecartCum;
    const j = diffDays(r.key, endKey) + 1; /* jour courant inclus */
    r.jrest = j > 0 ? j : null;
    r.retardJour = r.jrest ? Math.max(0, r.retard) / r.jrest : null;
  }
  const live = rows[lastDay - 1] || null;
  const liveJ = diffDays(today, endKey) + 1;
  let cumStaked = 0;
  for (const r of rows) if (!r.future) cumStaked += r.staked;
  return {
    rows,
    lastDay,
    endKey,
    live,
    cumStaked,
    liveJrest: liveJ > 0 ? liveJ : null,
  };
}

/** Mise exacte par pari pour un gain net donné à une cote (Feuille2 F corrigée :
 *  gainParPari / (cote − 1) — le fichier source portait /(1−cote), négatif). */
export function stakeForTarget(gainParPari: number, odds: number): number | null {
  if (!(odds > 1)) return null;
  return gainParPari / (odds - 1);
}

/** Remboursement journalier de l'emprunt (amount / days) ; null si inactif. */
export function dailyLoanRepayment(loan: BankLoan | null | undefined): number | null {
  if (!loan || !(loan.amount > 0) || !(loan.days > 0)) return null;
  return loan.amount / loan.days;
}

/**
 * Remboursement cumulé DÛ à une date (inclus) : 0 avant le début,
 * `daily × (jours écoulés + 1)` pendant l'amortissement, borné au montant.
 */
export function loanCumulatedAt(loan: BankLoan | null | undefined, dateKey: string): number {
  const daily = dailyLoanRepayment(loan);
  if (daily === null || !loan) return 0;
  const j = diffDays(loan.startDate, dateKey);
  if (j < 0) return 0;
  return Math.min(loan.amount, daily * (Math.min(j, loan.days - 1) + 1));
}

/** Reste à rembourser à une date (borné [0, amount]). */
export function loanRemainingAt(loan: BankLoan | null | undefined, dateKey: string): number {
  if (!loan || !(loan.amount > 0)) return 0;
  return Math.max(0, loan.amount - loanCumulatedAt(loan, dateKey));
}

/**
 * Objectif de GAINS cumulés (T_j − capital0) à une date du plan.
 * - date avant startDate → null (aucun objectif) ;
 * - date au-delà de la période → dernier objectif du plan (borné) ;
 * - `loan` fourni → l'objectif TOTAL inclut l'amortissement cumulé
 *   (gains + remboursement, le remboursement étant une obligation EN PLUS).
 */
export function objectiveGainsAt(p: PlanParams, dateKey: string, loan?: BankLoan | null): number | null {
  const j = diffDays(p.startDate, dateKey);
  if (j < 0) return null;
  const rows = computeTheoretical(p);
  const row = rows[Math.min(j, rows.length - 1)];
  return row.T - p.capital + loanCumulatedAt(loan, dateKey);
}

/** Ligne minimale pour le cumul réel (Bet de types.ts est structurellement compatible). */
export type CumBet = {
  placedAt: string;
  settledAt?: string | null;
  status: string;
  stake: number;
  payout?: number | null;
};

/**
 * Profit cumulé (P/L des paris réglés) PAR DATE — convention identique à
 * computeBankrollStats : date d'attribution = settledAt ?? placedAt.
 * Void/pending exclus (P/L nul). Valeurs = cumul APRÈS la date.
 */
export function cumulativeProfitByDay(bets: readonly CumBet[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const b of bets) {
    if (b.status === "pending" || b.status === "void") continue;
    const key = (b.settledAt ?? b.placedAt).slice(0, 10);
    const pl = (b.payout ?? 0) - b.stake;
    byDay.set(key, (byDay.get(key) ?? 0) + pl);
  }
  const sorted = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const cum = new Map<string, number>();
  let run = 0;
  for (const [k, v] of sorted) {
    run += v;
    cum.set(k, run);
  }
  return cum;
}

/** Cumul réel à une date (dernier jour connu ≤ dateKey, 0 si rien avant). */
export function cumulativeProfitAt(cum: Map<string, number>, dateKey: string): number {
  let best: string | null = null;
  for (const k of cum.keys()) {
    if (k <= dateKey && (best === null || k > best)) best = k;
  }
  return best === null ? 0 : cum.get(best) as number;
}
