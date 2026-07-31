import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // better-sqlite3 est un module natif (binding C++) utilisé par la couche
  // tennis-stats pour lire pariscore.db. Il doit rester externe au bundle
  // server de Next.js — sinon le build standalone échoue à le résoudre.
  serverExternalPackages: ["better-sqlite3", "pariscore-services"],

  // Caches des leaderboards officiels ATP/WTA (scripts/scrape-tour-leaderboards.py).
  // lus par src/lib/tennis-stats/official-leaderboard.ts via fs.readFileSync.
  // Sans cette directive, le build standalone ne les copie pas (chemin dynamique
  // process.cwd() non tracé par le file tracing de Next.js).
  outputFileTracingIncludes: {
    "/api/tennis/stats-leaderboard": ["./data/tour-leaderboards/*.json"],
  },

  // ─── Images : CDN autorisés pour next/image ─────────────────────────────
  images: {
    remotePatterns: [
      // Logos équipes foot (existants)
      { protocol: "https", hostname: "sfile.chatglm.cn" },
      // Unsplash — visuels sportifs génériques
      { protocol: "https", hostname: "images.unsplash.com" },
      // API-Football — logos équipes / ligues (si dispo)
      { protocol: "https", hostname: "media.api-sports.io" },
      // Smarkets / Betwatch — photos joueurs tennis si fournies
      { protocol: "https", hostname: "api.smarkets.com" },
      { protocol: "https", hostname: "betwatch.fr" },
      // BSD — logos / photos si exposés
      { protocol: "https", hostname: "sports.bzzoiro.com" },
      // Wikipedia / Commons — fallback logos ligues (CC)
      { protocol: "https", hostname: "upload.wikimedia.org" },
      // Placeholder local (fallback ultime)
      { protocol: "https", hostname: "placehold.co" },
    ],
    // Formats modernes pour PWA légère
    formats: ["image/avif", "image/webp"],
  },
};

// Sentry is conditionally wrapped — only when SENTRY_DSN is configured.
// In dev without DSN, we skip the wrapper to avoid Turbopack overhead.
const SENTRY_ENABLED = !!process.env.SENTRY_DSN;

async function applySentry(config: NextConfig): Promise<NextConfig> {
  if (!SENTRY_ENABLED) return config;
  const { withSentryConfig } = await import("@sentry/nextjs");
  return withSentryConfig(config, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
    sourcemaps: { disable: !process.env.SENTRY_DSN },
    disableLogger: true,
  });
}

export default applySentry(withNextIntl(nextConfig));
