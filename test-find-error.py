from playwright.sync_api import sync_playwright
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    
    all_msgs = []
    page.on("console", lambda msg: all_msgs.append(f"[{msg.type}] {msg.text}"))
    
    # Inject error catcher BEFORE page loads
    page.add_init_script("""
        window.__jsErrors = [];
        window.onerror = function(msg, src, line, col, err) {
            window.__jsErrors.push({msg: msg, src: src, line: line, col: col, stack: err ? err.stack : ''});
        };
        window.addEventListener('unhandledrejection', function(e) {
            window.__jsErrors.push({msg: 'UnhandledPromise: ' + (e.reason && e.reason.message || e.reason), src: '', line: 0, col: 0, stack: e.reason && e.reason.stack || ''});
        });
    """)
    
    print("[1] Loading page with error catcher...")
    page.goto("http://localhost:3000", timeout=30000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(5000)
    
    # Get caught errors
    errors = page.evaluate("window.__jsErrors || []")
    print(f"[2] JS errors caught: {len(errors)}")
    for e in errors:
        src_short = (e.get('src') or '')[-60:]
        print(f"    Line {e.get('line')}:{e.get('col')} — {e.get('msg')[:120]}")
        print(f"      in: ...{src_short}")
    
    # Also get console errors
    console_errs = [m for m in all_msgs if m.startswith('[error') or m.startswith('[warning')]
    print(f"\n[3] Console errors/warnings: {len(console_errs)}")
    for m in console_errs[:15]:
        print(f"    {m[:200]}")
    
    # Check which scripts loaded
    scripts = page.evaluate("""() => {
        var ss = document.querySelectorAll('script[src]');
        return Array.from(ss).map(s => s.src.split('/').pop());
    }""")
    print(f"\n[4] External scripts loaded: {scripts}")
    
    # Check pariscore.js specifically
    pc_loaded = page.evaluate("""() => {
        try {
            // Try to access a variable that should exist if pariscore.js ran
            return {
                hasTn2TopMode: typeof window.tn2Top10Mode,
                hasShowPage: typeof showPage,
                hasJQuery: typeof jQuery,
                bodyDataPage: document.body.dataset.page,
            };
        } catch(e) { return {error: e.message}; }
    }""")
    print(f"\n[5] Pariscore state: {pc_loaded}")
    
    browser.close()
    print("\n[DONE]")
