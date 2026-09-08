#!/usr/bin/env python3
"""
Scraper cuetracker.net — données snooker (matchs, joueurs, rankings).

Durcissement 100 % (mission « CueTracker scraper ») :
  - Rotation d'en-têtes HTTP réalistes (User-Agent, Accept-Language, Referer, Sec-Ch-Ua).
  - Rate limiting 1,5 à 3 s avec jitter aléatoire (anti rate-limit).
  - Retry exponentiel (backoff) sur 429 / 502 / 503.
  - Fallback stealth Camoufox (Scrapling StealthyFetcher, déjà installé)
    quand Cloudflare renvoie un 403 — même pattern que livetv-stealth-fetch.py.
  - Parsing résilient : détection de colonnes par texte d'en-tête (relatif),
    repli positionnel, et navigation sécurisée (gardes + valeurs par défaut).
  - Fallback amont snooker.org (API officielle, en-tête X-Requested-By) :
    best-effort via --snooker-org, jamais bloquant pour le flux CueTracker.
"""

import json
import os
import random
import sys
import time
import argparse
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

# Console Windows (cp1252) : force une sortie UTF-8 robuste (jetons type → / é).
for _stream in (sys.stdout, sys.stderr):
    if _stream is not None and hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

BASE_URL = "https://www.cuetracker.net"
SNOOKER_ORG_API = "https://api.snooker.org/"

# Rate limiting (secondes) — jitter aléatoire entre les deux bornes.
MIN_DELAY = 1.5
MAX_DELAY = 3.0

# Retry exponentiel sur les codes serveur volatils (Cloudflare / balancage).
RETRY_STATUSES = {429, 502, 503}
MAX_RETRIES = 3
BACKOFF_BASE = 1.5

# Agent déclaré pour l'API snooker.org (usage non-commercial, source mentionnée).
SNOOKER_ORG_REQUESTED_BY = os.environ.get("SNOOKER_ORG_REQUESTED_BY", "pariscore-app")

# Appellation du contrat snooker.org (best-effort, validable après obtention d'un X-Requested-By).
SNOOKER_ORG_TOUR = os.environ.get("SNOOKER_ORG_TOUR", "main")

# Scrapling (stealth Camoufox) — import paresseux, jamais bloquant.
try:
    from scrapling.fetchers import StealthyFetcher
    SCRAPLING_AVAILABLE = True
except Exception:
    StealthyFetcher = None
    SCRAPLING_AVAILABLE = False

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
]


def rotate_headers():
    """En-têtes HTTP réalistes, rotation du User-Agent + Referer cuetracker."""
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": random.choice([
            "en-US,en;q=0.9",
            "en-GB,en;q=0.9",
            "fr-FR,fr;q=0.9,en;q=0.8",
        ]),
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": f"{BASE_URL}/",
        "Sec-Ch-Ua": '"Chromium";v="124", " Not;A=Brand";v="99", "Google Chrome";v="124"',
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "no-cache",
    }


def _jitter_delay():
    """Attente aléatoire 1,5 à 3 s (anti rate-limit) avant une requête."""
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))


def _stealth_fetch(url):
    """Fallback stealth Camoufox (Scrapling) — contourne le challenge Cloudflare."""
    if not SCRAPLING_AVAILABLE:
        return None
    try:
        page = StealthyFetcher.fetch(
            url,
            headless=True,
            humanize=True,          # mouvements souris humains (anti-détection)
            os_randomize=True,      # fingerprint OS cohérent aléatoire
            solve_cloudflare=True,  # challenges JS génériques
            network_idle=True,
            wait_selector="body",
            timeout=60000,
        )
        return page.html_content
    except Exception as e:
        print(f"  [stealth:erreur] {url}: {e}")
        return None


def fetch_page(url, dry_run=False, _depth=0):
    """Rate-limit + retry exponentiel + fallback stealth. Renvoie le HTML ou None."""
    if dry_run:
        print(f"  [dry-run] GET {url}")
        return None

    _jitter_delay()
    try:
        resp = requests.get(url, headers=rotate_headers(), timeout=20)
    except requests.RequestException as e:
        if _depth < MAX_RETRIES and SCRAPLING_AVAILABLE:
            print(f"  [retry/stealth] {url} — {e}")
            return _stealth_fetch(url)
        print(f"  [erreur] {url}: {e}")
        return None

    # Retry exponentiel sur les codes serveur volatils.
    if resp.status_code in RETRY_STATUSES and _depth < MAX_RETRIES:
        wait = BACKOFF_BASE * (2 ** _depth) + random.uniform(0, 0.5)
        print(f"  [retry] HTTP {resp.status_code} → {url} (attente {wait:.1f}s)")
        time.sleep(wait)
        return fetch_page(url, dry_run, _depth + 1)

    # 403 Cloudflare → bascule stealth Camoufox.
    if resp.status_code == 403 and SCRAPLING_AVAILABLE:
        print(f"  [stealth] challenge Cloudflare détecté → Camoufox : {url}")
        return _stealth_fetch(url)

    if resp.status_code != 200:
        print(f"  [erreur] {url}: HTTP {resp.status_code}")
        return None

    return resp.text


def _columns(cells):
    """Texte brut d'une liste de cellules BS4 (navigation sécurisée)."""
    return [c.get_text(strip=True) if c else "" for c in cells]


def _col_index(header_cells, *aliases):
    """Index de la colonne dont l'en-tête contient l'un des alias (insensible à la casse)."""
    for i, h in enumerate(header_cells):
        hl = (h or "").lower()
        for a in aliases:
            if a in hl:
                return i
    return None


def _int(val):
    """Parse un entier depuis un élément BS4 ou une chaîne, ou 0."""
    if val is None:
        return 0
    try:
        text = val.get_text(strip=True) if hasattr(val, "get_text") else str(val)
    except AttributeError:
        text = str(val) if val is not None else ""
    try:
        return int(text.replace(",", "").replace("%", "").replace("–", "-").strip())
    except ValueError:
        return 0


def _cell_val(cells, colmap, key, fallback_pos):
    """Valeur d'une cellule par index d'en-tête (résilient à l'ordre), repli positionnel."""
    col = (colmap or {}).get(key)
    if col is not None and col < len(cells):
        return cells[col]
    if fallback_pos is not None and fallback_pos < len(cells):
        return cells[fallback_pos]
    return None


def _table_header_text(table):
    """Textes des en-têtes d'une table, quelle que soit la structure.

    CueTracker réel : <thead> contient des <th> DIRECTS (sans <tr>) —
    table.find_all('tr')[0] est donc déjà une ligne de données. On lit d'abord
    thead > th, puis en repli la première <tr> à <th> (variante legacy).
    """
    thead = table.find("thead")
    if thead:
        ths = thead.find_all("th")
        texts = _columns(ths)
        if any(t for t in texts):
            return texts
    for row in table.find_all("tr"):
        ths = row.find_all("th")
        if ths:
            return _columns(ths)
    return []


def _data_rows(table):
    """Lignes de données d'une table (hors ligne d'en-tête legacy à <th>)."""
    return [r for r in table.find_all("tr") if not r.find("th")]



def scrape_player_stats(html):
    """Extrait les stats joueurs depuis Won/All-time, colonnes par en-tête.

    Page réelle : /Statistics/Matches-and-Frames/Won/All-time avec colonnes
    [Rank(vide), Player, Tournaments Played, Matches Played, Matches Won,
    Match-win percentage]. Les losses n'existent pas sur cette page — elles
    sont dérivées : losses = matches_played - wins. Alias 'frames' gardés
    au cas où la page Frames-Won serait branchée à la place.
    """
    soup = BeautifulSoup(html, "html.parser")
    players = []
    seen = set()

    for table in soup.find_all("table"):
        header_cells = _table_header_text(table)
        colmap = {
            "player": _col_index(header_cells, "player", "name"),
            "nationality": _col_index(header_cells, "national"),
            "matches": _col_index(header_cells, "matches played", "frames played"),
            "wins": _col_index(header_cells, "matches won", "frames won", "wins", "won"),
            "losses": _col_index(header_cells, "losses", "lost"),
        }
        # Une table de stats présente au moins la colonne joueur ou matchs.
        if colmap["player"] is None and colmap["matches"] is None:
            continue

        for row in _data_rows(table):
            cells = row.find_all(["td", "th"])
            if len(cells) < 2:
                continue

            p_col = _cell_val(cells, colmap, "player", None)
            player_name = p_col.get_text(strip=True) if p_col else (cells[0].get_text(strip=True) if cells else "")
            if not player_name:
                continue

            player_id = player_name.lower().replace("'", "").replace(" ", "-")
            if player_id in seen:
                continue
            seen.add(player_id)

            matches_cell = _cell_val(cells, colmap, "matches", 1)
            wins_cell = _cell_val(cells, colmap, "wins", 2)
            losses_cell = _cell_val(cells, colmap, "losses", None)
            nat_cell = _cell_val(cells, colmap, "nationality", None)

            played = _int(matches_cell)
            wins = _int(wins_cell)
            losses = _int(losses_cell) or max(0, played - wins)

            players.append({
                "id": player_id,
                "name": player_name,
                "nationality": nat_cell.get_text(strip=True) if nat_cell else "",
                "ranking": None,
                "matches_played": played,
                "wins": wins,
                "losses": losses,
                "centuries": 0,
                "max_break": None,
                "decider_win_pct": None,
            })

    return players


def scrape_centuries(html):
    """Extrait {nom → nombre de centuries} depuis Centuries/Most-Made/All-time.

    Colonnes réelles : ['', 'Player', 'Centuries'].
    """
    soup = BeautifulSoup(html, "html.parser")
    result = {}

    for table in soup.find_all("table"):
        header_cells = _table_header_text(table)
        name_col = _col_index(header_cells, "player", "name")
        cent_col = _col_index(header_cells, "centur", "tons")
        if name_col is None:
            continue

        for row in _data_rows(table):
            cells = row.find_all(["td", "th"])
            if len(cells) <= max(name_col, cent_col or 0):
                continue
            name = cells[name_col].get_text(strip=True)
            if not name:
                continue
            raw = cells[cent_col].get_text(strip=True) if cent_col is not None else ""
            try:
                result[name.lower().replace("'", "").replace(" ", "-")] = int(raw.replace(",", ""))
            except (ValueError, AttributeError):
                continue

    return result


def scrape_max_breaks(html):
    """Extrait {nom → break maximum} depuis Centuries/Players-Highest-Break/All-time.

    Colonnes réelles : ['', 'Player', 'Break'].
    """
    soup = BeautifulSoup(html, "html.parser")
    result = {}

    for table in soup.find_all("table"):
        header_cells = _table_header_text(table)
        name_col = _col_index(header_cells, "player", "name")
        break_col = _col_index(header_cells, "break")
        if name_col is None:
            continue

        for row in _data_rows(table):
            cells = row.find_all(["td", "th"])
            if len(cells) <= max(name_col, break_col or 0):
                continue
            name = cells[name_col].get_text(strip=True)
            if not name:
                continue
            raw = cells[break_col].get_text(strip=True) if break_col is not None else ""
            try:
                result[name.lower().replace("'", "").replace(" ", "-")] = int(raw.replace(",", ""))
            except (ValueError, AttributeError):
                continue

    return result


def scrape_deciders(html):
    """Extrait les taux de victoire en deciders (colonne % par en-tête).

    Page réelle : ['', 'Player', 'Deciders Played', 'Deciders Won',
    'Win-percentage']. On cible la colonne POURCENTAGE (contient '%'
    ou 'percentage'), pas 'Deciders Played' qui matche aussi 'decider'.
    """
    soup = BeautifulSoup(html, "html.parser")
    decider_map = {}

    for table in soup.find_all("table"):
        header_cells = _table_header_text(table)
        name_col = _col_index(header_cells, "player", "name")
        pct_col = next(
            (i for i, h in enumerate(header_cells) if "%" in (h or "") or "percentage" in (h or "").lower()),
            -1,
        )

        for row in _data_rows(table):
            cells = row.find_all(["td", "th"])
            if len(cells) < 3:
                continue
            name_cell = cells[name_col] if name_col is not None and name_col < len(cells) else cells[1]
            name = name_cell.get_text(strip=True)
            if not name:
                continue
            pct_cell = cells[pct_col] if 0 <= pct_col < len(cells) else cells[-1]
            try:
                pct = float(pct_cell.get_text(strip=True).replace("%", "").replace(",", "."))
                decider_map[name.lower().replace("'", "").replace(" ", "-")] = pct / 100.0
            except (ValueError, AttributeError):
                continue

    return decider_map


def rankings_url(year, month=None):
    """URL de la page rankings par SAISON (août → N/N+1, sinon N-1/N).

    /rankings/{année} renvoie 404 sur CueTracker ; le format réel est
    /Rankings/2026-2027 (vérifié live).
    """
    if month is None:
        month = datetime.now().month
    season = f"{year}-{year + 1}" if month >= 8 else f"{year - 1}-{year}"
    return f"{BASE_URL}/Rankings/{season}"


def scrape_rankings(html, year):
    """Extrait les rankings depuis /Rankings/{saison} (rang = StartPosition).

    La page réelle contient 3 tables : 2 tables hub ('Joining/Leaving the
    tour', lignes à 1 cellule, ignorées par la garde ≥ 3 cellules) et la
    table principale [Player, StartPosition, StartPoints, Difference,
    FinishPosition, FinishPoints] — pas de colonne 'Rank' : le rang EST
    StartPosition.
    """
    soup = BeautifulSoup(html, "html.parser")
    players = []

    for table in soup.find_all("table"):
        header_cells = _table_header_text(table)
        colmap = {
            "name": _col_index(header_cells, "player", "name"),
            "ranking": _col_index(header_cells, "start position", "position", "rank"),
        }
        if colmap["name"] is None:
            continue

        for row in _data_rows(table):
            cells = row.find_all(["td", "th"])
            if len(cells) < 3:
                continue
            name_cell = _cell_val(cells, colmap, "name", 0)
            name = name_cell.get_text(strip=True) if name_cell else ""
            if not name:
                continue

            rank_cell = _cell_val(cells, colmap, "ranking", 1)
            try:
                ranking = int(rank_cell.get_text(strip=True)) if rank_cell else None
            except (ValueError, AttributeError):
                ranking = None

            players.append({
                "id": name.lower().replace("'", "").replace(" ", "-"),
                "name": name,
                "nationality": "",
                "ranking": ranking,
            })

    return players


def scrape_recent_matches(html):
    """Extrait les matchs récents depuis une page de résultats (best-effort, safe)."""
    soup = BeautifulSoup(html, "html.parser")
    matches = []

    match_divs = soup.find_all("div", class_=lambda c: c and "match" in (c or "").lower() if c else False)
    if not match_divs:
        match_divs = soup.find_all("tr", class_=lambda c: c and "match" in (c or "").lower() if c else False)

    for div in match_divs:
        try:
            text = div.get_text(" ", strip=True)
        except AttributeError:
            continue
        parts = text.split(" - ")
        if len(parts) >= 2:
            matches.append({
                "raw": text,
                "player_a": parts[0].strip()[:100],
                "player_b": parts[-1].strip()[:100],
            })

    return matches


def fetch_snooker_org_matches(dry_run=False, days=0):
    """Fallback amont snooker.org (matchs en cours / résultats récents).

    API officielle : en-tête obligatoire `X-Requested-By`. Best-effort :
    toute erreur est loggée et renvoie [] — ne bloque JAMAIS le flux CueTracker.
    Le contrat JSON des champs (matchs t=15) n'est validable qu'avec un
    X-Requested-By approuvé ; on normalise ce qui est sûr (noms, scores, statut)
    et on conserve les champs bruts dans `raw`.
    """
    if dry_run:
        print(f"  [dry-run] GET {SNOOKER_ORG_API}?t=15&ds=1&tr={SNOOKER_ORG_TOUR}")
        return []

    url = f"{SNOOKER_ORG_API}?t=15&ds={days}&tr={SNOOKER_ORG_TOUR}"
    headers = {
        "User-Agent": rotate_headers()["User-Agent"],
        "Accept": "application/json",
        "X-Requested-By": SNOOKER_ORG_REQUESTED_BY,
    }
    try:
        _jitter_delay()
        resp = requests.get(url, headers=headers, timeout=20)
        if resp.status_code != 200:
            print(f"  [snooker.org] échec HTTP {resp.status_code} (X-Requested-By requis)")
            return []
        data = resp.json()
    except (requests.RequestException, ValueError) as e:
        print(f"  [snooker.org] erreur ignorée (fallback non bloquant) : {e}")
        return []

    matches = []
    for row in data if isinstance(data, list) else []:
        if not isinstance(row, dict):
            continue
        p1 = row.get("player1") or row.get("Player1") or ""
        p2 = row.get("player2") or row.get("Player2") or ""
        if not p1 or not p2:
            continue
        matches.append({
            "source": "snooker.org",
            "player_a": str(p1).strip()[:100],
            "player_b": str(p2).strip()[:100],
            "score_a": row.get("score1") or row.get("Score1") or 0,
            "score_b": row.get("score2") or row.get("Score2") or 0,
            "status": (row.get("status") or row.get("Status") or "scheduled").lower(),
            "raw": row,
        })
    return matches


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
    parser.add_argument(
        "--snooker-org", action="store_true",
        help="Active le fallback amont snooker.org (matchs récents) — best-effort, jamais bloquant",
    )
    parser.add_argument("--days", type=int, default=0, help="Jours rétroactifs pour le fallback snooker.org (défaut 0 = aujourd'hui)")
    args = parser.parse_args()

    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
    os.makedirs(out_dir, exist_ok=True)

    print(f"[cuetracker] Début du scrape (dry_run={args.dry_run})")

    # URLs réelles vérifiées live le 2026-09-07 — les anciennes
    # /statistics/matches-and-frames (hub sans table) et /rankings/{year}
    # (404) cassaient le scrape (total_players=0).
    print("[cuetracker] Récupération des pages CueTracker...")
    pages = {}
    for key, url in {
        "matches": f"{BASE_URL}/statistics/matches-and-frames/won/all-time",
        "centuries": f"{BASE_URL}/statistics/centuries/most-made/all-time",
        "max_break": f"{BASE_URL}/statistics/centuries/players-highest-break/all-time",
        "deciders": f"{BASE_URL}/statistics/matches-and-frames/deciders/all-time",
        "rankings": rankings_url(args.year),  # saison : août → N/N+1, sinon N-1/N
    }.items():
        html = fetch_page(url, args.dry_run)
        if html:
            pages[key] = html
        else:
            print(f"  [warn] {key} : page vide/échec — {url}")

    # 1. Statistiques matchs/frames (Won/All-time : played/wins, losses dérivées)
    base_players = scrape_player_stats(pages.get("matches", ""))
    if len(base_players) == 0:
        soup = BeautifulSoup(pages.get("matches", "") or "", "html.parser")
        print(f"  [debug] match html len={len(pages.get('matches','') or '')} tables={len(soup.find_all('table'))} tr={len(soup.find_all('tr'))}")
    else:
        print(f"  → {len(base_players)} joueurs avec stats matchs")

    # 2. Records en deciders (colonne Win-percentage)
    decider_map = scrape_deciders(pages.get("deciders", ""))
    print(f"  → {len(decider_map)} joueurs avec taux decider")

    # 3. Rankings (rang = StartPosition, tables hub ignorées)
    ranking_players = scrape_rankings(pages.get("rankings", ""), args.year)
    print(f"  → {len(ranking_players)} joueurs classés")

    # 4. Enrichissements par nom : centuries + break maximum
    centuries = scrape_centuries(pages.get("centuries", ""))
    max_breaks = scrape_max_breaks(pages.get("max_break", ""))
    print(f"  → {len(centuries)} joueurs avec centuries / {len(max_breaks)} max breaks")

    # Fusion des joueurs CueTracker + enrichissement centuries/max break
    players = merge_players(base_players, ranking_players, decider_map)
    for p in players:
        if p["id"] in centuries:
            p["centuries"] = centuries[p["id"]]
        if p["id"] in max_breaks:
            p["max_break"] = max_breaks[p["id"]]

    # 4. Fallback amont snooker.org (optionnel, non bloquant)
    matches = []
    if args.snooker_org:
        print("[cuetracker] Fallback snooker.org (résultats récents)...")
        matches = fetch_snooker_org_matches(args.dry_run, days=args.days)
        print(f"  → {len(matches)} matchs snooker.org")

    output = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "source": "cuetracker.net",
        "season": args.year,
        "total_players": len(players),
        "players": players,
        "matches": matches,
    }

    out_path = os.path.join(out_dir, "cuetracker_matches.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n[cuetracker] Terminé → {out_path}")
    print(f"  Joueurs: {len(players)}")


if __name__ == "__main__":
    main()
