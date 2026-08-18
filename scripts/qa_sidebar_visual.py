"""QA visuelle automatisee de la sidebar multi-sports (pariscore.fr).
Ouvre le site deploye, controle les 5 blocs, les interactions cles, les erreurs console,
fait des captures desktop + mobile, et ecrit un rapport JSON-machine pour la QA humaine.
Usage: python scripts/qa_sidebar_visual.py [--url https://pariscore.fr] [--out report.json]
"""
import argparse, json, traceback
from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser()
p.add_argument("--url", default="https://pariscore.fr")
p.add_argument("--out", default="scripts/qa_sidebar_report.json")
a = p.parse_args()

results = []
errors = []
console_errors = []

def rec(name, ok, detail=""):
    results.append({"check": name, "ok": bool(ok), "detail": detail})
    print(("PASS  " if ok else "FAIL  ") + name + (" | " + detail if detail else ""))

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=["--force-device-scale-factor=1"])
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.on("console", lambda m: console_errors.append(m.text) if m.type in ("error",) else None)
    page.on("pageerror", lambda e: console_errors.append(f"PAGEERROR: {e.text}"))

    try:
        page.goto(a.url, wait_until="networkidle", timeout=45000)
        page.wait_for_timeout(4000)  # SWR sports-tree fetch

        aside = page.locator("aside[aria-label]")
        rec("aside desktop visible (1440px)", aside.is_visible() if aside.count() else False,
            "count=%d" % aside.count())
        page.screenshot(path="scripts/qa_sidebar_desktop_full.png", full_page=True)

        search = aside.locator("input[type=search]")
        rec("bloc 1: champ recherche", search.count() >= 1)
        rec("bloc 1: placeholder", len((search.first.get_attribute("placeholder") or "")) > 3)
        search.first.fill("liga")
        page.wait_for_timeout(500)
        rec("bloc 1: recherche 'liga' -> La Liga", aside.locator("text=La Liga").count() > 0)
        search.first.fill("zzzzzz")
        page.wait_for_timeout(600)
        rec("bloc 1: recherche vide -> empty-state", aside.locator("text=aucun résultat").count() > 0 or aside.locator("text=No results").count() > 0)
        search.first.fill("")

        rec("bloc 2: pills horaires", aside.locator("[role=group]").count() >= 2)
        rec("bloc 2: pill 'aujourd'hui'", aside.locator("text=Aujourd'hui").count() + aside.locator("text=Today").count() >= 1)
        rec("bloc 3: section favoris", aside.locator("text=Favoris").count() + aside.locator("text=Favorites").count() > 0)
        rec("bloc 5: toggle live/prematch", aside.locator("text=Live").count() > 0 and aside.locator("text=Avant-match").count() + aside.locator("text=Pre-match").count() > 0)

        sport_btn = aside.locator("button", has_text="Football").first
        if sport_btn.count():
            sport_btn.click()
            page.wait_for_timeout(500)
        rec("bloc 4: accordeon sport deroulable", aside.locator("ul").count() >= 2)

        page.screenshot(path="scripts/qa_sidebar_desktop_open.png")

    except Exception as e:
        errors.append("main:" + repr(e))
        traceback.print_exc()
    browser.close()

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    page.on("pageerror", lambda e: console_errors.append("MOBILE PAGEERROR: "+e.text))
    try:
        page.goto(a.url, wait_until="networkidle", timeout=45000)
        page.wait_for_timeout(3000)
        aside = page.locator("aside[aria-label]")
        rec("mobile <lg: aside masque (drawer)", not aside.is_visible())
        drawer_btn = page.locator("button[aria-label='Filtres sports'], button[aria-label='Sports filters']").last
        rec("mobile: bouton drawer present", drawer_btn.count() > 0)
        try:
            drawer_btn.click(timeout=4000); page.wait_for_timeout(800)
            rec("mobile: drawer s'ouvre", page.locator("[data-state=open]").count() > 0)
        except Exception:
            rec("mobile: drawer s'ouvre", False, "click impossible")
        page.screenshot(path="scripts/qa_sidebar_mobile.png", full_page=True)
    except Exception as e:
        errors.append("mobile:"+repr(e))
        traceback.print_exc()
    browser.close()

print("\n==== ERRORS CONSOLE ====")
for e in console_errors[:40]:
    print("  -", e[:200])
print("\n==== RESUME ====")
ok_count = sum(1 for r in results if r["ok"])
print(f"{ok_count}/{len(results)} checks OK  |  {len(errors)} exceptions  |  {len(console_errors)} console errors")

with open(a.out, "w", encoding="utf-8") as f:
    json.dump({"results": results, "exceptions": errors, "console_errors": console_errors[:40], "url": a.url}, f, ensure_ascii=False, indent=2)
print("RAPPORT ->", a.out)