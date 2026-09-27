// QA visuel — encart hero Handball (bead ParisScorebis-q8rl) :
//   < lg (390px) → encart épuré = slogan + photo de handball UNIQUEMENT
//   ≥ lg (1440px) → encart complet (badge, paragraphe, CTA, panneau stratégies)
// Usage : node scripts/qa-hero-mobile.mjs   (dev server requis sur :3000)
import { chromium } from "@playwright/test";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const URL = `${BASE}/?sport=handball`;
const PHOTO_ALT = "Action de handball — visuel hero";
const CTA = "Voir les picks du jour";
const PANEL = "3 stratégies pick";

const fails = [];
const ok = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"} · ${label}`);
  if (!cond) fails.push(label);
};

const browser = await chromium.launch();

// Handball en favori (défaut = football/tennis/basketball/hockey/f1) pour que
// l'onglet actif soit présent dans la headbar et testable.
const seedFavorites = (page) =>
  page.addInitScript(() => {
    try {
      localStorage.setItem(
        "ps_sport_favorites",
        JSON.stringify(["handball", "football", "tennis", "basketball", "hockey"])
      );
    } catch {
      /* stockage indisponible */
    }
  });

// ── Mobile : encart épuré ─────────────────────────────────────────────────────
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
seedFavorites(mobile);
await mobile.goto(URL, { waitUntil: "load", timeout: 60_000 });
await mobile.waitForSelector("h1:visible", { timeout: 30_000 });
const photoMobile = mobile.locator(`img[alt="${PHOTO_ALT}"]`);
try {
  await photoMobile.waitFor({ state: "visible", timeout: 20_000 });
} catch {
  fails.push("photo hero mobile non trouvée/visible");
}
ok(await photoMobile.isVisible(), "mobile : photo du sport visible");
// Pixels réellement décodés (sinon capture d'une boîte vide)
await mobile
  .waitForFunction(
    (alt) => {
      const img = document.querySelector(`img[alt="${alt}"]`);
      return !!img && img.complete && img.naturalWidth > 0;
    },
    PHOTO_ALT,
    { timeout: 20_000 }
  )
  .catch(() => fails.push("photo hero mobile non chargée (naturalWidth = 0)"));
ok(
  (await photoMobile.evaluate((img) => img.complete && img.naturalWidth > 0).catch(() => false)) ===
    true,
  "mobile : photo réellement chargée (naturalWidth > 0)"
);
ok(
  !(await mobile.getByRole("button", { name: CTA }).first().isVisible()),
  "mobile : CTA « Voir les picks du jour » absent"
);
ok(
  !(await mobile.getByText(PANEL, { exact: true }).first().isVisible()),
  "mobile : panneau « 3 stratégies pick » masqué"
);
ok(
  (await mobile.getByRole("heading", { level: 1 }).filter({ hasText: "60 minutes" }).count()) >= 1,
  "mobile : slogan h1 présent"
);
ok(
  await mobile
    .locator('div[class*="lg:hidden"]')
    .getByText("Handball", { exact: true })
    .first()
    .isVisible()
    .catch(() => false),
  "mobile : nom du sport « Handball » présent dans l'encart"
);

// ── Headbar sport (charte Flashscore) ────────────────────────────────────────
const nav = (p) => p.locator('[aria-label="Navigation par sport"]');
const navBg = await nav(mobile).evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => "?");
ok(navBg === "rgb(238, 238, 238)", `mobile : fond headbar gris Flashscore (${navBg})`);
ok(
  (await nav(mobile).locator('button[data-sport] svg:visible').count()) === 0,
  "mobile : icônes sport masquées (noms seuls)"
);
ok(
  (await nav(mobile).locator('button[data-sport] span:visible').count()) > 0,
  "mobile : noms de sports visibles"
);

// ── Sélecteur de jour du calendrier (façon Flashscore) ──────────────────────
const dayPicker = (p) => p.locator('[aria-label="Filtrer par date"]');
await dayPicker(mobile)
  .waitFor({ state: "visible", timeout: 30_000 })
  .catch(() => fails.push("sélecteur de jour absent (calendrier non chargé ?)"));
ok(await dayPicker(mobile).isVisible(), "mobile : filtre date ◀ · date · ▶ visible");
const dateLabel = await dayPicker(mobile)
  .locator("button")
  .nth(1)
  .innerText()
  .catch(() => "");
ok(/^\d{2}\/\d{2} [A-Z]\w$/.test(dateLabel.trim()), `mobile : libellé date Flashscore (« ${dateLabel.trim()} »)`);
ok(
  (await dayPicker(mobile).locator('button[aria-label="Jour suivant"]').isEnabled()),
  "mobile : flèche « jour suivant » active"
);
const pickerJustify = await dayPicker(mobile)
  .evaluate((el) => getComputedStyle(el).justifyContent)
  .catch(() => "?");
ok(pickerJustify === "center", `mobile : sélecteur de jour centré (${pickerJustify})`);
ok(
  (await mobile.getByRole("button", { name: "Aujourd'hui" }).count()) === 0,
  "mobile : pastille « Aujourd'hui » retirée"
);
ok(
  (await mobile.getByRole("button", { name: "Demain" }).count()) === 0,
  "mobile : pastille « Demain » retirée"
);

// ── Headbar « Championnats » enrichie : logo + drapeau par ligne ─────────────
const champTrigger = mobile.getByRole("button", { name: "Filtrer par championnat" });
await champTrigger
  .click()
  .catch(() => fails.push("déclencheur « Championnats » introuvable"));
const champList = mobile.locator('[role="listbox"][aria-label="Championnats"]');
await champList
  .waitFor({ state: "visible", timeout: 15_000 })
  .catch(() => fails.push("liste Championnats non ouverte"));
const flagCount = await champList.locator('img[src^="/flags/"]').count();
const logoCount = await champList.locator('img[src^="/logos/handball/leagues/"]').count();
ok(flagCount > 0, `mobile : drapeaux dans la liste Championnats (${flagCount})`);
ok(logoCount > 0, `mobile : logos de compétition dans Championnats (${logoCount})`);
// Présence ≠ affichage : le 1er drapeau et le 1er logo doivent être rendus
ok(
  await champList.locator('img[src^="/flags/"]').first().isVisible(),
  "mobile : 1er drapeau réellement rendu (visible)"
);
ok(
  await champList.locator('img[src^="/logos/handball/leagues/"]').first().isVisible(),
  "mobile : 1er logo de compétition réellement rendu (visible)"
);
await mobile.screenshot({ path: "logs/qa-headbar-championnats.png" });
await mobile.keyboard.press("Escape");
await mobile.screenshot({ path: "logs/qa-hero-mobile.png" });

// ── Desktop : encart complet (inchangé) ───────────────────────────────────────
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
seedFavorites(desktop);
await desktop.goto(URL, { waitUntil: "load", timeout: 60_000 });
// 2 <h1> dans le DOM (un par variante) : on attend celui réellement visible.
await desktop.waitForSelector("h1:visible", { timeout: 30_000 });
try {
  await desktop.getByRole("button", { name: CTA }).first().waitFor({ state: "visible", timeout: 20_000 });
} catch {
  fails.push("CTA desktop non visible");
}
ok(await desktop.getByRole("button", { name: CTA }).first().isVisible(), "desktop : CTA complet visible");
ok(await desktop.getByText(PANEL, { exact: true }).first().isVisible(), "desktop : panneau stratégies visible");
ok(
  !(await desktop.locator(`img[alt="${PHOTO_ALT}"]`).isVisible()),
  "desktop : photo épurée masquée"
);
ok(
  (await nav(desktop).locator('button[data-sport] svg:visible').count()) > 0,
  "desktop : icônes sport visibles (pictos Flashscore)"
);
const activeColor = await nav(desktop)
  .locator('button[data-sport][aria-selected="true"]')
  .evaluate((el) => getComputedStyle(el).color)
  .catch(() => "?");
ok(activeColor === "rgb(232, 0, 64)", `desktop : onglet actif rouge Flashscore (${activeColor})`);
await desktop.screenshot({ path: "logs/qa-hero-desktop.png" });

await browser.close();

console.log(`\n${fails.length === 0 ? "TOUT VERT" : `${fails.length} ÉCHEC(S)`} — captures : logs/qa-hero-mobile.png, logs/qa-hero-desktop.png`);
process.exit(fails.length === 0 ? 0 : 1);
