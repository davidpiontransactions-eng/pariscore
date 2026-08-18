// QA visuelle — features live OddAlerts (dialog détail match football).
// Vérifie rendu réel : momentum, ticker, duo donuts LIVE/ATTENDU,
// LiveStatsBreakdown (jauges, seuils funnel, probas live) + erreurs console.
// Usage : node scripts/qa-live-stats-visual.mjs [baseUrl]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const log = (m) => console.log(m);
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
};

await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
log(`URL: ${page.url()}`);

// ── Onglet Football ────────────────────────────────────────────────────────
// La home a plusieurs boutons "Football" : la vraie bascule de tab est la
// carte sport avec emoji ⚽ (SPORT_CARDS), pas l'ancre de scroll.
let footTab = page.locator("button").filter({ hasText: /⚽/ }).filter({ hasText: /Football/ }).first();
if (!(await footTab.count())) {
  footTab = page.locator("aside button, [class*=sidebar] button").filter({ hasText: /Football/i }).first();
}
const hasFootTab = await footTab.count();
if (hasFootTab) {
  await footTab.click();
  await page.waitForTimeout(6000);
}
check("onglet Football accessible", hasFootTab > 0);

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
await page.screenshot({ path: `qa-football-tab-${ts}.png`, fullPage: false });

// ── Ouvrir le dialog d'un match LIVE RÉEL (pas un mock v2) ────────────────
// Récupère une vraie équipe live depuis l'API BSD pour cibler la bonne carte.
let realTeam = null;
try {
  const res = await page.request.get(`${base}/api/football/live`);
  const data = await res.json();
  const list = data.matches ?? data;
  const pick = (Array.isArray(list) ? list : []).find((m) =>
    m.id?.startsWith("bsd-") && m.live && (m.live.homeXg != null || m.live.homeShots > 0));
  realTeam = pick?.home?.name ?? null;
  log(`INFO — match live réel ciblé: ${realTeam ?? "(aucun)"} ${pick ? `(${pick.id})` : ""}`);
} catch (e) {
  log(`INFO — cible réelle indisponible: ${e.message}`);
}

const momentumBtns = page.locator("button[title='Voir le momentum du match']");
const btnCount = await momentumBtns.count().catch(() => 0);
let targetIdx = 0;
if (realTeam) {
  for (let i = 0; i < btnCount; i++) {
    const cardText = await momentumBtns.nth(i).evaluate(
      (el) => el.closest('[class*="rounded"]')?.parentElement?.textContent ?? "",
    ).catch(() => "");
    if (cardText.includes(realTeam)) { targetIdx = i; break; }
  }
}
check("au moins un match live réel avec CTA Momentum", btnCount > 0);

let dialogOk = false;
if (btnCount > 0) {
  await momentumBtns.nth(targetIdx).click();
  const dialog = page.locator("[role=dialog]").first();
  await dialog.waitFor({ timeout: 20000 }).catch(() => {});
  dialogOk = (await dialog.count()) > 0;
  check("dialog détail ouvert", dialogOk);

  // Attente des fetch (stats + prematch) — le skeleton disparaît.
  await page.waitForTimeout(9000);

  const body = await page.evaluate(() => document.body.innerText);

  // 1) Momentum chart
  check("momentum chart rendu (svg + axe)", /Momentum/i.test(body) && (await page.locator("[role=dialog] svg").count()) > 0);

  // 2) Ticker d'événements agrégés (si événements)
  const ticker = page.locator("[role=dialog]").getByText(/Corner × |But × |Corner \(|But \(/).first();
  const hasTicker = await ticker.count().catch(() => 0);
  const hasGoalEvents = /But/.test(body);
  check("ticker d'événements (si buts/corners)", hasTicker > 0 || !hasGoalEvents, hasTicker ? "visible" : "aucun événement agrégé");

  // 3) Duo donuts LIVE / ATTENDU
  const hasLiveDonut = /Pression Live/i.test(body);
  const hasAvgDonut = /Attendu/i.test(body);
  check("donut PRESSION LIVE", hasLiveDonut);
  check("donut ATTENDU (baseline pré-match)", hasAvgDonut);

  // 4) LiveStatsBreakdown
  check("section Stats live", /Stats live/i.test(body));
  check("jauge Possession", /Possession/i.test(body));
  check("table métriques (Tirs cadrés)", /Tirs cadrés/i.test(body));
  check("probabilités live projetées", /Probabilités live projetées/i.test(body));
  check("marchés live (BTTS/O 2.5)", /BTTS|O 2\.5/.test(body));

  // 5) Surbrillance seuils funnel (badge compteur si signaux)
  const funnelBadge = page.locator("[role=dialog]").getByText(/signaux? funnel/i).first();
  const hasFunnelBadge = await funnelBadge.count().catch(() => 0);
  log(`INFO — badge signaux funnel: ${hasFunnelBadge ? "visible" : "absent (0 signal ou données manquantes)"}`);

  await page.screenshot({ path: `qa-live-dialog-${ts}.png`, fullPage: false });

  // Capture scrollée : donuts + breakdown sous le momentum
  await page.locator("[role=dialog]").evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `qa-live-dialog-bottom-${ts}.png`, fullPage: false });
}

// ── Erreurs console ────────────────────────────────────────────────────────
const realErrors = errors.filter((e) => !/404|favicon|posthog|sentry|Hydration|hydrat|Failed to load resource/i.test(e));
check("aucune erreur console/page", realErrors.length === 0, realErrors.slice(0, 3).join(" | ").slice(0, 220));

const fails = results.filter((r) => !r.ok).length;
log(`\nVERDICT: ${fails === 0 ? "OK — tout est rendu" : `${fails} FAIL(s)`}`);
log(`Screenshots: qa-football-tab-${ts}.png, qa-live-dialog-${ts}.png, qa-live-dialog-bottom-${ts}.png`);
await browser.close();
process.exit(fails === 0 ? 0 : 2);
