import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuration Capacitor — PariScore Android.
 *
 * Deux modes d'exploitation :
 *
 * 1. MODE REMOTE (par défaut — utilisé pour les APK debug/release)
 *    Le WebView charge directement le serveur de production
 *    https://pariscore.fr. Aucun build web local n'est requis : les routes
 *    /api/* (Next.js route handlers, Prisma, better-sqlite3) restent servies
 *    par le serveur. C'est le seul mode viable aujourd'hui car l'app compte
 *    55 route handlers incompatibles avec `output: 'export'` (voir audit
 *    docs/mobile/MOBILE_AUDIT_GRAPHIFY.md).
 *
 * 2. MODE LOCAL BUNDLE (roadmap Phase 2)
 *    Export statique Next.js dans `dist/` + reconfiguration des 23 appels
 *    fetch relatifs `/api/...` vers une base absolue (NEXT_PUBLIC_API_URL).
 *    Nécessite : déplacer/exclure src/app/api du build, neutraliser
 *    serverExternalPackages, pages dynamiques via generateStaticParams.
 *
 * Surcharger la cible (dev local sur émulateur) :
 *   $env:CAPACITOR_SERVER_URL = "http://10.0.2.2:3000"   # 10.0.2.2 = host vu depuis l'émulateur
 *   npx cap sync android
 */
const SERVER_URL = process.env.CAPACITOR_SERVER_URL ?? "https://pariscore.fr";

const config: CapacitorConfig = {
  appId: "fr.pariscore.app",
  appName: "PariScore",
  webDir: "dist",
  backgroundColor: "#0E1217",
  server: {
    url: SERVER_URL,
    androidScheme: "https",
    // Cleartext autorisé uniquement si la cible est http:// (dev local)
    cleartext: SERVER_URL.startsWith("http://"),
    allowNavigation: ["pariscore.fr", "*.pariscore.fr", "10.0.2.2:*", "localhost:*"],
  },
  android: {
    backgroundColor: "#0E1217",
    allowMixedContent: true,
    // WebView inspectable hors production (chrome://inspect)
    webContentsDebuggingEnabled: process.env.CAPACITOR_DEBUG !== "0",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0E1217",
      splashFullScreen: true,
      splashImmersive: true,
      androidSplashResourceName: "splash",
    },
  },
};

export default config;
