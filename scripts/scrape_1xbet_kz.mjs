#!/usr/bin/env node
/**
 * scrape_1xbet_kz.mjs
 *
 * Test approfondi : scraper 1xbet.kz (accessible depuis le VPS)
 * Focus sur le snooker et les cotes.
 *
 * Usage: node scripts/scrape_1xbet_kz.mjs [--sport=snooker|football|tennis]
 */

import { chromium } from "playwright";

const SPORT = process.argv.find((a) => a.startsWith("--sport="))?.split("=")[1] || "snooker";
const URLS = [
  `https://1xbet.kz/en/line/${SPORT}`,
  `https://1xbet.kz/en/line/all-sports/all`,
  `https://1xbet.kz/en/live/${SPORT}`,
];

async function scrape1xbet(browser, url) {
  console.log(`\n--- ${url} ---`);
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  // Intercepter les appels API internes
  const apiCalls = [];
  page.on("response", async (response) => {
    const reqUrl = response.url();
    if (reqUrl.includes("/api/") || reqUrl.includes("Line") || reqUrl.includes("Live")) {
      try {
        const contentType = response.headers()["content-type"] || "";
        if (contentType.includes("json")) {
          const body = await response.json().catch(() => null);
          if (body) {
            apiCalls.push({ url: reqUrl, status: response.status(), dataKeys: Object.keys(body).slice(0, 10) });
          }
        }
      } catch {}
    }
  });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(5000);

    // Capture complète du DOM
    const pageInfo = await page.evaluate(() => {
      const info = {
        title: document.title,
        url: window.location.href,
        bodyLength: document.body.innerHTML.length,
        textContent: document.body.textContent?.substring(0, 2000),
      };

      // Tous les éléments avec des classes contenant "odd", "bet", "coef", "price", "line"
      const oddsElements = document.querySelectorAll('[class*="odd"], [class*="coef"], [class*="price"], [class*="bet-"], [class*="line-"]');
      info.oddsElements = Array.from(oddsElements).slice(0, 10).map((el) => ({
        tag: el.tagName,
        class: el.className?.substring(0, 80),
        text: el.textContent?.trim().substring(0, 50),
      }));

      // Tous les liens/éléments contenant "snooker" ou des noms de joueurs
      const allText = document.body.innerText || "";
      const snookerIndex = allText.toLowerCase().indexOf("snooker");
      if (snookerIndex >= 0) {
        info.snookerContext = allText.substring(Math.max(0, snookerIndex - 100), snookerIndex + 500);
      }

      // Éléments cliquables (titres de sport/ligue)
      const clickables = document.querySelectorAll('[class*="sport"], [class*="league"], [class*="tournament"], [class*="champ"]');
      info.sportElements = Array.from(clickables).slice(0, 15).map((el) => ({
        tag: el.tagName,
        class: el.className?.substring(0, 60),
        text: el.textContent?.trim().substring(0, 40),
      }));

      return info;
    });

    console.log(`  Titre: ${pageInfo.title}`);
    console.log(`  URL: ${pageInfo.url}`);
    console.log(`  Body length: ${pageInfo.bodyLength}`);
    console.log(`  Odds elements: ${pageInfo.oddsElements.length}`);
    if (pageInfo.oddsElements.length > 0) {
      pageInfo.oddsElements.forEach((o) => console.log(`    ${o.tag}.${o.class}: "${o.text}"`));
    }
    console.log(`  Sport elements: ${pageInfo.sportElements.length}`);
    pageInfo.sportElements.forEach((s) => console.log(`    ${s.tag}: "${s.text}"`));
    if (pageInfo.snookerContext) {
      console.log(`  Snooker context: ${pageInfo.snookerContext.substring(0, 300)}`);
    }

    // Screenshot
    const filename = url.split("/").filter(Boolean).pop() || "page";
    await page.screenshot({ path: `/tmp/1xbet_kz_${filename}.png`, fullPage: false });
    console.log(`  Screenshot: /tmp/1xbet_kz_${filename}.png`);

  } catch (err) {
    console.log(`  ❌ ${err.message}`);
  }

  if (apiCalls.length > 0) {
    console.log(`  API calls interceptées: ${apiCalls.length}`);
    apiCalls.forEach((a) => console.log(`    ${a.status} ${a.url.substring(0, 80)} → keys: ${a.dataKeys.join(",")}`));
  }

  await context.close();
}

async function main() {
  console.log(`Test approfondi 1xbet.kz — Sport: ${SPORT}`);
  const browser = await chromium.launch({ headless: true });

  for (const url of URLS) {
    await scrape1xbet(browser, url);
  }

  await browser.close();
}

main().catch(console.error);
