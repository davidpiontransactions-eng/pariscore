#!/usr/bin/env python3
"""Tests unitaires du parseur CSV football-data.co.uk (hors réseau).

Fixtures inline — exécution sans requête HTTP :
    python scripts/tests/test_scrape_football_data.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scrape_football_data import parse_csv, standardize_team_name, season_two_digits  # noqa: E402

SAMPLE_CSV = """Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR,Referee,HS,AS,HST,AST,HF,AF,HC,AC,HY,AY,HR,AR,B365H,B365D,B365A,PSH,PSD,PSA,MaxH,MaxD,MaxA,AvgH,AvgD,AvgA,B365CH,B365CD,B365CA,PSCH,PSCD,PSCA,MaxCH,MaxCD,MaxCA,AvgCH,AvgCD,AvgCA,AHh,B365AHH,B365AHA,PAHH,PAHA,MaxAHH,MaxAHA,AvgAHH,AvgAHA
E0,17/08/2024,12:30,Ipswich,Liverpool,0,2,A,0,0,D,T Robinson,7,18,2,5,9,18,2,10,3,1,0,0,8.5,5.0,1.36,9.5,5.2,1.35,10.5,5.8,1.38,9.32,5.31,1.37,9.0,5.25,1.35,10.0,5.5,1.34,11.0,6.0,1.37,9.6,5.48,1.36,-0.75,1.98,1.88,1.98,1.88,2.02,1.82,1.99,1.85,1.84
E0,24/08/2024,15:00,Arsenal,Wolves,2,0,H,1,0,H,M Oliver,14,9,5,2,11,10,7,2,1,3,0,0,1.33,6.0,9.5,1.33,6.0,9.0,1.38,6.5,10.0,1.35,6.2,9.6,1.30,6.0,10.0,1.32,6.0,10.0,1.34,6.1,9.8,1.31,6.2,9.9,-1.5,2.05,1.82,2.05,1.82,2.10,1.78,2.07,1.80,1.79
"""


def test_parse_count():
    m = parse_csv(SAMPLE_CSV, "E0", 2024)
    assert len(m) == 2, f"attendu 2 matchs, obtenu {len(m)}"
    print("  [ok] parse_csv -> 2 matchs")


def test_parse_fields():
    m = parse_csv(SAMPLE_CSV, "E0", 2024)
    first = m[0]
    assert first["season"] == 2024
    assert first["date"] == "2024-08-17"
    assert first["homeTeam"] == "Ipswich"
    assert first["awayTeam"] == "Liverpool"
    assert first["fthg"] == 0 and first["ftag"] == 2
    assert first["ftr"] == "A"
    assert first["referee"] == "T Robinson"
    assert first["hs"] == 7 and first["as"] == 18
    assert first["hc"] == 2 and first["ac"] == 10
    assert first["hy"] == 3 and first["ay"] == 1
    assert first["hr"] == 0 and first["ar"] == 0
    print("  [ok] champs résultat + stats")


def test_odds_open_close():
    m = parse_csv(SAMPLE_CSV, "E0", 2024)
    first = m[0]
    assert first["odds"]["close"]["b365h"] == 8.5
    assert first["odds"]["close"]["psh"] == 9.5
    assert first["odds"]["close"]["avgh"] == 9.32
    assert first["odds"]["open"]["b365ch"] == 9.0
    assert first["odds"]["open"]["psch"] == 10.0
    assert first["odds"]["open"]["avgch"] == 9.6
    print("  [ok] cotes ouverture/fermeture 1X2")


def test_handle_null_odds():
    # Ligne avec cotes manquantes (saisons anciennes) : pas d'erreur
    csv_null = SAMPLE_CSV.replace(",8.5,5.0,1.36", ",,,")
    m = parse_csv(csv_null, "E0", 2024)
    assert "b365h" not in m[0]["odds"]["close"]  # filtré (None)
    assert m[0]["odds"]["close"]["avgh"] == 9.32  # reste intact
    print("  [ok] cotes nulles ignorées")


def test_standardize():
    assert standardize_team_name("  manchester united  ") == "Manchester United"
    print("  [ok] standardize_team_name")


def test_season_two_digits():
    assert season_two_digits(2024) == "2425"
    assert season_two_digits(1993) == "9394"
    assert season_two_digits(2025) == "2526"
    print("  [ok] season_two_digits")


def test_bom_handling():
    m = parse_csv("\ufeff" + SAMPLE_CSV, "E0", 2024)
    assert len(m) == 2
    print("  [ok] BOM ignoré")


if __name__ == "__main__":
    for fn in [test_parse_count, test_parse_fields, test_odds_open_close,
               test_handle_null_odds, test_standardize, test_season_two_digits,
               test_bom_handling]:
        fn()
    print("ALL OK")
