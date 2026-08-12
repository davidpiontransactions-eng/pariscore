const { chromium } = require("@playwright/test");

const BASE = process.env.QA_BASE_URL || "https://pariscore.fr";

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const bad = [];
  page.on("response", (r) => {
    if (r.status() >= 400) bad.push(r.status() + " " + r.url().slice(0, 160));
  });
  page.on("requestfailed", (r) => bad.push("FAILED " + r.url().slice(0, 160)));

  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2000);

  const heroLinks = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button, a")];
    return btns
      .filter((b) => /football|foot|⚽|🎾|🥊|🚴/i.test(b.textContent || ""))
      .slice(0, 8)
      .map((b) => ({ tag: b.tagName, text: (b.textContent || "").trim().slice(0, 40), href: b.getAttribute("href") || "", onclick: (b.getAttribute("onclick") || "").slice(0, 60) }));
  });

  const lazyImgs = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll("img")];
    const out = { total: imgs.length, loading: 0, brokenSrc: [] };
    for (const i of imgs.filter((i) => !i.complete)) {
      out.loading++;
      const src = i.currentSrc || i.getAttribute("src") || "";
      try {
        const r = await fetch(src, { method: "HEAD" });
        if (r.status >= 400) out.brokenSrc.push(src.slice(0, 120));
      } catch { out.brokenSrc.push("FETCHERR " + src.slice(0, 120)); }
    }
    return out;
  });

  console.log(JSON.stringify({ heroLinks, lazyImgs, bad404: bad }, null, 1).slice(0, 4500));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });