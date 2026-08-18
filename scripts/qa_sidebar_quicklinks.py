"""QA ciblee P0-3/P0-9 (quick-links, cotes 1X2, edge, a11y) - serveur local."""
import json
from playwright.sync_api import sync_playwright

results = []
console_errors = []

def rec(name, ok, detail=""):
    results.append({"check": name, "ok": bool(ok), "detail": detail})
    print(("PASS  " if ok else "FAIL  ") + name + (" | " + detail if detail else ""))

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(f"PAGEERROR: {e.text}"))

    page.goto("http://localhost:3000/", wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(8000)

    aside = page.locator("aside[aria-label]")

    rec("P0-3: section Predictions visible", aside.locator("text=Prédictions").count() >= 1)
    sec = aside.locator("section[aria-label='Prédictions']")
    rec("P0-3: sous-ligne Live", sec.locator("text=Live").count() >= 1)
    rec("P0-3: sous-ligne Value bets", sec.locator("text=Value bets").count() >= 1)
    rec("P0-3: sous-ligne Aujourd'hui", sec.locator("text=Aujourd'hui").count() >= 1)

    odds_buttons = aside.locator("button[aria-label^='1 '], button[aria-label^='X '], button[aria-label^='2 ']")
    rec("P0-1: boutons cotes 1/X/2 presents", odds_buttons.count() >= 3, f"count={odds_buttons.count()}")

    exp = aside.locator("button[aria-expanded]")
    rec("P0-9: boutons aria-expanded", exp.count() >= 3, f"count={exp.count()}")
    labels = aside.locator("button[aria-label*='Élargir'], button[aria-label*='Réduire']")
    rec("P0-9: labels Élargir/Réduire", labels.count() >= 2, f"count={labels.count()}")

    page.screenshot(path="scripts/qa_sidebar_quicklinks.png", full_page=False)

    try:
        page.evaluate("window.__qa_detail_events = []")
        page.evaluate("window.addEventListener('open-match-detail', e => window.__qa_detail_events.push(e.detail))")
        if odds_buttons.count():
            odds_buttons.first.click(timeout=5000)
            page.wait_for_timeout(400)
            details = page.evaluate("window.__qa_detail_events")
            rec("P0-1: clic cote -> open-match-detail", len(details) > 0, str(details[:1]))
        else:
            rec("P0-1: clic cote -> open-match-detail", False, "aucun bouton cote")
    except Exception as e:
        rec("P0-1: clic cote -> open-match-detail", False, repr(e)[:120])

    browser.close()

print()
print("==== ERRORS CONSOLE ====")
for e in console_errors[:20]:
    print("  -", e[:200])
ok_count = sum(1 for r in results if r["ok"])
print(f"{ok_count}/{len(results)} checks OK | {len(console_errors)} console errors")
with open("scripts/qa_sidebar_quicklinks_report.json", "w", encoding="utf-8") as f:
    json.dump({"results": results, "console_errors": console_errors[:20]}, f, ensure_ascii=False, indent=2)
print("RAPPORT -> scripts/qa_sidebar_quicklinks_report.json")