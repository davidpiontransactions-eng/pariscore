"""Visual verification of PowerScore mode on Tennis Top 10 page."""
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    
    # Navigate to the Tennis Top 10 page
    print("Navigating to localhost:3000...")
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle")
    
    # Take initial screenshot
    page.screenshot(path="C:/Users/david/Documents/dev PariScore/ParisScorebis/screenshot-initial.png", full_page=False)
    print("Initial screenshot taken")
    
    # Find the Tennis tab and click it
    print("Looking for Tennis tab...")
    tennis_tab = page.locator("text=Tennis").first
    if tennis_tab.is_visible():
        tennis_tab.click()
        page.wait_for_timeout(1000)
        print("Tennis tab clicked")
    else:
        print("Tennis tab not visible, trying alternative selectors...")
        # Try other selectors
        tennis_tab = page.locator("[data-sport='tennis']").first
        if tennis_tab.is_visible():
            tennis_tab.click()
            page.wait_for_timeout(1000)
    
    # Take screenshot after Tennis tab
    page.screenshot(path="C:/Users/david/Documents/dev PariScore/ParisScorebis/screenshot-tennis-tab.png", full_page=False)
    print("Tennis tab screenshot taken")
    
    # Find the PW SCR button and click it
    print("Looking for PW SCR button...")
    pw_scr_button = page.locator("text=PW SCR").first
    if pw_scr_button.is_visible():
        pw_scr_button.click()
        page.wait_for_timeout(2000)
        print("PW SCR button clicked")
    else:
        print("PW SCR button not visible, trying alternative selectors...")
        # Try other selectors
        pw_scr_button = page.locator("[data-mode='powerscore']").first
        if pw_scr_button.is_visible():
            pw_scr_button.click()
            page.wait_for_timeout(2000)
    
    # Take screenshot after PW SCR mode
    page.screenshot(path="C:/Users/david/Documents/dev PariScore/ParisScorebis/screenshot-pw-scr-mode.png", full_page=False)
    print("PW SCR mode screenshot taken")
    
    # Get page content to verify PowerScore bars are present
    content = page.content()
    if "powerscore" in content.lower() or "pw scr" in content.lower():
        print("SUCCESS: PowerScore content detected on page")
    else:
        print("WARNING: PowerScore content not detected in page HTML")
    
    browser.close()
    print("Visual verification complete!")
