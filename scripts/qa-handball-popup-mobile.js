/**
 * Recette VISUELLE mobile du pop-up match Handball (375 px et 430 px).
 *
 * Vérifie ce que `bun test` ne peut pas voir :
 *   1. absence de débordement horizontal (document + dans le pop-up) ;
 *   2. NON-redondance : combien de fois le nom de chaque équipe et le score
 *      prédit apparaissent dans le pop-up ;
 *   3. lisibilité des badges Pwr / Forme : couleur calculée + contraste du
 *      texte sur son fond ;
 *   4. onglets : scrollWidth > clientWidth (carrousel actif) + snap-x ;
 *   5. captures PNG.
 *
 * ps_shell ne capture pas stdout : tout est écrit dans un fichier.
 *
 * Usage : node scripts/qa-handball-popup-mobile.js [url]
 */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");

const URL = process.argv[2] || "https://pariscore.fr/?sport=handball";
const OUT = "logs/qa-handball-mobile.txt";
const SHOTS = "logs";
const VIEWPORTS = [
  { name: "375x812 (iPhone SE / SE2)", width: 375, height: 812 },
  { name: "430x932 (iPhone 15 Pro Max)", width: 430, height: 932 },
];

const CTX_BASE = {
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
};

/** Ratio de contraste WCAG entre deux couleurs rgb(). */
function luminance([r, g, b]) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

(async () => {
  const out = [];
  const log = (...a) => out.push(a.join(" "));
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    log(`\n${"=".repeat(72)}`);
    log(`VIEWPORT ${vp.name}`);
    log("=".repeat(72));

    const ctx = await browser.newContext({
      ...CTX_BASE,
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    try {
      await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
      // Attendre les CARTES, pas une durée fixe : à 375 px le 1er run trouva
      // 0 match et concluait « recette impossible » alors que c'était le
      // calendrier pas encore rendu.
      const opened = await page
        .waitForSelector('[aria-label^="Analyse du match"]', { timeout: 25000 })
        .then(() => true)
        .catch(() => false);
      await page.waitForTimeout(1500);
      const count = await page.locator('[aria-label^="Analyse du match"]').count();
      log(`matchs cliquables trouvés : ${count} (attente selector : ${opened})`);
      if (count === 0) {
        log("!! aucun match — recette impossible sur cette URL");
        await page.screenshot({ path: `${SHOTS}/qa-hb-${vp.width}-no-match.png` }).catch(() => {});
        continue;
      }
      await opener.click();
      await page.waitForTimeout(3500);

      // ── Sonde dans le pop-up ────────────────────────────────────────────
      const probe = await page.evaluate(() => {
        const dialog =
          document.querySelector('[role="dialog"]') ||
          document.querySelector('[data-state="open"]') ||
          null;
        const root = dialog || document.body;
        const vw = window.innerWidth;

        // 1. débordement
        const over = [];
        root.querySelectorAll("*").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > vw + 1) {
            over.push({
              tag: el.tagName.toLowerCase(),
              cls: typeof el.className === "string" ? el.className.slice(0, 60) : "",
              right: Math.round(r.right),
              by: Math.round(r.right - vw),
            });
          }
        });

        // 2. redondance : occurrences du nom de chaque équipe + du score
        const text = root.innerText || "";
        const teams = Array.from(
          root.querySelectorAll('[aria-label^="Analyser le duel"]'),
        ).map((b) => b.getAttribute("aria-label"));
        const logoCount = root.querySelectorAll("img").length;
        // Étiquettes « Score Prédit » / occurrences d'un motif « NN : NN »
        const scoreCells = text.match(/\b\d{1,2}\s*:\s*\d{1,2}\b/g) || [];

        // 3. badges Pwr / Forme : couleur + taille
        const badges = [];
        root.querySelectorAll("span").forEach((sp) => {
          const t = (sp.textContent || "").trim();
          if (/^(⚡\s*)?Pwr\s/i.test(t) || /^🔥\s*Forme/i.test(t)) {
            const cs = getComputedStyle(sp);
            badges.push({
              text: t.slice(0, 24),
              color: cs.color,
              bg: cs.backgroundColor,
              weight: cs.fontWeight,
              size: cs.fontSize,
            });
          }
        });

        // 4. onglets : le TabsList scroll-t-il ?
        let tabs = null;
        root.querySelectorAll('[role="tablist"]').forEach((tl) => {
          if (!tabs || tl.scrollWidth > tl.clientWidth + 2) tabs = tl;
        });
        const tabInfo = tabs
          ? {
              scrollWidth: tabs.scrollWidth,
              clientWidth: tabs.clientWidth,
              scrollable: tabs.scrollWidth > tabs.clientWidth + 2,
              overflowX: getComputedStyle(tabs).overflowX,
              snapType: getComputedStyle(tabs).scrollSnapType,
              count: tabs.querySelectorAll('[role="tab"]').length,
            }
          : null;

        // Hauteur du pop-up vs viewport
        const rect = root.getBoundingClientRect();
        return {
          hasDialog: !!dialog,
          docScrollW: document.documentElement.scrollWidth,
          vw,
          overCount: over.length,
          overTop: over.slice(0, 6),
          teams,
          logoCount,
          scoreCells,
          badges,
          tabInfo,
          popHeight: Math.round(rect.height),
          vh: window.innerHeight,
        };
      });

      log(`pop-up détecté (role=dialog) : ${probe.hasDialog}`);
      log(`hauteur pop-up ${probe.popHeight}px / viewport ${probe.vh}px`);
      log(
        `débordement horizontal doc : ${probe.docScrollW}px vs ${probe.vw}px (${probe.docScrollW - probe.vw}px)`,
      );
      log(`éléments débordant DANS le pop-up : ${probe.overCount}`);
      probe.overTop.forEach((o) =>
        log(`   - ${o.tag}.${o.cls} right=${o.right} (+${o.by}px)`),
      );

      log(`\n-- REDONDANCE --`);
      log(`boutons « Analyser le duel » : ${probe.teams.length}`);
      probe.teams.forEach((t) => log(`   ${t}`));
      log(`<img> dans le pop-up (logos + illustrations) : ${probe.logoCount}`);
      log(`occurrences d'un motif « NN : NN » : ${probe.scoreCells.length} → ${JSON.stringify(probe.scoreCells)}`);

      log(`\n-- BADGES KPI --`);
      if (probe.badges.length === 0) log("!! aucun badge Pwr/Forme trouvé");
      probe.badges.forEach((b) => {
        const parse = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
        const l1 = luminance(parse(b.color));
        const l2 = luminance(parse(b.bg));
        const ratio =
          (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        log(
          `   ${b.text.padEnd(22)} ${b.size}/${b.weight} ${b.color} sur ${b.bg} → contraste ~${ratio.toFixed(1)}:1 ${ratio >= 4.5 ? "AA OK" : ratio >= 3 ? "AA large OK" : "ÉCHEC"}`,
        );
      });

      log(`\n-- ONGLETS --`);
      if (!probe.tabInfo) log("!! aucune role=tablist");
      else
        log(
          `   ${probe.tabInfo.count} onglets · scrollWidth ${probe.tabInfo.scrollWidth} > clientWidth ${probe.tabInfo.clientWidth} → défilement : ${probe.tabInfo.scrollable} · overflow-x: ${probe.tabInfo.overflowX} · snap: ${probe.tabInfo.snapType}`,
        );

      const label = await opener.getAttribute("aria-label");
      log(`match ouvert : ${label}`);
      // 5. Captures.
      //
      // ⚠️ `locator.screenshot()` fait défiler l'élément pour le cadrer : sur un
      // pop-up plus haut que le viewport, Playwright remontait le CARRUSEL
      // d'onglets et la capture montrait « nalysis ». C'était un artefact de la
      // sonde, pas un défaut (scrollLeft mesuré à 0, 6 onglets entièrement
      // visibles). On capture donc le VIEWPORT, et on remet le carrousel à 0.
      const shot = `${SHOTS}/qa-hb-${vp.width}.png`;
      await page
        .evaluate(() => {
          const dlg = document.querySelector('[role="dialog"]');
          const tl = dlg && dlg.querySelector('[role="tablist"]');
          if (tl) tl.scrollLeft = 0;
        })
        .catch(() => {});
      await page.screenshot({ path: shot }).catch(() => {});
      log(`capture viewport : ${shot}`);
    } catch (e) {
      log(`ERREUR sur ${vp.name} : ${e.message}`);
    }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(OUT, out.join("\n"));
  console.log(`rapport écrit dans ${OUT}`);
})().catch((e) => {
  fs.writeFileSync(OUT, `ERREUR GLOBALE: ${e.stack}\n`);
  console.error(e);
  process.exit(1);
});