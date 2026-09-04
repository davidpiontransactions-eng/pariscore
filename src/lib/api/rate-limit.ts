/**
 * Rate limiting simple pour les API routes.
 * 
 * En production, utiliser Upstash Redis pour le rate limiting distribué.
 * Pour l'instant, on utilise un store en mémoire.
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

/**
 * Vérifie et incrémente le compteur de rate limiting.
 * 
 * @param key - Clé unique (ex: IP + endpoint)
 * @param limit - Nombre max de requêtes
 * @param windowMs - Fenêtre en millisecondes
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  key: string,
  limit: number = 100,
  windowMs: number = 60_000,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // Nouvelle fenêtre
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    // Limite atteinte
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Incrémenter
  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Middleware de rate limiting pour les API routes.
 */
export function rateLimit(
  limit: number = 100,
  windowMs: number = 60_000,
) {
  return (key: string) => checkRateLimit(key, limit, windowMs);
}

/**
 * Rate limits prédéfinis par type d'endpoint.
 */
export const rateLimits = {
  scoreboard: rateLimit(60, 60_000),    // 60 req/min
  standings: rateLimit(30, 60_000),     // 30 req/min
  stats: rateLimit(20, 60_000),         // 20 req/min (coûteux)
  odds: rateLimit(120, 60_000),         // 120 req/min
};
