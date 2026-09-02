import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Archivo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { PHProvider } from "@/components/analytics-provider";
import { ConsentProvider } from "@/components/consent-provider";

import { PrivacyDialog } from "@/components/privacy-dialog";
import { BankrollDialog } from "@/components/bankroll-dialog";
import { PaperTradingDialog } from "@/components/paper-trading-dialog";
import { BookmakerComparatorDialog } from "@/components/bookmaker-comparator-dialog";
import { AboutDialog } from "@/components/about-dialog";
import { ApiDocsDialog } from "@/components/api-docs-dialog";
import { FeedbackWidget } from "@/components/feedback-widget";
import { BetSlip } from "@/components/bet-slip";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { SentryErrorBoundary } from "@/components/sentry-error-boundary";
import { AbTestDebugBadge } from "@/components/ab-test-debug";
import { AppMotionConfig } from "@/components/motion-config";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

/**
 * Absolute site URL used for canonical / OG / JSON-LD URLs.
 * Falls back to the placeholder domain when the env var is not set.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://pariscore.fr";

/** Map next-intl locales (`fr`, `en`) to OpenGraph locale tags (`fr_FR`, `en_US`). */
const OG_LOCALE: Record<string, string> = {
  fr: "fr_FR",
  en: "en_US",
};

/**
 * WebApplication JSON-LD (https://schema.org/WebApplication).
 * Rendered server-side as a `<script type="application/ld+json">` so search
 * engines can index the app as a free, multi-language sports web app.
 */
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "PariScore — Tennis Prematch",
  description:
    "Probabilités de victoire tennis avec modèle Elo+Forme+Surface+H2H",
  url: SITE_URL,
  applicationCategory: "SportsApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
  },
  inLanguage: ["fr", "en"],
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Font display scoreboard — Archivo variable (axe wdth 62-125). Utilisee
// UNIQUEMENT pour les scores et grands numeraux : etiree (wdth ~118), elle
// donne une voix broadcast au chiffre le plus important de l app. Le corps
// reste Geist/Geist Mono (DESIGN.md).
const archivoDisplay = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  const locale = await getLocale();
  const title = `${t("appName")} · ${t("tabName")}`;
  const description = t("heroDesc");
  const canonicalUrl = `${SITE_URL}/`;
  const ogImage = `${SITE_URL}/icon-512.png`;

  return {
    title,
    description,
    keywords: ["tennis", "prematch", "probability", "Elo", "prediction", "sports betting"],
    authors: [{ name: t("appName") }],
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/icon-192.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: t("appName"),
    },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonicalUrl,
      siteName: t("appName"),
      locale: OG_LOCALE[locale] ?? "fr_FR",
      images: [
        {
          url: ogImage,
          width: 512,
          height: 512,
          alt: t("appName"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0e121e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Preconnect to image CDN (player photos) — saves ~100ms on LCP */}
        <link rel="preconnect" href="https://sfile.chatglm.cn" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://sfile.chatglm.cn" />
        {/* Preconnect to PostHog (analytics, gated by consent) */}
        <link rel="preconnect" href="https://app.posthog.com" />
        <link rel="dns-prefetch" href="https://app.posthog.com" />
        {/* Canonical link is emitted by metadata.alternates.canonical — no
            manual <link rel="canonical"> here to avoid duplicate tags. */}
        {/* WebApplication structured data (JSON-LD) for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${archivoDisplay.variable} antialiased bg-background text-foreground`}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-emerald-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Aller au contenu principal
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <NextIntlClientProvider locale={locale} messages={messages}>
            <ConsentProvider>
              <PHProvider>
                <SentryErrorBoundary>
                  <AppMotionConfig>
                    <main id="main">
                      {children}
                    </main>
                    <PrivacyDialog />
                    <BankrollDialog />
                    <PaperTradingDialog />
                    <BookmakerComparatorDialog />
                    <AboutDialog />
                    <ApiDocsDialog />
                    <FeedbackWidget />
                    {/* Floating bet slip — DraftKings-style sticky panel
                        (bottom-right, above the feedback widget). Renders
                        nothing while empty; auto-expands on first selection. */}
                    <BetSlip />
                    <Toaster />
                    <ServiceWorkerRegister />
                    {/* Dev-only floating A/B test badge — returns null in
                        production builds (see AbTestDebugBadge). */}
                    <AbTestDebugBadge />
                  </AppMotionConfig>
                </SentryErrorBoundary>
              </PHProvider>
            </ConsentProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
