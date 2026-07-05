from playwright.sync_api import sync_playwright
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    
    errors = []
    page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
    
    print("[1] Loading page...")
    page.goto("http://localhost:3000", timeout=30000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    
    # Navigate to Tennis page
    print("[2] Switching to Tennis page...")
    page.evaluate("window.bnGo('tennis')")
    page.wait_for_timeout(2000)
    page.screenshot(path="screenshot-final-01-tennis.png", full_page=False)
    
    # Switch to TOP tab
    print("[3] Switching to TOP tab...")
    page.evaluate("window.tn2SwitchTab('top')")
    page.wait_for_timeout(3000)
    page.screenshot(path="screenshot-final-02-top-fan.png", full_page=False)
    
    # Count cards before
    cards_before = page.evaluate("document.querySelectorAll('.tn-t10-card').length")
    ps_before = page.evaluate("document.querySelectorAll('.tn-t10-ps-label').length")
    print(f"    Before PW SCR: {cards_before} cards, {ps_before} PS labels")
    
    # Click PW SCR button
    print("[4] Activating PW SCR mode...")
    btn = page.query_selector('.tn2-mode-btn[onclick*="powerscore"]')
    if btn:
        btn.click()
        print("    Button clicked!")
    else:
        page.evaluate("window.tn2Top10Mode('powerscore')")
        print("    Called tn2Top10Mode('powerscore') directly")
    
    page.wait_for_timeout(3000)
    
    # Count cards/PS elements after
    cards_after = page.evaluate("document.querySelectorAll('.tn-t10-card').length")
    ps_labels = page.evaluate("document.querySelectorAll('.tn-t10-ps-label').length")
    ps_bars = page.evaluate("document.querySelectorAll('.tn-t10-ps-bar').length")
    ps_containers = page.evaluate("document.querySelectorAll('.tn-t10-ps-container').length")
    active_mode = page.evaluate("document.querySelector('.tn2-mode-btn.active')?.textContent?.trim()")
    ps_values = page.evaluate("""() => {
        return Array.from(document.querySelectorAll('.tn-t10-ps-label')).slice(0,3).map(el => el.textContent.trim());
    }""")
    
    print(f"    After PW SCR: {cards_after} cards, {ps_labels} PS labels, {ps_bars} PS bars, {ps_containers} PS containers")
    print(f"    Active mode button: {active_mode}")
    print(f"    PS label samples: {ps_values}")
    
    page.screenshot(path="screenshot-final-03-powerscore.png", full_page=False)
    page.screenshot(path="screenshot-final-03-powerscore-full.png", full_page=True)
    
    # Check for errors
    print(f"\n[5] Console errors: {len(errors)}")
    for e in errors[:5]:
        print(f"    {e[:150]}")
    
    # Verdict
    print(f"\n{'='*60}")
    if ps_labels > 0 and ps_bars > 0:
        print("✅ POWERSCORE MODE WORKING — PS labels and bars visible")
    elif ps_labels == 0 and cards_after > 0:
        print("⚠️  Cards render but NO PS elements — check CSS/rendering")
    else:
        print("❌ POWERSCORE MODE BROKEN — no cards or PS elements")
    print(f"{'='*60}")
    
    browser.close()
