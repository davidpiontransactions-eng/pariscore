from playwright.sync_api import sync_playwright
import json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://localhost:3000", timeout=30000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    
    data = page.evaluate("""async () => {
        const r = await fetch('/api/v1/tennis/top10');
        const j = await r.json();
        return j.top10.map((m, i) => ({
            rank: i+1,
            p1: m.player1,
            p2: m.player2,
            ps1: m.powerscore_p1,
            ps2: m.powerscore_p2,
            hasBoth: m.powerscore_p1 != null && m.powerscore_p2 != null
        }));
    }""")
    
    print(f"{'#':<3} {'J1':<25} {'PS1':>5}  {'J2':<25} {'PS2':>5}  {'Both?':>5}")
    print("-" * 80)
    both_count = 0
    for m in data:
        ps1_str = str(m['ps1']) if m['ps1'] is not None else 'NULL'
        ps2_str = str(m['ps2']) if m['ps2'] is not None else 'NULL'
        mark = '✅' if m['hasBoth'] else '❌'
        if m['hasBoth']:
            both_count += 1
        print(f"{m['rank']:<3} {m['p1']:<25} {ps1_str:>5}  {m['p2']:<25} {ps2_str:>5}  {mark:>5}")
    
    print(f"\nRésultat: {both_count}/{len(data)} matchs avec PS complet")
    browser.close()
