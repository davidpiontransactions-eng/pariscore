/** Diag : état DOM de la home + erreurs runtime. */
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("@playwright/test")); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const errs = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) errs.push(m.type() + ": " + m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 300)));
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(9_000);
  const info = await page.evaluate(() => ({
    title: document.title,
    asides: document.querySelectorAll("aside").length,
    bodyChildren: Array.from(document.body.children).map((c) => c.tagName + "." + String(c.className).slice(0, 40)),
    hasOverlay: !!document.querySelector("nextjs-portal"),
    mainExists: !!document.querySelector("main"),
    buttons: document.querySelectorAll("button").length,
    bodyHead: document.body.innerText.slice(0, 180),
  }));
  console.log(JSON.stringify(info, null, 1));
  console.log("erreurs:", JSON.stringify(errs.slice(0, 8), null, 1));
  await page.screenshot({ path: ".context/repro-fail.png" });
  await browser.close();
})().catch((e) => { console.error("DIAG FAIL:", e.message); process.exit(1); });
