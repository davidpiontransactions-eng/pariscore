const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE = process.env.QA_BASE_URL || "https://pariscore.fr";
const OUT = path.join(__dirname, "..", "docs", "qa", "audit-visuel");
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: "home", url: "/", mobile: false },
  { name: "home-mobile", url: "/", mobile: true },
  { name: "football", url: "/football", mobile: false },
  { name: "football-mobile", url: "/football", mobile: true },
  { name: "tennis-stats", url: "/tennis/stats", mobile: false },
];

(async () => {
  const browser = await chromium.launch();
  let report = [];

  for (const p of PAGES) {
    const ctx = await browser.newContext(
      p.mobile
        ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
        : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 }
    );
    const page = await ctx.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
    page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));

    try {
      await page.goto(BASE + p.url, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(OUT, p.name + ".png"), fullPage: false });

      const audit = await page.evaluate(() => {
        const doc = document.documentElement;
        const overflow = doc.scrollWidth - doc.clientWidth;
        const articles = document.querySelectorAll("article").length;
        const brokenImgs = [...document.querySelectorAll("img")].filter((i) => {
          const src = i.getAttribute("src") || "";
          return src && !i.complete;
        }).length;
        const buttons = document.querySelectorAll("button").length;
        const headings = [...document.querySelectorAll("h1,h2,h3")].map((h) => h.tagName + ":" + (h.textContent || "").trim().slice(0, 40));
        return { overflow, articles, brokenImgs, buttons, headings };
      });

      report.push({ page: p.name, consoleErrors, pageErrors, ...audit });
      console.log(JSON.stringify({ page: p.name, ok: true, ...audit, consoleErrors: consoleErrors.length, pageErrors: pageErrors.length }));
    } catch (e) {
      report.push({ page: p.name, fatal: String(e).slice(0, 300) });
      console.log(JSON.stringify({ page: p.name, ok: false, error: String(e).slice(0, 200) }));
    }
    await ctx.close();
  }

  fs.writeFileSync(path.join(OUT, "audit-report.json"), JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });