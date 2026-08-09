#!/usr/bin/env python3
"""
team_name_mapping.py — Dictionnaire soccerstats.com → PariScore.
Importé par scrape_rankings.py. Extensible par ligue.
"""

TEAM_NAME_OVERRIDES = {
    # ── Premier League ──
    "manchester utd": "Manchester United", "manchester united": "Manchester United",
    "manchester city": "Manchester City", "wolverhampton": "Wolves",
    "sheffield utd": "Sheffield United", "west brom": "West Bromwich Albion",
    "aston villa": "Aston Villa", "newcastle": "Newcastle United",
    "nottingham forest": "Nottingham Forest", "leicester city": "Leicester",
    "leeds united": "Leeds", "crystal palace": "Crystal Palace",
    "brighton & hove albion": "Brighton", "brighton": "Brighton",
    "west ham": "West Ham", "tottenham": "Tottenham",

    # ── Championship ──
    "luton town": "Luton", "burnley": "Burnley", "sunderland": "Sunderland",
    "middlesbrough": "Middlesbrough", "hull city": "Hull",
    "bristol city": "Bristol City", "norwich city": "Norwich",
    "millwall": "Millwall", "watford": "Watford",
    "queens park rangers": "QPR", "swansea city": "Swansea",
    "blackburn rovers": "Blackburn", "plymouth argyle": "Plymouth",
    "stoke city": "Stoke", "cardiff city": "Cardiff",

    # ── Ligue 1 ──
    "paris saint-germain": "Paris SG", "paris sg": "Paris SG",
    "olympique marseille": "Marseille", "marseille": "Marseille",
    "olympique lyonnais": "Lyon", "lyon": "Lyon",
    "as monaco": "Monaco", "monaco": "Monaco",
    "lille osc": "Lille", "lille": "Lille",
    "stade rennais": "Rennes", "rennes": "Rennes",
    "rc lens": "Lens", "lens": "Lens",
    "ogc nice": "Nice", "nice": "Nice",
    "rc strasbourg": "Strasbourg", "strasbourg": "Strasbourg",
    "stade de reims": "Reims", "reims": "Reims",
    "montpellier hsc": "Montpellier", "montpellier": "Montpellier",
    "toulouse fc": "Toulouse", "toulouse": "Toulouse",
    "fc nantes": "Nantes", "nantes": "Nantes",
    "stade brestois 29": "Brest", "brest": "Brest",
    "clermont foot": "Clermont", "le havre ac": "Le Havre",
    "aj auxerre": "Auxerre", "angers sco": "Angers",

    # ── La Liga ──
    "real madrid": "Real Madrid", "atletico madrid": "Atletico Madrid",
    "athletic bilbao": "Athletic Bilbao", "real sociedad": "Real Sociedad",
    "real betis": "Real Betis", "sevilla": "Sevilla",
    "villarreal": "Villarreal", "valencia": "Valencia",
    "osasuna": "Osasuna", "getafe": "Getafe",
    "celta vigo": "Celta Vigo", "rayo vallecano": "Rayo Vallecano",
    "girona": "Girona", "mallorca": "Mallorca",
    "alaves": "Alaves", "las palmas": "Las Palmas",
    "espanyol": "Espanyol", "valladolid": "Valladolid", "leganes": "Leganes",


    # ── Bundesliga ──
    "borussia m'gladbach": "Borussia Monchengladbach",
    "eintracht frankfurt": "Eintracht Frankfurt",
    "bayer leverkusen": "Bayer Leverkusen", "bayern munich": "Bayern Munich",
    "borussia dortmund": "Borussia Dortmund", "rb leipzig": "RB Leipzig",
    "tsg hoffenheim": "Hoffenheim", "vfb stuttgart": "Stuttgart",
    "vfl wolfsburg": "Wolfsburg", "sc freiburg": "Freiburg",
    "1. fc union berlin": "Union Berlin", "1. fsv mainz 05": "Mainz",
    "fc augsburg": "Augsburg", "werder bremen": "Werder Bremen",

    # ── 2. Bundesliga ──
    "hamburger sv": "Hamburger SV", "hamburg": "Hamburger SV",
    "1. fc koln": "FC Koln", "1. fc koeln": "FC Koln", "fc koln": "FC Koln",
    "hertha bsc": "Hertha BSC", "fc schalke 04": "Schalke 04", "schalke 04": "Schalke 04",
    "1. fc kaiserslautern": "Kaiserslautern", "hannover 96": "Hannover 96",
    "fortuna dusseldorf": "Fortuna Dusseldorf", "fortuna duesseldorf": "Fortuna Dusseldorf",
    "karlsruher sc": "Karlsruher SC", "1. fc magdeburg": "Magdeburg",
    "spvgg greuther furth": "Greuther Furth", "greuther furth": "Greuther Furth",
    "sv 07 elversberg": "Elversberg", "elversberg": "Elversberg",
    "sc paderborn 07": "Paderborn", "1. fc nurnberg": "Nurnberg", "nurnberg": "Nurnberg",
    "sv darmstadt 98": "Darmstadt 98", "eintracht braunschweig": "Eintracht Braunschweig",
    "preussen munster": "Preussen Munster", "sc preussen munster": "Preussen Munster",
    "ssv ulm 1846": "Ulm 1846", "ssv jahn regensburg": "Jahn Regensburg", "jahn regensburg": "Jahn Regensburg",
    "holstein kiel": "Holstein Kiel", "dynamo dresden": "Dynamo Dresden",
    "energie cottbus": "Energie Cottbus", "vfl bochum": "VfL Bochum",
    "fc st. pauli": "FC St. Pauli", "st. pauli": "FC St. Pauli",
    "1. fc koln 2": "FC Koln II", "fortuna dusseldorf 2": "Fortuna Dusseldorf II",

    # ── Serie A ──
    "inter": "Inter Milan", "ac milan": "AC Milan",
    "juventus": "Juventus", "napoli": "Napoli", "atalanta": "Atalanta",
    "lazio": "Lazio", "roma": "Roma", "fiorentina": "Fiorentina",
    "bologna": "Bologna", "torino": "Torino", "genoa": "Genoa",
    "monza": "Monza", "udinese": "Udinese", "lecce": "Lecce",
    "empoli": "Empoli", "cagliari": "Cagliari",
    "hellas verona": "Verona", "parma": "Parma",

    # ── Eredivisie ──
    "ajax": "Ajax", "psv eindhoven": "PSV", "feyenoord": "Feyenoord",
    "az alkmaar": "AZ Alkmaar", "fc twente": "Twente",
    "fc utrecht": "Utrecht", "sparta rotterdam": "Sparta Rotterdam",
    "sc heerenveen": "Heerenveen",

    # ── Primeira Liga ──
    "benfica": "Benfica", "porto": "Porto",
    "sporting lisbon": "Sporting CP", "braga": "Braga",
    "vitoria guimaraes": "Vitoria Guimaraes", "famalicao": "Famalicao",

    # ── Autres ──
    "bodø / glimt": "Bodo Glimt", "bodo/glimt": "Bodo Glimt",
    "galatasaray": "Galatasaray", "fenerbahce": "Fenerbahce",
    "besiktas": "Besiktas", "olympiacos": "Olympiacos",
    "panathinaikos": "Panathinaikos", "celtic": "Celtic",
    "rangers": "Rangers", "club brugge": "Club Brugge",
}
