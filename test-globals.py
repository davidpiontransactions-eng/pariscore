from playwright.sync_api import sync_playwright
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://localhost:3000", timeout=30000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(5000)
    
    result = page.evaluate("""() => {
        return {
            tn2Top10Mode: typeof window.tn2Top10Mode,
            tn2TopMode: typeof window.tn2TopMode,
            tn2SwitchTab: typeof window.tn2SwitchTab,
            showPage: typeof window.showPage,
            bnGo: typeof window.bnGo,
        };
    }""")
    for k, v in result.items():
        print(f"  window.{k}: {v}")
    browser.close()
