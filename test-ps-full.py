from playwright.sync_api import sync_playwright
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://localhost:3000", timeout=30000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    
    # Navigate
    page.evaluate("window.bnGo('tennis')")
    page.wait_for_timeout(2000)
    page.evaluate("window.tn2SwitchTab('top')")
    page.wait_for_timeout(3000)
    
    # Activate PW SCR
    page.evaluate("window.tn2Top10Mode('powerscore')")
    page.wait_for_timeout(3000)
    
    # Count ALL PS elements on page
    counts = page.evaluate("""() => {
        return {
            cards: document.querySelectorAll('.tn-t10-card').length,
            psLabels: document.querySelectorAll('.tn-t10-ps-label').length,
            psBars: document.querySelectorAll('.tn-t10-ps-bar').length,
            psScores: document.querySelectorAll('.tn-t10-ps-score').length,
            psRows: document.querySelectorAll('.tn-t10-ps-row').length,
            psDims: document.querySelectorAll('.tn-t10-ps-dims').length,
            psFav: document.querySelectorAll('.tn-t10-ps-fav').length,
        };
    }""")
    print("PS Elements on page:")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    
    # Get per-card PS data
    card_data = page.evaluate("""() => {
        return Array.from(document.querySelectorAll('.tn-t10-card')).map((card, i) => {
            const psRow = card.querySelector('.tn-t10-ps-row');
            const psLabel = card.querySelector('.tn-t10-ps-label');
            const psScores = card.querySelectorAll('.tn-t10-ps-score');
            const psDims = card.querySelector('.tn-t10-ps-dims');
            return {
                rank: i + 1,
                hasPS: !!psRow,
                label: psLabel ? psLabel.textContent.trim() : null,
                scoreP1: psScores[0] ? psScores[0].textContent.trim() : null,
                scoreP2: psScores[1] ? psScores[1].textContent.trim() : null,
                hasDims: !!psDims,
            };
        });
    }""")
    print("\nPer-card PowerScore:")
    for c in card_data:
        mark = '✅' if c['hasPS'] else '❌'
        ps_str = f"{c['scoreP1']} vs {c['scoreP2']}" if c['scoreP1'] else '—'
        print(f"  #{c['rank']}: {mark} PS={ps_str}, label={c['label']}, dims={c['hasDims']}")
    
    # Take screenshots
    page.screenshot(path="C:\\Users\\david\\screenshot-ps-all-cards.png", full_page=True)
    
    # Scroll to bottom to check last cards
    page.evaluate("document.querySelector('.tn-t10-card:last-child')?.scrollIntoView()")
    page.wait_for_timeout(1000)
    page.screenshot(path="C:\\Users\\david\\screenshot-ps-bottom-cards.png", full_page=False)
    
    browser.close()
