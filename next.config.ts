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
  serverExternalPackages: ["better-sqlite3"],
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
