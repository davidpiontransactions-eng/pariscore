from playwright.sync_api import sync_playwright
import json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def run_qa():
    results = {
        "server_status": "unknown",
        "api_tests": [],
        "ui_tests": [],
        "bugs_found": [],
        "fixes_verified": [],
        "health_score": 0
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        
        # Collect console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
        
        print("=" * 70)
        print("QA TEST REPORT — PowerScore Tennis Top 10")
        print("=" * 70)
        
        # 1. Server Health Check
        print("\n[1] SERVER HEALTH CHECK")
        try:
            status = page.evaluate("async () => { const r = await fetch('/api/v1/status'); return r.ok; }")
            results["server_status"] = "healthy" if status else "unhealthy"
            print(f"    Status: {'✅ OK' if status else '❌ FAIL'}")
        except Exception as e:
            results["server_status"] = f"error: {e}"
            print(f"    Status: ❌ ERROR - {e}")
        
        # 2. API Tests
        print("\n[2] API TESTS")
        
        # 2a. Tennis Top 10 endpoint
        try:
            data = page.evaluate("""async () => {
                const r = await fetch('/api/v1/tennis/top10');
                const j = await r.json();
                return {
                    status: r.status,
                    matchCount: j.top10 ? j.top10.length : 0,
                    hasPowerscore: j.top10 ? j.top10.every(m => 
                        m.hasOwnProperty('powerscore_p1') && 
                        m.hasOwnProperty('powerscore_p2')
                    ) : false,
                    sampleData: j.top10 ? j.top10.slice(0, 2).map(m => ({
                        p1: m.player1,
                        p2: m.player2,
                        ps1: m.powerscore_p1,
                        ps2: m.powerscore_p2
                    })) : []
                };
            }""")
            
            test_result = {
                "name": "GET /api/v1/tennis/top10",
                "status": "PASS" if data["status"] == 200 and data["matchCount"] == 10 else "FAIL",
                "details": f"{data['matchCount']} matches, powerscore fields: {data['hasPowerscore']}"
            }
            results["api_tests"].append(test_result)
            print(f"    {test_result['status']}: {test_result['name']}")
            print(f"         {test_result['details']}")
            if data["sampleData"]:
                for m in data["sampleData"]:
                    print(f"         Sample: {m['p1']} ({m['ps1']}) vs {m['p2']} ({m['ps2']})")
        except Exception as e:
            results["api_tests"].append({"name": "GET /api/v1/tennis/top10", "status": "ERROR", "details": str(e)})
            print(f"    ERROR: {e}")
        
        # 3. UI Tests
        print("\n[3] UI TESTS")
        
        # Navigate to Tennis page
        page.goto("http://localhost:3000", timeout=30000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        
        # 3a. Tennis page loads
        try:
            page.evaluate("window.bnGo('tennis')")
            page.wait_for_timeout(2000)
            tennis_visible = page.evaluate("document.getElementById('page-tennis').style.display === 'grid'")
            results["ui_tests"].append({"name": "Tennis page loads", "status": "PASS" if tennis_visible else "FAIL"})
            print(f"    {'✅ PASS' if tennis_visible else '❌ FAIL'}: Tennis page loads")
        except Exception as e:
            results["ui_tests"].append({"name": "Tennis page loads", "status": "ERROR", "details": str(e)})
            print(f"    ERROR: Tennis page loads - {e}")
        
        # 3b. TOP tab activates
        try:
            page.evaluate("window.tn2SwitchTab('top')")
            page.wait_for_timeout(2000)
            top_active = page.evaluate("document.querySelector('.tn2-tab-btn[data-tab=\"top\"]')?.classList.contains('active')")
            results["ui_tests"].append({"name": "TOP tab activates", "status": "PASS" if top_active else "FAIL"})
            print(f"    {'✅ PASS' if top_active else '❌ FAIL'}: TOP tab activates")
        except Exception as e:
            results["ui_tests"].append({"name": "TOP tab activates", "status": "ERROR", "details": str(e)})
            print(f"    ERROR: TOP tab activates - {e}")
        
        # 3c. Cards render
        try:
            card_count = page.evaluate("document.querySelectorAll('.tn-t10-card').length")
            results["ui_tests"].append({"name": "Cards render", "status": "PASS" if card_count == 10 else "FAIL", "details": f"{card_count} cards"})
            print(f"    {'✅ PASS' if card_count == 10 else '❌ FAIL'}: Cards render ({card_count}/10)")
        except Exception as e:
            results["ui_tests"].append({"name": "Cards render", "status": "ERROR", "details": str(e)})
            print(f"    ERROR: Cards render - {e}")
        
        # 3d. PW SCR button exists and is clickable
        try:
            btn_exists = page.evaluate("!!document.querySelector('.tn2-mode-btn[onclick*=\"powerscore\"]')")
            results["ui_tests"].append({"name": "PW SCR button exists", "status": "PASS" if btn_exists else "FAIL"})
            print(f"    {'✅ PASS' if btn_exists else '❌ FAIL'}: PW SCR button exists")
        except Exception as e:
            results["ui_tests"].append({"name": "PW SCR button exists", "status": "ERROR", "details": str(e)})
            print(f"    ERROR: PW SCR button exists - {e}")
        
        # 3e. PowerScore mode activates
        try:
            page.evaluate("window.tn2Top10Mode('powerscore')")
            page.wait_for_timeout(2000)
            active_mode = page.evaluate("document.querySelector('.tn2-mode-btn.active')?.textContent?.trim()")
            ps_labels = page.evaluate("document.querySelectorAll('.tn-t10-ps-label').length")
            results["ui_tests"].append({
                "name": "PowerScore mode activates",
                "status": "PASS" if active_mode == "⚡ PW SCR" and ps_labels > 0 else "FAIL",
                "details": f"Active: {active_mode}, PS labels: {ps_labels}"
            })
            print(f"    {'✅ PASS' if active_mode == '⚡ PW SCR' and ps_labels > 0 else '❌ FAIL'}: PowerScore mode activates")
            print(f"         Active button: {active_mode}, PS labels: {ps_labels}")
        except Exception as e:
            results["ui_tests"].append({"name": "PowerScore mode activates", "status": "ERROR", "details": str(e)})
            print(f"    ERROR: PowerScore mode activates - {e}")
        
        # 3f. All 10 cards have PowerScore data
        try:
            card_ps_data = page.evaluate("""() => {
                return Array.from(document.querySelectorAll('.tn-t10-card')).map((card, i) => {
                    const psRow = card.querySelector('.tn-t10-ps-row');
                    const psScores = card.querySelectorAll('.tn-t10-ps-score');
                    return {
                        rank: i + 1,
                        hasPS: !!psRow,
                        scoreP1: psScores[0] ? psScores[0].textContent.trim() : null,
                        scoreP2: psScores[1] ? psScores[1].textContent.trim() : null
                    };
                });
            }""")
            all_have_ps = all(c["hasPS"] for c in card_ps_data)
            results["ui_tests"].append({
                "name": "All cards have PowerScore",
                "status": "PASS" if all_have_ps else "FAIL",
                "details": f"{sum(1 for c in card_ps_data if c['hasPS'])}/10 cards with PS"
            })
            print(f"    {'✅ PASS' if all_have_ps else '❌ FAIL'}: All cards have PowerScore ({sum(1 for c in card_ps_data if c['hasPS'])}/10)")
        except Exception as e:
            results["ui_tests"].append({"name": "All cards have PowerScore", "status": "ERROR", "details": str(e)})
            print(f"    ERROR: All cards have PowerScore - {e}")
        
        # 4. Bug Verification
        print("\n[4] BUG FIX VERIFICATION")
        
        # 4a. BUG-001: Field name mismatch
        try:
            bug001_fixed = page.evaluate("""async () => {
                const r = await fetch('/api/v1/tennis/top10');
                const j = await r.json();
                const m = j.top10[0];
                return m.hasOwnProperty('powerscore_p1') && m.hasOwnProperty('powerscore_p2');
            }""")
            results["fixes_verified"].append({"bug": "BUG-001", "status": "FIXED" if bug001_fixed else "NOT FIXED"})
            print(f"    {'✅ FIXED' if bug001_fixed else '❌ NOT FIXED'}: BUG-001 (field name mismatch)")
        except Exception as e:
            results["fixes_verified"].append({"bug": "BUG-001", "status": "ERROR", "details": str(e)})
            print(f"    ERROR: BUG-001 - {e}")
        
        # 4b. BUG-003: Syntax error (extra })
        try:
            bug003_fixed = page.evaluate("typeof window.tn2Top10Mode === 'function'")
            results["fixes_verified"].append({"bug": "BUG-003", "status": "FIXED" if bug003_fixed else "NOT FIXED"})
            status_msg = '✅ FIXED' if bug003_fixed else '❌ NOT FIXED'
            print(f"    {status_msg}: BUG-003 (syntax error - extra brace)")
        except Exception as e:
            results["fixes_verified"].append({"bug": "BUG-003", "status": "ERROR", "details": str(e)})
            print(f"    ERROR: BUG-003 - {e}")
        
        # 5. Console Errors
        print("\n[5] CONSOLE ERRORS")
        if console_errors:
            print(f"    ⚠️  {len(console_errors)} errors found:")
            for err in console_errors[:5]:
                print(f"         {err[:100]}")
        else:
            print("    ✅ No console errors")
        
        # 6. Health Score Calculation
        print("\n[6] HEALTH SCORE")
        passed_tests = sum(1 for t in results["ui_tests"] if t["status"] == "PASS")
        total_tests = len(results["ui_tests"])
        api_passed = sum(1 for t in results["api_tests"] if t["status"] == "PASS")
        api_total = len(results["api_tests"])
        
        health_score = ((passed_tests / total_tests * 100) if total_tests > 0 else 0) * 0.7 + \
                       ((api_passed / api_total * 100) if api_total > 0 else 0) * 0.3
        results["health_score"] = round(health_score, 1)
        
        print(f"    UI Tests: {passed_tests}/{total_tests} passed")
        print(f"    API Tests: {api_passed}/{api_total} passed")
        print(f"    Health Score: {results['health_score']}/100")
        
        # 7. Summary
        print("\n" + "=" * 70)
        print("SUMMARY")
        print("=" * 70)
        print(f"Server Status: {results['server_status']}")
        print(f"API Tests: {api_passed}/{api_total} passed")
        print(f"UI Tests: {passed_tests}/{total_tests} passed")
        print(f"Bugs Fixed: {sum(1 for f in results['fixes_verified'] if f['status'] == 'FIXED')}/{len(results['fixes_verified'])}")
        print(f"Health Score: {results['health_score']}/100")
        
        if results["health_score"] >= 80:
            print("\n✅ VERDICT: PowerScore mode is FUNCTIONAL and ready for production")
        elif results["health_score"] >= 60:
            print("\n⚠️  VERDICT: PowerScore mode works but has issues to address")
        else:
            print("\n❌ VERDICT: PowerScore mode has critical issues")
        
        # Take final screenshot
        page.screenshot(path="C:\\Users\\david\\qa-powerscore-final.png", full_page=True)
        print(f"\nFinal screenshot saved: qa-powerscore-final.png")
        
        browser.close()
        return results

if __name__ == "__main__":
    run_qa()
