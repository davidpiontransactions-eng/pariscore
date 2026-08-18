import json
from playwright.sync_api import sync_playwright

bad = {}
allreq = []
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width":1440,"height":900})
    pg = ctx.new_page()
    pg.on("response", lambda r: (bad.update({r.url: r.status}) if r.status >= 400 else None, allreq.append((r.status, r.url))[0] if False else None))
    pg.goto("https://pariscore.fr", wait_until="networkidle", timeout=45000)
    pg.wait_for_timeout(5000)

    print("=== HTTP >=400 ===")
    for u, s in list(bad.items()):
        print(f"  {s}  {u[:110]}")

    print("\n=== /api/ statuses ===")
    seen={}
    for s,u in allreq:
        if "/api/" in u:
            k=u.split("?")[0]
            seen.setdefault(k,set()).add(s)
    for k in sorted(seen): print("  ", list(seen[k]), k[:100])

    print("\n=== sidebar sport rows (visible) ===")
    rows = pg.eval_on_selector_all("aside li button", "els => els.map(e => e.innerText.replace(/\\n/g,' | ').slice(0,60))")
    for r in rows[:40]: print("   -", r)

    print("\n=== favoris section present? ===")
    print("   header Favoris:", pg.locator("aside", has_text="Favoris").count(), "| EN Favorites:", pg.locator("aside", has_text="Favorites").count())
    print("   any Star svg in aside:", pg.locator("aside svg[viewBox='0 0 24 24'] polygon").count())

    print("\n=== football leagues visible ===")
    pg.locator("aside button", has_text="Football").first.click()
    pg.wait_for_timeout(400)
    txt = pg.locator("aside").inner_text()
    leagues=[l for l in txt.split("\n") if l.strip() and not any(x in l for x in ["Live","Avant","Pre-match","Rechercher","Tout","Heure","Favori","Sports"])]
    print("\n".join("   - "+l for l in leagues[:40]))
    pg.screenshot(path="scripts/qa_sidebar_after_restore.png", full_page=True)
    b.close()

with open("scripts/qa_probe.json","w",encoding="utf-8") as f:
    json.dump({"bad":bad}, f, ensure_ascii=False, indent=2)
print("\nprobe done")