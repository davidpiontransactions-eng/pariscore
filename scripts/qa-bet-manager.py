# QA visuel du module Bet Manager (Playwright, serveur déjà lancé sur :3000)
# Étendu en phase P6 bettrack : session cookie (routes /bm/* protégées depuis P2),
# fiche détail/édition, page Plan, page Ledger (CRUD tx live), nav 6 onglets.
import json
import pathlib

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
OUT = "docs/bet-tracker/qa"
COOKIE_FILE = pathlib.Path("logs/session-cookie.txt")


def shot(page, name):
    page.screenshot(path=f"{OUT}/{name}.png", full_page=True)
    print(f"  [shot] {name}.png")


def add_session(context):
    raw = COOKIE_FILE.read_text(encoding="utf-8").strip()
    name, _, value = raw.partition("=")
    context.add_cookies(
        [{"name": name, "value": value, "domain": "localhost", "path": "/", "secure": False, "httpOnly": True, "sameSite": "Lax"}]
    )


pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="dark")
    add_session(ctx)
    page = ctx.new_page()
    page.set_default_navigation_timeout(60000)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    # 0. Session : les routes /bm/* exigent une session NextAuth
    assert COOKIE_FILE.exists(), "logs/session-cookie.txt manquant (lancer mint-session.mjs)"
    # Le cookie minté vaut 1 h : vérification explicite avant d'aller plus loin.
    ping = page.request.get(f"{BASE}/api/v1/bm/bankrolls")
    if ping.status == 401:
        raise SystemExit("Session expirée (401) — relancer: bun %TEMP%\\opencode\\mint-session.mjs")

    # 0.5 Purge des paris QA des runs précédents (contexte = mêmes cookies)
    for b in page.request.get(f"{BASE}/api/v1/bm/bets?limit=500").json().get("bets", []):
        if b.get("matchLabel") == "Lyon vs Monaco":
            page.request.delete(f"{BASE}/api/v1/bm/bets/{b['id']}")
            print(f"  [clean] pari QA precedent supprime ({b['id']})")
    bankrolls = page.request.get(f"{BASE}/api/v1/bm/bankrolls").json().get("bankrolls", [])
    for bk in bankrolls:
        for t in page.request.get(f"{BASE}/api/v1/bm/bankrolls/{bk['id']}/txs").json().get("txs", []):
            if (t.get("note") or "").startswith("QA"):
                page.request.delete(f"{BASE}/api/v1/bm/bankrolls/{bk['id']}/txs/{t['id']}")
                print(f"  [clean] tx QA precedent supprime ({t['id']})")

    # 1. Dashboard
    print("1. Dashboard /bankroll")
    page.goto(f"{BASE}/bankroll")
    page.wait_for_load_state("networkidle")
    # Le KPI Capital dépend de la chaîne SWR (bankrolls → activeId → bets) :
    # on attend sa présence plutôt qu'un délai fixe (flaky en first-load).
    page.wait_for_selector("text=Capital actuel", timeout=20000)
    print(f"  viewport={page.evaluate('document.documentElement.clientWidth')}")
    shot(page, "01-dashboard")
    assert page.locator("text=Capital actuel").count() > 0, "KPI Capital manquant"
    assert page.locator("text=Évolution du capital").count() > 0, "Chart manquant"
    assert page.locator("text=Par sport").count() > 0, "Breakdown sport manquant"
    assert page.locator("text=Par type de pari").count() > 0, "Breakdown type manquant"
    assert page.locator("text=Exposition en cours").count() > 0, "KPI exposition manquant"
    # Nav 6 onglets (P6)
    assert page.locator('nav a[href="/bankroll/plan"]').count() > 0, "Onglet Plan manquant"
    assert page.locator('nav a[href="/bankroll/ledger"]').count() > 0, "Onglet Banque manquant"

    # 2. Ajout d'un pari via la page dédiée
    print("2. Formulaire ajout pari /bankroll/bets/new")
    page.goto(f"{BASE}/bankroll/bets/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    page.fill('input[placeholder="ex: PSG vs OM"]', "Lyon vs Monaco")
    page.fill('input[placeholder="ex: 1X2, Over 2.5, BTTS"]', "1X2")
    page.fill('input[placeholder="ex: PSG, Over, Oui"]', "Lyon")
    page.locator('input[placeholder="10"]').fill("15")
    page.fill('input[placeholder="1.85"]', "1.75")
    shot(page, "02-bet-form")
    page.click('button[type="submit"]')
    page.wait_for_timeout(1500)
    shot(page, "03-after-add")

    # 3. Règlement du pari (marquer gagné)
    print("3. Règlement pari")
    page.goto(f"{BASE}/bankroll/bets")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector('text=Lyon vs Monaco', timeout=15000)
    assert page.locator("text=Lyon vs Monaco").count() > 0, "Pari ajouté invisible dans la table"
    row = page.locator("tr", has_text="Lyon vs Monaco").first
    row.hover()
    row.get_by_title("Gagné").click()
    page.wait_for_timeout(1200)
    shot(page, "04-after-settle")

    # 4. Page Paris (filtres + recherche + tri)
    print("4. Page /bankroll/bets (filtres avancés)")
    assert page.locator("text=Tous les types").count() > 0, "Filtre type manquant"
    assert page.locator("text=Tous les books").count() > 0, "Filtre bookmaker manquant"
    page.fill('input[placeholder*="Rechercher"]', "Lyon")
    page.wait_for_timeout(600)
    shot(page, "05-bets-filter")
    rows = page.locator("tbody tr").count()
    print(f"  rows after filter: {rows}")
    assert rows == 1, f"Filtre recherche KO ({rows} lignes)"

    # 5. Fiche détail / édition d'un pari (P6)
    print("5. Fiche détail d'un pari")
    page.fill('input[placeholder*="Rechercher"]', "")
    page.wait_for_timeout(600)
    page.locator('button[aria-label^="Ouvrir la fiche de"]').first.click()
    page.wait_for_timeout(600)
    shot(page, "06-bet-detail")
    assert page.locator("text=Enregistrer").count() > 0, "Bouton Enregistrer (édition) manquant"
    assert page.locator("text=Réglé le").count() > 0, "Audit dates manquant"
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)

    # 6. Page Outils (19 calculateurs + paramètres)
    print("6. Page /bankroll/tools")
    page.goto(f"{BASE}/bankroll/tools")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)
    shot(page, "07-tools")
    assert page.locator("text=Critère de Kelly").count() > 0, "Kelly manquant"
    assert page.locator("text=Conversion de bonus").count() > 0, "Promo Conversion manquant"
    assert page.locator("text=Plan de mise").count() > 0, "Plan de mise manquant"
    assert page.locator("text=Paramètres & données").count() > 0, "Panneau paramètres manquant"
    assert page.locator("text=19 calculateurs").count() > 0, "Compteur 19 calculateurs manquant"

    # 7. Page Plan +20 %/j (P6)
    print("7. Page /bankroll/plan")
    page.goto(f"{BASE}/bankroll/plan")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)
    shot(page, "08-plan")
    assert page.locator("text=Paramètres du plan").count() > 0, "Paramètres du plan manquant"
    assert page.locator("text=Journal — objectif").count() > 0, "Journal manquant"
    assert page.locator("text=Table d'arbitrage").count() > 0, "Table d'arbitrage manquant"
    assert page.locator("text=Capital (réel)").count() > 0, "KPI jour courant manquant"

    # 8. Page Banque / Ledger (CRUD tx live : dépôt → suppression)
    print("8. Page /bankroll/ledger (CRUD BankrollTx)")
    page.goto(f"{BASE}/bankroll/ledger")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)
    shot(page, "09-ledger")
    assert page.locator("text=Nouveau mouvement").count() > 0, "Formulaire ledger manquant"
    assert page.locator("text=Solde courant").count() > 0, "KPI solde manquant"
    page.locator('input[placeholder="100"]').fill("50")
    page.locator('input[placeholder="ex : retrait Neteller"]').fill("QA dépôt")
    page.locator("button", has_text="Ajouter").last.click()
    page.wait_for_selector("text=QA dépôt", timeout=10000)
    shot(page, "10-ledger-after")
    assert page.locator("text=QA dépôt").count() > 0, "Mouvement non enregistré (POST /txs KO)"
    tx_row = page.locator("tr", has_text="QA dépôt").first
    tx_row.hover()
    tx_row.get_by_title("Supprimer le mouvement").click()
    page.wait_for_selector("text=QA dépôt", state="detached", timeout=10000)
    assert page.locator("text=QA dépôt").count() == 0, "Suppression tx KO (DELETE /txs)"

    # 9. Mobile 390px : dashboard + plan
    print("9. Mobile 390px")
    mctx = browser.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark")
    add_session(mctx)
    m = mctx.new_page()
    m.set_default_navigation_timeout(60000)
    for path, name in (("/bankroll", "11-dashboard-mobile"), ("/bankroll/plan", "12-plan-mobile")):
        m.goto(f"{BASE}{path}")
        m.wait_for_load_state("networkidle")
        m.wait_for_timeout(1500)
        shot(m, name)
        overflow = m.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
        print(f"  {path} horizontal overflow: {overflow}")
        assert not overflow, f"Overflow horizontal sur {path}"
    mctx.close()

    browser.close()

    if errors:
        print("\nERREURS CONSOLE/PAGE:")
        for e in errors[:10]:
            print("  -", e[:200])
    else:
        print("\nAucune erreur console.")
    # ASCII pur : console cp1252 de Windows (✔ planterait l'encodage)
    print("\nQA TERMINE")
