// TEMPORARY — Sentry integration smoke test.
// Throws synchronously so Next.js returns a 500 and Sentry's server-side
// instrumentation captures the error automatically.
// ⚠️ REMOVE this route (and its README mention) before go-live.
export const dynamic = "force-dynamic";

export function GET(): never {
  throw new Error("[sentry-test] synthetic error from /api/sentry-test");
}
