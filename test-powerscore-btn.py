from playwright.sync_api import sync_playwright
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    
    # Collect console messages
    console_msgs = []
    page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))
    
    print("[1] Navigating to localhost:3000...")
    page.goto("http://localhost:3000", timeout=30000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(5000)
    
    # Check for JS errors
    errors = [m for m in console_msgs if 'error' in m.lower() or 'uncaught' in m.lower()]
    if errors:
        print("[!] Console errors:", errors[:5])
    
    # Check which global functions are available
    funcs = page.evaluate("""() => ({
        showPage: typeof showPage,
        bnGo: typeof window.bnGo,
        tn2SwitchTab: typeof window.tn2SwitchTab,
        tn2Top10Mode: typeof window.tn2Top10Mode,
        tn2TopMode: typeof window.tn2TopMode,
        startTennisTop10: typeof startTennisTop10,
    })""")
    print("[2] Global functions:", funcs)
    
    # Show Tennis page
    print("[3] Showing Tennis page...")
    page.evaluate("""() => {
        document.querySelectorAll('div[data-page]').forEach(el => el.style.display = 'none');
        var p = document.getElementById('page-tennis');
        if (p) p.style.display = 'grid';
    }""")
    page.wait_for_timeout(1000)
    
    # Switch to TOP tab
    print("[4] Switching to TOP tab...")
    page.evaluate("window.tn2SwitchTab('top')")
    page.wait_for_timeout(3000)
    
    page.screenshot(path="C:/Users/david/Documents/dev PariScore/ParisScorebis/screenshot-top-tab.png", full_page=False)
    print("[5] Screenshot: TOP tab")
    
    # Try tn2Top10Mode with fallback
    print("[6] Activating powerscore mode...")
    try:
        page.evaluate("window.tn2Top10Mode('powerscore')")
        print("    -> window.tn2Top10Mode succeeded")
    except Exception as e:
        print("    -> window.tn2Top10Mode failed:", str(e)[:100])
        try:
            page.evaluate("window.tn2TopMode('powerscore')")
            print("    -> window.tn2TopMode succeeded")
        except Exception as e2:
            print("    -> window.tn2TopMode failed:", str(e2)[:100])
            # Try calling the internal function via click simulation
            page.evaluate("""() => {
                var btn = document.querySelector('.tn2-mode-btn[onclick*="powerscore"]');
                if (btn) btn.click();
                else console.log('No powerscore button found');
            }""")
            print("    -> Tried button click fallback")
    
    page.wait_for_timeout(3000)
    
    ps = page.evaluate("""() => ({
        labels: document.querySelectorAll('.tn-t10-ps-label').length,
        bars: document.querySelectorAll('.tn-t10-ps-bar').length,
        containers: document.querySelectorAll('.tn-t10-ps-container').length,
        cards: document.querySelectorAll('.tn2-t10-card').length,
        activeMode: document.querySelector('.tn2-mode-btn.active') ? document.querySelector('.tn2-mode-btn.active').innerText : 'none'
    })""")
    print("[7] PS elements:", ps)
    
    ps_texts = page.evaluate("""() => {
        var labels = document.querySelectorAll('.tn-t10-ps-label');
        return Array.from(labels).slice(0, 8).map(function(l) { return l.innerText; });
    }""")
    print("[8] PS labels:", ps_texts)
    
    page.screenshot(path="C:/Users/david/Documents/dev PariScore/ParisScorebis/screenshot-powerscore-mode.png", full_page=False)
    print("[9] Screenshot: powerscore mode")
    
    page.screenshot(path="C:/Users/david/Documents/dev PariScore/ParisScorebis/screenshot-powerscore-full.png", full_page=True)
    print("[10] Full page screenshot")
    
    browser.close()
    print("[11] ALL DONE!")
