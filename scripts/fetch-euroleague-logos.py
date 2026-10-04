# -*- coding: utf-8 -*-
"""
fetch-euroleague-logos.py — Logos des clubs EuroLeague + EuroCup (Lot 1, todo.md).

Pour chaque club (code = celui renvoyé par /api/v1/euroleague/matches) :
  1. recherche de la page Wikipedia du club (API action=query&generator=search)
  2. récupération du thumbnail 300px (prop=pageimages)
  3. téléchargement dans public/images/basketball/euroleague/<CODE>.<ext>
  4. validation magic bytes (PNG/JPEG/WebP/SVG/GIF) — sinon le club est sauté
     (le composant garde son fallback initiales)
  5. écriture de data/euroleague_logos.json (mapping + provenance + licence)

Usage :
    python scripts/fetch-euroleague-logos.py            # fetch complet
    python scripts/fetch-euroleague-logos.py --dry-run  # API seulement, 0 download

Idempotent : relançable, écrase les fichiers existants.
Respectueux : 0.4 s entre chaque requête, User-Agent identifié (exigence Wikimedia).
"""

import argparse
import json
import re
import struct
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

# Console Windows (cp1252) : forcer l'UTF-8 pour les noms à accents.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "images" / "basketball" / "euroleague"
OUT_JSON = ROOT / "data" / "euroleague_logos.json"

WIKI_API = "https://{lang}.wikipedia.org/w/api.php"
HEADERS = {
    "User-Agent": "PariScoreLogoFetch/1.0 (contact: david@pariscore.fr) python-urllib",
    "Accept": "*/*",
}
DELAY_S = 0.4
THUMB_SIZE = 300

# (code, nom du feed, [(langue, titre exact d'article Wikipedia), ...])
# Codes = codes réels servis par le bridge euroleague_api (vérifiés prod 2026-10-01).
# Titres EXACTS (pas de recherche) : la recherche renvoie souvent des articles
# éloignés (joueurs, arènes) dont la photo n'est PAS le logo du club.
TEAMS = [
    # ── EuroLeague (20) ──
    ("ASV", "LDLC ASVEL VILLEURBANNE", [("fr", "LDLC ASVEL"), ("en", "LDLC ASVEL")]),
    ("BAR", "FC BARCELONA", [("en", "FC Barcelona Bàsquet"), ("ca", "FC Barcelona Bàsquet")]),
    ("BAS", "KOSNER BASKONIA VITORIA-GASTEIZ", [("en", "Saski Baskonia"), ("es", "Saski Baskonia")]),
    ("DUB", "DUBAI BASKETBALL", [("en", "Dubai Basketball"), ("fr", "Dubaï Basketball")]),
    ("HTA", "HAPOEL IBI TEL AVIV", [("en", "Hapoel Tel Aviv B.C."), ("en", "Hapoel IBI Tel Aviv")]),
    ("IST", "ANADOLU EFES ISTANBUL", [("en", "Anadolu Efes S.K."), ("tr", "Anadolu Efes SK")]),
    ("MAD", "REAL MADRID", [("en", "Real Madrid Baloncesto"), ("es", "Sección de baloncesto del Real Madrid")]),
    ("MCO", "AS MONACO", [("en", "AS Monaco Basket"), ("fr", "AS Monaco Basket-ball")]),
    ("MIL", "EA7 EMPORIO ARMANI MILAN", [("en", "Olimpia Milano"), ("it", "Olimpia Milano")]),
    ("MUN", "FC BAYERN MUNICH", [("en", "FC Bayern Munich (basketball)"), ("de", "FC Bayern München (Basketball)")]),
    ("OLY", "OLYMPIACOS PIRAEUS", [("en", "Olympiacos B.C.")]),
    ("PAM", "VALENCIA BASKET", [("en", "Valencia Basket"), ("es", "Valencia Basket")]),
    ("PAN", "PANATHINAIKOS AKTOR ATHENS", [("en", "Panathinaikos B.C.")]),
    ("PAR", "PARTIZAN MOZZART BET BELGRADE", [("en", "KK Partizan"), ("sr", "КК Партизан")]),
    ("PRS", "PARIS BASKETBALL", [("en", "Paris Basketball"), ("fr", "Paris Basketball")]),
    ("RED", "CRVENA ZVEZDA MERIDIANBET BELGRADE", [("en", "KK Crvena zvezda"), ("sr", "КК Црвена звезда")]),
    ("TEL", "MACCABI RAPYD TEL AVIV", [("en", "Maccabi Tel Aviv B.C."), ("en", "Maccabi Tel Aviv Basketball Club")]),
    ("ULK", "FENERBAHCE BEKO ISTANBUL", [("en", "Fenerbahçe Basketball"), ("tr", "Fenerbahçe Erkek Basketbol Takımı")]),
    ("VIR", "VIRTUS BOLOGNA", [("en", "Virtus Bologna"), ("it", "Virtus Segafredo Bologna")]),
    ("ZAL", "ZALGIRIS KAUNAS", [("en", "BC Žalgiris"), ("lt", "BC Žalgiris")]),
    # ── EuroCup (20) ──
    ("ARI", "ARIS THESSALONIKI BETSSON", [("en", "Aris B.C."), ("en", "Aris Thessaloniki B.C.")]),
    ("BAH", "BAHCESEHIR COLLEGE ISTANBUL", [("en", "Bahçeşehir Koleji S.K."), ("tr", "Bahçeşehir Koleji SK")]),
    ("BES", "BESIKTAS GAIN ISTANBUL", [("en", "Beşiktaş J.K. (men's basketball)"), ("en", "Beşiktaş men's basketball")]),
    ("BOU", "COSEA JL BOURG-EN-BRESSE", [("en", "JL Bourg Basket"), ("fr", "JL Bourg Basket")]),
    ("BUD", "BUDUCNOST VOLI PODGORICA", [("en", "KK Budućnost"), ("sr", "КК Будућност")]),
    ("CLU", "U-BT CLUJ-NAPOCA", [("en", "U-BT Cluj-Napoca"), ("ro", "U-BT Cluj-Napoca")]),
    ("HAM", "VEOLIA TOWERS HAMBURG", [("en", "Hamburg Towers"), ("de", "Hamburg Towers")]),
    ("JER", "HAPOEL MIDTOWN JERUSALEM", [("en", "Hapoel Jerusalem B.C."), ("en", "Hapoel Migdal Jerusalem")]),
    ("KLA", "NEPTUNAS KLAIPEDA", [("en", "BC Neptūnas"), ("en", "BC Neptunas")]),
    ("LJU", "CEDEVITA OLIMPIJA LJUBLJANA", [("en", "KK Cedevita Olimpija"), ("sl", "KK Cedevita Olimpija")]),
    ("LKB", "LIETKABELIS PANEVEZYS", [("en", "BC Lietkabelis"), ("lt", "BC Lietkabelis")]),
    ("LLI", "LONDON LIONS", [("en", "London Lions (basketball)"), ("en", "London Lions")]),
    ("MAN", "BAXI MANRESA", [("en", "Bàsquet Manresa"), ("es", "Bàsquet Manresa")]),
    ("NIN", "NINERS CHEMNITZ", [("de", "Niners Chemnitz"), ("en", "Niners Chemnitz")]),
    ("NIO", "PANIONIOS COSMORAMA TRAVEL ATHENS", [("en", "Panionios B.C."), ("en", "Panionios BC")]),
    ("TRN", "DOLOMITI ENERGIA TRENTO", [("en", "Dolomiti Energia Trentino"), ("it", "Aquila Basket Trento")]),
    ("TTK", "TURK TELEKOM ANKARA", [("en", "Türk Telekom B.K."), ("tr", "Türk Telekom BK")]),
    ("ULM", "RATIOPHARM ULM", [("en", "Ratiopharm Ulm"), ("de", "Ratiopharm ulm")]),
    ("VNC", "UMANA REYER VENICE", [("en", "Reyer Venezia Mestre"), ("it", "Reyer Venezia Mestre")]),
    ("WRO", "SLASK WROCLAW", [("en", "Śląsk Wrocław basketball"), ("pl", "Śląsk Wrocław (koszykówka)")]),
    # ── Clubs EuroCup visibles en oct. 2026 — codes réels = home/away.code du
    # bridge (vérifiés le 2026-10-05 contre /api/v1/euroleague/matches?season=2026,
    # liste « 2026-27 EuroCup Basketball » sur Wikipédia pour les identités) ──
    ("BLK", "BALKAN BOTEVGRAD", [("en", "BC Balkan Botevgrad"), ("bg", "Балкан (Ботевград)")]),
    ("TRT", "BAGLIETTO DERTHONA TORTONA", [("en", "Derthona Basket"), ("it", "Derthona Basket")]),
    ("LEM", "LE MANS SARTHE BASKET", [("fr", "Le Mans Sarthe Basket"), ("en", "MSB")]),
    ("BGS", "RECOLETAS SALUD SAN PABLO BURGOS", [("en", "CB San Pablo Burgos"), ("es", "Club Baloncesto San Pablo Burgos")]),
    ("BCR", "ROMA BASKETBALL", [("en", "BC Roma"), ("it", "BC Roma")]),
    ("MRO", "MAXIMA ROMA", [("en", "Maxima Roma"), ("it", "Maxima Roma")]),
    ("NAP", "NAPOLI BASKETBALL", [("en", "GeVi Napoli"), ("en", "Napoli Basket (2016)")]),
    ("PAO", "PAOK THESSALONIKI", [("en", "PAOK BC"), ("el", "Π.Α.Ο.Κ.")]),
    ("BUR", "TOFAS BURSA", [("en", "Tofaş S.K."), ("tr", "Tofaş SK")]),
    ("BOS", "BOSNA BH TELECOM SARAJEVO", [("en", "KK Bosna"), ("bs", "KK Bosna")]),
    ("RTK", "ROSTOCK SEAWOLVES", [("de", "Rostock Seawolves"), ("en", "Rostock Seawolves")]),
    ("RIG", "RIGA ZELLI", [("en", "Rīgas Zeļļi"), ("en", "Riga Zelli")]),
    ("SIA", "SIAULIAI BASKETBALL", [("en", "BC Šiauliai"), ("lt", "BC Šiauliai")]),
    ("FRA", "SKYLINERS FRANKFURT", [("en", "Skyliners Frankfurt"), ("de", "Frankfurt Skyliners")]),
    ("TNF", "LA LAGUNA TENERIFE", [("en", "Iberostar Tenerife"), ("es", "CB Canarias")]),
]


def http_get(url: str, timeout: int = 20) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def wiki_page_thumbnail(lang: str, title: str) -> tuple[str | None, str | None, bool]:
    """Image d'infobox du club via l'API REST summary (redirects suivis).

    Retourne (thumb_url, titre_page, manquant). Pourquoi REST et pas
    action=query&prop=pageimages : pageimages omet thumbnail sur une partie des
    articles de clubs (constaté 2026-10-01 sur Olympiacos B.C., Real Madrid
    Baloncesto…), alors que /page/summary/ les renvoie systématiquement.
    """
    rest_url = (
        f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/"
        + urllib.parse.quote(title.replace(" ", "_"), safe="")
    )
    try:
        raw = http_get(rest_url)
        data = json.loads(raw.decode("utf-8"))
        if data.get("type") in ("standard", "disambiguation", "no-extract"):
            thumb = (data.get("thumbnail") or {}).get("source") or None
            original = (data.get("originalimage") or {}).get("source") or None
            # Préférer l'original si c'est déjà un logo (PNG/SVG) : meilleure qualité.
            orig_path = (original or "").lower().split("?")[0]
            if original and not orig_path.endswith((".jpg", ".jpeg")):
                return original, data.get("title") or title, False
            if thumb:
                return thumb, data.get("title") or title, False
            # Niveau 2 : article SANS pageimage mais infobox avec File: logo
            # (constaté sur Aris B.C.) → lister les fichiers de l'article.
            logo_url = article_logo_file(lang, title)
            if logo_url:
                return logo_url, data.get("title") or title, False
    except Exception:
        pass
    # Repli : ancienne API avec suffixe « (basketball) » (couvre les homonymies).
    params = {
        "action": "query",
        "format": "json",
        "titles": f"{title} (basketball)",
        "redirects": "1",
        "prop": "pageimages",
        "piprop": "thumbnail|name",
        "pithumbsize": str(THUMB_SIZE),
    }
    url = WIKI_API.format(lang=lang) + "?" + urllib.parse.urlencode(params)
    raw = http_get(url)
    data = json.loads(raw.decode("utf-8"))
    pages = (data.get("query") or {}).get("pages") or {}
    for _pid, page in pages.items():
        if page.get("missing") is not None:
            return None, None, True
        thumb = (page.get("thumbnail") or {}).get("source")
        return thumb, page.get("title"), False
    return None, None, True


def article_logo_file(lang: str, title: str) -> str | None:
    """Fichier « logo » listé dans l'article (prop=images) → URL 300px.

    Couvre les articles dont l'infobox porte un File: sans pageimage.
    Filtre par nom : logo/crest/herb/badge/emblème (anti photos de joueurs).
    """
    import re
    params = {
        "action": "query",
        "format": "json",
        "titles": title,
        "redirects": "1",
        "prop": "images",
        "imlimit": "60",
    }
    url = WIKI_API.format(lang=lang) + "?" + urllib.parse.urlencode(params)
    raw = http_get(url)
    data = json.loads(raw.decode("utf-8"))
    pages = (data.get("query") or {}).get("pages") or {}
    files: list[str] = []
    for _pid, page in pages.items():
        for img in page.get("images") or []:
            files.append(img.get("title", ""))  # ex. "File:Aris BC logo.png"
    pattern = re.compile(r"logo|crest|herb|badge|embl", re.IGNORECASE)
    candidates = [f for f in files if pattern.search(f) and not re.search(r"\.svg\.png$", f, re.IGNORECASE)]
    if not candidates:
        return None
    # URL directe via imageinfo sur le wiki LOCAL du fichier (les crests de clubs
    # sont souvent « équitable use » → hébergés en local, PAS sur Commons).
    name = candidates[0].removeprefix("File:")
    info_params = {
        "action": "query",
        "format": "json",
        "titles": f"File:{name}",
        "prop": "imageinfo",
        "iiprop": "url",
        "iiurlwidth": str(THUMB_SIZE),
    }
    info_url = WIKI_API.format(lang=lang) + "?" + urllib.parse.urlencode(info_params)
    info_raw = http_get(info_url)
    info_data = json.loads(info_raw.decode("utf-8"))
    for page in (info_data.get("query") or {}).get("pages", {}).values():
        infos = page.get("imageinfo") or []
        if infos:
            return infos[0].get("thumburl") or infos[0].get("url")
    return None


def resolve_team_logo(candidates: list[tuple[str, str]]) -> tuple[str | None, str | None]:
    """Essaie chaque (langue, titre exact) et garde le MEILLEUR thumb.

    Préférence : un format « logo » (PNG/SVG/GIF) plutôt qu'une photo (JPG) —
    les crests sont vectoriels ou PNG transparent, les photos de joueurs
    sont presque toujours du JPG. Le 1er thumb trouvé reste le repli.
    """
    first_any: tuple[str | None, str | None] = (None, None)
    for lang, title in candidates:
        try:
            thumb, page_title, missing = wiki_page_thumbnail(lang, title)
        except Exception:
            time.sleep(DELAY_S)
            continue
        if missing:
            time.sleep(DELAY_S)
            continue
        if thumb:
            if not first_any[0]:
                first_any = (thumb, page_title)
            path = thumb.lower().split("?")[0]
            if not path.endswith((".jpg", ".jpeg")):
                return thumb, page_title
        time.sleep(DELAY_S)
    return first_any


MAGIC = {
    b"\x89PNG": "png",
    b"\xff\xd8\xff": "jpg",
    b"GIF8": "gif",
    b"RIFF": None,  # traité à part (WebP)
    b"<?xml": "svg",
    b"<svg": "svg",
}


def sniff_ext(data: bytes, url: str) -> str | None:
    """Extension déduite des magic bytes (source de vérité) sinon de l'URL."""
    for magic, ext in MAGIC.items():
        if ext is None:
            continue
        if data.startswith(magic):
            return ext
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    lower = url.lower().split("?")[0]
    for ext in (".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"):
        if lower.endswith(ext):
            return {"jpeg": "jpg"}.get(ext[1:], ext[1:])
    return None


def png_size(data: bytes) -> tuple[int, int] | None:
    """(largeur, hauteur) d'un PNG, ou None si ce n'est pas un PNG valide."""
    if data[:8] != b"\x89PNG\r\n\x1a\n" or len(data) < 24:
        return None
    w, h = struct.unpack(">II", data[16:24])
    return w, h


# Largeurs de thumb réellement acceptées par Wikimedia (HTTP 400 « Use thumbnail
# sizes listed on… » sinon) — constat 2026-10-05 : 250/330/500 OK, 300/640 refusés.
THUMB_WIDTHS = (330, 500, 250)


def bigger_thumbs(url: str) -> list[str]:
    """Thumb réduit (ex. 20px, constaté sur San Pablo Burgos.svg) : l'URL thumb
    porte sa largeur (…/thumb/e/ee/Nom.svg/20px-Nom.svg.png) — on propose des
    largeurs autorisées pour éviter un logo illisible en 22px à l'écran."""
    m = re.search(r"/(\d+)px-", url)
    if not m or int(m.group(1)) >= THUMB_SIZE:
        return []
    return [url[: m.start()] + f"/{w}px-" + url[m.end() :] for w in THUMB_WIDTHS]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="API seulement, aucun téléchargement")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)

    teams: dict[str, dict] = {}
    skipped: list[str] = []

    for i, (code, feed_name, wiki_candidates) in enumerate(TEAMS, 1):
        prefix = f"[{i:02d}/{len(TEAMS)}] {code}"
        try:
            thumb_url, title = resolve_team_logo(wiki_candidates)
        except Exception as exc:
            print(f"{prefix} ERREUR recherche: {exc}")
            skipped.append(code)
            time.sleep(DELAY_S)
            continue

        if not thumb_url:
            print(f"{prefix} ABSENT — aucun article/image pour {wiki_candidates}")
            skipped.append(code)
            time.sleep(DELAY_S)
            continue

        if args.dry_run:
            print(f"{prefix} OK (dry) {title} → {thumb_url[:90]}")
            time.sleep(DELAY_S)
            continue

        try:
            data = http_get(thumb_url)
        except Exception as exc:
            print(f"{prefix} ERREUR download: {exc}")
            skipped.append(code)
            time.sleep(DELAY_S)
            continue

        ext = sniff_ext(data, thumb_url)
        # Rendu trop petit (thumb 20px) : retenter en 300px avant le rejet.
        if ext == "png":
            dim = png_size(data)
            if dim and min(dim) < 100:
                for big_url in bigger_thumbs(thumb_url):
                    try:
                        big = http_get(big_url)
                    except Exception:
                        continue
                    big_dim = png_size(big) if sniff_ext(big, big_url) == "png" else None
                    if big_dim and min(big_dim) >= 100:
                        data, thumb_url = big, big_url
                        ext = "png"
                        break
        if not ext or len(data) < 800:
            print(f"{prefix} REJET (format/size: {len(data)}B, ext={ext})")
            skipped.append(code)
            time.sleep(DELAY_S)
            continue

        file_name = f"{code}.{ext}"
        (OUT_DIR / file_name).write_bytes(data)
        teams[code] = {
            "file": f"images/basketball/euroleague/{file_name}",
            "name": feed_name,
            "wiki_title": title,
            "url_directe": thumb_url,
            "poids_ko": round(len(data) / 1024, 1),
            "http_verifie": "ok",
        }
        print(f"{prefix} OK {file_name} ({len(data) // 1024} Ko) ← {title}")
        time.sleep(DELAY_S)

    payload = {
        "version": 1,
        "updatedAt": time.strftime("%Y-%m-%d"),
        "source": "API Wikipedia (prop=pageimages, thumbnail 300px) — logos officiels des clubs",
        "note_licence": (
            "Logos de clubs (marques déposées) référencés via Wikipédia : usage illustratif "
            "référentiel (scores/résultats). À faire valider juridiquement pour tout autre usage."
        ),
        "skipped": skipped,
        "teams": teams,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n→ {OUT_JSON.name} : {len(teams)} logos, {len(skipped)} sans image {skipped or ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
