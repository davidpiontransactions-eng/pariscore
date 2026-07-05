import type { MetadataRoute } from "next";

/**
 * Dynamic sitemap (Next.js App Router convention).
 *
 * Only `/` is a visible, indexable route — the app is a single-page Tennis
 * Prematch tool with cookie-based i18n (no locale prefix in the URL). API
 * routes are disallowed in robots.txt and intentionally omitted here.
 *
 * `changeFrequency: "hourly"` matches the SWR polling cadence (60s) on the
 * client; new predictions may land at any time so hourly is a reasonable
 * hint to crawlers that the page content changes frequently.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://setpoint.example";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1.0,
    },
  ];
}
