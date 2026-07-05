import type { Locator, Page } from "@playwright/test";

/**
 * Page Object Model helpers for the SetPoint · Tennis Prematch UI.
 *
 * The app uses role-based + text-based selectors throughout (no data-testid
 * attributes were added by previous agents), so these helpers wrap the most
 * common queries in reusable accessors.
 *
 * NOTE: French is the default locale (`NEXT_LOCALE=fr`). When the test toggles
 * the language to English, those same selectors won't match anymore — pass
 * `lang="en"` to switch to the English label set.
 */

export type Lang = "fr" | "en";

const I18N = {
  fr: {
    refresh: "Actualiser",
    filters: "Filtres avancés",
    all: "Tous",
    favorites: "Favoris clairs",
    balanced: "Matchs serrés",
    detail: "Détail",
    detailHide: "Masquer",
    analysis: "Analyse complète",
    analysisShort: "Analyse",
    bet: "Parier",
    noMatchTitle: "Aucun match pour ce filtre",
    noMatchHint: "Essayez un autre filtre pour voir d'autres matchs.",
    tabOverview: "Vue d'ensemble",
    tabH2H: "H2H",
    tabForm: "Forme",
    tabOdds: "Cotes",
    h2hDirect: "H2H direct",
    h2hHistory: "Historique des confrontations",
    recentForm: "Forme récente (6 derniers matchs)",
    eloProgression: "Progression Elo (12 derniers mois)",
    valueBet: "Value bet détecté",
    bookmaker: "Bookmaker",
    warning: "Avertissement",
  },
  en: {
    refresh: "Refresh",
    filters: "Advanced filters",
    all: "All",
    favorites: "Clear favorites",
    balanced: "Balanced matches",
    detail: "Detail",
    detailHide: "Hide",
    analysis: "Full analysis",
    analysisShort: "Analysis",
    bet: "Bet",
    noMatchTitle: "No match for this filter",
    noMatchHint: "Try another filter to see more matches.",
    tabOverview: "Overview",
    tabH2H: "H2H",
    tabForm: "Form",
    tabOdds: "Odds",
    h2hDirect: "Direct H2H",
    h2hHistory: "Head-to-head history",
    recentForm: "Recent form (last 6 matches)",
    eloProgression: "Elo progression (last 12 months)",
    valueBet: "Value bet detected",
    bookmaker: "Bookmaker",
    warning: "Warning",
  },
} as const;

export function tr(lang: Lang) {
  return I18N[lang];
}

/**
 * Wait for the SWR-backed match list to render. We assert that at least one
 * card `<article>` is visible. The API endpoint resolves quickly (mock data)
 * so the loading skeletons should disappear within ~2s.
 */
export async function waitForMatches(page: Page, expectedCount?: number): Promise<void> {
  await page.locator("article").first().waitFor({ state: "visible" });
  if (expectedCount !== undefined) {
    await page
      .locator("article")
      .nth(expectedCount - 1)
      .waitFor({ state: "visible" });
  }
}

export class MatchCardPage {
  readonly page: Page;
  readonly root: Locator;
  readonly lang: Lang;

  constructor(page: Page, root: Locator, lang: Lang = "fr") {
    this.page = page;
    this.root = root;
    this.lang = lang;
  }

  static async all(page: Page, lang: Lang = "fr"): Promise<MatchCardPage[]> {
    await waitForMatches(page);
    const cards = page.locator("article");
    const count = await cards.count();
    const out: MatchCardPage[] = [];
    for (let i = 0; i < count; i++) {
      out.push(new MatchCardPage(page, cards.nth(i), lang));
    }
    return out;
  }

  static nth(page: Page, index: number, lang: Lang = "fr"): MatchCardPage {
    return new MatchCardPage(page, page.locator("article").nth(index), lang);
  }

  async playerNameA(): Promise<string> {
    return (await this.root.locator("h3").nth(0).textContent()) ?? "";
  }

  async playerNameB(): Promise<string> {
    return (await this.root.locator("h3").nth(1).textContent()) ?? "";
  }

  /** Probability percentages displayed in each ProbabilityRing center.
   *
   * The ProbabilityRing component has `role="img"` and an aria-label of the
   * form "Probabilité de victoire NN%". We parse the NN out of the aria-label
   * rather than the visible text — the visible text is concatenated with
   * surrounding player info (e.g. "205279%WIN") making regex parsing fragile.
   */
  async probabilities(): Promise<number[]> {
    const rings = this.root.locator(
      "[role='img'][aria-label^='Probabilité']",
    );
    const count = await rings.count();
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      const label = (await rings.nth(i).getAttribute("aria-label")) ?? "";
      const m = label.match(/(\d{1,3})%/);
      if (m) out.push(parseInt(m[1], 10));
    }
    return out;
  }

  async statChips(): Promise<{ label: string; value: string }[]> {
    // StatChip containers live inside the chip grid (div.grid with grid-cols-2
    // / sm:grid-cols-3 / lg:grid-cols-6). Each chip is a `div.flex.flex-col.
    // gap-1.rounded-lg` with two spans (label + value).
    const chipGrid = this.root.locator(
      "div.grid.grid-cols-2, div.grid.lg\\:grid-cols-6",
    ).first();
    const chips = chipGrid.locator("div.flex.flex-col.gap-1.rounded-lg");
    const count = await chips.count();
    const out: { label: string; value: string }[] = [];
    for (let i = 0; i < count; i++) {
      const spans = chips.nth(i).locator("span");
      const label = (await spans.nth(0).textContent()) ?? "";
      const value = (await spans.nth(1).textContent()) ?? "";
      out.push({ label: label.trim(), value: value.trim() });
    }
    return out;
  }

  detailButton(): Locator {
    return this.root.getByRole("button", { name: tr(this.lang).detail });
  }

  detailHideButton(): Locator {
    return this.root.getByRole("button", { name: tr(this.lang).detailHide });
  }

  analysisButton(): Locator {
    // The button shows "Analyse complète" on >= sm screens, "Analyse" on
    // smaller ones. The accessible name is whichever span is visible.
    // Use a regex that matches either form.
    return this.root.getByRole("button", {
      name: new RegExp(
        `^(${escapeRegExp(tr(this.lang).analysis)}|${escapeRegExp(
          tr(this.lang).analysisShort,
        )})$`,
      ),
    });
  }

  betButton(): Locator {
    return this.root.getByRole("button", { name: tr(this.lang).bet });
  }

  async expandDetail(): Promise<void> {
    await this.detailButton().click();
    // The warning callout renders as `<span>Avertissement :</span>` (note the
    // trailing colon) inside a parent div with the warning body text. Use a
    // substring match — `exact: true` would fail because the text node is
    // "Avertissement :" not "Avertissement".
    await this.root
      .getByText(tr(this.lang).warning)
      .first()
      .waitFor({ state: "visible" });
  }

  async collapseDetail(): Promise<void> {
    await this.detailHideButton().click();
    await this.root
      .getByText(tr(this.lang).warning)
      .first()
      .waitFor({ state: "hidden" });
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class DetailDialogPage {
  readonly page: Page;
  readonly lang: Lang;

  constructor(page: Page, lang: Lang = "fr") {
    this.page = page;
    this.lang = lang;
  }

  /** The Radix Dialog renders into a portal at the end of <body>.
   *  Filter out the consent banner by matching only dialogs that contain tabs
   *  (the match detail dialog has tabs, the consent banner does not). */
  dialog(): Locator {
    return this.page.getByRole("dialog").filter({
      has: this.page.getByRole("tab"),
    });
  }

  async open(card: MatchCardPage): Promise<void> {
    await card.analysisButton().click();
    await this.dialog().waitFor({ state: "visible" });
  }

  async close(): Promise<void> {
    await this.page.keyboard.press("Escape");
    // Wait for the match dialog (the one with tabs) to close.
    // The consent banner may still be visible — that's OK.
    await this.dialog().waitFor({ state: "hidden" });
  }

  tabOverview(): Locator {
    return this.page.getByRole("tab", { name: tr(this.lang).tabOverview });
  }

  tabH2H(): Locator {
    return this.page.getByRole("tab", { name: tr(this.lang).tabH2H, exact: true });
  }

  tabForm(): Locator {
    return this.page.getByRole("tab", { name: tr(this.lang).tabForm, exact: true });
  }

  tabOdds(): Locator {
    return this.page.getByRole("tab", { name: tr(this.lang).tabOdds, exact: true });
  }

  async switchToH2H(): Promise<void> {
    await this.tabH2H().click();
    await this.dialog()
      .getByText(tr(this.lang).h2hDirect, { exact: true })
      .waitFor({ state: "visible" });
  }

  async switchToForm(): Promise<void> {
    await this.tabForm().click();
    await this.dialog()
      .getByText(tr(this.lang).recentForm, { exact: true })
      .waitFor({ state: "visible" });
  }

  async switchToOdds(): Promise<void> {
    await this.tabOdds().click();
    await this.dialog()
      .getByText(tr(this.lang).bookmaker, { exact: true })
      .waitFor({ state: "visible" });
  }

  async switchToOverview(): Promise<void> {
    await this.tabOverview().click();
  }
}

/**
 * Click a filter pill by localized label.
 */
export async function clickFilter(
  page: Page,
  key: "all" | "favorites" | "balanced",
  lang: Lang = "fr",
): Promise<void> {
  const labelMap = {
    all: tr(lang).all,
    favorites: tr(lang).favorites,
    balanced: tr(lang).balanced,
  };
  // Use exact match to avoid colliding with "Tous les matchs" / similar.
  await page.getByRole("button", { name: labelMap[key], exact: true }).click();
}

/**
 * Toggle the theme via the header button.
 *
 * The ThemeToggle uses `next-themes` with `attribute="class"`, so toggling
 * flips `<html class="dark">` on/off. The button's accessible name is localized
 * ("Passer en mode clair" / "Switch to light mode"). Instead of relying on
 * the localized name, we target the icon button via its visible icon
 * (lucide-sun when in dark mode, lucide-moon in light mode) — that's stable
 * across locales.
 */
export async function toggleTheme(page: Page): Promise<void> {
  // The page header has role="banner"; use it to scope the locator so we don't
  // match any icon buttons inside match cards. ThemeToggle uses an icon button
  // with a Sun (dark mode) or Moon (light mode) lucide icon.
  const header = page.getByRole("banner");
  const themeBtn = header.locator(
    "button:has(svg.lucide-sun), button:has(svg.lucide-moon)",
  );
  await themeBtn.first().click();
}

/**
 * Toggle language via the LanguageToggle button. It shows "FR" or "EN" text.
 */
export async function toggleLanguage(page: Page): Promise<void> {
  // Scope to the banner header so we don't accidentally match any card-level
  // buttons. The LanguageToggle has a Languages icon + a 2-letter label.
  const header = page.getByRole("banner");
  const btn = header
    .getByRole("button")
    .filter({ hasText: /^(FR|EN)$/ });
  await btn.first().click();
  // router.refresh() is async — wait for the network idle / DOM to settle.
  await page.waitForLoadState("networkidle");
}
