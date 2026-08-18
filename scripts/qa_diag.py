import json
from playwright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width":1440,"height":900})
    pg = ctx.new_page()
    errs=[]
    pg.on("pageerror", lambda e: errs.append("PAGEERROR:"+e.text))
    pg.on("console", lambda m: errs.append(m.type+":"+m.text[:150]) if m.type=="error" else None)
    pg.goto("https://pariscore.fr", wait_until="domcontentloaded", timeout=45000)
    pg.wait_for_timeout(5000)
    print("URL:", pg.url)
    print("TITLE:", pg.title())
    crash = pg.evaluate("() => (window.__PARISCORE_CRASH || null)")
    print("PARISCORE_CRASH:", crash)
    body = pg.locator("body").inner_text()
    print("BODY_LEN:", len(body))
    print("HAS 'Filtres sports':", "Filtres sports" in body)
    print("HAS 'Sports':", "Sports" in body)
    print("HAS 'Football':", "Football" in body)
    print("HAS 'Bonjour':", "Bonjour" in body)
    print("BODY_HEAD:", body[:400].replace("\n"," | "))
    print("ASIDES:", pg.locator("aside").count())
    print("HEADER_BTN_Trophy:", pg.locator("text=Bonjour").count())
    pg.screenshot(path="scripts/diag.png", full_page=False)
    print("ERRORS:", errs[:10])
    b.close()