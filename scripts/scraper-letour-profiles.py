#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scraper-letour-profiles.py
--------------------------
Scrape les images de profil d'étape (parcours 3D) du Tour de France 2026
depuis letour.fr, et les sauvegarde localement avec un index JSON.

Source primaire : https://www.letour.fr/fr/etape-<N>
Fallback        : https://www.letour.fr/en/stage-<N>
Fallback final  : https://www.cyclingstage.com/tour-de-france-2026-route/stage-<N>-tdf-2026/
Dernier recours : placeholder SVG local.

Le profil officiel est une image JPEG hébergée sur img.aso.fr
(animateur ASO du Tour). L'URL est dans la balise :

    <div id="profil" class="sporting__content__item profil ...">
        <img class="sporting__content__img lazyItem js-lazy"
             data-src="https://img.aso.fr/core_app/img-cycling-tdf-jpg/.../..."
             alt="" />
    </div>

Usage:
    python3 scraper-letour-profiles.py
    python3 scraper-letour-profiles.py --stage 1
    python3 scraper-letour-profiles.py --stage 1-5
    python3 scraper-letour-profiles.py --lang fr
    python3 scraper-letour-profiles.py --force      # re-download même si existe

Auteur: Agent 8-letour-profile (PARISCORE)
Licence: usage interne PARISCORE — les images restent la propriété d'ASO.
"""

import argparse
import json
import os
import re
import sys
import time
import hashlib
from datetime import datetime, timezone
import urllib.request
import urllib.error

# ─── Constantes ───────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(SCRIPT_DIR)
PROFILES_DIR = os.path.join(REPO_DIR, "data", "cycling", "images", "profiles")
INDEX_FILE = os.path.join(PROFILES_DIR, "index.json")

LETOUR_FR_URL = "https://www.letour.fr/fr/etape-{n}"
LETOUR_EN_URL = "https://www.letour.fr/en/stage-{n}"
CYCLINGSTAGE_URL = "https://www.cyclingstage.com/tour-de-france-2026-route/stage-{n}-tdf-2026/"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
HTML_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.letour.fr/fr",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
}
IMG_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "cross-site",
}

HTTP_TIMEOUT = 30
DELAY_BETWEEN_STAGES = 1.5  # politesse
MIN_VALID_IMAGE_SIZE = 5 * 1024  # 5 KB — sous cette taille, c'est suspect

# 21 étapes du TdF 2026
TDF_2026_STAGES = list(range(1, 22))

# ─── Helpers HTTP ─────────────────────────────────────────────────────────────

def fetch_url(url, headers=None, timeout=HTTP_TIMEOUT):
    """Fetch une URL avec headers navigateur. Retourne (status, bytes, content_type)."""
    h = headers or HTML_HEADERS
    req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            # Handle gzip/deflate if present (urllib does NOT auto-decompress)
            encoding = resp.headers.get("Content-Encoding", "").lower()
            if encoding == "gzip":
                import gzip
                data = gzip.decompress(data)
            elif encoding == "deflate":
                import zlib
                try:
                    data = zlib.decompress(data)
                except zlib.error:
                    data = zlib.decompress(data, -zlib.MAX_WBITS)
            return resp.status, data, resp.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return e.code, b"", e.headers.get("Content-Type", "") if hasattr(e, "headers") else ""
    except Exception as e:
        return -1, str(e).encode("utf-8", "replace"), ""


def fetch_html(url):
    """Fetch HTML page. Retourne le texte ou None."""
    status, data, _ = fetch_url(url, HTML_HEADERS)
    if status == 200 and data:
        try:
            return data.decode("utf-8", errors="replace")
        except Exception:
            return data.decode("latin-1", errors="replace")
    return None


# ─── Parsing du profil d'étape ────────────────────────────────────────────────

# Regex : capture le contenu du div#profil, puis la première data-src non-default
_PROFIL_DIV_RE = re.compile(
    r'<div[^>]*id="profil"[^>]*>(.*?)</div>',
    re.IGNORECASE | re.DOTALL,
)
# data-src peut contenir une URL seule ou url|url@2x
_DATASRC_RE = re.compile(
    r'data-src="([^"]+)"',
    re.IGNORECASE,
)
# Placeholders à ignorer
_PLACEHOLDER_PATTERNS = (
    "/img/stage/default-",
    "data:image/",
)


def extract_profile_url(html):
    """
    Extrait l'URL de l'image profil depuis le HTML d'une page étape.
    Retourne l'URL absolue (https://...) ou None si non trouvée.
    """
    if not html:
        return None

    m = _PROFIL_DIV_RE.search(html)
    if not m:
        # Fallback : chercher un img dont la classe contient 'profil' ou un
        # data-src dont l'URL contient 'profil' / 'profils' / 'tdf26-profils'
        for dm in _DATASRC_RE.finditer(html):
            raw = dm.group(1).split("|")[0].strip()
            if raw.startswith("http") and "profil" in raw.lower():
                return raw
        return None

    profil_block = m.group(1)
    for dm in _DATASRC_RE.finditer(profil_block):
        # L'attribut peut contenir url|url@2x — on prend la première
        raw = dm.group(1).split("|")[0].strip()
        if not raw:
            continue
        if any(p in raw for p in _PLACEHOLDER_PATTERNS):
            continue
        # URL absolue → OK
        if raw.startswith("http://") or raw.startswith("https://"):
            return raw
        # URL relative → préfixer le domaine
        if raw.startswith("/"):
            return "https://www.letour.fr" + raw
    return None


def extract_cyclingstage_profile_url(html, stage_n):
    """
    Fallback cyclingstage.com : cherche un <img> dont l'attribut contient
    'profile' ou 'stage-<N>'. Retourne l'URL absolue ou None.
    """
    if not html:
        return None
    # Cherche tous les <img ... src="..." ...> avec extension image
    pattern = re.compile(
        r'<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp|gif))"[^>]*>',
        re.IGNORECASE,
    )
    candidates = []
    for m in pattern.finditer(html):
        url = m.group(1)
        # Évite logos / icônes / placeholder
        low = url.lower()
        if any(s in low for s in ("logo", "icon", "avatar", "sprite", "banner", "flag")):
            continue
        if "profile" in low or f"stage-{stage_n}" in low or "parcours" in low:
            candidates.append(url)
    if candidates:
        return candidates[0]
    # Sinon, prend la plus grande image du contenu
    return None


# ─── Placeholder SVG (dernier recours) ────────────────────────────────────────

def make_placeholder_svg(stage_n, info=""):
    """Génère un SVG placeholder simple pour une étape sans profil récupérable."""
    info = info or f"Tour de France 2026 — Étape {stage_n}"
    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 576" width="960" height="576">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff7d6"/>
      <stop offset="100%" stop-color="#cfe8ff"/>
    </linearGradient>
  </defs>
  <rect width="960" height="576" fill="url(#bg)"/>
  <polyline points="20,500 140,470 260,420 380,360 500,280 620,330 740,200 860,150 940,180"
            fill="none" stroke="#ff8c00" stroke-width="4" stroke-linejoin="round"/>
  <polyline points="20,500 140,470 260,420 380,360 500,280 620,330 740,200 860,150 940,180 940,576 20,576"
            fill="#ffd24d" fill-opacity="0.55"/>
  <text x="480" y="60" text-anchor="middle"
        font-family="sans-serif" font-size="32" font-weight="bold" fill="#0b3d6b">
    Étape {stage_n} — Profil non disponible
  </text>
  <text x="480" y="95" text-anchor="middle"
        font-family="sans-serif" font-size="18" fill="#0b3d6b" opacity="0.7">
    {info}
  </text>
  <text x="480" y="540" text-anchor="middle"
        font-family="sans-serif" font-size="14" fill="#0b3d6b" opacity="0.5">
    Placeholder PARISCORE — Source: letour.fr (image non récupérable)
  </text>
</svg>"""
    return svg.encode("utf-8")


# ─── Téléchargement d'image ───────────────────────────────────────────────────

def download_image(url, dest_path, referer=None):
    """
    Télécharge une image. Retourne (status, size_bytes, content_type) ou
    (status, 0, "") si échec.
    """
    headers = dict(IMG_HEADERS)
    if referer:
        headers["Referer"] = referer
    status, data, ctype = fetch_url(url, headers)
    if status == 200 and data and len(data) >= MIN_VALID_IMAGE_SIZE:
        with open(dest_path, "wb") as f:
            f.write(data)
        return status, len(data), ctype
    return status, 0, ctype


# ─── Index JSON ───────────────────────────────────────────────────────────────

def load_index():
    if os.path.exists(INDEX_FILE):
        try:
            with open(INDEX_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "source": "letour.fr",
        "last_update": None,
        "stages": {},
    }


def save_index(index):
    index["last_update"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    os.makedirs(os.path.dirname(INDEX_FILE), exist_ok=True)
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)


# ─── Scraping d'une étape ─────────────────────────────────────────────────────

def scrape_stage(stage_n, lang="fr", force=False):
    """
    Scrape le profil d'une étape. Retourne un dict avec les métadonnées.
    """
    index = load_index()
    key = str(stage_n)
    existing = index["stages"].get(key, {})

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    result = {
        "stage": stage_n,
        "image_url": None,
        "local_path": None,
        "source_url": None,
        "scraped_at": now,
        "status": "error",
        "error": None,
        "bytes": 0,
        "source_used": None,
    }

    # Skip si déjà fait et pas --force
    if not force and existing.get("status") == "ok":
        local_path = existing.get("local_path")
        full_path = os.path.join(REPO_DIR, local_path) if local_path else None
        if full_path and os.path.exists(full_path) and os.path.getsize(full_path) >= MIN_VALID_IMAGE_SIZE:
            result.update(existing)
            result["scraped_at"] = now
            result["status"] = "ok"
            result["cached"] = True
            return result

    # ── Tentative 1 : letour.fr FR ────────────────────────────────────────────
    source_url_fr = LETOUR_FR_URL.format(n=stage_n)
    html_fr = fetch_html(source_url_fr)
    if html_fr:
        img_url = extract_profile_url(html_fr)
        if img_url and "default-profil" not in img_url:
            # Télécharge
            ext = ".jpg"  # les profils aso.fr sont des JPEG
            if ".png" in img_url.lower():
                ext = ".png"
            elif ".webp" in img_url.lower():
                ext = ".webp"
            dest = os.path.join(PROFILES_DIR, f"stage-{stage_n}{ext}")
            os.makedirs(PROFILES_DIR, exist_ok=True)
            status, size, ctype = download_image(img_url, dest, referer=source_url_fr)
            if status == 200 and size >= MIN_VALID_IMAGE_SIZE:
                # Détermine l'extension finale d'après le contenu réel
                real_ext = detect_ext_from_bytes(dest) or ext
                if real_ext != ext:
                    new_dest = os.path.join(PROFILES_DIR, f"stage-{stage_n}{real_ext}")
                    os.rename(dest, new_dest)
                    dest = new_dest
                    ext = real_ext
                result.update({
                    "image_url": img_url,
                    "local_path": os.path.relpath(dest, REPO_DIR),
                    "source_url": source_url_fr,
                    "status": "ok",
                    "bytes": size,
                    "source_used": "letour.fr/fr",
                })
                print(f"  [OK] stage {stage_n:>2} via letour.fr/fr — {size} bytes ({ext})")
                return finalize(result)

    # ── Tentative 2 : letour.fr EN ────────────────────────────────────────────
    source_url_en = LETOUR_EN_URL.format(n=stage_n)
    html_en = fetch_html(source_url_en)
    if html_en:
        img_url = extract_profile_url(html_en)
        if img_url and "default-profil" not in img_url:
            ext = ".jpg"
            if ".png" in img_url.lower():
                ext = ".png"
            elif ".webp" in img_url.lower():
                ext = ".webp"
            dest = os.path.join(PROFILES_DIR, f"stage-{stage_n}{ext}")
            os.makedirs(PROFILES_DIR, exist_ok=True)
            status, size, ctype = download_image(img_url, dest, referer=source_url_en)
            if status == 200 and size >= MIN_VALID_IMAGE_SIZE:
                real_ext = detect_ext_from_bytes(dest) or ext
                if real_ext != ext:
                    new_dest = os.path.join(PROFILES_DIR, f"stage-{stage_n}{real_ext}")
                    os.rename(dest, new_dest)
                    dest = new_dest
                    ext = real_ext
                result.update({
                    "image_url": img_url,
                    "local_path": os.path.relpath(dest, REPO_DIR),
                    "source_url": source_url_en,
                    "status": "ok",
                    "bytes": size,
                    "source_used": "letour.fr/en",
                })
                print(f"  [OK] stage {stage_n:>2} via letour.fr/en — {size} bytes ({ext})")
                return finalize(result)

    # ── Tentative 3 : cyclingstage.com ────────────────────────────────────────
    cs_url = CYCLINGSTAGE_URL.format(n=stage_n)
    cs_html = fetch_html(cs_url)
    if cs_html:
        cs_img = extract_cyclingstage_profile_url(cs_html, stage_n)
        if cs_img:
            if not (cs_img.startswith("http://") or cs_img.startswith("https://")):
                if cs_img.startswith("/"):
                    cs_img = "https://www.cyclingstage.com" + cs_img
                else:
                    cs_img = "https://www.cyclingstage.com/" + cs_img
            ext = ".jpg"
            if ".png" in cs_img.lower():
                ext = ".png"
            elif ".webp" in cs_img.lower():
                ext = ".webp"
            dest = os.path.join(PROFILES_DIR, f"stage-{stage_n}{ext}")
            os.makedirs(PROFILES_DIR, exist_ok=True)
            status, size, ctype = download_image(cs_img, dest, referer=cs_url)
            if status == 200 and size >= MIN_VALID_IMAGE_SIZE:
                real_ext = detect_ext_from_bytes(dest) or ext
                if real_ext != ext:
                    new_dest = os.path.join(PROFILES_DIR, f"stage-{stage_n}{real_ext}")
                    os.rename(dest, new_dest)
                    dest = new_dest
                    ext = real_ext
                result.update({
                    "image_url": cs_img,
                    "local_path": os.path.relpath(dest, REPO_DIR),
                    "source_url": cs_url,
                    "status": "ok",
                    "bytes": size,
                    "source_used": "cyclingstage.com",
                })
                print(f"  [OK] stage {stage_n:>2} via cyclingstage.com — {size} bytes ({ext})")
                return finalize(result)

    # ── Dernier recours : placeholder SVG ─────────────────────────────────────
    dest = os.path.join(PROFILES_DIR, f"stage-{stage_n}.svg")
    os.makedirs(PROFILES_DIR, exist_ok=True)
    svg_bytes = make_placeholder_svg(stage_n)
    with open(dest, "wb") as f:
        f.write(svg_bytes)
    result.update({
        "image_url": None,
        "local_path": os.path.relpath(dest, REPO_DIR),
        "source_url": source_url_fr,
        "status": "placeholder",
        "bytes": len(svg_bytes),
        "source_used": "placeholder",
        "error": "Aucune source n'a donné d'image valide (letour.fr FR/EN + cyclingstage.com)",
    })
    print(f"  [PLACEHOLDER] stage {stage_n:>2} — SVG généré localement")
    return finalize(result)


def detect_ext_from_bytes(path):
    """Détecte l'extension réelle d'après les magic bytes."""
    try:
        with open(path, "rb") as f:
            head = f.read(16)
        if head.startswith(b"\xff\xd8\xff"):
            return ".jpg"
        if head.startswith(b"\x89PNG\r\n\x1a\n"):
            return ".png"
        if head.startswith(b"GIF87a") or head.startswith(b"GIF89a"):
            return ".gif"
        if head.startswith(b"RIFF") and b"WEBP" in head:
            return ".webp"
        if b"<svg" in head.lower() or head.startswith(b"<?xml"):
            return ".svg"
    except Exception:
        return None
    return None


def finalize(result):
    """Sauvegarde dans l'index et retourne le résultat."""
    index = load_index()
    key = str(result["stage"])
    index["stages"][key] = {
        "image_url": result["image_url"],
        "local_path": result["local_path"],
        "source_url": result["source_url"],
        "scraped_at": result["scraped_at"],
        "status": result["status"],
        "bytes": result["bytes"],
        "source_used": result["source_used"],
        "error": result.get("error"),
    }
    save_index(index)
    return result


# ─── CLI ──────────────────────────────────────────────────────────────────────

def parse_stages_arg(s):
    """Parse '1', '1-5', 'all', ou '1,3,5'."""
    if s.lower() == "all":
        return TDF_2026_STAGES
    if "-" in s and "," not in s:
        a, b = s.split("-", 1)
        return list(range(int(a), int(b) + 1))
    if "," in s:
        return [int(x) for x in s.split(",") if x.strip()]
    return [int(s)]


def main():
    ap = argparse.ArgumentParser(description="Scraper profils d'étape TdF 2026 — letour.fr")
    ap.add_argument("--stage", default="all", help="Numéro d'étape (1-21), range (1-5), ou 'all' (defaut: all)")
    ap.add_argument("--lang", default="fr", choices=["fr", "en"], help="Langue preferée")
    ap.add_argument("--force", action="store_true", help="Re-télécharger même si déjà en cache")
    ap.add_argument("--delay", type=float, default=DELAY_BETWEEN_STAGES,
                    help=f"Délai entre étapes en secondes (defaut: {DELAY_BETWEEN_STAGES})")
    args = ap.parse_args()

    stages = parse_stages_arg(args.stage)
    print(f"[scraper-letour-profiles] {len(stages)} étape(s) à scraper : {stages}")
    print(f"[scraper-letour-profiles] Output dir : {PROFILES_DIR}")
    print(f"[scraper-letour-profiles] Index file  : {INDEX_FILE}")
    print()

    os.makedirs(PROFILES_DIR, exist_ok=True)

    results = []
    for i, n in enumerate(stages):
        print(f"[stage {n:>2}/{max(stages)}] ", end="")
        r = scrape_stage(n, lang=args.lang, force=args.force)
        results.append(r)
        # Délai de politesse sauf après le dernier
        if i < len(stages) - 1:
            time.sleep(args.delay)

    # ── Récapitulatif ─────────────────────────────────────────────────────────
    print()
    print("=" * 72)
    print("RÉCAPITULATIF")
    print("=" * 72)
    ok = sum(1 for r in results if r["status"] == "ok")
    placeholder = sum(1 for r in results if r["status"] == "placeholder")
    error = sum(1 for r in results if r["status"] == "error")
    total_bytes = sum(r.get("bytes", 0) for r in results if r["status"] == "ok")
    print(f"  OK          : {ok}/{len(results)}")
    print(f"  Placeholder : {placeholder}/{len(results)}")
    print(f"  Erreurs     : {error}/{len(results)}")
    print(f"  Volume      : {total_bytes:,} bytes ({total_bytes/1024:.1f} KB)")

    # Par source
    sources = {}
    for r in results:
        s = r.get("source_used") or "?"
        sources[s] = sources.get(s, 0) + 1
    print("  Par source  : " + ", ".join(f"{k}={v}" for k, v in sorted(sources.items())))

    # Vérification finale
    print()
    print("VÉRIFICATION FICHIERS LOCAUX :")
    for n in stages:
        candidates = sorted(
            os.path.join(PROFILES_DIR, f)
            for f in os.listdir(PROFILES_DIR)
            if f.startswith(f"stage-{n}.") and not f.endswith(".json")
        )
        if not candidates:
            print(f"  stage {n:>2} : MANQUANT")
            continue
        path = candidates[0]
        size = os.path.getsize(path)
        flag = "OK" if size >= MIN_VALID_IMAGE_SIZE else "TROP PETIT"
        print(f"  stage {n:>2} : {os.path.basename(path):<20} {size:>8} bytes  [{flag}]")

    return 0 if (ok + placeholder) == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
