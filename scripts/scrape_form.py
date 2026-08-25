#!/usr/bin/env python3
"""
scrape_form.py — Pipeline production « forme récente » depuis soccerstats.com.

Scrape formtable.asp?league={slug} pour 12+ ligues, extrait la forme par équipe
(GP/W/D/L/GF/GA/GD/Pts) + la séquence de résultats récents, normalise les noms
via team_name_mapping.py, et génère /public/data/form/{id}.json.

USAGE:
    python scripts/scrape_form.py --all --output-dir public/data/form
    python scripts/scrape_form.py --league england --output-dir public/data/form
"""

import sys, os, json, argparse, re, time
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

try:
    import requests
    from bs4 import BeautifulSoup, Tag
    from tenacity import retry, stop_after_attempt, wait_exponential
except ImportError as e:
    print(json.dumps({"error": "Deps missing",
          "install": "pip install -r scripts/requirements-rankings.txt",
          "detail": str(e)}), file=sys.stderr)
    sys.exit(1)

try:
    from team_name_mapping import TEAM_NAME_OVERRIDES
except ImportError:
    TEAM_NAME_OVERRIDES = {}

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
           "Accept": "text/html,application/xhtml+xml"}

# slug soccerstats → (base slug, slug interne PariScore)
# La forme est volontairement scrapée sur la SAISON PRÉCÉDENTE (2025/26) car en
# début de saison 2026/27 le corpus courant est trop sparse. La convention
# d'URL soccerstats `league=<slug>_<année>` (année de fin de saison) charge la
# saison 2025/26 avec `_2026`.
LEAGUES = {
    "england":     ("england",     "epl"),
    "england2":    ("england2",    "championship"),
    "france":      ("france",      "ligue1"),
    "france2":     ("france2",     "ligue2"),
    "spain":       ("spain",       "laliga"),
    "spain2":      ("spain2",      "laliga2"),
    "germany":     ("germany",     "bundesliga"),
    "germany2":    ("germany2",    "bundesliga2"),
    "italy":       ("italy",       "seriea"),
    "italy2":      ("italy2",      "serieb"),
    "netherlands": ("netherlands", "eredivisie"),
    "portugal":    ("portugal",    "primeira_liga"),
    "belgium":     ("belgium",     "jupiler"),
    "turkey":      ("turkey",      "super_lig"),
    "greece":      ("greece",      "superleague_greece"),
    "switzerland": ("switzerland", "super_league_swiss"),
    "scotland":    ("scotland",    "scot_prem"),
    "sweden":      ("sweden",      "allsvenskan"),
    "romania":     ("romania",     "liga_1_romania"),
    "denmark":     ("denmark",     "denmark_superliga"),
    "russia":      ("russia",      "russian_premier"),
    "china":       ("china",       "chinese_super_league"),
    "japan":       ("japan",       "j1_league"),
    "southkorea":  ("southkorea",  "k_league1"),
    "usa":         ("usa",         "mls"),
    "mexico":      ("mexico",      "liga_mx"),
    "argentina":   ("argentina2",  "argentina_primera"),
    "austria":     ("austria",     "austria_bundesliga"),
    "saudiarabia": ("saudiarabia", "saudi_pro_league"),
}

# Saison cible (saison précédente). `_2026` = saison dont l'année de fin est 2026.
SEASON_SUFFIX = "2026"
SEASON_LABEL = "2025/26"


def league_url(slug: str, season: Optional[str] = None) -> str:
    suffix = season if season is not None else SEASON_SUFFIX
    return f"https://www.soccerstats.com/formtable.asp?league={slug}_{suffix}"


# ── Normalisation ──

def standardize_team_name(raw_name: str) -> str:
    name = re.sub(r"\s+", " ", raw_name.strip())
    key = name.lower().strip()
    if key in TEAM_NAME_OVERRIDES:
        return TEAM_NAME_OVERRIDES[key]
    return name.title()


def _parse_number(text: str) -> Optional[float]:
    t = text.strip().replace("%", "").replace(",", "")
    if t in ("", "-", "n/a", "N/A", "+"):
        return None
    # signe explicite (+3 / -2)
    signed = t.lstrip("+")
    try:
        return float(signed)
    except ValueError:
        return None


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
def _fetch_page_status(url: str) -> tuple[int, str]:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.encoding = "utf-8"
    return resp.status_code, resp.text


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
def _fetch_page(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    resp.encoding = "utf-8"
    return resp.text


# ── Parsing de formtable.asp ──
# Structure : un tableau principal par contexte (HOME / AWAY), colonnes
#   rank | équipe | GP | W | D | L | GF | GA | GD | Pts | Opponents PPG
# suivi, par équipe, d'une ligne « Séquence » avec "Last N games (most recent first)"
# puis lister des rencontres "(H) vs X (PPG away = …)".

def _parse_form_table(table: Tag) -> List[Dict[str, Any]]:
    rows = table.find_all("tr")
    if len(rows) < 3:
        return []
    header_idx = -1
    for i, tr in enumerate(rows[:4]):
        text = " ".join(td.get_text(strip=True) for td in tr.find_all(["td", "th"]))
        if all(kw in text for kw in ["GP", "W", "D", "L", "Pts"]):
            header_idx = i
            break
    if header_idx < 0:
        return []
    results = []
    for tr in rows[header_idx + 1:]:
        cells = tr.find_all(["td", "th"])
        team_raw = None
        a = tr.find("a")
        if a:
            team_raw = a.get_text(strip=True)
        if not team_raw and len(cells) > 1:
            team_raw = cells[1].get_text(strip=True)
        if not team_raw:
            continue
        team_name = standardize_team_name(team_raw)
        # layout : rank | équipe | GP | W | D | L | GF | GA | GD | Pts | [Opp PPG]
        vals = [_parse_number(c.get_text(strip=True)) for c in cells[2:8]]
        if len(vals) < 6 or vals[0] is None or vals[1] is None:
            continue
        gp, w, d, l, gf, ga = vals
        results.append({
            "teamName": team_name,
            "gp": int(gp or 0), "w": int(w or 0), "d": int(d or 0), "l": int(l or 0),
            "gf": int(gf or 0), "ga": int(ga or 0),
        })
    return results


# ── Scrape d'une ligue ──

MISSING_SIZE = 8  # nombre de matchs minimum pour considérer la forme exploitable
# Fenêtre de forme ciblée (alignée sur la constante TS FORM_WINDOW).
TARGET_WINDOW = 5


def _extract_window_form(html: str, kind: str) -> tuple[List[Dict[str, Any]], int]:
    """Extrait la forme (home|away) d'une page formtable.

    kind = "home" → table « (AT HOME) » ; "away" → table « (AWAY) ».
    Retourne (entries, window) en gardant la fenêtre la plus large dispo.
    """
    soup = BeautifulSoup(html, "lxml")
    tables = soup.find_all("table")

    def pick_window(ctx: str) -> int:
        m = re.search(r"last (\d+)", ctx)
        return int(m.group(1)) if m else 0

    best_entries, best_window = None, 0
    for table in tables:
        prev = table.find_previous(["h2", "h3", "b", "strong", "div", "font"])
        ctx = prev.get_text(strip=True).lower() if prev else ""
        if kind == "home" and "at home" in ctx:
            rows = _parse_form_table(table)
            w = pick_window(ctx)
            if rows and w > best_window:
                best_entries, best_window = rows, w
        elif kind == "away" and "away" in ctx and "home" not in ctx:
            rows = _parse_form_table(table)
            w = pick_window(ctx)
            if rows and w > best_window:
                best_entries, best_window = rows, w
    return (best_entries or [], best_window)


def _merge_form(current: List[Dict], previous: List[Dict], current_window: int, target: int) -> List[Dict]:
    """Cumule la forme de 2 saisons en donnant priorité à la saison courante
    (la plus récente) puis en complétant sur la saison précédente jusqu'à
    `target` matchs.

    Chaque entrée porte un agrégat (gp/w/d/l/gf/ga) sur sa propre fenêtre.
    Pour cumuler proprement : on prend d'abord `min(gp_current, target)`
    matchs courants, puis on complète avec `target - pris` matchs précédents
    — la contribution précédente est calculée au prorata des taux (buts par
    match, points par match) de la saison précédente.
    """
    cur = {e["teamName"]: e for e in current}
    prev = {e["teamName"]: e for e in previous}
    out = []
    # Union des équipes : la forme de la saison courante est prioritaire, mais on
    # inclut les équipes présentes uniquement en saison précédente (promues qui
    # ont joué en 2025/26 mais pas encore en 2026/27) pour maximiser la couverture.
    for name in cur.keys() | prev.keys():
        c = cur.get(name)
        p = prev.get(name)
        if not c:
            # Équipe absente de la saison courante : on prend sa forme précédente
            # telle quelle, ramenée à la fenêtre cible.
            if p and p["gp"] >= 1:
                take_p = min(p["gp"], target)
                if take_p >= p["gp"]:
                    out.append(dict(p))
                else:
                    pgp = max(p["gp"], 1)
                    frac = take_p / pgp
                    out.append({
                        "teamName": name,
                        "gp": take_p,
                        "w": round(p["w"] * frac),
                        "d": round(p["d"] * frac),
                        "l": round(p["l"] * frac),
                        "gf": round(p["gf"] * frac),
                        "ga": round(p["ga"] * frac),
                    })
            continue
        take_c = min(c["gp"], target)
        if not p:
            out.append(dict(c))
            continue
        # Contribution précédente : on complète la fenêtre (au plus target - take_c).
        take_p = min(p["gp"], target - take_c)
        if take_p <= 0:
            out.append(dict(c))
            continue
        # Taux par match de la saison précédente.
        pgp = max(p["gp"], 1)
        gf_r = p["gf"] / pgp
        ga_r = p["ga"] / pgp
        pts_rate = (p["w"] * 3 + p["d"]) / pgp
        # Buts cumulés (saison courante + portion précédente).
        gf = c["gf"] + round(gf_r * take_p)
        ga = c["ga"] + round(ga_r * take_p)
        gp = take_c + take_p
        # Répartition W/D/L proportionnelle à chaque saison.
        w_c = c["w"] * (take_c / max(c["gp"], 1)) if c["gp"] else 0
        d_c = c["d"] * (take_c / max(c["gp"], 1)) if c["gp"] else 0
        l_c = c["l"] * (take_c / max(c["gp"], 1)) if c["gp"] else 0
        prev_frac = take_p / max(p["gp"], 1)
        w = round(w_c + p["w"] * prev_frac)
        d = round(d_c + p["d"] * prev_frac)
        l = round(l_c + p["l"] * prev_frac)
        out.append({
            "teamName": name,
            "gp": gp,
            "w": w,
            "d": d,
            "l": l,
            "gf": gf,
            "ga": ga,
        })
    return out


def scrape_league(slug: str, base_slug: str, league_id: str) -> Optional[Dict]:
    # On scrape les DEUX saisons : la courante (2026/27, la plus récente) et la
    # précédente (2025/26). La forme finale est la cumulation (priorité courante,
    # complétée par la précédente jusqu'à TARGET_WINDOW matchs).
    current_html = None
    previous_html = None
    try:
        cur_url = f"https://www.soccerstats.com/formtable.asp?league={base_slug}"
        status_c, cur_html = _fetch_page_status(cur_url)
        if status_c == 200:
            current_html = cur_html
        prev_url = league_url(base_slug)
        status_p, prev_html_res = _fetch_page_status(prev_url)
        if status_p == 200:
            previous_html = prev_html_res
    except Exception as e:
        print(f"[{slug}] ERROR fetch: {e}", file=sys.stderr)
        return None

    if not current_html and not previous_html:
        print(f"[{slug}] ERROR: no data (both seasons failed)", file=sys.stderr)
        return None

    home_cur, home_cur_win = _extract_window_form(current_html or previous_html, "home")
    away_cur, away_cur_win = _extract_window_form(current_html or previous_html, "away")
    home_prev, home_prev_win = _extract_window_form(previous_html, "home") if previous_html else ([], 0)
    away_prev, away_prev_win = _extract_window_form(previous_html, "away") if previous_html else ([], 0)

    # Cumulation : priorité à la saison courante, complétée par la précédente.
    home_entries = _merge_form(home_cur, home_prev, home_cur_win, TARGET_WINDOW)
    away_entries = _merge_form(away_cur, away_prev, away_cur_win, TARGET_WINDOW)

    if not home_entries and not away_entries:
        print(f"[{slug}] ERROR: no data", file=sys.stderr)
        return None

    print(
        f"[{slug}] {len(home_entries)}H / {len(away_entries)}A "
        f"(cur {home_cur_win}/{away_cur_win} + prev {home_prev_win}/{away_prev_win})",
        file=sys.stderr,
    )

    # Label de saison : cumul si les deux saisons ont servi, sinon la seule dispo.
    st = "2026/27" if not previous_html else "2025/26+2026/27"

    return {
        "meta": {
            "schemaVersion": 2,
            "leagueId": league_id,
            "leagueName": slug.replace("-", " ").title(),
            "season": st,
            "lastUpdated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "soccerstats.com/formtable (cumulé 2 saisons)",
            "teamCount": max(len(home_entries), len(away_entries)),
            "window": max(home_cur_win, home_prev_win, away_cur_win, away_prev_win),
            "targetWindow": TARGET_WINDOW,
            "partial": max(
                len([e for e in home_entries if e["gp"] < TARGET_WINDOW]),
                len([e for e in away_entries if e["gp"] < TARGET_WINDOW]),
            ) > 0,
        },
        "home": home_entries,
        "away": away_entries,
    }


def main():
    parser = argparse.ArgumentParser(description="Production form scraper")
    parser.add_argument("--league", type=str)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--output-dir", type=str, default="public/data/form")
    parser.add_argument("--delay", type=float, default=2.0)
    args = parser.parse_args()

    if args.league:
        if args.league not in LEAGUES:
            print(f"Unknown: '{args.league}'", file=sys.stderr)
            sys.exit(1)
        targets = {args.league: LEAGUES[args.league]}
    elif args.all:
        targets = LEAGUES
    else:
        print("Use --all or --league <slug>", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)
    ok, fail = 0, 0
    keys = list(targets.keys())
    for i, (slug, (base_slug, lid)) in enumerate(targets.items()):
        data = scrape_league(slug, base_slug, lid)
        if data is None:
            fail += 1
            continue
        fpath = os.path.join(args.output_dir, f"{lid}.json")
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  -> {fpath}", file=sys.stderr)
        ok += 1
        if i != len(keys) - 1:
            time.sleep(args.delay)
    print(f"\nDone: {ok} OK, {fail} failed", file=sys.stderr)
    sys.exit(0 if fail == 0 else 1)


if __name__ == "__main__":
    main()
