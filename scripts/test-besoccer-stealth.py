#!/usr/bin/env python3
"""
scripts/test-besoccer-stealth.py — SPIKE de faisabilité beSOCCER (Phase B0).

beSOCCER est protégé par un WAF Fastly : 406 sur User-Agent non-navigateur +
Client Challenge JS sur les pages équipes. Ce script teste si le mode stealth
de Scrapling (Camoufox = Firefox patché C++) résout le challenge et permet
d'extraire le logo d'une page équipe.

Critères de succès (SPIKE RÉUSSI) :
  - HTTP 200 (vs 406/403 actuel avec fetch natif)
  - DOM rendu contient une balise logo (<img> ou background-image CSS)
  - Pattern d'URL logo découvert (CDN icdn.besoccer.com ou similaire)

Critères d'échec (SPIKE ÉCHOUÉ → abandon Phase B) :
  - 406/403 persistant (Fastly bloque même Camoufox)
  - Challenge JS non résolu (timeout, page blanche)
  - Logo introuvable dans le DOM rendu

Usage :
  python scripts/test-besoccer-stealth.py
  python scripts/test-besoccer-stealth.py --team "FC Barcelona"
  python scripts/test-besoccer-stealth.py --url "https://www.besoccer.com/team/real-madrid"

Dépendance : scrapling installé (pip install scrapling) + Camoufox.
Si scrapling manque, installer : pip install "scrapling[camoufox]"
"""

import argparse
import json
import re
import sys
import time

# Slug normalisation : "Real Madrid" → "real-madrid", "FC Barcelona" → "barcelona"
# (beSOCCER utilise des slugs parfois tronqués — on teste plusieurs variantes)
def name_to_slug_variants(name: str) -> list:
    """Génère des variantes de slug beSOCCER à tester."""
    n = name.strip().lower()
    # Strip préfixes/suffixes club communs
    n = re.sub(r'\b(fc|cf|ac|ssc|sc|afc|asd|cd|club|united|utd|city|real)\b', '', n).strip()
    n = re.sub(r'[^a-z0-9]+', '-', n).strip('-')
    variants = []
    if n:
        variants.append(n)
    # Variante sans strip (nom complet)
    full = re.sub(r'[^a-z0-9]+', '-', name.strip().lower()).strip('-')
    if full and full != n:
        variants.append(full)
    # Variante premier mot seul (ex: "barcelona" depuis "fc barcelona")
    first_word = re.sub(r'\s.*', '', name.strip().lower())
    first_word = re.sub(r'[^a-z0-9]+', '-', first_word).strip('-')
    if first_word and first_word not in variants:
        variants.append(first_word)
    return variants or ['real-madrid']


def try_fetch_stealthy(url: str, timeout: int = 90) -> dict:
    """Tente un fetch stealth Scrapling sur une URL. Retourne {ok, status, logos, elapsed, error}."""
    result = {'url': url, 'ok': False, 'status': None, 'logos': [], 'elapsed': 0, 'error': None}
    try:
        from scrapling.fetchers import StealthyFetcher
    except ImportError as e:
        result['error'] = f"scrapling non installé: {e}. Installer: pip install 'scrapling[camoufox]'"
        return result

    t0 = time.time()
    try:
        page = StealthyFetcher.fetch(
            url,
            headless=True,
            humanize=True,          # mouvements souris humains
            os_randomize=True,      # fingerprint OS cohérent
            solve_cloudflare=True,  # challenges JS génériques (Fastly inclus)
            network_idle=True,
            wait_selector="body",
            timeout=timeout,
        )
        result['elapsed'] = round(time.time() - t0, 1)
        result['status'] = getattr(page, 'status', None)

        if result['status'] != 200:
            result['error'] = f"HTTP {result['status']} (challenge Fastly non résolu)"
            return result

        # Recherche de logos dans le DOM rendu
        html = getattr(page, 'html', '') or getattr(page, 'content', '') or str(page)
        logos = extract_logos_from_html(html)
        result['logos'] = logos[:10]  # plafonné pour le rapport
        result['ok'] = len(logos) > 0
        if not logos:
            result['error'] = "Page chargée (200) mais aucun logo trouvé dans le DOM rendu"
        return result

    except Exception as e:
        result['elapsed'] = round(time.time() - t0, 1)
        result['error'] = f"{type(e).__name__}: {e}"
        return result


def extract_logos_from_html(html: str) -> list:
    """Extrait les URLs logo candidates depuis le HTML rendu.
    Patterns cherchés : <img> avec src contenant 'logo'/'crest'/'escudo',
    background-image CSS, attributs data-src, CDN beSOCCER connus.
    """
    logos = set()
    # <img src="...logo...">
    for m in re.finditer(r'<img[^>]+src=["\']([^"\']*(?:logo|crest|escudo|shield)[^"\']*)["\']', html, re.I):
        logos.add(m.group(1))
    # CDN beSOCCER typiques (icdn.besoccer.com, cdn.besoccer.com)
    for m in re.finditer(r'(https?://[a-z0-9.]*besoccer\.com/[^"\'\s>]+\.(?:png|jpg|svg|webp))', html, re.I):
        u = m.group(1)
        if any(k in u.lower() for k in ('logo', 'crest', 'escudo', 'shield', 'team', 'club', 'equipos')):
            logos.add(u)
    # background-image CSS
    for m in re.finditer(r'background(?:-image)?\s*:\s*url\(["\']?([^"\')]+)["\']?\)', html, re.I):
        u = m.group(1)
        if any(k in u.lower() for k in ('logo', 'crest', 'escudo', 'shield', 'team', 'equipos')):
            logos.add(u)
    # data-src (lazy load)
    for m in re.finditer(r'data-src=["\']([^"\']*(?:logo|crest|escudo)[^"\']*)["\']', html, re.I):
        logos.add(m.group(1))
    return sorted(logos)


def main():
    parser = argparse.ArgumentParser(description='SPIKE beSOCCER stealth (Phase B0)')
    parser.add_argument('--team', default='Real Madrid', help='Nom équipe (défaut: Real Madrid)')
    parser.add_argument('--url', help='URL directe (override --team)')
    parser.add_argument('--timeout', type=int, default=90, help='Timeout fetch (défaut 90s)')
    args = parser.parse_args()

    print('=' * 70)
    print('  SPIKE beSOCCER stealth (Phase B0) — faisabilité Camoufox vs Fastly')
    print('=' * 70)
    print(f"  Équipe: {args.team}")

    # URLs à tester
    urls = []
    if args.url:
        urls.append(args.url)
    else:
        base = 'https://www.besoccer.com/team/'
        for slug in name_to_slug_variants(args.team):
            urls.append(base + slug)
        # Variantes linguistiques
        slug_first = name_to_slug_variants(args.team)[0]
        urls.append(f'https://www.besoccer.es/equipo/{slug_first}')

    print(f"  URLs à tester ({len(urls)}):")
    for u in urls:
        print(f"    • {u}")
    print('=' * 70)

    results = []
    for url in urls:
        print(f"\n>>> Test: {url}")
        r = try_fetch_stealthy(url, args.timeout)
        results.append(r)
        status_str = f"HTTP {r['status']}" if r['status'] else 'N/A'
        print(f"    Status: {status_str} | Temps: {r['elapsed']}s | OK: {r['ok']}")
        if r['error']:
            print(f"    Erreur: {r['error']}")
        if r['logos']:
            print(f"    Logos trouvés ({len(r['logos'])}):")
            for lg in r['logos'][:5]:
                print(f"      → {lg}")
        if r['ok']:
            print("    ✅ SPIKE RÉUSSI sur cette URL")
            break  # un succès suffit
        else:
            print("    ❌ Échec sur cette URL")

    # Verdict final
    print('\n' + '=' * 70)
    print('  VERDICT SPIKE')
    print('=' * 70)
    any_ok = any(r['ok'] for r in results)
    if any_ok:
        ok = next(r for r in results if r['ok'])
        print(f"  ✅ RÉUSSI — beSOCCER est atteignable via Camoufox stealth.")
        print(f"     URL fonctionnelle: {ok['url']}")
        print(f"     Status: HTTP {ok['status']} | Temps: {ok['elapsed']}s")
        print(f"     Pattern logo: {ok['logos'][0] if ok['logos'] else '(à confirmer)'}")
        print(f"  → Phase B (B1-B4) peut procéder.")
        verdict = {'feasible': True, 'results': results}
    else:
        print("  ❌ ÉCHOUÉ — beSOCCER bloque même Camoufox stealth.")
        print("     Causes possibles: WAF Fastly, challenge JS non résolu, timeout.")
        print("  → Abandon Phase B. La Phase A (fix BSD IDs) suffit pour ~3600 équipes.")
        verdict = {'feasible': False, 'results': results}

    print('=' * 70)
    # Output JSON sur stderr pour parsing programmatif (stdout reste lisible)
    print('\n[JSON verdict]', file=sys.stderr)
    print(json.dumps(verdict, indent=2), file=sys.stderr)

    sys.exit(0 if any_ok else 1)


if __name__ == '__main__':
    main()
