# Preuve UI v1v8 : emprunt actif → colonne « Remb. » + ligne d'amortissement.
import json
import pathlib
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
raw = pathlib.Path("logs/session-cookie.txt").read_text(encoding="utf-8").strip()
name, _, value = raw.partition("=")
loan = json.dumps({"amount": 200, "startDate": "2026-10-02", "days": 24})

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="light")
    ctx.add_cookies([{"name": name, "value": value, "domain": "localhost", "path": "/", "secure": False, "httpOnly": True, "sameSite": "Lax"}])
    page = ctx.new_page()
    page.goto(f"{BASE}/bankroll/plan")
    page.wait_for_load_state("networkidle")
    page.evaluate("l => localStorage.setItem('bm-plan-loan', l)", loan)
    page.reload()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    remb_header = page.locator('th:has-text("Remb.")').count()
    remb_cells = page.locator("td", has_text="8,33").count()
    emprunt_trace = page.locator("text=à rembourser en plus des gains").count()
    retard_kpi = page.locator("text=Retard à combler").count()
    page.screenshot(path="docs/bet-tracker/qa/13-loan-plan.png", full_page=False)
    print(f"colonne Remb. header={remb_header}")
    print(f"cellules 8,33 (remb jour)={remb_cells}")
    print(f"trace emprunt actif={emprunt_trace}")
    print(f"KPI retard present={retard_kpi}")
    browser.close()
