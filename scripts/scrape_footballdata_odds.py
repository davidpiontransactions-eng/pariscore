#!/usr/bin/env python3
"""
Scrape football-data.co.uk CSV files for historical odds data.
Downloads CSVs for current + previous season across major leagues.
Output: data/football_data_odds.json
"""

import requests
import csv
import json
import os
from datetime import datetime, timezone
from io import StringIO

LEAGUES = {
    "E0": "Premier League",
    "E1": "Championship",
    "SP1": "La Liga",
    "I1": "Serie A",
    "D1": "Bundesliga",
    "F1": "Ligue 1",
    "N1": "Eredivisie",
    "P1": "Primeira Liga",
    "T1": "Super Lig",
    "B1": "Jupiler League",
}

SEASONS = ["2526", "2425"]


def download_csv(league_code, season):
    url = f"https://www.football-data.co.uk/mmz4281/{season}/{league_code}.csv"
    resp = requests.get(url, timeout=15)
    if resp.status_code == 200 and len(resp.text) > 100:
        return resp.text
    return None


def parse_csv(csv_text, league_name, league_code, season):
    matches = []
    reader = csv.DictReader(StringIO(csv_text))
    for row in reader:
        try:
            match = {
                "league": league_name,
                "league_code": league_code,
                "season": f"20{season[:2]}/{season[2:]}",
                "date": row.get("Date", ""),
                "home_team": row.get("HomeTeam", ""),
                "away_team": row.get("AwayTeam", ""),
                "home_goals": int(row.get("FTHG", 0)) if row.get("FTHG") else None,
                "away_goals": int(row.get("FTAG", 0)) if row.get("FTAG") else None,
                "result": row.get("FTR", ""),
                "odds_home_avg": float(row.get("AvgH", 0)) if row.get("AvgH") else None,
                "odds_draw_avg": float(row.get("AvgD", 0)) if row.get("AvgD") else None,
                "odds_away_avg": float(row.get("AvgA", 0)) if row.get("AvgA") else None,
                "odds_home_close": float(row.get("PSH", 0)) if row.get("PSH") else None,
                "odds_draw_close": float(row.get("PSD", 0)) if row.get("PSD") else None,
                "odds_away_close": float(row.get("PSA", 0)) if row.get("PSA") else None,
                "odds_home_b365": float(row.get("B365H", 0)) if row.get("B365H") else None,
                "odds_draw_b365": float(row.get("B365D", 0)) if row.get("B365D") else None,
                "odds_away_b365": float(row.get("B365A", 0)) if row.get("B365A") else None,
                "ou25_avg_over": float(row.get("Avg>2.5", 0)) if row.get("Avg>2.5") else None,
                "ou25_avg_under": float(row.get("Avg<2.5", 0)) if row.get("Avg<2.5") else None,
                "btts_yes": float(row.get("BbMx>2.5", 0)) if row.get("BbMx>2.5") else None,
                "btts_no": float(row.get("BbAv>2.5", 0)) if row.get("BbAv>2.5") else None,
                "home_shots": int(row.get("HS", 0)) if row.get("HS") else None,
                "away_shots": int(row.get("AS", 0)) if row.get("AS") else None,
                "home_corners": int(row.get("HC", 0)) if row.get("HC") else None,
                "away_corners": int(row.get("AC", 0)) if row.get("AC") else None,
                "home_fouls": int(row.get("HF", 0)) if row.get("HF") else None,
                "away_fouls": int(row.get("AF", 0)) if row.get("AF") else None,
                "home_yellow": int(row.get("HY", 0)) if row.get("HY") else None,
                "away_yellow": int(row.get("AY", 0)) if row.get("AY") else None,
            }
            if match["home_team"] and match["away_team"]:
                matches.append(match)
        except (ValueError, KeyError):
            continue
    return matches


def main():
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
    os.makedirs(out_dir, exist_ok=True)

    all_matches = []
    for season in SEASONS:
        for code, name in LEAGUES.items():
            print(f"[football-data] {name} ({code}) season {season}...", end=" ")
            csv_text = download_csv(code, season)
            if csv_text:
                matches = parse_csv(csv_text, name, code, season)
                all_matches.extend(matches)
                print(f"{len(matches)} matchs")
            else:
                print("skip")

    output = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "source": "football-data.co.uk",
        "total_matches": len(all_matches),
        "matches": all_matches,
    }

    out_path = os.path.join(out_dir, "football_data_odds.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\n[football-data] {len(all_matches)} matchs → {out_path}")


if __name__ == "__main__":
    main()
