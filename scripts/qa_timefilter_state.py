"""QA ciblé : onglet Football actif, filtre 1h, comparer sidebar vs partie droite,
clic match football → popup ?"""
from playwright.sync_api import sync_playwright
import re, datetime

def parse_kickoff(s):
    m = re.match(r"(\d{1,2}):(\d{2})", s or "")
    if not m:
        return None
    return int(m.group(1)) * 60 + int(m.group(2))

def now_min():
    now = datetime.datetime.now()
    return now.hour * 60 + now.minute

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.goto("http://localhost:3000/", wait_until="domcontentloaded", timeout=90000)
    page.wait_for_selector("aside[aria-label]", timeout=60000)
    page.wait_for_function(
        "() => document.querySelectorAll('aside[aria-label] button[aria-expanded]').length >= 3",
        timeout=90000,
    )

    # Onglet Football : clic sur le sport dans la sidebar
    page.evaluate("""() => {
      const btns = [...document.querySelectorAll('aside[aria-label] button[aria-expanded]')];
      const b = btns.find(x => x.textContent.includes('Football'));
      if (b) b.click(); return !!b;
    }""")
    page.wait_for_timeout(1200)

    # Vérifier l'onglet actif (SportSwipeHeader)
    active_tab = page.evaluate("""() => {
      const el = document.querySelector('[aria-selected=true], [data-active=true]');
      return el ? el.textContent.trim().slice(0, 30) : null;
    }""")
    print("onglet actif:", active_tab)

    # Filtre 1h
    page.locator("aside[aria-label] button", has_text=re.compile(r"^1h$")).first.click()
    page.wait_for_timeout(1000)

    txt = page.inner_text("aside[aria-label]")
    s_times = re.findall(r"\b(\d{1,2}:\d{2})\b", txt)
    nm = now_min()
    s_outside = [t for t in s_times if parse_kickoff(t) and abs(parse_kickoff(t) - nm) > 75]
    print("sidebar heures:", sorted(set(s_times))[:15])
    print("sidebar HORS 1h:", sorted(set(s_outside))[:10])

    # Partie droite : texte principal sous le header
    right = page.inner_text("body")
    # Ne garder que la zone après "Meilleurs matchs" (le tab content)
    idx = right.find("Meilleurs matchs")
    zone = right[:idx] if idx > 0 else right[:4000]
    r_times = re.findall(r"\b(\d{1,2}:\d{2})\b", zone)
    r_outside = [t for t in r_times if parse_kickoff(t) and abs(parse_kickoff(t) - nm) > 75]
    print("partie droite heures:", sorted(set(r_times))[:15])
    print("partie droite HORS 1h:", sorted(set(r_outside))[:10])

    # Nombre de cartes de matchs à droite (estimateur : ' vs ' ou ' – ')
    cards = len(re.findall(r"–", zone))
    print("séparateurs '–' partie droite:", cards)

    # Clic sur un match football (nom avec '–' dans la sidebar)
    clicked = page.evaluate("""() => {
      const btns = [...document.querySelectorAll('aside[aria-label] button')];
      const b = btns.find(x => x.textContent.includes('–') && !x.textContent.includes('€'));
      if (!b) return null;
      b.click();
      return b.textContent.trim().slice(0, 70);
    }""")
    page.wait_for_timeout(1500)
    popup = page.evaluate("""() => {
      const dlg = document.querySelector('[role=dialog]');
      return dlg ? (dlg.offsetParent !== null) : false;
    }""")
    print("clic match:", clicked)
    print("popup visible:", popup)

    # Liste des titres visibles à droite (h1/h2/h3) pour comprendre la zone
    heads = page.evaluate("""() => [...document.querySelectorAll('h1,h2,h3')].slice(0,12).map(h => h.textContent.trim().slice(0,50))""")
    print("titres page:", heads)
    browser.close()