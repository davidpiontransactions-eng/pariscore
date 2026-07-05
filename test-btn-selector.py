from playwright.sync_api import sync_playwright
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://localhost:3000", timeout=30000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    
    # Navigate to Tennis TOP
    page.evaluate("window.bnGo('tennis')")
    page.wait_for_timeout(2000)
    page.evaluate("window.tn2SwitchTab('top')")
    page.wait_for_timeout(2000)
    
    # Test the selector that window.tn2Top10Mode uses internally
    result = page.evaluate("""() => {
        var sel = '.tn2-mode-btn[onclick*="powerscore"]';
        var btn = document.querySelector(sel);
        return {
            selector: sel,
            found: !!btn,
            text: btn ? btn.textContent.trim() : null,
            onclick: btn ? btn.getAttribute('onclick') : null,
            allBtns: Array.from(document.querySelectorAll('.tn2-mode-btn')).map(b => ({
                text: b.textContent.trim(),
                onclick: b.getAttribute('onclick'),
                active: b.classList.contains('active')
            }))
        };
    }""")
    print("Selector test:")
    print(f"  Selector: {result['selector']}")
    print(f"  Found: {result['found']}")
    print(f"  Text: {result['text']}")
    print(f"  OnClick: {result['onclick']}")
    print(f"\nAll .tn2-mode-btn buttons:")
    for b in result['allBtns']:
        print(f"  {b['text']}: active={b['active']}, onclick={b['onclick']}")
    
    # Now test the actual flow: click PW SCR via the global function
    print("\n--- Calling tn2Top10Mode('powerscore') ---")
    page.evaluate("window.tn2Top10Mode('powerscore')")
    page.wait_for_timeout(500)
    
    after = page.evaluate("""() => {
        return Array.from(document.querySelectorAll('.tn2-mode-btn')).map(b => ({
            text: b.textContent.trim(),
            active: b.classList.contains('active')
        }));
    }""")
    print("After tn2Top10Mode('powerscore'):")
    for b in after:
        print(f"  {b['text']}: active={b['active']}")
    
    browser.close()
