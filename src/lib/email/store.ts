/**
 * Shared in-memory store for email alert subscriptions.
 *
 * Mirrors the approach used by `src/lib/push/store.ts`: a module-level Map
 * keyed by email address. Next.js route handlers run in the same Node.js
 * process (dev) / serverless instance (prod warm starts), so this is
 * sufficient for the demo. In production, replace this with a Prisma
 * `EmailSubscription` table.
 *
 * SMTP credentials are read from the environment and NEVER exposed to the
 * client — this module is server-only (imported exclusively from API routes).
 */

export type EmailSubscriber = {
  email: string;
  subscribedAt: string; // ISO timestamp
};

const subscribers = new Map<string, EmailSubscriber>();

export const subscribersRef = {
  add(email: string): EmailSubscriber {
    const sub: EmailSubscriber = {
      email,
      subscribedAt: new Date().toISOString(),
    };
    subscribers.set(email, sub);
    return sub;
  },
  has(email: string): boolean {
    return subscribers.has(email);
  },
  delete(email: string): boolean {
    return subscribers.delete(email);
  },
  snapshot(): EmailSubscriber[] {
    return Array.from(subscribers.values());
  },
  get size(): number {
    return subscribers.size;
  },
};

/**
 * Basic email format validation. Good enough for a demo — rejects obviously
 * malformed addresses without pulling in a full RFC validator.
 */
export function isValidEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 320) return false;
  // local@domain — local part non-empty, domain has at least one dot
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Normalize an email address (trim + lowercase) so dedup is consistent.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
