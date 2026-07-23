#!/usr/bin/env python3
"""
scripts/inspect-besoccer-dom.py — Inspection du DOM rendu beSOCCER (post-Fastly).

Suite du spike B0 : Camoufox résout le challenge Fastly (HTTP 200 sur /team/real-madrid),
mais les patterns regex ne trouvent pas le logo. Ce script dump le HTML rendu et analyse
TOUS les <img>, background-image, et CDN URLs pour découvrir le vrai pattern logo.

Output :
  - HTML complet sauvé dans data/besoccer-real-madrid.html
  - Analyse : tous les <img src>, tous les background-image, toutes les URLs besoccer CDN,
    avec filtre sur les candidats logo.
"""

import os
import re
import sys
import time

URL = "https://www.besoccer.com/team/real-madrid"
OUT_HTML = os.path.join(os.path.dirname(__file__), "..", "data", "besoccer-real-madrid.html")
OUT_REPORT = os.path.join(os.path.dirname(__file__), "..", "data", "besoccer-dom-analysis.txt")


def main():
    print(f">>> Fetch stealth: {URL}")
    from scrapling.fetchers import StealthyFetcher
    t0 = time.time()
    page = StealthyFetcher.fetch(
        URL,
        headless=True,
        humanize=True,
        os_randomize=True,
        solve_cloudflare=True,
        network_idle=True,
        wait_selector="body",
        timeout=180,
    )
    elapsed = round(time.time() - t0, 1)
    print(f"    Status: {page.status} | Temps: {elapsed}s")

    # scrapling 0.4.11 Response : utiliser html_content (le vrai DOM rendu)
    html = getattr(page, 'html_content', '') or ''
    if not html:
        # fallback : prettify ou get_all_text
        try:
            html = page.prettify() or ''
        except Exception:
            html = page.get_all_text() or ''
    print(f"    HTML length: {len(html)} chars")

    os.makedirs(os.path.dirname(OUT_HTML), exist_ok=True)
    with open(OUT_HTML, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"    HTML sauvé: {OUT_HTML}")

    # Analyse
    lines = []
    lines.append(f"Analyse DOM beSOCCER — {URL}")
    lines.append(f"Status: {page.status} | Temps: {elapsed}s | HTML: {len(html)} chars")
    lines.append("=" * 70)

    # 1. Tous les <img src>
    imgs = re.findall(r'<img[^>]*\bsrc=["\']([^"\']+)["\'][^>]*>', html, re.I)
    lines.append(f"\n1. BALISES <img> ({len(imgs)} total) :")
    logo_candidates = []
    for src in imgs:
        # Filtre candidats logo
        is_logo = any(k in src.lower() for k in ('logo', 'crest', 'escudo', 'shield', 'team', 'club', 'equipos'))
        marker = ' ★LOGO' if is_logo else ''
        lines.append(f"   {src[:120]}{marker}")
        if is_logo:
            logo_candidates.append(src)

    # 2. Tous les background-image
    bgs = re.findall(r'background(?:-image)?\s*:\s*url\(["\']?([^"\')]+)["\']?\)', html, re.I)
    lines.append(f"\n2. BACKGROUND-IMAGE ({len(bgs)} total) :")
    for bg in bgs:
        is_logo = any(k in bg.lower() for k in ('logo', 'crest', 'escudo', 'shield', 'team', 'club', 'equipos'))
        marker = ' ★LOGO' if is_logo else ''
        lines.append(f"   {bg[:120]}{marker}")
        if is_logo:
            logo_candidates.append(bg)

    # 3. Toutes les URLs CDN beSOCCER (icdn, cdn, etc.)
    cdn_urls = set(re.findall(r'(https?://[a-z0-9.]*besoccer\.com/[^"\'\s>)\\]+)', html, re.I))
    lines.append(f"\n3. URLs CDN beSOCCER ({len(cdn_urls)} uniques) :")
    for u in sorted(cdn_urls)[:40]:
        lines.append(f"   {u[:120]}")

    # 4. Recherche contexte autour des mots-clés logo/crest/escudo
    lines.append(f"\n4. CONTEXTE autour de 'logo|crest|escudo|shield' :")
    for kw in ('logo', 'crest', 'escudo', 'shield'):
        for m in re.finditer(r'.{0,80}' + kw + r'.{0,80}', html, re.I):
            ctx = re.sub(r'\s+', ' ', m.group(0)).strip()
            if len(ctx) < 300:
                lines.append(f"   [{kw}] ...{ctx}...")

    lines.append(f"\n5. CANDIDATS LOGO FINAUX ({len(logo_candidates)}) :")
    for c in logo_candidates[:20]:
        lines.append(f"   → {c}")

    report = "\n".join(lines)
    with open(OUT_REPORT, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f"\n    Rapport: {OUT_REPORT}")

    print("\n" + "=" * 70)
    print(report)
    print("=" * 70)


if __name__ == '__main__':
    main()
