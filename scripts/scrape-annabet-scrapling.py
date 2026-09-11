"""
scrape-annabet-scrapling.py
Scraping Annabet via scrapling StealthyFetcher (Camoufox) pour bypass WAF.
Parse le HTML des matchs upcoming + H2H (standings, stats, odds).
Usage: python scripts/scrape-annabet-scrapling.py [--league=khl] [--dry-run]
"""
import json
import sys
import time
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "annabet_hockey_prematch.json"

LEAGUES = [
    {"id": "nhl", "name": "NHL", "serieId": 6},
    {"id": "khl", "name": "KHL", "serieId": 13},
    {"id": "magnus", "name": "Ligue Magnus", "serieId": 40},
]

def get_fetcher():
    from scrapling.fetchers import StealthyFetcher
    return StealthyFetcher

def fetch_html(StealthyFetcher, url, max_retries=5):
    for attempt in range(max_retries):
        try:
            page = StealthyFetcher.fetch(url, headless=True, wait_selector="body", timeout=60000)
            # Vérifier si c'est un 429
            if hasattr(page, 'status') and page.status == 429:
                wait = (attempt + 1) * 10
                print(f"[scrapling] Rate limited (429), waiting {wait}s...")
                time.sleep(wait)
                continue
            return str(page.body)
        except Exception as e:
            if "429" in str(e) or "rate" in str(e).lower():
                wait = (attempt + 1) * 10
                print(f"[scrapling] Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            raise
    raise Exception(f"Failed after {max_retries} retries (rate limit)")

def parse_upcoming(html):
    """Parse le HTML upcoming pour extraire matchs + odds"""
    matches = []
    # HTML: <tr> with team1 link, " - ", team2 link, then 3 <td> with odds
    # Split by <tr> to process each row
    rows = re.split(r'<tr[^>]*>', html)
    for row in rows:
        # Find team1 and team2 IDs + names
        team_links = re.findall(r'h2h\.php\?team1=(\d+)&amp;team2=(\d+)"[^>]*>\s*(?:<[^>]*>\s*)*([A-Z][^<]+)</a>', row)
        if len(team_links) < 1:
            continue
        t1id, t2id, t1name = team_links[0]
        # Find team2 name (second link with same h2h URL)
        t2_match = re.search(r'<a[^>]*>([A-Z][^<]+)</a>\s*</td>', row)
        t2name = t2_match.group(1).strip() if t2_match else "Unknown"
        # Find odds (3 numbers in td elements)
        odds_vals = re.findall(r'<td[^>]*>\s*([\d.]+)', row)
        if len(odds_vals) >= 3:
            o1, ox, o2 = float(odds_vals[0]), float(odds_vals[1]), float(odds_vals[2])
        else:
            o1, ox, o2 = 0, 0, 0
        matches.append({
            "team1Id": int(t1id),
            "team1Name": t1name.strip(),
            "team2Id": int(t2id),
            "team2Name": t2name,
            "odds1X2": {"home": o1, "draw": ox, "away": o2},
        })
    return matches

def parse_h2h(html):
    """Parse le HTML H2H pour extraire standings + summary via BeautifulSoup"""
    from bs4 import BeautifulSoup
    result = {"standings": [], "summaryHome": None, "summaryAway": None, "h2hStats": None}

    soup = BeautifulSoup(html, "html.parser")

    # ── Standings: chercher la table avec headers #, Team, GP, W, OTW, OTL, L, Pts ──
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        # Chercher la ligne d'en-tête
        header_idx = -1
        for i, row in enumerate(rows):
            cells = row.find_all("td")
            texts = [c.get_text(strip=True) for c in cells]
            if "# Team GP W OTW OTL L Pts" in " ".join(texts) or ("#" in texts and "GP" in texts and "Pts" in texts):
                header_idx = i
                break
        if header_idx < 0:
            continue

        # Parser les lignes de données suivantes
        for row in rows[header_idx + 1:]:
            cells = row.find_all("td")
            if len(cells) < 8:
                continue
            texts = [c.get_text(strip=True) for c in cells]
            try:
                rank_str = texts[0].rstrip(".")
                rank = int(rank_str)
                name = texts[1]
                gp = int(texts[2])
                w = int(texts[3])
                otw = int(texts[4])
                otl = int(texts[5])
                l = int(texts[6])
                pts_text = texts[7].replace(".", "").strip()
                pts = int(pts_text) if pts_text.isdigit() else 0
                if 1 <= rank <= 30 and gp > 0:
                    result["standings"].append({
                        "rank": rank,
                        "name": name,
                        "gp": gp,
                        "all": {"w": w, "otw": otw, "otl": otl, "l": l, "pts": pts},
                        "home": None,
                        "away": None,
                    })
            except (ValueError, IndexError):
                continue
        if result["standings"]:
            break

    # ── 1X2 summary: chercher span "1x2" puis extraire les compteurs ──
    for span in soup.find_all("span", class_="small"):
        if span.get_text(strip=True).lower() == "1x2":
            # Le td avec les bullets est dans le MÊME <tr>
            parent_tr = span.find_parent("tr")
            if parent_tr:
                td = parent_tr.find("td", attrs={"colspan": True})
                if td:
                    # Extraire le texte brut pour compter les bullets
                    raw = str(td)
                    green = raw.count("bullet_green")
                    yellow = raw.count("bullet_yellow")
                    red = raw.count("bullet_red")
                    # Extraire le total goals depuis <b>27 - 28</b>
                    b_tag = td.find("b")
                    total_goals = b_tag.get_text(strip=True) if b_tag else ""
                    # Ligne suivante: pourcentages
                    pct_tr = parent_tr.find_next_sibling("tr")
                    pct_text = ""
                    if pct_tr:
                        pct_td = pct_tr.find("td", attrs={"colspan": True})
                        if pct_td:
                            pct_text = pct_td.get_text(strip=True)
                    result["h2hStats"] = {
                        "oneXtwo": {
                            "homeWins": green,
                            "draws": yellow,
                            "awayWins": red,
                            "pcts": [green, yellow, red],
                            "odds": [],
                        },
                        "totalGoals": total_goals,
                        "percentages": pct_text,
                    }
            break

    return result

def main():
    args = {}
    for arg in sys.argv[1:]:
        if arg.startswith("--"):
            k, v = arg[2:].split("=", 1) if "=" in arg else (arg[2:], True)
            args[k] = v

    dry_run = "dry-run" in args
    league_filter = args.get("league")

    StealthyFetcher = get_fetcher()

    # Charger les données existantes pour fusionner
    output = {
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "annabet.com (scrapling-stealth)",
        "leagues": {},
    }
    if OUT.exists():
        try:
            with open(OUT, "r", encoding="utf-8") as f:
                existing = json.load(f)
                output["leagues"] = existing.get("leagues", {})
        except Exception:
            pass

    for league in LEAGUES:
        if league_filter and league["id"] != league_filter:
            continue

        print(f"\n=== {league['name']} (serie {league['serieId']}) ===")

        try:
            upcoming_url = f"https://annabet.com/en/statistics/ajax_upcoming.php?_language=en&compare=Compare&serie=i:{league['serieId']};&hockeystats"
            html = fetch_html(StealthyFetcher, upcoming_url)
            matches = parse_upcoming(html)
            print(f"[scrapling] Found {len(matches)} upcoming matches")

            if dry_run:
                for m in matches[:5]:
                    print(f"  {m['team1Name']} vs {m['team2Name']} — odds: {m['odds1X2']}")
                output["leagues"][league["id"]] = {"matches": matches[:5]}
                continue

            results = []
            for i, match in enumerate(matches):
                h2h_url = f"https://annabet.com/en/hockeystats/h2h.php?team1={match['team1Id']}&team2={match['team2Id']}"
                print(f"[scrapling] ({i+1}/{len(matches)}) {match['team1Name']} vs {match['team2Name']}")

                try:
                    h2h_html = fetch_html(StealthyFetcher, h2h_url)
                    h2h = parse_h2h(h2h_html)
                    results.append({**match, "h2h": h2h, "summary": h2h.get("summary")})
                    print(f"[scrapling]   OK — {len(h2h['standings'])} standings")
                except Exception as e:
                    print(f"[scrapling]   H2H error: {e}")
                    results.append({**match, "h2h": None, "error": str(e)})

                time.sleep(10)

            output["leagues"][league["id"]] = {"matches": results}

        except Exception as e:
            print(f"[scrapling] League error: {e}")
            output["leagues"][league["id"]] = {"matches": [], "error": str(e)}

    # Sauvegarder
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n[scrapling] Saved to {OUT}")
    for lid, ldata in output["leagues"].items():
        matches = ldata.get("matches", [])
        ok = sum(1 for m in matches if m.get("h2h"))
        print(f"  {lid}: {len(matches)} matches, {ok} with H2H data")

if __name__ == "__main__":
    main()
