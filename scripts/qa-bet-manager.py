# QA visuel du module Bet Manager (Playwright, serveur déjà lancé sur :3000)
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
OUT = "docs/bet-tracker/qa"

def shot(page, name):
    page.screenshot(path=f"{OUT}/{name}.png", full_page=True)
    print(f"  [shot] {name}.png")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    # 1. Dashboard
    print("1. Dashboard /bankroll")
    page.goto(f"{BASE}/bankroll")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    shot(page, "01-dashboard")
    assert page.locator("text=Capital actuel").count() > 0, "KPI Capital manquant"
    assert page.locator("text=Évolution du capital").count() > 0, "Chart manquant"
    assert page.locator("text=Par sport").count() > 0, "Breakdown sport manquant"

    # 2. Ajout d'un pari via le formulaire
    print("2. Formulaire ajout pari")
    page.click("text=Ajouter un pari")
    page.wait_for_timeout(500)
    page.fill('input[placeholder="PSG vs OM"]', "Lyon vs Monaco")
    page.fill('input[placeholder="1X2"]', "1X2")
    page.fill('input[placeholder="PSG"]', "Lyon")
    stake = page.locator('input[placeholder="10"]')
    stake.fill("15")
    page.fill('input[placeholder="1.85"]', "1.75")
    shot(page, "02-bet-form")
    page.click("text=Ajouter le pari")
    page.wait_for_timeout(1500)
    shot(page, "03-after-add")
    assert page.locator("text=Lyon vs Monaco").count() > 0, "Pari ajouté invisible dans la table"

    # 3. Règlement du pari (marquer gagné)
    print("3. Règlement pari")
    row = page.locator("tr", has_text="Lyon vs Monaco").first
    row.hover()
    row.get_by_title("Gagné").click()
    page.wait_for_timeout(1200)
    shot(page, "04-after-settle")

    # 4. Page Paris (filtres + recherche)
    print("4. Page /bankroll/bets")
    page.goto(f"{BASE}/bankroll/bets")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)
    shot(page, "05-bets")
    page.fill('input[placeholder*="Rechercher"]', "Lyon")
    page.wait_for_timeout(600)
    shot(page, "06-bets-filter")
    rows = page.locator("tbody tr").count()
    print(f"  rows after filter: {rows}")
    assert rows == 1, f"Filtre recherche KO ({rows} lignes)"

    # 5. Page Outils (17 calculateurs)
    print("5. Page /bankroll/tools")
    page.goto(f"{BASE}/bankroll/tools")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)
    shot(page, "07-tools")
    assert page.locator("text=Critère de Kelly").count() > 0, "Kelly manquant"
    assert page.locator("text=Simulateur Monte Carlo").count() > 0, "Monte Carlo manquant"
    assert page.locator("text=Plan de mise").count() > 0, "Plan de mise manquant"

    # 6. Dashboard mobile
    print("6. Mobile 390px")
    m = browser.new_page(viewport={"width": 390, "height": 844})
    m.goto(f"{BASE}/bankroll")
    m.wait_for_load_state("networkidle")
    m.wait_for_timeout(1500)
    shot(m, "08-dashboard-mobile")
    overflow = m.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
    print(f"  horizontal overflow: {overflow}")
    m.close()

    browser.close()

    if errors:
        print("\nERREURS CONSOLE/PAGE:")
        for e in errors[:10]:
            print("  -", e[:200])
    else:
        print("\nAucune erreur console.")
    print("\nQA TERMINÉ ✔")