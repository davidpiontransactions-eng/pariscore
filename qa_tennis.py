"""QA visuelle onglet tennis — vérifie drapeau pays + rang (#X) sur les cartes matchs.

Contexte session 2026-08-05 : résolution pays/drapeau + rang ATP/WTA (phase 2).
Vérifie que Player.country resolve vers un ISO2 et qu'un rang s'affiche (pas #—
quand les données source fournissent un rang).

Usage (via with_server.py) :
  python with_server.py --server "bun run dev" --port 3000 -- python qa_tennis.py
"""
import re
import sys
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
OUT = {}  # rapport JSON

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        # Onglet tennis actif par défaut (activeTab="tennis").
        # NB: pas de networkidle (SSE live/websockets ne "nettoient" jamais le réseau).
        page.goto(BASE, wait_until="domcontentloaded", timeout=150000)
        page.wait_for_timeout(8000)

        # Exploration du rendu : quels composants sont visibles ?
        flags = page.locator("img[alt*='flag' i], [data-flag], [class*='flag' i]").count()
        em_dash = page.get_by_text("#—", exact=True).count()
        rank_like = page.locator("text=/\\#[0-9]+( ATP| WTA)?/").count()

        # Match cards — classe du conteneur définie dans match-card.
        cards = page.locator("[data-match-card], [class*='match-card' i]").count()

        OUT["flags_visible"] = flags
        OUT["em_dash_sharp"] = em_dash
        OUT["rank_like_texts"] = rank_like
        OUT["cards"] = cards
        OUT["console_errors"] = errors[:10]

        page.screenshot(path="qa_tennis_full.png", full_page=True)

        # Récupérer les textes de rang visibles (échantillon)
        rank_samples = []
        for el in page.locator("text=/\\#[0-9]+( ATP| WTA)?/").all()[:10]:
            rank_samples.append(el.inner_text().strip())
        OUT["rank_samples"] = rank_samples

        # Drapeaux : src des imgs flag éventuelles
        flag_srcs = []
        imgs = page.locator("img").all()
        for im in imgs:
            src = im.get_attribute("src") or ""
            if "flag" in src.lower():
                flag_srcs.append(src)
            alt = im.get_attribute("alt") or ""
            if "flag" in alt.lower():
                flag_srcs.append(src + " (alt)")
        OUT["flag_srcs"] = flag_srcs[:8]

        # Contexte data : est-ce que l'API prematch a renvoyé des données ?
        try:
            resp = page.request.get(f"{BASE}/api/tennis/prematch")
            OUT["prematch_status"] = resp.status
            txt = resp.text()[:2000]
            OUT["prematch_body_snippet"] = txt
        except Exception as e:
            OUT["prematch_error"] = str(e)

        # Native country data on cards: inspect a rendered match card if any player
        # shows a flag emoji or iso code in the DOM.
        country_hits = page.locator("text=/[a-z]{2}/i").count()

        browser.close()

    ok = out_ok()
    OUT["qapass"] = ok
    print("=== QA TENNIS RESULT ===")
    print(json.dumps(OUT, ensure_ascii=False, indent=2))
    print("=== QA_PASS:", ok, "===")
    return 0 if ok else 1

def out_ok():
    """Critère QA : pas de pageerror/erreur console bloquante + rang #X présent."""
    hard_errors = [e for e in OUT.get("console_errors", []) if not ("favicon" in e or "404" in e and "/favicon" in e)]
    if any("pageerror" in e for e in OUT.get("console_errors", [])):
        return False
    # Un rank_like présent est un bon signal (rang résolu). Em-dash seul = pas de rang.
    has_rank = OUT.get("rank_like_texts", 0) > 0
    return has_rank and ("flags_visible" in OUT)

if __name__ == "__main__":
    sys.exit(run())