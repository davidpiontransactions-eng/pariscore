from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True); ctx=b.new_context(viewport={"width":1440,"height":900}); pg=ctx.new_page()
    pg.goto("https://pariscore.fr", wait_until="networkidle", timeout=45000); pg.wait_for_timeout(4000)
    aside=pg.locator("aside")
    fb=aside.locator("button", has_text="Football").first
    try: fb.click()
    except: pass
    pg.wait_for_timeout(400)
    # expand first country (France / internationale)
    try:
        aside.locator("button", has_text=("France")).first.click(); pg.wait_for_timeout(300)
    except: pass
    print("=== aside dump after expand ===")
    print(aside.inner_text()[:3000])
    b.close()