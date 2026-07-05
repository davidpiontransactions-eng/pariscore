// This file configures the initialization of Sentry on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  // Respect RGPD consent — only send events if the user granted analytics consent.
  // The consent state is stored under the `setpoint-consent` key (see src/components/consent-provider.tsx).
  beforeSend(event) {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("setpoint-consent");
        const consent = raw ? JSON.parse(raw) : null;
        if (!consent?.analytics) return null; // drop event if no consent
      } catch {
        return null;
      }
    }
    return event;
  },
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Network request failed",
    "Failed to fetch",
  ],
});
