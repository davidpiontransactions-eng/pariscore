/**
 * Sonde QA — sidebar Tennis : la branche tennis se déplie-t-elle et affiche-t-elle des matchs ?
 * Usage : node scripts/probe-tennis-sidebar.js [baseUrl]
 */
const BASE = process.argv[2] || "http://localhost:3000";
const TIME_FILTER = process.argv[3] || null; // ex: 6h — simule store persisté
const OUT = ".context/probe-tennis-sidebar.png";

let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("@playwright/test")); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  if (TIME_FILTER) {
    // Seed du store persisté zustand (clé pariscore.sportsSidebar)
    await page.addInitScript(
      ([tf]) => {
        localStorage.setItem(
          "pariscore.sportsSidebar",
          JSON.stringify({
            state: {
              selectedTimeFilter: tf,
              favoriteLeagueIds: [],
              favoritesCustomized: false,
              expandedSports: { tennis: true },
              expandedCountries: {},
              modes: {},
            },
            version: 0,
          }),
        );
      },
      [TIME_FILTER],
    );
    console.log("[0] timeFilter simulé:", TIME_FILTER);
  }

  const consoleErrors = [];
  const apiCalls = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + e.message));
  page.on("response", (r) => {
    if (r.url().includes("/api/tennis")) {
      apiCalls.push(`${r.status()} ${r.url().replace(BASE, "")}`);
    }
  });

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(8_000); // SWR fetch arbre

  const aside = page.locator("aside").first();
  const asideVisible = await aside.isVisible().catch(() => false);
  console.log("[1] aside visible:", asideVisible);

  // Bouton sport Tennis (aria-expanded) dans l'aside
  const tennisBtn = aside.locator('button[aria-expanded]', { hasText: /tennis/i }).first();
  const tennisCount = await aside.locator('button[aria-expanded]', { hasText: /tennis/i }).count();
  console.log("[2] boutons Tennis trouvés:", tennisCount);
  if (!(await tennisBtn.isVisible().catch(() => false))) {
    // Dump de tous les sports visibles pour diagnostic
    const sports = await aside.locator('button[aria-expanded]').allInnerTexts();
    console.log("[2b] sports présents:", JSON.stringify(sports.map((s) => s.replace(/\n/g, " | "))));
    await page.screenshot({ path: OUT, fullPage: false });
    console.log("screenshot:", OUT);
    console.log("api:", JSON.stringify(apiCalls));
    console.log("consoleErrors:", JSON.stringify(consoleErrors.slice(0, 10)));
    await browser.close();
    return;
  }

  console.log("[3] libellé Tennis:", JSON.stringify((await tennisBtn.innerText()).replace(/\n/g, " | ")));
  const expandedBefore = await tennisBtn.getAttribute("aria-expanded");
  if (expandedBefore !== "true") {
    await tennisBtn.click();
    await page.waitForTimeout(1_000);
  }

  // Pays sous le sport tennis
  const countryBtns = aside.locator('li button[aria-expanded]');
  const allCountries = await countryBtns.allInnerTexts();
  console.log("[4] pays/ligues visibles après dépliage:", allCountries.length);

  // Déplie tous les niveaux restants (pays puis ligues)
  for (const b of await countryBtns.all()) {
    if ((await b.getAttribute("aria-expanded")) !== "true") {
      await b.click().catch(() => {});
      await page.waitForTimeout(150);
    }
  }
  await page.waitForTimeout(800);

  // Lignes de matchs : boutons avec aria-pressed (MatchRow)
  const matchRows = aside.locator('button[aria-pressed]');
  const nMatches = await matchRows.count();
  console.log("[5] lignes de matchs (aria-pressed) dans l'aside:", nMatches);
  const sample = await matchRows.allInnerTexts();
  console.log("[5b] échantillon:", JSON.stringify(sample.slice(0, 6).map((s) => s.replace(/\n/g, " "))));

  await page.screenshot({ path: OUT, fullPage: false });
  console.log("screenshot:", OUT);
  console.log("api:", JSON.stringify(apiCalls));
  console.log("consoleErrors:", JSON.stringify(consoleErrors.slice(0, 10)));
  await browser.close();
})().catch((e) => { console.error("PROBE FAIL:", e.message); process.exit(1); });
