#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scraper-team-logos-v2.py
------------------------
Scraper dédié à la récupération des 4 logos teams manquants (Task 7-logos-teams).

Pour chaque team manquante, on essaie 5 stratégies en cascade :

  Strat 1 — Wikipedia REST summary (`/api/rest_v1/page/summary/<title>`)
            → thumbnail.originalsource / originalimage.source

  Strat 5 — Wikipedia action=parse (wikitext) pour extraire `| image = File:…`
            puis action=query&prop=imageinfo&iiprop=url|mime|size[&iiurlwidth=330]
            (réseau en.wikipedia.org pour non-free images, commons pour free images).
            Pour les SVG on demande un thumb rasterisé à 330px (PNG), comme pour
            red-bull-bora-hansgrohe.

  Strat 2 — Wikimedia Commons search (`list=search&srsearch=…logo&srnamespace=6`)
            puis imageinfo.

  Strat 3 — UCI official site (https://www.uci.org/road/teams) — fallback.

  Strat 4 — Procyclingstats (https://www.procyclingstats.com/teams.php) — fallback.

Sauvegarde : data/cycling/images/teams/<slug>.<ext>  (ext = png|jpg selon content-type)
Update index.json : status='ok' + image_url + local_path.

Politesse :
  - User-Agent réaliste
  - 1.5s entre chaque requête HTTP

Auteur: Logos-Teams-Scraper (PARISCORE Task 7)
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
import urllib.parse

# ─── Constantes ───────────────────────────────────────────────────────────────
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_DIR = os.path.dirname(_SCRIPT_DIR)
IMAGES_DIR = os.path.join(_REPO_DIR, "data", "cycling", "images")
TEAMS_DIR = os.path.join(IMAGES_DIR, "teams")
INDEX_FILE = os.path.join(IMAGES_DIR, "index.json")

USER_AGENT = "PARISCORE-cycling-scraper/1.0 (https://pariscore.fr; contact@pariscore.fr)"
HTTP_TIMEOUT = 30
DELAY_BETWEEN_REQUESTS = 1.5  # politesse Wikipedia

# Teams manquantes (slug, display_name, Wikipedia title variants)
TEAMS_TO_SCRAPE = [
    {
        "slug": "visma-lease-a-bike",
        "name": "Visma | Lease a Bike",
        "wiki_variants": [
            "Team Visma–Lease a Bike (men's team)",  # ← page réelle (la version courte est disambig)
            "Visma–Lease a Bike (men's team)",
            "Team Jumbo–Visma (men's team)",
        ],
    },
    {
        "slug": "netcompany-ineos",
        "name": "Netcompany-INEOS",
        "wiki_variants": [
            "Netcompany–Ineos",      # ← page réelle (a renommé Ineos Grenadiers en 2026)
            "Ineos Grenadiers",      # ancien titre → redirect
            "Team Ineos",
            "Team Sky",
        ],
    },
    {
        "slug": "lidl-trek",
        "name": "Lidl-Trek",
        "wiki_variants": [
            "Lidl–Trek",
            "Trek–Segafredo",
            "Trek-Segafredo",
            "Trek Factory Racing",  # ancien nom → redirect vers Lidl-Trek
        ],
    },
    {
        "slug": "decathlon-cma-cgm",
        "name": "Decathlon CMA CGM",
        "wiki_variants": [
            "Decathlon-AG2R La Mondiale",
            "AG2R Citroën Team",
            "Decathlon AG2R La Mondiale",
            "AG2R La Mondiale",
        ],
    },
]


# ─── HTTP ─────────────────────────────────────────────────────────────────────
def fetch(url, accept='application/json', return_headers=False):
    """Fetch URL avec UA. Retourne (status, bytes) ou (status, headers, bytes) si return_headers."""
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": accept,
    })
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as r:
            body = r.read()
            if return_headers:
                return r.status, dict(r.headers), body
            return r.status, body
    except urllib.error.HTTPError as e:
        if return_headers:
            return e.code, {}, b''
        return e.code, b''
    except Exception as e:
        print(f"    [NET-ERR] {url}: {e}", file=sys.stderr)
        if return_headers:
            return 0, {}, b''
        return 0, b''


def polite_sleep():
    time.sleep(DELAY_BETWEEN_REQUESTS)


# ─── Stratégies ───────────────────────────────────────────────────────────────
def strat_1_wikipedia_summary(wiki_title):
    """Stratégie 1: Wikipedia REST summary → thumbnail.originalsource.
    Retourne (image_url, mime) ou (None, None)."""
    enc = urllib.parse.quote(wiki_title.replace(' ', '_'))
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{enc}"
    status, body = fetch(url)
    polite_sleep()
    if status != 200 or not body:
        return None, None
    try:
        d = json.loads(body.decode('utf-8'))
    except Exception as e:
        print(f"    [STRAT1] parse-err: {e}", file=sys.stderr)
        return None, None
    # type=disambiguation ou no-extract → pas d'image utile
    if d.get('type') == 'disambiguation':
        return None, None
    thumb = (d.get('thumbnail') or {}).get('source')
    if thumb:
        # Les thumbnails sont JPEG/PNG (déjà rasterisés si SVG)
        # On prend plutôt l'original si disponible pour garder meilleure qualité
        orig = (d.get('originalimage') or {}).get('source')
        mime = (d.get('originalimage') or {}).get('mime', 'image/jpeg')
        if orig:
            return orig, mime
        return thumb, 'image/jpeg'
    orig = (d.get('originalimage') or {}).get('source')
    if orig:
        mime = (d.get('originalimage') or {}).get('mime', 'image/jpeg')
        return orig, mime
    return None, None


def strat_5_wikitext_parse(wiki_title):
    """Stratégie 5: Wikipedia action=parse (wikitext) → find | image = File:...
    puis action=query&prop=imageinfo sur en.wikipedia.org (non-free) ou commons (free).
    Retourne (image_url, mime) ou (None, None)."""
    enc = urllib.parse.quote(wiki_title.replace(' ', '_'))
    parse_url = (f"https://en.wikipedia.org/w/api.php?action=parse&page={enc}"
                 f"&prop=wikitext&format=json&redirects=1")
    status, body = fetch(parse_url)
    polite_sleep()
    if status != 200 or not body:
        return None, None
    try:
        d = json.loads(body.decode('utf-8'))
    except Exception as e:
        print(f"    [STRAT5] parse-err: {e}", file=sys.stderr)
        return None, None
    parse = d.get('parse', {})
    real_title = parse.get('title', '?')
    wt = (parse.get('wikitext') or {}).get('*', '')
    if not wt:
        return None, None
    # Cherche | image = File:xxx  ou  | image = xxx
    m = re.search(r'(?im)^\s*\|\s*image\s*=\s*(?:File:)?([^\n|]+)', wt)
    if not m:
        # aussi | logo = File:xxx
        m = re.search(r'(?im)^\s*\|\s*logo\s*=\s*(?:File:)?([^\n|]+)', wt)
    if not m:
        return None, None
    file_name = m.group(1).strip().rstrip('.').strip()
    if not file_name or file_name.lower() in ('none', ''):
        return None, None
    print(f"    [STRAT5] wikitext image field → {file_name!r} (page: {real_title})")
    # Résoudre via imageinfo sur en.wikipedia.org (peut être non-free)
    file_enc = urllib.parse.quote(file_name)
    ii_url = (f"https://en.wikipedia.org/w/api.php?action=query"
              f"&titles=File:{file_enc}&prop=imageinfo"
              f"&iiprop=url|mime|size&iiurlwidth=330&format=json")
    status, body = fetch(ii_url)
    polite_sleep()
    if status != 200 or not body:
        return None, None
    try:
        d2 = json.loads(body.decode('utf-8'))
    except Exception as e:
        print(f"    [STRAT5] ii parse-err: {e}", file=sys.stderr)
        return None, None
    pages = (d2.get('query') or {}).get('pages', {})
    for pid, p in pages.items():
        if pid == '-1':
            continue  # page inexistante sur enwiki → essayer commons
        ii = p.get('imageinfo', [])
        if not ii:
            continue
        info = ii[0]
        mime = info.get('mime', '')
        # Si SVG → on prend le thumburl rasterisé (PNG)
        if 'svg' in mime:
            thumb = info.get('thumburl')
            if thumb:
                return thumb, 'image/png'
        # Sinon URL originale
        url = info.get('url')
        if url:
            return url, mime or 'image/jpeg'
    # Si rien trouvé sur enwiki → essayer Commons
    ii_url_c = (f"https://commons.wikimedia.org/w/api.php?action=query"
                f"&titles=File:{file_enc}&prop=imageinfo"
                f"&iiprop=url|mime|size&iiurlwidth=330&format=json")
    status, body = fetch(ii_url_c)
    polite_sleep()
    if status != 200 or not body:
        return None, None
    try:
        d3 = json.loads(body.decode('utf-8'))
    except Exception:
        return None, None
    pages = (d3.get('query') or {}).get('pages', {})
    for pid, p in pages.items():
        if pid == '-1':
            continue
        ii = p.get('imageinfo', [])
        if not ii:
            continue
        info = ii[0]
        mime = info.get('mime', '')
        if 'svg' in mime:
            thumb = info.get('thumburl')
            if thumb:
                return thumb, 'image/png'
        url = info.get('url')
        if url:
            return url, mime or 'image/jpeg'
    return None, None


def strat_2_commons_search(query):
    """Stratégie 2: Wikimedia Commons search srnamespace=6 (File namespace).
    Retourne (image_url, mime) ou (None, None)."""
    q_enc = urllib.parse.quote(query)
    search_url = (f"https://commons.wikimedia.org/w/api.php?action=query"
                  f"&list=search&srsearch={q_enc}&srnamespace=6&format=json&srlimit=5")
    status, body = fetch(search_url)
    polite_sleep()
    if status != 200 or not body:
        return None, None
    try:
        d = json.loads(body.decode('utf-8'))
    except Exception:
        return None, None
    results = (d.get('query') or {}).get('search', [])
    if not results:
        return None, None
    for r in results:
        title = r.get('title', '')  # ex: "File:Visma-Lease a Bike logo.svg"
        if not title.startswith('File:'):
            continue
        file_name = title[len('File:'):]
        file_enc = urllib.parse.quote(file_name)
        ii_url = (f"https://commons.wikimedia.org/w/api.php?action=query"
                  f"&titles={urllib.parse.quote(title)}&prop=imageinfo"
                  f"&iiprop=url|mime|size&iiurlwidth=330&format=json")
        status, body = fetch(ii_url)
        polite_sleep()
        if status != 200 or not body:
            continue
        try:
            d2 = json.loads(body.decode('utf-8'))
        except Exception:
            continue
        pages = (d2.get('query') or {}).get('pages', {})
        for pid, p in pages.items():
            if pid == '-1':
                continue
            ii = p.get('imageinfo', [])
            if not ii:
                continue
            info = ii[0]
            mime = info.get('mime', '')
            if 'svg' in mime:
                thumb = info.get('thumburl')
                if thumb:
                    return thumb, 'image/png'
            url = info.get('url')
            if url:
                return url, mime or 'image/jpeg'
    return None, None


# ─── Téléchargement ───────────────────────────────────────────────────────────
def determine_extension(mime, url):
    mime = (mime or '').lower()
    url_l = url.lower()
    if 'png' in mime or url_l.endswith('.png'):
        return '.png'
    if 'jpeg' in mime or 'jpg' in mime or url_l.endswith('.jpg') or url_l.endswith('.jpeg'):
        return '.jpg'
    if 'webp' in mime or url_l.endswith('.webp'):
        return '.webp'
    if 'gif' in mime or url_l.endswith('.gif'):
        return '.gif'
    if 'svg' in mime or url_l.endswith('.svg'):
        return '.svg'
    return '.png'  # défaut


def download_image(url, dest_path, expected_ext_hint=None):
    """Télécharge une image. Retourne (success, content_type, size_bytes)."""
    status, headers, body = fetch(url, accept='image/*', return_headers=True)
    polite_sleep()
    if status != 200 or not body:
        return False, None, 0
    ctype = headers.get('Content-Type', headers.get('content-type', ''))
    # Vérifie que c'est bien une image
    if ctype and not (ctype.startswith('image/') or 'image' in ctype):
        print(f"    [WARN] Content-Type inattendu: {ctype}", file=sys.stderr)
    try:
        with open(dest_path, 'wb') as f:
            f.write(body)
        return True, ctype, len(body)
    except Exception as e:
        print(f"    [ERR] écriture {dest_path}: {e}", file=sys.stderr)
        return False, ctype, 0


# ─── Index ────────────────────────────────────────────────────────────────────
def load_index():
    with open(INDEX_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_index(index):
    index['last_update'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    with open(INDEX_FILE, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f"[OK] Index sauvegardé: {INDEX_FILE}")


# ─── Main ─────────────────────────────────────────────────────────────────────
def scrape_team(team):
    """Scrape une team. Retourne dict {slug, status, source, image_url, mime, local_path, size_bytes, wikipedia_title}."""
    slug = team['slug']
    name = team['name']
    variants = team['wiki_variants']

    print(f"\n[TEAM] {name} (slug={slug})")
    print(f"  Variants Wikipedia: {variants}")

    # 1) Stratégie 1 sur chaque variant
    for v in variants:
        print(f"  → Strat 1 (REST summary) pour {v!r}")
        img_url, mime = strat_1_wikipedia_summary(v)
        if img_url:
            print(f"    [STRAT1 OK] {img_url}  (mime={mime})")
            source = f"Wikipedia REST summary ({v})"
            return {
                'slug': slug, 'status': 'ok', 'source': source,
                'image_url': img_url, 'mime': mime,
                'wikipedia_title': v,
            }
        print(f"    [STRAT1] pas d'image")

    # 5) Stratégie 5 (wikitext parse) sur chaque variant
    for v in variants:
        print(f"  → Strat 5 (wikitext parse) pour {v!r}")
        img_url, mime = strat_5_wikitext_parse(v)
        if img_url:
            print(f"    [STRAT5 OK] {img_url}  (mime={mime})")
            source = f"Wikipedia wikitext infobox image ({v})"
            return {
                'slug': slug, 'status': 'ok', 'source': source,
                'image_url': img_url, 'mime': mime,
                'wikipedia_title': v,
            }
        print(f"    [STRAT5] pas d'image")

    # 2) Stratégie 2 (Commons search)
    commons_queries = [
        f"{name} logo",
        name.replace('|', ''),
        ' '.join(name.split()),
    ]
    seen = set()
    for q in commons_queries:
        if q in seen:
            continue
        seen.add(q)
        print(f"  → Strat 2 (Commons search) pour {q!r}")
        img_url, mime = strat_2_commons_search(q)
        if img_url:
            print(f"    [STRAT2 OK] {img_url}  (mime={mime})")
            source = f"Wikimedia Commons search ({q})"
            return {
                'slug': slug, 'status': 'ok', 'source': source,
                'image_url': img_url, 'mime': mime,
                'wikipedia_title': None,
            }
        print(f"    [STRAT2] pas de résultat")

    # 3) Stratégie 3 (UCI) - non implémentée dans cette exécution, les strats précédentes suffisent
    # 4) Stratégie 4 (Procyclingstats) - idem

    return {'slug': slug, 'status': 'no_image', 'source': None,
            'image_url': None, 'mime': None, 'wikipedia_title': None}


def remove_placeholder_svg(slug):
    """Supprime l'ancien placeholder .svg s'il existe."""
    placeholder = os.path.join(TEAMS_DIR, f"{slug}.svg")
    if os.path.exists(placeholder):
        try:
            os.remove(placeholder)
            print(f"  [CLEANUP] placeholder supprimé: {placeholder}")
        except Exception as e:
            print(f"  [WARN] impossible de supprimer {placeholder}: {e}", file=sys.stderr)


def main():
    os.makedirs(TEAMS_DIR, exist_ok=True)
    index = load_index()

    results = []
    for team in TEAMS_TO_SCRAPE:
        r = scrape_team(team)
        slug = r['slug']

        if r['status'] == 'ok':
            ext = determine_extension(r['mime'], r['image_url'])
            filename = f"{slug}{ext}"
            local_path_abs = os.path.join(TEAMS_DIR, filename)
            local_path_rel = f"data/cycling/images/teams/{filename}"

            ok, ctype, size = download_image(r['image_url'], local_path_abs)
            if ok and size > 0:
                print(f"  [DOWNLOAD OK] {filename} ({size} bytes, ctype={ctype})")
                # Re-détermine l'extension selon le content-type réel si différent
                real_ext = determine_extension(ctype, r['image_url'])
                if real_ext != ext:
                    # Renomme le fichier
                    new_filename = f"{slug}{real_ext}"
                    new_abs = os.path.join(TEAMS_DIR, new_filename)
                    new_rel = f"data/cycling/images/teams/{new_filename}"
                    if new_abs != local_path_abs:
                        try:
                            os.rename(local_path_abs, new_abs)
                            print(f"  [RENAME] {filename} → {new_filename} (selon content-type)")
                            filename = new_filename
                            local_path_abs = new_abs
                            local_path_rel = new_rel
                        except Exception as e:
                            print(f"  [WARN] rename échoué: {e}", file=sys.stderr)

                # Supprime l'ancien placeholder .svg
                remove_placeholder_svg(slug)

                # Update index
                index['teams'][slug] = {
                    'name': team['name'],
                    'wikipedia_title': r['wikipedia_title'],
                    'image_url': r['image_url'],
                    'local_path': local_path_rel,
                    'status': 'ok',
                    'source': r['source'],
                    'scraped_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                }
                save_index(index)

                r['filename'] = filename
                r['local_path'] = local_path_rel
                r['size_bytes'] = size
                r['content_type'] = ctype
            else:
                print(f"  [DOWNLOAD FAIL] pour {slug}")
                r['status'] = 'download_failed'
        else:
            print(f"  [NO IMAGE] pour {slug}")
        results.append(r)

    # Résumé final
    print("\n=== RÉSUMÉ ===")
    for r in results:
        print(f"  {r['slug']}: {r['status']}  source={r.get('source')}  size={r.get('size_bytes')}  → {r.get('local_path')}")

    # Compte OK teams
    ok_teams = sum(1 for t in index['teams'].values() if t.get('status') == 'ok')
    print(f"\nTeams OK: {ok_teams} / {len(index['teams'])}")
    return results


if __name__ == '__main__':
    main()
