// Probe v5: contenu détaillé après activation du tab Football
const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('[role="tab"], button')].find(
      (b) => (b.textContent || "").trim().toLowerCase() === "football",
    );
    if (el) el.click();
  }).catch(() => {});
  await page.waitForTimeout(7000);

  const out = await page.evaluate(() => {
    const body = document.body.textContent || "";
    const findBadges = (re) => {
      const out = [];
      for (const el of document.querySelectorAll("span, div, p")) {
        if (el.childElementCount) continue;
        const t = (el.textContent || "").trim();
        if (re.test(t) && !out.includes(t)) out.push(t);
      }
      return out.slice(0, 8);
    };
    return {
      hasCorn: /Corn\./.test(body),
      cornBadges: findBadges(/Corn\./),
      o15Badges: findBadges(/O1\.5/),
      bttsBadges: findBadges(/BTTS/),
      kairat: body.includes("Kairat"),
      // 3 premiers blocs-cards : éléments avec gros texte
      cards: [...document.querySelectorAll("[class*='rounded-2xl']")]
        .filter((el) => (el.textContent || "").length > 150 && (el.textContent || "").length < 900)
        .slice(0, 3)
        .map((el) => ({
          len: (el.textContent || "").length,
          text: (el.textContent || "").slice(0, 400),
        })),
      loading: [...document.querySelectorAll("[class*='animate-pulse']")].length,
    };
  });
  console.log("PROBE5=" + JSON.stringify(out, null, 1));
  await page.screenshot({ path: "docs/qa/audit-visuel/probe5-football.png", fullPage: false }).catch(() => {});
  await browser.close();
})();