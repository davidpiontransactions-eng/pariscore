#!/usr/bin/env python3
"""Tests unitaires du connecteur Understat (hors réseau).

Fixtures inline du JSON getLeagueData — exécution sans requête HTTP :
    python scripts/tests/test_scrape_understat.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scrape_understat import build_matches, build_teams, standardize_team_name  # noqa: E402

FIXTURE = {
    "teams": {
        "147": {
            "id": "147", "title": "Athletic Club",
            "short_title": "ATH",
            "history": [
                {"h_a": "h", "xG": 0.290195, "xGA": 0.537517, "npxG": 0.29,
                 "npxGA": 0.53, "ppda": {"att": 97, "def": 19},
                 "ppda_allowed": {"att": 200, "def": 30}, "deep": 2,
                 "deep_allowed": 6, "scored": 1, "missed": 1, "xpts": 0.8,
                 "result": "d", "date": "2024-08-15 17:00:00",
                 "wins": 0, "draws": 1, "loses": 0, "pts": 1, "npxGD": -0.24},
            ],
        },
        "142": {
            "id": "142", "title": "Getafe", "short_title": "GET",
            "history": [
                {"h_a": "a", "xG": 0.537517, "xGA": 0.290195, "npxG": 0.53,
                 "npxGA": 0.29, "ppda": {"att": 205, "def": 14},
                 "ppda_allowed": {"att": 97, "def": 19}, "deep": 3,
                 "deep_allowed": 2, "scored": 1, "missed": 1, "xpts": 0.9,
                 "result": "d", "date": "2024-08-15 17:00:00",
                 "wins": 0, "draws": 1, "loses": 0, "pts": 1, "npxGD": 0.24},
            ],
        },
        "404": "some-string-value",  # cas réel observé : valeur string -> ignorée
    },
    "players": {},
    "dates": [
        {"id": "26982", "isResult": True,
         "h": {"id": "147", "title": "Athletic Club", "short_title": "ATH"},
         "a": {"id": "142", "title": "Getafe", "short_title": "GET"},
         "goals": {"h": "1", "a": "1"},
         "xG": {"h": "0.290195", "a": "0.537517"},
         "datetime": "2024-08-15 17:00:00",
         "forecast": {"w": "0.1519", "d": "0.4912", "l": "0.3569"}},
    ],
}


def test_build_matches():
    m = build_matches("La%20liga", "2024", FIXTURE)
    assert len(m) == 1
    match = m[0]
    assert match["homeTeam"] == "Athletic Club"
    assert match["awayTeam"] == "Getafe"
    assert match["goals"] == {"h": 1, "a": 1}
    assert match["xG"] == {"h": 0.290195, "a": 0.537517}
    assert match["ppda"]["h"] == round(97 / 19, 3)
    assert match["ppda"]["a"] == round(205 / 14, 3)
    assert match["deep"] == {"h": 2, "a": 3}
    assert match["npxGD"] == {"h": -0.24, "a": 0.24}
    assert match["forecast"]["w"] == 0.1519
    assert match["isResult"] is True
    print("  [ok] build_matches (xG/PPDA/deep/forecast)")


def test_build_teams_ignores_string_values():
    t = build_teams(FIXTURE)
    assert "404" not in t
    assert "147" in t and "142" in t
    ath = t["147"]
    assert ath["title"] == "Athletic Club"
    assert ath["games"] == 1
    assert ath["wins"] == 0 and ath["pts"] == 1
    assert ath["xG"] == 0.290
    assert ath["ppda"] == round(97 / 19, 3)
    print("  [ok] build_teams (valeurs string ignorées)")


def test_standardize():
    assert standardize_team_name("  Athletic Club  ") == "Athletic Club"
    print("  [ok] standardize_team_name")


if __name__ == "__main__":
    test_build_matches()
    test_build_teams_ignores_string_values()
    test_standardize()
    print("ALL OK")
