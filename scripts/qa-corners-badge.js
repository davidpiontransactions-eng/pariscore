// QA visuel final : force la source legacy enrichie (route /api/v2/matches → 500)
// puis vérifie le badge Corn. O6.5 (X%) sur les cards football (desktop + mobile).
const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const BASE = "http://localhost:3000";
const OUT = path.join(__dirname, "..", "docs", "qa", "audit-visuel");
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const results = [];

  for (const view of [
    { name: "desktop", width: 1440, height: 900, dsf: 1.5 },
    { name: "mobile", width: 390, height: 844, dsf: 2 },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: view.dsf });
    const page = await ctx.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 150)); });
    page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
    // Force le fallback legacy (prédictions enrichies)
    await page.route("**/api/v2/matches**", (route) => route.fulfill({ status: 500, body: "{}" }));

    try {
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(4000);
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('[role="tab"], button')].find(
          (b) => (b.textContent || "").trim().toLowerCase() === "football",
        );
        if (el) el.click();
      }).catch(() => {});
      // Attendre la fin du chargement (fallback legacy 113 matches + rendu)
      await page.waitForTimeout(9000);
      await page.waitForSelector("text=Corn. O6.5", { timeout: 20000 }).catch(() => {});

      const audit = await page.evaluate(() => {
        const body = document.body.textContent || "";
        const badgeRe = /Corn\. O6\.5 \(?\s*(\d{1,3})/;
        const seen = new Set();
        const badges = [];
        for (const el of document.querySelectorAll("span,div,p")) {
          if (el.childElementCount) continue;
          const t = (el.textContent || "").trim();
          const m = t.match(badgeRe);
          if (m && !seen.has(t)) { seen.add(t); badges.push({ text: t.slice(0, 40), prob: parseInt(m[1], 10) }); }
        }
        const cardsF = [...document.querySelectorAll("article,[class*='rounded-2xl']")]
          .filter((c) => (c.textContent || "").includes("Corn."));
        return {
          hasCorn: /Corn\./.test(body),
          cornerBadges: badges.slice(0, 10),
          cornerCardCount: cardsF.length,
          kairat: body.includes("Kairat"),
          liveHeader: /EN DIRECT/i.test(body),
          o15Present: /O1\.5/.test(body),
          loadingElems: document.querySelectorAll("[class*='animate-pulse']").length,
        };
      });
      results.push({ view: view.name, ...audit, consoleErrors, pageErrors });
      console.log("[" + view.name + "] " + JSON.stringify({ hasCorn: audit.hasCorn, badges: audit.cornerBadges, cornerCards: audit.cornerCardCount, kairat: audit.kairat, errors: consoleErrors.length + pageErrors.length }));
      await page.screenshot({ path: path.join(OUT, "corners-qa-" + view.name + ".png"), fullPage: false });
    } catch (e) {
      results.push({ view: view.name, error: String(e).slice(0, 300) });
      console.log("[" + view.name + "] ERROR " + String(e).slice(0, 300));
    }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "corners-qa-report.json"), JSON.stringify(results, null, 2));
  console.log("DONE");
})();