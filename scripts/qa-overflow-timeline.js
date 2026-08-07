/**
 * Sonde QA — timeline du débordement : mesure scrollWidth dès domcontentloaded
 * pendant ~10 s et identifie les éléments VRAIMENT responsables (exclut ceux
 * contenus dans un conteneur overflow-x hidden/auto/scroll/clip — ex. la
 * rangée d'onglets sport qui scrolle dans son nav, comportement normal).
 */
const { chromium, devices } = require("@playwright/test");

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices["Pixel 7"] });
  const p = await ctx.newPage();
  await p.goto("https://pariscore.fr", {
    waitUntil: "domcontentloaded",
    timeout: 25000,
  });
  const t0 = Date.now();
  const lines = [];
  let lastSig = "";
  let lastUrl = "";
  for (let i = 0; i < 32; i++) {
    let m = null;
    try {
      m = await p.evaluate(() => {
      const iw = window.innerWidth;
      const sw = document.documentElement.scrollWidth;
      let offenders = [];
      if (sw > iw + 1) {
        const clippedBy = (el) => {
          let n = el.parentElement;
          while (n && n !== document.documentElement) {
            const ox = getComputedStyle(n).overflowX;
            if (["hidden", "auto", "scroll", "clip"].includes(ox)) return true;
            n = n.parentElement;
          }
          return false;
        };
        document.querySelectorAll("body *").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > iw + 1 && !clippedBy(el)) {
            const cls =
              typeof el.className === "string"
                ? el.className.split(" ").slice(0, 4).join(".")
                : "";
            offenders.push(
              el.tagName.toLowerCase() +
                (el.id ? "#" + el.id : "") +
                "." + cls +
                " right=" + Math.round(r.right),
            );
          }
        });
        offenders = [...new Set(offenders)].slice(0, 6);
      }
      return { iw, sw, offenders };
    });
    } catch {
      // Navigation client-side en cours : on skip ce sample.
      await p.waitForTimeout(400);
      continue;
    }
    const dt = Date.now() - t0;
    const url = p.url();
    if (url !== lastUrl) {
      lines.push(`t+${dt}ms NAVIGATION -> ${url}`);
      lastUrl = url;
    }
    if (m.sw > m.iw + 1) {
      const sig = m.offenders.join("|");
      lines.push(`t+${dt}ms iw=${m.iw} sw=${m.sw}`);
      if (sig !== lastSig) {
        m.offenders.forEach((o) => lines.push("   -> " + o));
        lastSig = sig;
      }
    }
    await p.waitForTimeout(300);
  }
  console.log(
    lines.length
      ? lines.join("\n")
      : "AUCUN debordement document durant les 10 premieres secondes",
  );
  await b.close();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
