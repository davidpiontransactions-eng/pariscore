# Probe : import xlsx dans le formulaire — texte du toast + erreurs console.
import pathlib
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
CALC = r"C:\Users\David\Documents\GenOffice\calc.xlsx"
raw = pathlib.Path("logs/session-cookie.txt").read_text(encoding="utf-8").strip()
name, _, value = raw.partition("=")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="dark")
    ctx.add_cookies([{"name": name, "value": value, "domain": "localhost", "path": "/", "secure": False, "httpOnly": True, "sameSite": "Lax"}])
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append("PAGEERROR: " + str(e)))
    page.on("console", lambda m: errs.append("CONSOLE: " + m.text[:300]) if m.type == "error" else None)
    page.goto(f"{BASE}/bankroll")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    page.get_by_role("button", name="Import CSV / Excel").click()
    page.wait_for_timeout(400)
    page.locator('input[type="file"][accept*=".xlsx"]').set_input_files(CALC)
    page.wait_for_timeout(6000)
    toasts = page.locator("[data-sonner-toast]")
    lines = [f"toasts={toasts.count()}"]
    for i in range(min(toasts.count(), 4)):
        lines.append(f"  toast[{i}]={toasts.nth(i).inner_text()[:200]!r}")
    lines.append("body_has_Feuille2=" + str(page.locator("text=Feuille2").count()))
    lines.append("dialog_open=" + str(page.locator('input[placeholder*="Rechercher une équipe"]').count()))
    lines.append("--- errors ---")
    lines.extend(errs[:8] or ["(aucune)"])
    pathlib.Path("logs/procs.txt").write_text("\n".join(lines), encoding="utf-8")
    browser.close()
