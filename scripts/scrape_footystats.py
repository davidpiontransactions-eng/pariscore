#!/usr/bin/env python3
"""
scrape_footystats.py — Scraper FootyStats corners via ajax_corners.php.
Genere JSON standalone ou merge dans metrics existantes.
USAGE: python scripts/scrape_footystats.py --standalone corners > public/data/footystats_corners.json
"""

import sys, os, json, argparse, re, time
from datetime import datetime, timezone
from typing import Optional, Dict, List

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("pip install requests beautifulsoup4 lxml", file=sys.stderr)
    sys.exit(1)

try:
    from team_name_mapping import TEAM_NAME_OVERRIDES
except ImportError:
    TEAM_NAME_OVERRIDES = {}

BASE = "https://footystats.org"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

def std_name(raw: str) -> str:
    name = re.sub(r"\s+", " ", raw.strip())
    return TEAM_NAME_OVERRIDES.get(name.lower().strip(), name.strip())

def safe_float(text: str) -> Optional[float]:
    t = text.strip().replace("%", "").replace(",", "")
    if t in ("", "-", "n/a", "N/A"): return None
    try: return float(t)
    except ValueError: return None


def scrape_corners(corner_type: str = "corners-o95") -> List[Dict]:
    """Scrape ajax_corners.php → [{teamName, countryCode, rank, hitPct, avgCorners, odds}]."""
    url = f"{BASE}/ajax_corners.php?type={corner_type}"
    print(f"  [FS] {url}", file=sys.stderr)

    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        print(f"  [FS] ERROR: {e}", file=sys.stderr)
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    rows = soup.find_all("tr")
    results = []

    thresh_m = re.search(r"o(\d+)", corner_type)
    threshold = float(thresh_m.group(1)) / 10.0 if thresh_m else 9.5

    for tr in rows:
        cells = tr.find_all("td")
        if len(cells) < 5:
            continue

        rank = safe_float(cells[0].get_text())
        if rank is None:
            continue

        team_link = cells[1].find("a")
        team_name = std_name(team_link.get_text(strip=True)) if team_link else ""
        if not team_name:
            continue

        flag_span = cells[1].find("span", class_=re.compile(r"flag-"))
        country_code = ""
        if flag_span:
            for cls in flag_span.get("class", []):
                m = re.match(r"flag-(\w+)-\d+", cls)
                if m:
                    country_code = m.group(1).upper()
                    break

        hit_el = cells[2].find("span", class_="semi-bold")
        hit_rate = safe_float(hit_el.get_text()) if hit_el else None

        avg_el = cells[3].find("span")
        avg_corners = safe_float(avg_el.get_text()) if avg_el else safe_float(cells[3].get_text())

        odds_el = cells[5].find("span") if len(cells) > 5 else None
        odds = safe_float(odds_el.get_text()) if odds_el else None

        results.append({
            "teamName": team_name,
            "countryCode": country_code,
            "rank": int(rank),
            f"cornersOver{threshold}HitPct": hit_rate,
            "avgCornersPg": avg_corners,
            "odds": odds,
        })

    print(f"  [FS] {len(results)} teams", file=sys.stderr)
    return results
def merge_into_existing(league_slug: str, corners: List[Dict], output_dir: str):
    """Charge le JSON existant et merge les corners FootyStats par fuzzy team name."""
    fpath = os.path.join(output_dir, f"{league_slug}.json")
    if not os.path.exists(fpath):
        # Standalone: creer un fichier juste avec les corners
        total = len(corners)
        out = {
            "meta": {"schemaVersion": 1, "leagueId": league_slug,
                     "leagueName": league_slug, "lastUpdated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                     "sources": ["footystats.org"], "teamCount": total, "partial": total < 5},
            "teams": [{
                "teamName": t["teamName"], "rank": t["rank"], "rankTotal": total,
                "corners": {"total": {"value": t.get("avgCornersPg"), "rank": None, "rankTotal": total}}
            } for t in corners]
        }
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
        print(f"  -> {fpath} (new)", file=sys.stderr)
        return

    with open(fpath, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Fuzzy match: lowercase alphanumeric only
    def key(name): return re.sub(r"[^a-z0-9]", "", name.lower())
    corner_lookup = {key(t["teamName"]): t for t in corners}

    updated = 0
    for team in data.get("teams", []):
        k = key(team["teamName"])
        if k in corner_lookup:
            ct = corner_lookup[k]
            team["corners"]["total"]["value"] = ct.get("avgCornersPg")
            updated += 1

    data["meta"]["sources"] = list(set(data["meta"].get("sources", []) + ["footystats.org"]))
    data["meta"]["lastUpdated"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    with open(fpath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  -> {fpath} (updated {updated}/{len(data['teams'])} teams)", file=sys.stderr)


# ── Main ──

def main():
    parser = argparse.ArgumentParser(description="FootyStats corner scraper")
    parser.add_argument("--league", type=str)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--corner-type", type=str, default="corners-o95",
                        choices=["corners-o95","corners-o105","corners-o115","corners-o125"])
    parser.add_argument("--output-dir", type=str, default="public/data/metrics")
    parser.add_argument("--standalone", type=str, help="Save standalone (no merge)")
    args = parser.parse_args()

    corners = scrape_corners(args.corner_type)
    if not corners:
        print("No data", file=sys.stderr); sys.exit(1)

    if args.standalone:
        fpath = os.path.join(args.output_dir, f"footystats_{args.standalone}.json")
        os.makedirs(args.output_dir, exist_ok=True)
        out = {
            "meta": {"schemaVersion": 1, "source": "footystats.org",
                     "type": args.corner_type, "teamCount": len(corners),
                     "lastUpdated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
            "teams": corners,
        }
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
        print(f"  -> {fpath}", file=sys.stderr)

    elif args.league:
        merge_into_existing(args.league, corners, args.output_dir)

    elif args.all:
        os.makedirs(args.output_dir, exist_ok=True)
        for fname in sorted(os.listdir(args.output_dir)):
            if fname.endswith(".json") and not fname.startswith("footystats"):
                merge_into_existing(fname.replace(".json", ""), corners, args.output_dir)
                time.sleep(0.3)

    print(f"\nDone: {len(corners)} teams (type={args.corner_type})", file=sys.stderr)


if __name__ == "__main__":
    main()

