"use client";

import posthog, { type PostHog } from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect, useState } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

// Lazy-init once on the client — kept outside React so it survives re-renders
let posthogClient: PostHog | null = null;
let initAttempted = false;

function initPostHog(): PostHog | null {
  if (typeof window === "undefined") return null;
  if (initAttempted) return posthogClient;
  initAttempted = true;
  if (!POSTHOG_KEY) return null;
  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: "identified_only",
      persistence: "localStorage+cookie",
      autocapture: false,
      // Respect Do Not Track
      respect_dnt: true,
    });
    posthogClient = posthog;
  } catch (err) {
    console.error("[posthog] init failed", err);
  }
  return posthogClient;
}

function getPostHog(): PostHog | null {
  return posthogClient;
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<PostHog | null>(null);

  // Initialiser PostHog dès le mount (eager)
  useEffect(() => {
    const ph = initPostHog();
    if (ph) {
      setClient(ph);
    }
  }, []);

  // Toujours rendre PostHogProvider pour éviter le remount des enfants
  if (!client) return <>{children}</>;
  return <PostHogProvider client={client}>{children}</PostHogProvider>;
}

export function useAnalytics() {
  return {
    track: (event: string, properties?: Record<string, unknown>) => {
      const ph = getPostHog();
      if (!ph) return; // no consent yet, or no key configured
      try {
        if (ph.has_opted_out_capturing()) return;
      } catch {
        /* ignore */
      }
      ph.capture(event, properties);
    },
    identify: (userId: string, properties?: Record<string, unknown>) => {
      const ph = getPostHog();
      if (!ph) return;
      try {
        if (ph.has_opted_out_capturing()) return;
      } catch {
        /* ignore */
      }
      ph.identify(userId, properties);
    },
    getVariant: (experimentName: string): string | null => {
      const ph = getPostHog();
      if (!ph) return null;
      try {
        if (ph.has_opted_out_capturing()) return null;
        return ph.getFeatureFlag(experimentName) as string | null;
      } catch {
        return null;
      }
    },
    reloadFlags: async () => {
      const ph = getPostHog();
      if (!ph) return;
      try {
        if (ph.has_opted_out_capturing()) return;
        await ph.reloadFeatureFlags();
      } catch {
        /* ignore */
      }
    },
    /**
     * Set person properties on the current PostHog identity.
     *
     * Used for A/B test instrumentation: once a variant is assigned, we set
     * a person property whose key is the feature-flag key. PostHog then
     * automatically attaches that property to every subsequent event fired
     * by the same person, so we can break down any funnel / insight by
     * variant without having to thread the variant through every `track`
     * call.
     *
     * No-op when PostHog is uninitialised.
     */
    setPersonProperties: (properties: Record<string, unknown>) => {
      const ph = getPostHog();
      if (!ph) return;
      try {
        if (ph.has_opted_out_capturing()) return;
        ph.setPersonProperties(properties);
      } catch {
        /* ignore */
      }
    },
  };
}
