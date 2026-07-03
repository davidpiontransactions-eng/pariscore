#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scraper-cycling-photos.py
-------------------------
Scrape les photos des coureurs et les logos des équipes depuis Wikipedia.
Stocke les images localement dans data/cycling/images/{riders,teams}/<slug>.{jpg,png}

Utilise l'API REST de Wikipedia (gratuit, pas de clé API, fiable) :
  - Page summary: https://en.wikipedia.org/api/rest_v1/page/summary/<title>
  - Renvoie thumbnail.originalsource → URL de l'image

Usage:
    python3 scraper-cycling-photos.py                # scrape tous les riders + teams connus
    python3 scraper-cycling-photos.py --riders "Tadej Pogacar,Jonas Vingegaard"
    python3 scraper-cycling-photos.py --teams "UAE Emirates,Visma | Lease a Bike"
    python3 scraper-cycling-photos.py --from-favourites   # lit stage-favourites.json et scrape les riders/teams présents

Auteur: Équipe QA PARISCORE
"""

import argparse
import json
import os
import re
import sys
import time
import unicodedata
import urllib.request
import urllib.error
import urllib.parse

# ─── Constantes ───────────────────────────────────────────────────────────────
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_DIR = os.path.dirname(_SCRIPT_DIR)
IMAGES_DIR = os.path.join(_REPO_DIR, "data", "cycling", "images")
RIDERS_DIR = os.path.join(IMAGES_DIR, "riders")
TEAMS_DIR = os.path.join(IMAGES_DIR, "teams")
FAVOURITES_FILE = os.path.join(_REPO_DIR, "data", "cycling", "stage-favourites.json")
PHOTOS_INDEX_FILE = os.path.join(IMAGES_DIR, "index.json")

USER_AGENT = "PARISCORE-cycling-scraper/1.0 (contact@pariscore.fr)"
HTTP_TIMEOUT = 20
DELAY_BETWEEN_REQUESTS = 0.5  # secondes — politesse Wikipedia

# ─── Mapping riders → Wikipedia title (corrections pour les noms scrapés) ────
# cyclingstage utilise parfois des noms courts (Pogacar) ou avec/sans accents
# On mappe vers le titre Wikipedia exact
RIDER_WIKIPEDIA_MAP = {
    # Stars TdF 2026 (sans accent dans cyclingstage → avec accent Wikipedia)
    "Pogacar": "Tadej Pogacar",
    "Tadej Pogacar": "Tadej Pogačar",
    "Tadej Pogačar": "Tadej Pogačar",
    "Vingegaard": "Jonas Vingegaard",
    "Jonas Vingegaard": "Jonas Vingegaard",
    "Evenepoel": "Remco Evenepoel",
    "Remco Evenepoel": "Remco Evenepoel",
    "Van der Poel": "Mathieu van der Poel",
    "Mathieu van der Poel": "Mathieu van der Poel",
    "Carapaz": "Richard Carapaz",
    "Richard Carapaz": "Richard Carapaz",
    "Ayuso": "Juan Ayuso",
    "Juan Ayuso": "Juan Ayuso",
    "Skjelmose": "Mattias Skjelmose",
    "Mattias Skjelmose": "Mattias Skjelmose",
    "Seixas": "Paul Seixas",
    "Paul Seixas": "Paul Seixas",
    "Arensman": "Thymen Arensman",
    "Thymen Arensman": "Thymen Arensman",
    "Vauquelin": "Kévin Vauquelin",
    "Kevin Vauquelin": "Kévin Vauquelin",
    "Kévin Vauquelin": "Kévin Vauquelin",
    # Stage 2
    "Tom Pidcock": "Tom Pidcock",
    "Maxim Van Gils": "Maxim Van Gils",
    "Romain Grégoire": "Romain Grégoire",
    "Mathias Vacek": "Mathias Vacek",
    "Mads Pedersen": "Mads Pedersen (cyclist)",
    "Lenny Martinez": "Lenny Martinez",

    # ── Mock cyclingService.js — 21 riders manquants (Task 10-riders-inventory) ──
    # GC contenders
    "Primož Roglič": "Primož Roglič",
    "Primoz Roglic": "Primož Roglič",
    "Roglic": "Primož Roglič",
    "Mikel Landa": "Mikel Landa",
    "Landa": "Mikel Landa",
    "Adam Yates": "Adam Yates (cyclist)",       # disambiguation (sibling Simon)
    "Simon Yates": "Simon Yates (cyclist)",     # disambiguation (sibling Adam)
    "David Gaudu": "David Gaudu",
    "Gaudu": "David Gaudu",
    # Puncheurs / Classics
    "Wout van Aert": "Wout van Aert",
    "Alberto Bettiol": "Alberto Bettiol",
    "Bettiol": "Alberto Bettiol",
    "Matej Mohorič": "Matej Mohorič",
    "Matej Mohoric": "Matej Mohorič",
    "Mohoric": "Matej Mohorič",
    "Stefan Küng": "Stefan Küng",
    "Stefan Kung": "Stefan Küng",
    "Kung": "Stefan Küng",
    "Anthony Turgis": "Anthony Turgis",
    "Turgis": "Anthony Turgis",
    # Sprinteurs
    "Jasper Philipsen": "Jasper Philipsen",
    "Philipsen": "Jasper Philipsen",
    "Biniam Girmay": "Biniam Girmay",
    "Girmay": "Biniam Girmay",
    "Jonathan Milan": "Jonathan Milan",  # page Wikipedia existe déjà à ce titre (cycliste italien)
    "Milan": "Jonathan Milan",
    "Dylan Groenewegen": "Dylan Groenewegen",
    "Groenewegen": "Dylan Groenewegen",
    "Fabio Jakobsen": "Fabio Jakobsen",
    "Jakobsen": "Fabio Jakobsen",
    "Arnaud Démare": "Arnaud Démare",
    "Arnaud Demare": "Arnaud Démare",
    "Demare": "Arnaud Démare",
    "Sam Welsford": "Sam Welsford",
    "Welsford": "Sam Welsford",
    "Christophe Laporte": "Christophe Laporte",
    "Laporte": "Christophe Laporte",
    # Baroudeurs / équipiers
    "Alexey Lutsenko": "Alexey Lutsenko",
    "Lutsenko": "Alexey Lutsenko",
    "Ben Healy": "Ben Healy (cyclist)",         # disambiguation (rugbyman homonyme)
    "Healy": "Ben Healy (cyclist)",
    "Magnus Cort": "Magnus Cort",               # page Wikipedia : "Magnus Cort"
    "Cort": "Magnus Cort",
}

# ─── Mapping teams → Wikipedia title ──────────────────────────────────────────
TEAM_WIKIPEDIA_MAP = {
    "UAE Emirates": "UAE Team Emirates XRG",  # nom 2025-2026
    "Visma | Lease a Bike": "Team Visma–Lease a Bike",
    "Red Bull-BORA-hansgrohe": "Red Bull–Bora–Hansgrohe",
    "Netcompany-INEOS": "Ineos Grenadiers",  # ancien nom, mais page Wikipedia
    "Lidl-Trek": "Lidl–Trek",
    "Decathlon CMA CGM": "Decathlon AG2R La Mondiale",
    "Alpecin Premier Tech": "Alpecin–Deceuninck",
    "EF Education-EasyPost": "EF Education–EasyPost",
}


def slugify(name):
    """Convertit un nom en slug safe pour nom de fichier.

    Utilise NFKD pour gérer tous les accents Unicode (notamment č, š, ž, etc.
    que les regex simples ne couvrent pas)."""
    # Normalisation Unicode : décompose les accents (č → c + caron)
    # puis encode en ASCII en ignorant les caractères non-ASCII (le caron)
    name_no_accents = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
    # Minuscules + remplace espaces/| par tiret
    slug = name_no_accents.lower()
    slug = re.sub(r'[\s|/\\]+', '-', slug)
    slug = re.sub(r'[^a-z0-9-]', '', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')
    return slug


def fetch_url(url, accept='application/json'):
    """Fetch URL avec User-Agent. Retourne le contenu binaire ou None."""
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": accept,
    })
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            if resp.status != 200:
                return None
            return resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        print(f"  [WARN] HTTP {e.code} sur {url}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  [WARN] Erreur fetch {url}: {e}", file=sys.stderr)
        return None


def fetch_wikipedia_image(wikipedia_title):
    """Récupère l'URL de l'image principale d'une page Wikipedia.
    Retourne (image_url, content_type) ou (None, None) si non trouvé.
    """
    # Encode le titre pour l'URL
    encoded_title = urllib.parse.quote(wikipedia_title.replace(' ', '_'))
    api_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded_title}"
    
    raw = fetch_url(api_url, accept='application/json')
    if not raw:
        return None, None
    
    try:
        data = json.loads(raw.decode('utf-8'))
    except Exception as e:
        print(f"  [WARN] Erreur parse JSON pour {wikipedia_title}: {e}", file=sys.stderr)
        return None, None
    
    # Cherche thumbnail.originalsource (image principale)
    thumbnail = data.get('thumbnail')
    if thumbnail and thumbnail.get('source'):
        return thumbnail['source'], 'image/jpeg'
    
    # Sinon cherche originalimage
    original = data.get('originalimage')
    if original and original.get('source'):
        return original['source'], original.get('mime', 'image/jpeg')
    
    return None, None


def download_image(url, dest_path):
    """Télécharge une image et la sauvegarde localement."""
    raw = fetch_url(url, accept='image/*')
    if not raw:
        return False
    
    try:
        with open(dest_path, 'wb') as f:
            f.write(raw)
        return True
    except Exception as e:
        print(f"  [WARN] Erreur écriture {dest_path}: {e}", file=sys.stderr)
        return False


def determine_extension(content_type, url):
    """Détermine l'extension de fichier à partir du content-type ou de l'URL."""
    if 'png' in content_type or url.lower().endswith('.png'):
        return '.png'
    if 'webp' in content_type or url.lower().endswith('.webp'):
        return '.webp'
    if 'gif' in content_type or url.lower().endswith('.gif'):
        return '.gif'
    return '.jpg'  # défaut


def scrape_rider(rider_name, index):
    """Scrape la photo d'un rider. Met à jour l'index. Retourne le slug ou None."""
    slug = slugify(rider_name)
    
    # Cherche le titre Wikipedia
    wiki_title = RIDER_WIKIPEDIA_MAP.get(rider_name, rider_name)
    
    print(f"  [RIDER] {rider_name} → Wikipedia: {wiki_title}")
    
    image_url, content_type = fetch_wikipedia_image(wiki_title)
    if not image_url:
        # Essaie avec "(cyclist)" suffix
        if '(cyclist)' not in wiki_title and '(' not in wiki_title:
            alt_title = f"{wiki_title} (cyclist)"
            print(f"    Retry avec: {alt_title}")
            image_url, content_type = fetch_wikipedia_image(alt_title)
    
    if not image_url:
        print(f"    [FAIL] Pas d'image trouvée pour {rider_name}")
        index['riders'][slug] = {
            'name': rider_name,
            'wikipedia_title': wiki_title,
            'image_url': None,
            'local_path': None,
            'status': 'no_image',
            'scraped_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        }
        return slug
    
    ext = determine_extension(content_type, image_url)
    filename = f"{slug}{ext}"
    local_path = os.path.join(RIDERS_DIR, filename)
    
    if download_image(image_url, local_path):
        print(f"    [OK] {filename} ({os.path.getsize(local_path)} bytes)")
        index['riders'][slug] = {
            'name': rider_name,
            'wikipedia_title': wiki_title,
            'image_url': image_url,
            'local_path': f"data/cycling/images/riders/{filename}",
            'status': 'ok',
            'scraped_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        }
        return slug
    else:
        print(f"    [FAIL] Download échoué pour {rider_name}")
        index['riders'][slug] = {
            'name': rider_name,
            'wikipedia_title': wiki_title,
            'image_url': image_url,
            'local_path': None,
            'status': 'download_failed',
            'scraped_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        }
        return slug


def scrape_team(team_name, index):
    """Scrape le logo d'une équipe. Met à jour l'index."""
    slug = slugify(team_name)
    
    wiki_title = TEAM_WIKIPEDIA_MAP.get(team_name, team_name)
    
    print(f"  [TEAM] {team_name} → Wikipedia: {wiki_title}")
    
    image_url, content_type = fetch_wikipedia_image(wiki_title)
    if not image_url:
        print(f"    [FAIL] Pas de logo trouvé pour {team_name}")
        index['teams'][slug] = {
            'name': team_name,
            'wikipedia_title': wiki_title,
            'image_url': None,
            'local_path': None,
            'status': 'no_image',
            'scraped_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        }
        return slug
    
    ext = determine_extension(content_type, image_url)
    filename = f"{slug}{ext}"
    local_path = os.path.join(TEAMS_DIR, filename)
    
    if download_image(image_url, local_path):
        print(f"    [OK] {filename} ({os.path.getsize(local_path)} bytes)")
        index['teams'][slug] = {
            'name': team_name,
            'wikipedia_title': wiki_title,
            'image_url': image_url,
            'local_path': f"data/cycling/images/teams/{filename}",
            'status': 'ok',
            'scraped_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        }
        return slug
    else:
        print(f"    [FAIL] Download échoué pour {team_name}")
        index['teams'][slug] = {
            'name': team_name,
            'wikipedia_title': wiki_title,
            'image_url': image_url,
            'local_path': None,
            'status': 'download_failed',
            'scraped_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        }
        return slug


def load_index():
    """Charge l'index existant ou crée un nouveau."""
    if os.path.exists(PHOTOS_INDEX_FILE):
        try:
            with open(PHOTOS_INDEX_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Erreur lecture index: {e}", file=sys.stderr)
    return {
        'description': 'Index des photos riders + logos teams cyclisme (source: Wikipedia)',
        'last_update': None,
        'riders': {},
        'teams': {},
    }


def save_index(index):
    """Sauvegarde l'index."""
    os.makedirs(IMAGES_DIR, exist_ok=True)
    index['last_update'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    with open(PHOTOS_INDEX_FILE, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f"[OK] Index sauvegardé: {PHOTOS_INDEX_FILE}")


def collect_from_favourites():
    """Lit stage-favourites.json et collecte tous les riders + teams uniques."""
    if not os.path.exists(FAVOURITES_FILE):
        print(f"[WARN] {FAVOURITES_FILE} introuvable", file=sys.stderr)
        return [], []
    
    with open(FAVOURITES_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    riders = []
    teams = []
    seen_riders = set()
    seen_teams = set()
    
    for stage_data in data.get('stages', {}).values():
        for fav in stage_data.get('favourites', []):
            if fav.get('team') and fav['team'] not in seen_teams:
                teams.append(fav['team'])
                seen_teams.add(fav['team'])
            for rider in fav.get('riders', []):
                # Normalise: si rider court (Pogacar), prend la version longue du map
                normalized = RIDER_WIKIPEDIA_MAP.get(rider, rider)
                if normalized not in seen_riders:
                    riders.append(normalized)
                    seen_riders.add(normalized)
    
    return riders, teams


def main():
    parser = argparse.ArgumentParser(description="Scraper photos riders + logos teams cyclisme")
    parser.add_argument('--riders', type=str, help='Liste de riders séparés par virgule')
    parser.add_argument('--teams', type=str, help='Liste de teams séparées par virgule')
    parser.add_argument('--from-favourites', action='store_true', 
                        help='Lit stage-favourites.json et scrape les riders/teams présents')
    parser.add_argument('--force', action='store_true', 
                        help='Re-scrape même si déjà présent dans l\'index')
    args = parser.parse_args()
    
    # Crée les dossiers
    os.makedirs(RIDERS_DIR, exist_ok=True)
    os.makedirs(TEAMS_DIR, exist_ok=True)
    
    index = load_index()
    
    # Détermine la liste des riders/teams à scraper
    riders_to_scrape = []
    teams_to_scrape = []
    
    if args.from_favourites:
        riders_to_scrape, teams_to_scrape = collect_from_favourites()
        print(f"[INFO] {len(riders_to_scrape)} riders + {len(teams_to_scrape)} teams à scraper depuis favourites")
    elif args.riders or args.teams:
        if args.riders:
            riders_to_scrape = [r.strip() for r in args.riders.split(',') if r.strip()]
        if args.teams:
            teams_to_scrape = [t.strip() for t in args.teams.split(',') if t.strip()]
    else:
        # Default: scrape from favourites
        riders_to_scrape, teams_to_scrape = collect_from_favourites()
        print(f"[INFO] {len(riders_to_scrape)} riders + {len(teams_to_scrape)} teams à scraper (depuis favourites)")
    
    print()
    
    # Scrape riders
    if riders_to_scrape:
        print(f"=== SCRAPING {len(riders_to_scrape)} RIDERS ===")
        for i, rider in enumerate(riders_to_scrape):
            slug = slugify(rider)
            if not args.force and slug in index['riders'] and index['riders'][slug].get('status') == 'ok':
                print(f"  [SKIP] {rider} (déjà scrapé)")
                continue
            scrape_rider(rider, index)
            save_index(index)  # Sauve après chaque rider
            if i < len(riders_to_scrape) - 1:
                time.sleep(DELAY_BETWEEN_REQUESTS)
        print()
    
    # Scrape teams
    if teams_to_scrape:
        print(f"=== SCRAPING {len(teams_to_scrape)} TEAMS ===")
        for i, team in enumerate(teams_to_scrape):
            slug = slugify(team)
            if not args.force and slug in index['teams'] and index['teams'][slug].get('status') == 'ok':
                print(f"  [SKIP] {team} (déjà scrapé)")
                continue
            scrape_team(team, index)
            save_index(index)
            if i < len(teams_to_scrape) - 1:
                time.sleep(DELAY_BETWEEN_REQUESTS)
        print()
    
    # Résumé
    print("=== RÉSUMÉ ===")
    print(f"Total riders dans l'index: {len(index['riders'])}")
    ok_riders = sum(1 for r in index['riders'].values() if r.get('status') == 'ok')
    print(f"  OK: {ok_riders} / {len(index['riders'])}")
    print(f"Total teams dans l'index: {len(index['teams'])}")
    ok_teams = sum(1 for t in index['teams'].values() if t.get('status') == 'ok')
    print(f"  OK: {ok_teams} / {len(index['teams'])}")
    print()
    print(f"Images stockées dans: {IMAGES_DIR}")
    print(f"Index: {PHOTOS_INDEX_FILE}")


if __name__ == '__main__':
    main()
