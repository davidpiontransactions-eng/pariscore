import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // Autoriser les requêtes cross-origin depuis pariscore.fr en mode dev
  // (le VPS reverse-proxy accède à next dev sur le même host mais via un
  // nom de domaine différent → sinon Next.js bloque les chunks JS/HMR).
  allowedDevOrigins: ["pariscore.fr"],
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://app.posthog.com https://browser.sentry-cdn.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https: data: blob:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://app.posthog.com https://sentry.io https://*.sentry.io wss:",
              "frame-ancestors 'none",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
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
      // Imgur — certains logos équipes fournis par BSD (ex: Bundesliga 2)
      { protocol: "https", hostname: "i.imgur.com" },
      // Wikipedia / Commons — fallback logos ligues (CC)
      { protocol: "https", hostname: "upload.wikimedia.org" },
      // Placeholder local (fallback ultime)
      { protocol: "https", hostname: "placehold.co" },
      // DiceBear — avatars initiales (fallback photos joueurs tennis)
      { protocol: "https", hostname: "api.dicebear.com" },
      // Tennis Warehouse — headshots ~90 joueurs ATP/WTA (tennis-player-photos.json)
      { protocol: "https", hostname: "img.tennis-warehouse.com" },
      // MLB — logos équipes + photos lanceurs (CDN public gratuit sans clé)
      { protocol: "https", hostname: "www.mlbstatic.com" },
      { protocol: "https", hostname: "midfield.mlbstatic.com" },
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
