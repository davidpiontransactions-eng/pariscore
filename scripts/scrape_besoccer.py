#!/usr/bin/env python3
"""
scripts/scrape_besoccer.py — Scraper stealth BeSoccer (Camoufox/Scrapling).

Extrait les données structurées des 4 pages match BeSoccer :
  - /match/{id}/{slug}/analyse  → probabilités, H2H, séries
  - /match/{id}/{slug}/          → enjeux, faits marquants
  - /match/{id}/{slug}/compos     → 11 probables/officiels, schéma, notes, absents
  - /match/{id}/{slug}/infos-match/ → arbitre, cartons, stade, météo

Usage :
  python scripts/scrape_besoccer.py --ids 123456,789012 --limit 10
  python scripts/scrape_besoccer.py --dry-run

Dépendance : pip install "scrapling[camoufox]"
Sortie : data/besoccer/{matchId}.json (consommé par scripts/sync-besoccer-db.ts)
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "data" / "besoccer"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
BESOCCER_BASE = "https://www.besoccer.com/match"

_stealth_fetcher = None


def get_fetcher():
    global _stealth_fetcher
    if _stealth_fetcher is not None:
        return _stealth_fetcher
    try:
        from scrapling.fetchers import StealthyFetcher
    except ImportError:
        sys.exit("scrapling non installé. Installer : pip install 'scrapling[camoufox]'")
    _stealth_fetcher = StealthyFetcher
    return _stealth_fetcher


def stealth_get(url: str, timeout: int = 90) -> dict:
    result = {"url": url, "ok": False, "status": None, "html": "", "elapsed": 0, "error": None}
    Fetcher = get_fetcher()
    t0 = time.time()
    try:
        page = Fetcher.fetch(
            url, headless=True, humanize=True, os_randomize=True,
            solve_cloudflare=True, network_idle=True, wait_selector="body", timeout=timeout,
        )
        result["elapsed"] = round(time.time() - t0, 1)
        result["status"] = getattr(page, "status", None)
        if result["status"] != 200:
            result["error"] = f"HTTP {result['status']}"
            return result
        result["html"] = getattr(page, "html", "") or getattr(page, "content", "") or str(page)
        result["ok"] = True
    except Exception as e:
        result["elapsed"] = round(time.time() - t0, 1)
        result["error"] = f"{type(e).__name__}: {e}"
    return result


def _clean(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def _first(*patterns, html=None, flags=re.I):
    if html is None:
        return None
    for pat in patterns:
        m = re.search(pat, html, flags)
        if m:
            return m.group(1).strip()
    return None


def parse_analyse(html: str) -> dict:
    """Extrait probabilités, H2H, séries depuis la page analyse."""
    out = {"probabilities": {}, "h2h": [], "streaks": {}}
    for label, pats in [
        ("home_win", [r'home.*?(\d+(?:\.\d+)?)\s*%']),
        ("draw", [r'draw.*?(\d+(?:\.\d+)?)\s*%']),
        ("away_win", [r'away.*?(\d+(?:\.\d+)?)\s*%']),
        ("over_25", [r'over\s*2\.5.*?(\d+(?:\.\d+)?)\s*%']),
        ("btts_yes", [r'btts.*?yes.*?(\d+(?:\.\d+)?)\s*%']),
    ]:
        val = _first(*pats, html=html)
        if val:
            out["probabilities"][label] = float(val)
    h2h = re.findall(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}).*?(\d+)\s*[-–]\s*(\d+)', html)
    for date, g1, g2 in h2h[:10]:
        out["h2h"].append({"date": date, "home_goals": int(g1), "away_goals": int(g2)})
    for key, pat in [
        ("home_wins_streak", r'home.*?(\d+)\s*(?:wins?|victories?)\s*in\s*a\s*row'),
        ("away_wins_streak", r'away.*?(\d+)\s*(?:wins?|victories?)\s*in\s*a\s*row'),
        ("home_unbeaten", r'home.*?(\d+)\s*matches?\s*without\s*losing'),
    ]:
        m = re.search(pat, html, re.I)
        if m:
            out["streaks"][key] = int(m.group(1))
    return out


def parse_prematch(html: str) -> dict:
    """Extrait enjeux, faits marquants, dynamique."""
    out = {"context": "", "key_facts": [], "momentum": {}}
    m = re.search(r'<p[^>]*>([^<]{40,500})</p>', html, re.I)
    if m:
        out["context"] = _clean(re.sub(r"<[^>]+>", "", m.group(1)))
    facts = re.findall(r'<li[^>]*>([^<]{10,200})</li>', html, re.I)
    out["key_facts"] = [_clean(re.sub(r"<[^>]+>", "", f)) for f in facts[:8] if _clean(f)]
    return out


def parse_lineups(html: str) -> dict:
    """Extrait les 11 probables/officiels, schéma tactique, notes, absences."""
    out = {"formation_home": None, "formation_away": None, "home": [], "away": [], "absents": []}
    formations = re.findall(r'(\d-\d-\d(?:-\d)?)', html)
    if len(formations) >= 2:
        out["formation_home"] = formations[0]
        out["formation_away"] = formations[1]
    player_names = re.findall(r'data-player="([^"]+)"', html)
    player_ratings = re.findall(r'data-rating="([\d.]+)"', html)
    players = []
    for i, name in enumerate(player_names[:22]):
        rating = float(player_ratings[i]) if i < len(player_ratings) else None
        players.append({"player": _clean(name), "rating": rating})
    mid = len(players) // 2
    out["home"] = players[:mid]
    out["away"] = players[mid:]
    absents = re.findall(r'class="[^"]*(?:absent|injured|suspended)[^"]*"[^>]*>([^<]+)', html, re.I)
    out["absents"] = [_clean(a) for a in absents[:10]]
    return out


def parse_infos(html: str) -> dict:
    """Extrait arbitre, cartons moyens, stade, météo."""
    out = {"referee": None, "referee_yellow_avg": None, "referee_red_avg": None, "stadium": None, "weather": None}
    out["referee"] = _first(r'referee.*?>([^<]{3,60})<', r'(?:arbitre|referee)[^<]*</[^>]+>\s*<[^>]*>([^<]+)<', html=html)
    yellow = _first(r'yellow.*?(\d+\.\d+)', r'jaunes?\s*:\s*(\d+\.\d+)', html=html)
    red = _first(r'red.*?(\d+\.\d+)', r'rouges?\s*:\s*(\d+\.\d+)', html=html)
    if yellow:
        out["referee_yellow_avg"] = float(yellow)
    if red:
        out["referee_red_avg"] = float(red)
    out["stadium"] = _first(r'stadium.*?>([^<]{3,80})<', r'stade[^<]*</[^>]+>\s*<[^>]*>([^<]+)<', html=html)
    weather_match = re.search(r'(?:weather|meteo|conditions?)[^<]*</[^>]+>\s*<[^>]*>([^<]{2,40})<', html, re.I)
    if weather_match:
        out["weather"] = _clean(weather_match.group(1))
    return out


def scrape_match(match_id: str, slug: str = "match") -> dict:
    """Scrape les 4 pages d'un match et retourne le JSON structuré."""
    base = f"{BESOCCER_BASE}/{match_id}/{slug}"
    result = {
        "match_id": match_id,
        "slug": slug,
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "urls": {
            "analyse": f"{base}/analyse",
            "summary": base,
            "lineups": f"{base}/compos",
            "infos": f"{base}/infos-match",
        },
        "analysis": {},
        "prematch": {},
        "lineups": {},
        "conditions": {},
        "errors": [],
    }
    r = stealth_get(result["urls"]["analyse"])
    if r["ok"]:
        result["analysis"] = parse_analyse(r["html"])
    else:
        result["errors"].append(f"analyse: {r['error']}")
    r = stealth_get(result["urls"]["summary"])
    if r["ok"]:
        result["prematch"] = parse_prematch(r["html"])
    else:
        result["errors"].append(f"summary: {r['error']}")
    r = stealth_get(result["urls"]["lineups"])
    if r["ok"]:
        result["lineups"] = parse_lineups(r["html"])
    else:
        result["errors"].append(f"lineups: {r['error']}")
    r = stealth_get(result["urls"]["infos"])
    if r["ok"]:
        result["conditions"] = parse_infos(r["html"])
    else:
        result["errors"].append(f"infos: {r['error']}")
    return result


def main():
    parser = argparse.ArgumentParser(description="Scraper BeSoccer stealth (Camoufox)")
    parser.add_argument("--ids", help="IDs de matchs séparés par des virgules")
    parser.add_argument("--limit", type=int, default=5, help="Limite de matchs (défaut 5)")
    parser.add_argument("--slug", default="match", help="Slug URL (défaut 'match')")
    parser.add_argument("--dry-run", action="store_true", help="Affiche le JSON sans écrire")
    parser.add_argument("--url", help="URL directe d'un match (override --ids)")
    args = parser.parse_args()
    results = []
    if args.url:
        m = re.search(r"/match/(\d+)", args.url)
        if not m:
            sys.exit(f"ID introuvable dans l'URL : {args.url}")
        results.append(scrape_match(m.group(1), args.slug))
    elif args.ids:
        ids = [i.strip() for i in args.ids.split(",") if i.strip()]
        for mid in ids[: args.limit]:
            print(f"[scrape_besoccer] Match {mid} ...", file=sys.stderr)
            results.append(scrape_match(mid, args.slug))
            if len(results) < len(ids):
                time.sleep(1.5)
    else:
        print("[scrape_besoccer] Aucun ID fourni. Utiliser --ids ou --url.", file=sys.stderr)
        sys.exit(1)
    for data in results:
        mid = data["match_id"]
        if args.dry_run:
            print(json.dumps(data, ensure_ascii=False, indent=2))
        else:
            out_path = OUTPUT_DIR / f"{mid}.json"
            out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  -> {out_path}", file=sys.stderr)
    print(f"[scrape_besoccer] Termine : {len(results)} match(s).", file=sys.stderr)


if __name__ == "__main__":
    main()

