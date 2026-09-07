#!/usr/bin/env python3
"""
Scraper cuetracker.net — données snooker (matchs, joueurs, rankings).
Utilise requests + BeautifulSoup. Rate limit 2s entre requêtes.
"""

import requests
from bs4 import BeautifulSoup
import json
import os
import sys
import time
import argparse
from datetime import datetime, timezone

BASE_URL = "https://www.cuetracker.net"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
DELAY = 2  # secondes entre requêtes


def fetch_page(url, dry_run=False):
    """Récupère une page avec rate limiting."""
    if dry_run:
        print(f"  [dry-run] GET {url}")
        return None
    time.sleep(DELAY)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as e:
        print(f"  [erreur] {url}: {e}")
        return None


def scrape_player_stats(html):
    """Extrait les stats joueurs depuis la page matches-and-frames."""
    soup = BeautifulSoup(html, "html.parser")
    players = []

    # Chercher le tableau principal de statistiques
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for row in rows[1:]:  # skip header
            cells = row.find_all(["td", "th"])
            if len(cells) < 5:
                continue

            # Extraire le lien joueur si présent
            link = row.find("a")
            player_name = cells[0].get_text(strip=True) if cells[0] else ""
            if not player_name:
                continue

            # Construire un id slug
            player_id = player_name.lower().replace("'", "").replace(" ", "-")

            stats = {
                "id": player_id,
                "name": player_name,
                "nationality": "",
                "ranking": None,
                "matches_played": _int(cells[1]) if len(cells) > 1 else 0,
                "wins": _int(cells[2]) if len(cells) > 2 else 0,
                "losses": _int(cells[3]) if len(cells) > 3 else 0,
                "centuries": _int(cells[4]) if len(cells) > 4 else 0,
                "max_break": _int(cells[5]) if len(cells) > 5 else None,
                "decider_win_pct": None,
            }
            if link and link.get("href"):
                stats["_link"] = link["href"]
            players.append(stats)

    return players


def scrape_deciders(html):
    """Extrait les taux de victoire en deciders."""
    soup = BeautifulSoup(html, "html.parser")
    decider_map = {}

    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if len(cells) < 3:
                continue
            name = cells[0].get_text(strip=True)
            pct_text = cells[-1].get_text(strip=True).replace("%", "")
            try:
                decider_map[name.lower().replace("'", "").replace(" ", "-")] = float(pct_text) / 100
            except ValueError:
                continue

    return decider_map


def scrape_rankings(html, year):
    """Extrait les rankings (Elo-like) depuis la page rankings."""
    soup = BeautifulSoup(html, "html.parser")
    players = []

    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if len(cells) < 3:
                continue

            rank_text = cells[0].get_text(strip=True)
            name = cells[1].get_text(strip=True)
            if not name:
                continue

            player_id = name.lower().replace("'", "").replace(" ", "-")
            nationality = cells[2].get_text(strip=True) if len(cells) > 2 else ""

            try:
                ranking = int(rank_text)
            except ValueError:
                ranking = None

            players.append({
                "id": player_id,
                "name": name,
                "nationality": nationality,
                "ranking": ranking,
            })

    return players


def scrape_recent_matches(html):
    """Extrait les matchs récents depuis une page de résultats."""
    soup = BeautifulSoup(html, "html.parser")
    matches = []

    # Chercher les blocs de matchs (div ou table)
    match_divs = soup.find_all("div", class_=lambda c: c and "match" in c.lower()) if soup else []
    if not match_divs:
        match_divs = soup.find_all("tr", class_=lambda c: c and "match" in c.lower()) if soup else []

    for div in match_divs:
        text = div.get_text(" ", strip=True)
        # Extraction basique — s'adapter au HTML réel si nécessaire
        parts = text.split(" - ")
        if len(parts) >= 2:
            matches.append({
                "raw": text,
                "player_a": parts[0].strip()[:100],
                "player_b": parts[-1].strip()[:100],
            })

    return matches


def _int(val):
    """Parse un entier depuis un élément BS4, ou 0."""
    try:
        return int(val.get_text(strip=True).replace(",", ""))
    except (ValueError, AttributeError):
        return 0


def merge_players(base_players, ranking_players, decider_map):
    """Fusionne les données de plusieurs sources dans un dict par id."""
    merged = {}

    for p in ranking_players:
        pid = p["id"]
        merged[pid] = {
            "id": pid,
            "name": p["name"],
            "nationality": p.get("nationality", ""),
            "ranking": p.get("ranking"),
            "matches_played": 0,
            "wins": 0,
            "losses": 0,
            "centuries": 0,
            "max_break": None,
            "decider_win_pct": None,
        }

    for p in base_players:
        pid = p["id"]
        if pid in merged:
            merged[pid]["matches_played"] = p.get("matches_played", 0)
            merged[pid]["wins"] = p.get("wins", 0)
            merged[pid]["losses"] = p.get("losses", 0)
            merged[pid]["centuries"] = p.get("centuries", 0)
            merged[pid]["max_break"] = p.get("max_break")
        else:
            merged[pid] = p

    for pid, pct in decider_map.items():
        if pid in merged:
            merged[pid]["decider_win_pct"] = pct

    return list(merged.values())


def main():
    parser = argparse.ArgumentParser(description="Scraper cuetracker.net snooker data")
    parser.add_argument("--dry-run", action="store_true", help="Affiche les URLs sans scraper")
    parser.add_argument("--year", type=int, default=datetime.now().year, help="Année pour les rankings")
    args = parser.parse_args()

    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
    os.makedirs(out_dir, exist_ok=True)

    print(f"[cuetracker] Début du scrape (dry_run={args.dry_run})")

    # 1. Statistiques matchs/frames
    print("[cuetracker] Récupération des stats matchs...")
    html = fetch_page(f"{BASE_URL}/statistics/matches-and-frames", args.dry_run)
    base_players = scrape_player_stats(html) if html else []
    print(f"  → {len(base_players)} joueurs trouvés")

    # 2. Records en deciders
    print("[cuetracker] Récupération des records deciders...")
    html = fetch_page(f"{BASE_URL}/statistics/matches-and-frames/deciders/all-time", args.dry_run)
    decider_map = scrape_deciders(html) if html else {}
    print(f"  → {len(decider_map)} joueurs avec taux decider")

    # 3. Rankings
    print(f"[cuetracker] Récupération des rankings {args.year}...")
    html = fetch_page(f"{BASE_URL}/rankings/{args.year}", args.dry_run)
    ranking_players = scrape_rankings(html, args.year) if html else []
    print(f"  → {len(ranking_players)} joueurs classés")

    # Fusion
    players = merge_players(base_players, ranking_players, decider_map)

    output = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "source": "cuetracker.net",
        "season": args.year,
        "total_players": len(players),
        "players": players,
        "matches": [],  # Peuplé si on scrape des pages de matchs spécifiques
    }

    out_path = os.path.join(out_dir, "cuetracker_matches.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n[cuetracker] Terminé → {out_path}")
    print(f"  Joueurs: {len(players)}")


if __name__ == "__main__":
    main()
