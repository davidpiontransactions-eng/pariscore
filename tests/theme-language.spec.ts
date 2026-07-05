import { test, expect } from "@playwright/test";
import { toggleLanguage, toggleTheme, waitForMatches } from "./page-objects";

/**
 * Theme + language toggle tests.
 *
 * Theme: next-themes with attribute="class" defaultTheme="dark" → <html class="dark">.
 *   - Click toggle → light mode (no "dark" class)
 *   - Click again → dark mode ("dark" class)
 *
 * Language: cookie-based (`NEXT_LOCALE`), soft refresh via router.refresh().
 *   - Default: html lang="fr", French strings (Actualiser)
 *   - Click → html lang="en", English strings (Refresh)
 *   - Click again → back to French
 */

test.describe("Theme toggle (next-themes)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForMatches(page);
  });

  test("default theme is dark", async ({ page }) => {
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("clicking theme toggle switches to light", async ({ page }) => {
    await toggleTheme(page);
    // After toggle, "dark" class is removed from <html>.
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("clicking theme toggle twice returns to dark", async ({ page }) => {
    await toggleTheme(page); // → light
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await toggleTheme(page); // → dark
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});

test.describe("Language toggle (cookie-based, soft refresh)", () => {
  test.beforeEach(async ({ page }) => {
    // Start each test from a clean French state — clear any leftover cookie.
    await page.context().clearCookies();
    await page.goto("/");
    await waitForMatches(page);
  });

  test("default language is French (html lang='fr')", async ({ page }) => {
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    // Refresh button shows "Actualiser"
    await expect(page.getByRole("button", { name: "Actualiser" })).toBeVisible();
  });

  test("clicking language toggle switches to English", async ({ page }) => {
    await toggleLanguage(page);

    // html lang attribute now "en"
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // English "Refresh" button visible
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();

    // French "Actualiser" is gone
    await expect(page.getByRole("button", { name: "Actualiser" })).toHaveCount(0);

    // NEXT_LOCALE cookie was set
    const cookies = await page.context().cookies();
    const localeCookie = cookies.find((c) => c.name === "NEXT_LOCALE");
    expect(localeCookie).toBeDefined();
    expect(localeCookie?.value).toBe("en");
  });

  test("clicking language toggle twice returns to French", async ({ page }) => {
    await toggleLanguage(page); // fr → en
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await toggleLanguage(page); // en → fr
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("button", { name: "Actualiser" })).toBeVisible();
  });

  test("filter labels also translate", async ({ page }) => {
    // Sanity-check that the filter pill labels were translated alongside.
    await expect(page.getByRole("button", { name: "Tous", exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Favoris clairs", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Matchs serrés", exact: true }),
    ).toBeVisible();

    await toggleLanguage(page);

    // English labels
    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Clear favorites", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Balanced matches", exact: true }),
    ).toBeVisible();
  });
});
