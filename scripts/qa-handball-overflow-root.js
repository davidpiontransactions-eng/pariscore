/**
 * Diagnostic ciblé : pourquoi le pop-up handball déborde-t-il de ~19 px ?
 *
 * Mesure la boîte du DialogContent, puis remonte la chaîne des ancêtres pour
 * trouver le PREMIER élément dont scrollWidth > clientWidth — c'est lui qui
 * gonfle la piste implicite de la grille, pas ses victimes visuelles.
 *
 * Usage : node scripts/qa-handball-overflow-root.js [url]
 */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");

const URL = process.argv[2] || "https://pariscore.fr/?sport=handball";
const WIDTH = parseInt(process.argv[3] || "430", 10);
const OUT = "logs/qa-hb-root.txt";

(async () => {
  const out = [];
  const log = (...a) => out.push(a.join(" "));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: WIDTH, height: 932 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
  });
  const page = await ctx.newPage();

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(4000);

  const opener = page.locator('[aria-label^="Analyse du match"]').first();
  const n = await page.locator('[aria-label^="Analyse du match"]').count();
  log(`viewport ${WIDTH}px — matchs cliquables : ${n}`);
  if (n === 0) {
    fs.writeFileSync(OUT, out.join("\n"));
    await browser.close();
    return;
  }
  await opener.click();
  await page.waitForTimeout(3500);

  const r = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return { error: "pas de dialog" };
    const cs = getComputedStyle(dlg);
    const rect = dlg.getBoundingClientRect();
    const lbl = (el) => {
      const slot = el.getAttribute("data-slot");
      const cls =
        typeof el.className === "string" && el.className
          ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "";
      return el.tagName.toLowerCase() + (slot ? `[${slot}]` : "") + cls;
    };

    // Sources RÉELLES de débordement : scrollWidth > clientWidth.
    const sources = [];
    dlg.querySelectorAll("*").forEach((el) => {
      const ecs = getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        const er = el.getBoundingClientRect();
        sources.push({
          sel: lbl(el),
          scrollW: el.scrollWidth,
          clientW: el.clientWidth,
          by: el.scrollWidth - el.clientWidth,
          right: Math.round(er.right),
          display: ecs.display,
          minWidth: ecs.minWidth,
          overflowX: ecs.overflowX,
          whiteSpace: ecs.whiteSpace,
          text: (el.textContent || "").trim().slice(0, 40),
        });
      }
    });
    sources.sort((a, b) => b.by - a.by);

    // Chaîne d'ancêtres de la pire victime VISUELLE.
    let worst = null;
    dlg.querySelectorAll("*").forEach((el) => {
      const er = el.getBoundingClientRect();
      if (er.width > 0 && er.right > window.innerWidth + 1) {
        if (!worst || er.right > worst.right) {
          const chain = [];
          let n2 = el;
          for (let i = 0; i < 9 && n2 && n2 !== document.body; i++) {
            const c2 = getComputedStyle(n2);
            const r2 = n2.getBoundingClientRect();
            chain.push(
              `${lbl(n2)} [right=${Math.round(r2.right)} w=${Math.round(r2.width)} display=${c2.display} minW=${c2.minWidth} pad=${c2.paddingLeft}/${c2.paddingRight}]`,
            );
            n2 = n2.parentElement;
          }
          worst = { right: Math.round(er.right), chain };
        }
      }
    });

    return {
      vw: window.innerWidth,
      dlg: {
        rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) },
        width: cs.width,
        maxWidth: cs.maxWidth,
        left: cs.left,
        right: cs.right,
        transform: cs.transform,
        padding: `${cs.paddingLeft}/${cs.paddingRight}`,
        display: cs.display,
        gridTemplateColumns: cs.gridTemplateColumns,
        scrollW: dlg.scrollWidth,
        clientW: dlg.clientWidth,
      },
      sources: sources.slice(0, 10),
      worst,
    };
  });

  log("");
  log("=== DialogContent ===");
  log(JSON.stringify(r.dlg, null, 2));
  log("");
  log(`=== ${r.sources ? r.sources.length : 0} source(s) de débordement (scrollWidth > clientWidth) ===`);
  (r.sources || []).forEach((s) =>
    log(
      `  ${s.sel}\n    scrollW=${s.scrollW} clientW=${s.clientW} (+${s.by}) right=${s.right} display=${s.display} minW=${s.minWidth} overflowX=${s.overflowX} ws=${s.whiteSpace}\n    texte: "${s.text}"`,
    ),
  );
  log("");
  log("=== chaîne de la pire victime visuelle ===");
  (r.worst?.chain || []).forEach((c, i) => log(`  ${"  ".repeat(i)}${c}`));

  fs.writeFileSync(OUT, out.join("\n"));
  await browser.close();
})().catch((e) => {
  fs.writeFileSync(OUT, `ERREUR: ${e.stack}\n`);
  process.exit(1);
});