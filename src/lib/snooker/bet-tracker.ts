/**
 * Hook pour tracker les paris dans localStorage
 *
 * Stocke les paris avec :
 * - ID du match
 * - Marché (matchWinner, overTotal, etc.)
 * - Sélection (label du pari)
 * - Cote (si disponible)
 * - Probabilité modèle
 * - Edge
 * - Statut: pending | won | lost | void
 * - Timestamp
 */

export type TrackedBet = {
  id: string;
  matchId: string;
  match: string;
  market: string;
  selection: string;
  odds?: number;
  probability: number;
  edge: number;
  confidence: "high" | "medium" | "low";
  status: "pending" | "won" | "lost" | "void";
  createdAt: string;
  resolvedAt?: string;
  pnl?: number; // profit/loss en units
};

const STORAGE_KEY = "pariscore_snooker_bets";

/**
 * Génère un ID unique pour un pari
 */
function generateBetId(matchId: string, market: string): string {
  return `${matchId}_${market}_${Date.now()}`;
}

/**
 * Charge les paris depuis localStorage
 */
export function loadBets(): TrackedBet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Garde-fou : valeur corrompu/ancien schéma → crash React sur .filter/.unshift
    return Array.isArray(parsed) ? (parsed as TrackedBet[]) : [];
  } catch {
    return [];
  }
}

/**
 * Sauvegarde les paris dans localStorage
 */
function saveBets(bets: TrackedBet[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
  } catch {
    // localStorage plein ou indisponible
  }
}

/**
 * Ajoute un pari au tracker
 */
export function addBet(bet: Omit<TrackedBet, "id" | "status" | "createdAt">): TrackedBet {
  const bets = loadBets();
  // Idempotent : double-clic avant re-render → pas de doublon
  const existing = bets.find(
    (b) => b.matchId === bet.matchId && b.market === bet.market && b.status === "pending",
  );
  if (existing) return existing;
  const newBet: TrackedBet = {
    ...bet,
    id: generateBetId(bet.matchId, bet.market),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  bets.unshift(newBet); // Plus récent en premier
  saveBets(bets);
  return newBet;
}

/**
 * Met à jour le statut d'un pari
 */
export function updateBetStatus(
  betId: string,
  status: "won" | "lost" | "void",
  pnl?: number
): void {
  const bets = loadBets();
  const idx = bets.findIndex((b) => b.id === betId);
  if (idx === -1) return;
  bets[idx].status = status;
  bets[idx].resolvedAt = new Date().toISOString();
  bets[idx].pnl = pnl;
  saveBets(bets);
}

/**
 * Supprime un pari du tracker
 */
export function removeBet(betId: string): void {
  const bets = loadBets();
  saveBets(bets.filter((b) => b.id !== betId));
}

/**
 * Calcule les statistiques globales
 */
export function getStats(bets: TrackedBet[]) {
  const pending = bets.filter((b) => b.status === "pending");
  const resolved = bets.filter((b) => b.status !== "pending" && b.status !== "void");
  const won = bets.filter((b) => b.status === "won");
  const lost = bets.filter((b) => b.status === "lost");

  const totalPnl = bets.reduce((sum, b) => sum + (b.pnl ?? 0), 0);
  const resolvedPnl = resolved.reduce((sum, b) => sum + (b.pnl ?? 0), 0);
  const winRate = resolved.length > 0 ? (won.length / resolved.length) * 100 : 0;

  // ROI = PnL / mise totale
  const totalStaked = resolved.length; // 1 unit per bet
  const roi = totalStaked > 0 ? (resolvedPnl / totalStaked) * 100 : 0;

  return {
    total: bets.length,
    pending: pending.length,
    won: won.length,
    lost: lost.length,
    winRate: Math.round(winRate * 10) / 10,
    totalPnl: Math.round(totalPnl * 100) / 100,
    roi: Math.round(roi * 10) / 10,
  };
}

/**
 * Vérifie si un pari est déjà tracké
 */
export function isTracked(matchId: string, market: string): boolean {
  const bets = loadBets();
  return bets.some(
    (b) => b.matchId === matchId && b.market === market && b.status === "pending"
  );
}
