/**
 * Shared in-memory store for push subscriptions.
 *
 * Next.js route handlers run in the same Node.js process (dev) / serverless
 * instance (prod warm starts), so a module-level Map is sufficient for the
 * demo. In production, replace this with a Prisma `PushSubscription` table.
 *
 * Keyed by subscription endpoint (unique per browser).
 */

// web-push accepts a PushSubscription-like object:
// { endpoint, keys: { p256dh, auth }, expirationTime? }
export type StoredSubscription = {
  endpoint: string;
  keys?: Record<string, string>;
  expirationTime?: number | null;
};

const subscriptions = new Map<string, StoredSubscription>();

export const subscriptionsRef = {
  set(sub: StoredSubscription): void {
    subscriptions.set(sub.endpoint, sub);
  },
  get(endpoint: string): StoredSubscription | undefined {
    return subscriptions.get(endpoint);
  },
  delete(endpoint: string): boolean {
    return subscriptions.delete(endpoint);
  },
  snapshot(): StoredSubscription[] {
    return Array.from(subscriptions.values());
  },
  get size(): number {
    return subscriptions.size;
  },
};
