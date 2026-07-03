#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scraper-cyclingstage-favourites.py
----------------------------------
Scrape les descriptions et favoris des étapes du Tour de France 2026
depuis cyclingstage.com, et les sauvegarde dans un fichier JSON
consommé par le backend pariscore (cyclingService.js).

Usage:
    python3 scraper-cyclingstage-favourites.py --stage 1
    python3 scraper-cyclingstage-favourites.py --stage all
    python3 scraper-cyclingstage-favourites.py --current     # étape du jour (selon date)
    python3 scraper-cyclingstage-favourites.py --next        # prochaine étape

Source: https://www.cyclingstage.com/tour-de-france-2026-favourites/stage-N-contenders-tdf-2026/
Auteur: Équipe QA PARISCORE
Licence: usage interne PARISCORE — ne pas redistribuer le contenu scrapingé.
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
import urllib.request
import urllib.error

# ─── Constantes ───────────────────────────────────────────────────────────────
BASE_URL = "https://www.cyclingstage.com/tour-de-france-2026-favourites/stage-{n}-contenders-tdf-2026/"
# Chemin relatif au script : <repo>/data/cycling/stage-favourites.json
# Utilise os.path.dirname(__file__) pour fonctionner sur n'importe quel environnement
import os as _os
_SCRIPT_DIR = _os.path.dirname(_os.path.abspath(__file__))
_REPO_DIR = _os.path.dirname(_SCRIPT_DIR)
OUTPUT_FILE = _os.path.join(_REPO_DIR, "data", "cycling", "stage-favourites.json")
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
HTTP_TIMEOUT = 30
DELAY_BETWEEN_REQUESTS = 1.5  # secondes — politesse

# Calendrier TdF 2026 (dates de chaque étape)
TDF_2026_STAGES = {
    1:  "2026-07-04",
    2:  "2026-07-05",
    3:  "2026-07-06",
    4:  "2026-07-07",
    5:  "2026-07-08",
    6:  "2026-07-09",
    7:  "2026-07-10",
    8:  "2026-07-11",
    9:  "2026-07-12",
    10: "2026-07-14",   # 13 = repos
    11: "2026-07-15",
    12: "2026-07-16",
    13: "2026-07-17",
    14: "2026-07-18",
    15: "2026-07-19",
    16: "2026-07-21",   # 20 = repos
    17: "2026-07-22",
    18: "2026-07-23",
    19: "2026-07-24",
    20: "2026-07-25",
    21: "2026-07-26",
}

# ─── Helpers HTTP ─────────────────────────────────────────────────────────────

def fetch_url(url):
    """Fetch une URL avec User-Agent réaliste. Retourne le HTML ou None si erreur."""
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
    })
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            if resp.status != 200:
                return None
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None  # étape pas encore publiée
        print(f"[WARN] HTTP {e.code} sur {url}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"[WARN] Erreur fetch {url}: {e}", file=sys.stderr)
        return None


# ─── Parsing HTML ────────────────────────────────────────────────────────────

class TextExtractor(HTMLParser):
    """Extracteur de texte simple qui préserve les <br> comme newlines."""
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = False
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "nav", "header", "footer"):
            self.skip = True
        if tag == "br":
            self.parts.append("\n")
        if tag in ("p", "h1", "h2", "h3", "h4", "li", "div"):
            self.parts.append("\n")
    def handle_endtag(self, tag):
        if tag in ("script", "style", "nav", "header", "footer"):
            self.skip = False
        if tag in ("p", "h1", "h2", "h3", "h4", "li", "div"):
            self.parts.append("\n")
    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)
    def get_text(self):
        text = "".join(self.parts)
        # Normalise les entités courantes
        text = text.replace("&amp;", "&").replace("&nbsp;", " ") \
                    .replace("&quot;", '"').replace("&#39;", "'") \
                    .replace("&rsquo;", "'").replace("&lsquo;", "'") \
                    .replace("&ldquo;", '"').replace("&rdquo;", '"')
        # Normalise whitespace
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n[ \t]+", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()


def clean_html_text(html_fragment):
    """Nettoie un fragment HTML en texte plain."""
    parser = TextExtractor()
    try:
        parser.feed(html_fragment)
    except Exception:
        pass
    return parser.get_text()


def extract_stage_data(html, stage_n):
    """Extrait les données structurées d'une page cyclingstage.com étape."""
    data = {
        "stage": stage_n,
        "url": BASE_URL.format(n=stage_n),
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "title": None,
        "description": None,
        "favourites_raw": None,
        "favourites": [],  # [{tier: '***', team: 'UAE Emirates', riders: ['Pogacar']}]
        "weather_forecast": None,
        "publication_info": None,
        "status": "ok",
        "error": None,
    }

    # 1. Titre (h1 qui contient "Favourites stage N")
    m = re.search(
        r'<h1[^>]*>(Tour de France 2026 Favourites stage \d+:.*?)</h1>',
        html, re.DOTALL
    )
    if m:
        data["title"] = clean_html_text(m.group(1)).strip()

    # 2. Section entre le h1 et le premier h2 "Favourites"
    # La description est dans les <p> entre le titre et "Favourites ..."
    m = re.search(
        r'<h1[^>]*>Tour de France 2026 Favourites.*?</h1>(.*?)(?=<h2[^>]*>Favourites)',
        html, re.DOTALL
    )
    if m:
        article_html = m.group(1)
        paras = re.findall(r'<p[^>]*>(.*?)</p>', article_html, re.DOTALL)
        description_parts = []
        publication_info = None
        weather = None
        for p in paras:
            text = clean_html_text(p).strip()
            if not text:
                continue
            # Skip les "Slideshow" et captions
            if text.startswith("(Slideshow"):
                continue
            # Detect publication info
            if re.match(r'^First published on', text, re.IGNORECASE):
                publication_info = text
                continue
            # Detect weather forecast section
            if text.lower().startswith("weather forecast"):
                weather = text
                continue
            # Skip les "Another interesting read" et pub
            if "Another interesting read" in text or "prize pool" in text.lower():
                continue
            # Skip les credits photo au début
            if text.startswith("fotobureau") or text.startswith("Cor Vos"):
                # Garde le texte après le credit
                text = re.sub(r'^(fotobureau\s+Cor Vos|Cor Vos|Photo:.*?)(?=[A-Z])', '', text).strip()
                if text:
                    description_parts.append(text)
            else:
                description_parts.append(text)

        if description_parts:
            data["description"] = "\n\n".join(description_parts)
        if publication_info:
            data["publication_info"] = publication_info
        if weather:
            data["weather_forecast"] = weather

    # 3. Section Favourites (h2 "Favourites ..." + le <p> qui suit)
    m = re.search(
        r'<h2[^>]*>Favourites\s+\d+(?:st|nd|rd|th)\s+stage.*?</h2>\s*<p>(.*?)</p>',
        html, re.DOTALL | re.IGNORECASE
    )
    if m:
        fav_html = m.group(1)
        # Remplace <br> par newlines pour séparer les tiers
        fav_html_normalized = re.sub(r'<br\s*/?>', '\n', fav_html)
        fav_text = clean_html_text(fav_html_normalized).strip()
        data["favourites_raw"] = fav_text

        # Parse les tiers: lignes qui commencent par *** / ** / *
        # Format typique:
        #   "*** Team A (Rider1), Team B (Rider2, Rider3)\n** Team C (Rider4)"
        # On split sur les virgules SEULEMENT si elles sont en dehors des parenthèses
        favourites = []
        for line in fav_text.split("\n"):
            line = line.strip()
            if not line:
                continue
            tier_match = re.match(r'^(\*{1,3})\s+(.+)$', line)
            if not tier_match:
                continue
            tier = tier_match.group(1)
            content = tier_match.group(2).strip()

            # Split intelligent sur les virgules hors parenthèses
            entries = []
            current = ""
            depth = 0
            for char in content:
                if char == "(":
                    depth += 1
                    current += char
                elif char == ")":
                    depth -= 1
                    current += char
                elif char == "," and depth == 0:
                    if current.strip():
                        entries.append(current.strip())
                    current = ""
                else:
                    current += char
            if current.strip():
                entries.append(current.strip())

            for entry in entries:
                entry = entry.strip().rstrip(",").strip()
                if not entry:
                    continue
                team_match = re.match(r'^(.+?)\s*\(([^)]+)\)\s*$', entry)
                if team_match:
                    # Format: "Team Name (Rider1, Rider2)"
                    team = team_match.group(1).strip()
                    riders = [r.strip() for r in team_match.group(2).split(",") if r.strip()]
                else:
                    # Format: "Rider Name" (pas d'équipe précisée — ex: stage 2)
                    # On considère que c'est un rider solo, team = null
                    team = None
                    riders = [entry]
                favourites.append({
                    "tier": tier,
                    "team": team,
                    "riders": riders,
                })
        data["favourites"] = favourites

    # Si pas de titre ni de favoris, la page est probablement vide / pas encore publiée
    if not data["title"] and not data["favourites"]:
        data["status"] = "empty"
        data["error"] = "Page exists but no title/favourites found — possibly not yet published"

    return data


# ─── Main ────────────────────────────────────────────────────────────────────

def determine_current_stage():
    """Détermine le numéro de l'étape du jour (ou None si pas d'étape aujourd'hui)."""
    today = datetime.now(timezone(timedelta(hours=2))).strftime("%Y-%m-%d")  # Europe/Paris
    for n, date in TDF_2026_STAGES.items():
        if date == today:
            return n
    return None


def determine_next_stage():
    """Détermine le numéro de la prochaine étape (à partir d'aujourd'hui)."""
    today = datetime.now(timezone(timedelta(hours=2))).strftime("%Y-%m-%d")
    for n in sorted(TDF_2026_STAGES.keys()):
        if TDF_2026_STAGES[n] >= today:
            return n
    return None


def load_existing_data():
    """Charge les données existantes (ou retourne un dict vide)."""
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Erreur lecture {OUTPUT_FILE}: {e}", file=sys.stderr)
    return {
        "race": "Tour de France 2026",
        "source": "cyclingstage.com",
        "last_update": None,
        "stages": {}
    }


def save_data(data):
    """Sauvegarde les données en JSON."""
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    data["last_update"] = datetime.now(timezone.utc).isoformat()
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[OK] Données sauvegardées dans {OUTPUT_FILE}")


def scrape_stage(stage_n, force=False):
    """Scrape une étape spécifique. Retourne les données ou None."""
    existing = load_existing_data()
    if not force and str(stage_n) in existing["stages"]:
        existing_data = existing["stages"][str(stage_n)]
        # Re-scrape si plus vieux que 6h
        scraped_at = existing_data.get("scraped_at", "")
        if scraped_at:
            try:
                scraped_time = datetime.fromisoformat(scraped_at)
                age_hours = (datetime.now(timezone.utc) - scraped_time).total_seconds() / 3600
                if age_hours < 6:
                    print(f"[SKIP] Stage {stage_n} déjà scrapé il y a {age_hours:.1f}h (< 6h)")
                    return existing_data
            except Exception:
                pass

    url = BASE_URL.format(n=stage_n)
    print(f"[SCRAPING] Stage {stage_n}: {url}")
    html = fetch_url(url)
    if not html:
        print(f"[FAIL] Stage {stage_n}: page introuvable ou erreur fetch")
        return None

    stage_data = extract_stage_data(html, stage_n)
    if stage_data["status"] == "empty":
        print(f"[EMPTY] Stage {stage_n}: page sans contenu — probablement pas encore publiée")
        return stage_data

    print(f"[OK] Stage {stage_n}: {len(stage_data.get('description', ''))} chars description, "
          f"{len(stage_data.get('favourites', []))} favoris")
    return stage_data


def main():
    parser = argparse.ArgumentParser(description="Scraper cyclingstage.com TdF 2026")
    parser.add_argument("--stage", type=int, help="Numéro d'étape à scraper (1-21)")
    parser.add_argument("--all", action="store_true", help="Scrape toutes les 21 étapes")
    parser.add_argument("--current", action="store_true", help="Scrape l'étape du jour")
    parser.add_argument("--next", action="store_true", help="Scrape la prochaine étape")
    parser.add_argument("--force", action="store_true", help="Force re-scrape même si < 6h")
    args = parser.parse_args()

    if not any([args.stage, args.all, args.current, args.next]):
        # Default: --next
        args.next = True

    existing = load_existing_data()

    stages_to_scrape = []
    if args.all:
        stages_to_scrape = list(range(1, 22))
    elif args.stage:
        stages_to_scrape = [args.stage]
    elif args.current:
        n = determine_current_stage()
        if n is None:
            print("[INFO] Pas d'étape aujourd'hui (jour de repos ou hors TdF)")
            # Scrap next à la place
            n = determine_next_stage()
            if n:
                print(f"[INFO] Scraping prochaine étape: {n}")
                stages_to_scrape = [n]
        else:
            stages_to_scrape = [n]
    elif args.next:
        n = determine_next_stage()
        if n is None:
            print("[INFO] TdF 2026 terminé")
            return
        stages_to_scrape = [n]

    print(f"[INFO] Étapes à scraper: {stages_to_scrape}")
    print(f"[INFO] Date du jour (Europe/Paris): {datetime.now(timezone(timedelta(hours=2))).strftime('%Y-%m-%d %H:%M')}")

    for i, n in enumerate(stages_to_scrape):
        stage_data = scrape_stage(n, force=args.force)
        if stage_data:
            existing["stages"][str(n)] = stage_data
            existing["last_update"] = datetime.now(timezone.utc).isoformat()
            save_data(existing)
        if i < len(stages_to_scrape) - 1:
            time.sleep(DELAY_BETWEEN_REQUESTS)

    # Résumé final
    print("\n=== RÉSUMÉ ===")
    print(f"Total étapes en base: {len(existing['stages'])}")
    for n_str in sorted(existing["stages"].keys(), key=int):
        s = existing["stages"][n_str]
        status_icon = "✓" if s.get("status") == "ok" else "✗"
        title = (s.get("title") or "—")[:80]
        print(f"  Stage {n_str:>2}: {status_icon} {title}")


if __name__ == "__main__":
    main()
