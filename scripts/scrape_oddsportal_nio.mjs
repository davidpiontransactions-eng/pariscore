#!/usr/bin/env node
/**
 * scrape_oddsportal_nio.mjs
 *
 * Scrape les matchs + cotes du Northern Ireland Open depuis Oddsportal.
 * Utilise Playwright pour extraire les données DOM (cotes incluses).
 *
 * Usage:
 *   node scripts/scrape_oddsportal_nio.mjs
 *   node scripts/scrape_oddsportal_nio.mjs --live
 *
 * Sortie: data/oddsportal_nio.json
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(import.meta.dirname, "..", "data");
const OUT_FILE = join(OUT_DIR, "oddsportal_nio.json");

const NIO_URL = "https://www.oddsportal.com/snooker/northern-ireland/northern-ireland-open/";

async function scrapeMatches(page, url, liveOnly) {
  console.log(`[OddsPortal NIO] Navigation → ${url}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(5000);

  const matches = await page.evaluate(() => {
    const results = [];
    // Sélecteur Oddsportal : lignes de match avec bordures noires
    const rows = document.querySelectorAll('div.flex.w-full.items-stretch.border-b.border-l.border-black-borders');

    for (const row of rows) {
      try {
        // Lien match (contient les joueurs + score + statut)
        const link = row.querySelector('a[href*="/snooker/h2h/"]');
        if (!link) continue;

        const href = link.getAttribute("href") || "";
        // Extraire un ID depuis l'URL h2h
        const idMatch = href.match(/\/h2h\/([^/]+)/);
        const matchId = idMatch ? idMatch[1] : href.replace(/\//g, "_");
        if (!matchId) continue;

        // Statut / heure — sélecteur corrigé : p.whitespace-nowrap dans le premier div.w-max
        const statusEl = link.querySelector("div.w-max.whitespace-nowrap p");
        // Pour les matchs finis, le texte contient "Finished" + "FIN" (mobile) → prendre juste le span desktop
        const desktopSpan = statusEl?.querySelector("span.max-md\\:hidden.min-md\\:inline");
        const mobileSpan = statusEl?.querySelector("span.min-md\\:hidden.max-md\\:inline");
        const statusText = desktopSpan?.textContent?.trim() || mobileSpan?.textContent?.trim() || statusEl?.textContent?.trim() || "";

        // Déterminer le statut et extraire l'heure
        let status = "scheduled";
        let time = "";
        if (/^\d{1,2}:\d{2}$/.test(statusText)) {
          // Match scheduled — l'heure est visible (ex: "14:00", "17:00", "20:00")
          status = "scheduled";
          time = statusText;
        } else if (/fin/i.test(statusText)) {
          status = "finished";
        } else if (/^li$/i.test(statusText) || /\d+\s*['']/.test(row.textContent || "") || /\bFrame\b/i.test(row.textContent || "")) {
          status = "live";
        }

        // Joueurs : p.order-1 = joueur 1 (gauche), p.order-2 = joueur 2 (droite)
        const player1El = link.querySelector("p.order-1");
        const player2El = link.querySelector("p.order-2");
        const home = player1El?.textContent?.trim() || "";
        const away = player2El?.textContent?.trim() || "";
        if (!home || !away) continue;

        // Score : span.shrink-0.font-bold qui contient un chiffre (pas le round)
        const scoreEls = link.querySelectorAll("span.order-2.shrink-0.font-bold, span[class*='order-2'][class*='shrink-0'][class*='font-bold']");
        let scoreHome = "";
        let scoreAway = "";
        if (scoreEls.length >= 2) {
          scoreHome = scoreEls[0]?.textContent?.trim() || "";
          scoreAway = scoreEls[1]?.textContent?.trim() || "";
        } else {
          const text = link.textContent || "";
          const scoreMatch = text.match(/(\d+)\s*-\s*(\d+)/);
          if (scoreMatch) {
            scoreHome = scoreMatch[1];
            scoreAway = scoreMatch[2];
          }
        }

        // Cotes (ul > li > div > div > p)
        const oddsEls = row.querySelectorAll("ul p");
        let odds1 = null;
        let odds2 = null;
        const oddsValues = [];
        for (const el of oddsEls) {
          const txt = el.textContent?.trim() || "";
          const val = parseFloat(txt);
          if (!isNaN(val) && val > 1 && val < 50) {
            oddsValues.push(val);
          }
        }
        if (oddsValues.length >= 2) {
          odds1 = oddsValues[0];
          odds2 = oddsValues[1];
        }

        results.push({
          id: matchId,
          home,
          away,
          time: statusText,
          scoreHome,
          scoreAway,
          status,
          odds1,
          odds2,
          href,
        });
      } catch {
        // ignorer les lignes malformées
      }
    }

    return results;
  });

  // Filtrer live si demandé
  const filtered = liveOnly ? matches.filter((m) => m.status === "live") : matches;
  console.log(`[OddsPortal NIO] ${filtered.length} matchs extraits (${matches.length} total)`);
  return filtered;
}

async function main() {
  const liveOnly = process.argv.includes("--live");

  console.log("[OddsPortal NIO] Démarrage du navigateur...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "en-US",
  });
  const page = await context.newPage();

  const scrapedAt = new Date().toISOString();

  const matches = await scrapeMatches(page, NIO_URL, liveOnly);

  await browser.close();

  const liveCount = matches.filter((m) => m.status === "live").length;
  const withOdds = matches.filter((m) => m.odds1 && m.odds2).length;
  const finishedCount = matches.filter((m) => m.status === "finished").length;

  const output = {
    scraped_at: scrapedAt,
    sport: "snooker",
    source: "oddsportal.com",
    tournament: "Northern Ireland Open",
    live_only: liveOnly,
    matches_count: matches.length,
    live_count: liveCount,
    finished_count: finishedCount,
    with_odds: withOdds,
    matches,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n[OddsPortal NIO] ✅ ${matches.length} matchs (${liveCount} live, ${finishedCount} terminés, ${withOdds} avec cotes) → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error("[OddsPortal NIO] Erreur fatale:", err.message);
  process.exit(1);
});
