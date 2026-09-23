#!/usr/bin/env node
/**
 * scrape-football-market-values.mjs — Valeurs d'effectif Transfermarkt (M€)
 * par club via les pages « marktwerte » (classement valeur d'effectif : UNE page
 * = toutes les valeurs de la ligue).
 *
 * Feature : Csurilla & Csató arXiv:2609.21674 — signal orthogonal mercato,
 * combiné faiblement à l'ensemble (MV_WEIGHT=0.10, src/lib/prediction/football/market-value.ts).
 *
 * Sortie : data/football_market_values.json
 *   { scraped_at, leagues: { lgId: { clubNormalisé: valeurM€ } } }
 *
 * Usage : node scripts/scrape-football-market-values.mjs
 * Garde-fou : 0 clubs parsés partout → fichier existant conservé (pas d'écrasement) ;
 * ligue en erreur → conserve la ligue précédente du fichier existant.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const OUT_DIR = join(import.meta.dirname, "..", "data");
const OUT_FILE = join(OUT_DIR, "football_market_values.json");

// Pages TM « startseite » : table clubs de la ligne avec valeur TOTALE effectif
// (colonne lien /kader/ = « 314,65 mio. € ») — UNE page = toutes les valeurs club.
// (Les pages /marktwerte listent des JOUeurs, pas des clubs — diagnostic17:xx.)
const LEAGUES = [
  { id: "fr-ligue-1", url: "https://www.transfermarkt.fr/ligue-1/startseite/wettbewerb/FR1" },
  { id: "en-premier-league", url: "https://www.transfermarkt.fr/premier-league/startseite/wettbewerb/GB1" },
  { id: "de-bundesliga", url: "https://www.transfermarkt.fr/bundesliga/startseite/wettbewerb/L1" },
  { id: "it-serie-a", url: "https://www.transfermarkt.fr/serie-a/startseite/wettbewerb/IT1" },
  { id: "es-la-liga", url: "https://www.transfermarkt.fr/laliga/startseite/wettbewerb/ES1" },
];

function loadPrevLeagues() {
  try {
    if (!existsSync(OUT_FILE)) return {};
    return JSON.parse(readFileSync(OUT_FILE, "utf8")).leagues ?? {};
  } catch {
    return {};
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "fr-FR",
  });
  const page = await ctx.newPage();
  const prevLeagues = loadPrevLeagues();
  const out = { scraped_at: new Date().toISOString(), leagues: {} };

  for (const lg of LEAGUES) {
    try {
      console.log(`[tm-values] ${lg.id} → ${lg.url}`);
      await page.goto(lg.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("table.items", { timeout: 30000 }).catch(() => null);

      // Consent wall Sourcepoint (status202 + sp-message-open) : accepter best-effort
      // dans les iframes pour hydrater le tableau des valeurs.
      for (const fr of page.frames()) {
        for (const label of ["Tout accepter", "Accepter", "Accept all", "I agree"]) {
          try {
            const btn = fr.locator(`button:has-text("${label}")`).first();
            if (await btn.count() > 0 && await btn.isVisible()) {
              await btn.click({ timeout: 1500 });
              console.log(`[tm-values] ${lg.id}: consent dismissé (${label})`);
              break;
            }
          } catch {
            /* frame cross-origin / bouton absent — best-effort */
          }
        }
      }

      // Attendre hydratation des lignes (jusqu'à20s) plutôt que la seule présence de la table
      await page
        .waitForFunction(() => document.querySelectorAll("table.items tbody tr").length > 3, {
          timeout: 20000,
        })
        .catch(() => null);
      const rowCount = await page.locator("table.items tbody tr").count();
      console.log(`[tm-values] ${lg.id}: ${rowCount} lignes DOM`);

      // Parse navigateur : valeur TOTALE effectif = cellule contenant le lien /kader/
      // (« 314,65 mio. € » fr / « 1,05 Md € » → M€). Le nom club = titre du lien club.
      const clubs = await page.$$eval("table.items tbody tr", (rows) => {
        const norm = (s) =>
          (s || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9 ]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const toVal = (numStr, unitRaw) => {
          let v = parseFloat(String(numStr).replace(/\s/g, "").replace(",", "."));
          if (isNaN(v) || v <= 0) return null;
          const u = (unitRaw || "").toLowerCase().replace(/\./g, "");
          if (["mrd", "mds", "md", "bn", "b"].includes(u)) v *= 1000; // Md/Mrd/bn → M€
          return Math.round(v * 10) / 10; // M€,1 décimale
        };
        const parseM = (text) => {
          const s = (text || "").replace(/\u00a0/g, " ");
          // «1,36 Mrd. € » : le point final après l'unité est optionnel (\.?)
          let m = s.match(/([\d.,]+)\s*(mio|mrd|mds|md|bn|b|m)?\.?\s*€/i);
          if (m) return toVal(m[1], m[2]);
          m = s.match(/€\s*([\d.,]+)\s*(mio|mrd|mds|md|bn|b|m)?\.?\s*/i);
          if (m) return toVal(m[1], m[2]);
          return null;
        };
        const outMap = {};
        for (const r of rows) {
          const clubA = r.querySelector('.hauptlink a[title], td a[title]');
          if (!clubA) continue;
          // La ligne contient PLUSIEURS valeurs € : taille effectif (« 24 », sans €),
          // valeur moyenne/joueur (« 56,55 mio. € ») et valeur TOTALE effectif
          // (« 1,36 Mrd. € » — toujours la plus grande). Collecter toutes les
          // valeurs € (liens /kader/ + cellules) et prendre le MAX = total.
          const candidates = [];
          for (const a of r.querySelectorAll('a[href*="/kader/"]')) {
            const v = parseM(a.textContent);
            if (v != null) candidates.push(v);
          }
          for (const td of r.querySelectorAll("td")) {
            const v = parseM(td.textContent);
            if (v != null) candidates.push(v);
          }
          if (candidates.length === 0) continue;
          const v = Math.max(...candidates);
          const key = norm(clubA.getAttribute("title") || clubA.textContent);
          if (key) outMap[key] = v;
        }
        return outMap;
      });

      if (Object.keys(clubs).length === 0) {
        // 0 clubs (bloquage/structure) → conserver les valeurs précédentes
        console.warn(`[tm-values] ${lg.id}: 0 clubs — anciennes valeurs conservées`);
        if (prevLeagues[lg.id] && Object.keys(prevLeagues[lg.id]).length > 0) {
          out.leagues[lg.id] = prevLeagues[lg.id];
        }
      } else {
        out.leagues[lg.id] = clubs;
        console.log(`[tm-values] ${lg.id}: ${Object.keys(clubs).length} clubs`);
      }
      await page.waitForTimeout(2500); // rate-limit TM
    } catch (e) {
      console.warn(`[tm-values] ${lg.id} fail: ${e.message}`);
      if (prevLeagues[lg.id] && Object.keys(prevLeagues[lg.id]).length > 0) {
        out.leagues[lg.id] = prevLeagues[lg.id];
        console.log(`[tm-values] ${lg.id}: anciennes valeurs conservées`);
      }
    }
  }

  await browser.close();

  const total = Object.values(out.leagues).reduce((n, c) => n + Object.keys(c || {}).length, 0);
  if (total === 0 && existsSync(OUT_FILE)) {
    console.log("[tm-values] 0 clubs au total — fichier existant conservé");
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
  console.log(`[tm-values] Saved ${total} clubs → ${OUT_FILE}`);
}

main().catch((e) => {
  console.error("[tm-values] FATAL:", e.message);
  process.exit(1);
});
