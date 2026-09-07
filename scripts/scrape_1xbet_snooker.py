#!/usr/bin/env python3
"""
scrape_1xbet_snooker.py — Scraper 1xBet/1xWin Snooker matches + cotes

Architecture identique à scrape_1xbet_mma.py :
- StealthySession (Camoufox) pour contourner Cloudflare
- Extraction __NUXT__ via Node (1xbet_extract.cjs adapté)
- Sortie compacte JSON → data/odds_1xbet_snooker.json

USAGE:
    python scripts/scrape_1xbet_snooker.py              # toutes les pages snooker
    python scripts/scrape_1xbet_snooker.py --limit 5    # batch test
    python scripts/scrape_1xbet_snooker.py --dry-run    # affiche sans sauvegarder

REQUIS:
    - scrapling[fetchers] + Camoufox installé
    - Node.js pour l'extraction __NUXT__
    - VPN si 1xbet bloque votre IP (selon région)
"""

import sys, os, json, time, random, argparse, subprocess, tempfile
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

try:
    from scrapling.fetchers import StealthySession
except ImportError as e:
    print(f"Deps missing: {e}", file=sys.stderr)
    sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_FILE = os.path.join(HERE, "..", "data", "odds_1xbet_snooker.json")
EXTRACT_CJS = os.path.join(HERE, "1xbet_extract.cjs")

# ─── Configuration 1xBet Snooker ────────────────────────────────────────────
# 1xbet structure : /line/snooker/ → pages par tournoi
# Les league IDs seront découverts dynamiquement depuis la page principale.
BASE_URLS = [
    "https://1xbet.rs",      # Serbie (VPN requis)
    "https://1xwin.com",     # 1xWin (alternative)
    "https://1xbet.com",     # International
]

SNOOKER_LINE_URL = "/line/snooker/"

# ─── Utilitaires ──────────────────────────────────────────────────────────────

def extract_nuxt(html: str) -> Optional[Dict]:
    """Évalue window.__NUXT__ via Node (même méthode que betmines/mma)"""
    start = html.find("window.__NUXT__=")
    if start < 0:
        start = html.find('id="__NEXT_DATA__"')
        if start >= 0:
            start = html.find(">{", start)
            if start >= 0:
                end = html.find("</script>", start)
                expr = html[start+1:end].strip()
            else:
                return None
        else:
            return None
    else:
        end = html.find("</script>", start)
        expr = html[start + len("window.__NUXT__=") : end].strip().rstrip(";")

    tmp_dir = tempfile.mkdtemp(prefix="1xbet-snooker-")
    try:
        eval_path = os.path.join(tmp_dir, "eval.cjs")
        with open(eval_path, "w", encoding="utf-8") as f:
            f.write(
                "const vm=require('vm'),fs=require('fs');\n"
                f"const val=vm.runInNewContext({json.dumps(expr)},{{}},{{timeout:15000}});\n"
                f"fs.writeFileSync({json.dumps(os.path.join(tmp_dir, 'payload.json'))},JSON.stringify(val));\n"
            )
        r = subprocess.run(
            ["node", eval_path],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30
        )
        if r.returncode != 0:
            print(f"[extract] Node error: {r.stderr[:200]}", file=sys.stderr)
            return None
        payload_path = os.path.join(tmp_dir, "payload.json")
        if not os.path.exists(payload_path):
            return None
        with open(payload_path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[extract] Error: {e}", file=sys.stderr)
        return None
    finally:
        try:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


def discover_snooker_leagues(nuxt_data: Dict) -> List[Dict]:
    """
    Découvre dynamiquement les ligues/tournois snooker depuis __NUXT__.
    Retourne [{id, slug, name}] pour chaque tournoi trouvé.
    """
    leagues = []
    state = nuxt_data.get("state") or nuxt_data.get("data") or {}
    line_data = state.get("lineData") or state.get("sports") or {}

    # Parcourir toutes les clés numériques (league IDs)
    for key, val in line_data.items():
        if not isinstance(val, dict):
            continue
        # Extraire le nom de la ligue
        name = val.get("name") or val.get("champ_name") or val.get("leagueName") or ""
        slug = val.get("slug") or val.get("alias") or ""
        events = val.get("events") or val.get("champs") or []

        if events and name:
            leagues.append({
                "id": key,
                "slug": slug,
                "name": str(name).strip(),
                "events_count": len(events) if isinstance(events, list) else 0,
            })

    return leagues


def extract_matches_from_nuxt(nuxt_data: Dict, source_url: str) -> List[Dict]:
    """
    Extrait les matchs snooker depuis la structure __NUXT__ de 1xBet.
    Retourne une liste de matchs normalisés.
    """
    matches = []
    state = nuxt_data.get("state") or nuxt_data.get("data") or {}
    line_data = state.get("lineData") or state.get("sports") or {}

    for league_key, league_val in line_data.items():
        if not isinstance(league_val, dict):
            continue

        league_name = league_val.get("name") or league_val.get("champ_name") or "Snooker"
        events = league_val.get("events") or league_val.get("champs") or []

        if not isinstance(events, list):
            continue

        for ev in events:
            if not isinstance(ev, dict):
                continue

            # Extraction défensive des champs (pattern 1xbet)
            game_id = ev.get("id") or ev.get("game_id") or ev.get("gameId")
            player1 = ev.get("name1") or ev.get("team1") or ev.get("player1")
            player2 = ev.get("name2") or ev.get("team2") or ev.get("player2")

            # Cotes 1x2 snooker (vainqueur du match)
            odds_p1 = ev.get("coeff1") or ev.get("odds1") or ev.get("odd1") or ev.get("c1")
            odds_p2 = ev.get("coeff2") or ev.get("odds2") or ev.get("odd2") or ev.get("c2")

            # Cotes additionnelles si disponibles (handicap jeux, total jeux)
            handicap = ev.get("handicap") or ev.get("hcap") or None
            total = ev.get("total") or ev.get("totals") or None

            start_time = ev.get("start_time") or ev.get("startTime") or ev.get("date") or ev.get("ts")
            tournament = ev.get("champ_name") or ev.get("league_name") or league_name
            status = ev.get("status") or ev.get("game_status") or None

            if not all([game_id, player1, player2]):
                continue

            # Normalisation timestamp
            iso_time = None
            if start_time:
                try:
                    ts = int(start_time)
                    if ts < 1e11:
                        ts = ts * 1000
                    dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
                    iso_time = dt.isoformat()
                    if dt < datetime.now(timezone.utc) and not status:
                        continue  # skip passé sauf si live
                except Exception:
                    pass

            match_data = {
                "id": str(game_id),
                "source": source_url,
                "tournament": str(tournament).strip(),
                "league_id": str(league_key),
                "player1": str(player1).strip(),
                "player2": str(player2).strip(),
                "scheduled_at": iso_time,
                "status": str(status).strip() if status else None,
            }

            # Cotes vainqueur
            if odds_p1 and odds_p2:
                match_data["odds"] = {
                    "player1": float(odds_p1),
                    "player2": float(odds_p2),
                }

            # Handicap jeux
            if handicap and isinstance(handicap, dict):
                match_data["handicap"] = {
                    "line": handicap.get("value") or handicap.get("line"),
                    "odds_p1": handicap.get("coeff1") or handicap.get("odds1"),
                    "odds_p2": handicap.get("coeff2") or handicap.get("odds2"),
                }

            # Total jeux (Over/Under)
            if total and isinstance(total, dict):
                match_data["total"] = {
                    "line": total.get("value") or total.get("line"),
                    "over_odds": total.get("coeff_over") or total.get("over"),
                    "under_odds": total.get("coeff_under") or total.get("under"),
                }

            matches.append(match_data)

    return matches


# ─── Scraper Principal ────────────────────────────────────────────────────────

def scrape_snooker_page(session: StealthySession, base_url: str, path: str, delay: float) -> List[Dict]:
    """Scrape la page snooker d'un domaine 1xbet"""
    url = f"{base_url}{path}"
    print(f"[1xBet] Scraping {url}")

    try:
        resp = session.fetch(url, timeout=30000)
        if not resp or resp.status_code != 200:
            print(f"[1xBet] HTTP {resp.status_code if resp else 'None'} for {url}", file=sys.stderr)
            return []

        html = resp.text
        if not html or len(html) < 1000:
            print(f"[1xBet] Empty/small response for {url}", file=sys.stderr)
            return []

        nuxt = extract_nuxt(html)
        if not nuxt:
            print(f"[1xBet] No __NUXT__ data for {url}", file=sys.stderr)
            return []

        # Découvrir les ligues
        leagues = discover_snooker_leagues(nuxt)
        print(f"[1xBet] {len(leagues)} tournois snooker découverts")
        for lg in leagues:
            print(f"  - {lg['name']} (id={lg['id']}, {lg['events_count']} events)")

        # Extraire tous les matchs
        matches = extract_matches_from_nuxt(nuxt, url)
        print(f"[1xBet] {len(matches)} matchs extraits depuis {url}")
        return matches

    except Exception as e:
        print(f"[1xBet] Error scraping {url}: {e}", file=sys.stderr)
        return []


def scrape_subpages(session: StealthySession, base_url: str, nuxt_data: Dict, delay: float) -> List[Dict]:
    """
    Après avoir trouvé les slugs de tournois sur la page principale,
    scrape chaque sous-page pour des données plus détaillées.
    """
    state = nuxt_data.get("state") or nuxt_data.get("data") or {}
    line_data = state.get("lineData") or state.get("sports") or {}

    all_matches = []
    for league_key, league_val in line_data.items():
        if not isinstance(league_val, dict):
            continue
        slug = league_val.get("slug") or league_val.get("alias") or ""
        name = league_val.get("name") or league_val.get("champ_name") or "Unknown"

        if slug:
            sub_url = f"/line/snooker/{slug}/"
            time.sleep(delay + random.uniform(0, 1))
            matches = scrape_snooker_page(session, base_url, sub_url, delay)
            all_matches.extend(matches)

    return all_matches


def main():
    ap = argparse.ArgumentParser(description="1xBet Snooker Scraper (matchs + cotes)")
    ap.add_argument("--limit", type=int, default=0, help="Limiter le nombre de pages")
    ap.add_argument("--delay", type=float, default=2.0, help="Délai entre requêtes (s)")
    ap.add_argument("--out", type=str, default=OUT_FILE, help="Fichier de sortie JSON")
    ap.add_argument("--dry-run", action="store_true", help="Afficher sans sauvegarder")
    ap.add_argument("--base-url", type=str, default=None, help="URL de base (défaut: 1xbet.rs)")
    ap.add_argument("--subpages", action="store_true", help="Scraper aussi les sous-pages tournois")
    args = ap.parse_args()

    base_url = args.base_url or BASE_URLS[0]
    print(f"[1xBet] Cible: {base_url}/line/snooker/")
    print(f"[1xBet] ⚠️  VPN possible selon votre région")

    session = StealthySession()
    session.start()
    all_matches = []
    scraped_at = datetime.now(timezone.utc).isoformat()

    try:
        # Page principale snooker
        matches = scrape_snooker_page(session, base_url, SNOOKER_LINE_URL, args.delay)
        all_matches.extend(matches)

        # Sous-pages tournois (optionnel)
        if args.subpages and matches:
            # Re-fetch pour obtenir les slugs
            resp = session.fetch(f"{base_url}{SNOOKER_LINE_URL}", timeout=30000)
            if resp and resp.status_code == 200:
                nuxt = extract_nuxt(resp.text)
                if nuxt:
                    sub_matches = scrape_subpages(session, base_url, nuxt, args.delay)
                    all_matches.extend(sub_matches)

    finally:
        session.close()

    # Déduplication par id
    seen = set()
    unique_matches = []
    for m in all_matches:
        mid = m["id"]
        if mid not in seen:
            seen.add(mid)
            unique_matches.append(m)

    # Tri par date
    unique_matches.sort(key=lambda x: x.get("scheduled_at") or "")

    # Stats
    with_odds = sum(1 for m in unique_matches if m.get("odds"))
    tournaments = set(m["tournament"] for m in unique_matches)

    output = {
        "scraped_at": scraped_at,
        "sport": "snooker",
        "source": base_url,
        "matches_count": len(unique_matches),
        "with_odds": with_odds,
        "tournaments": sorted(tournaments),
        "matches": unique_matches,
    }

    if args.dry_run:
        print(f"\n[DRY RUN] {len(unique_matches)} matchs, {with_odds} avec cotes")
        for m in unique_matches[:10]:
            odds_str = ""
            if m.get("odds"):
                odds_str = f"  [{m['odds']['player1']:.2f} / {m['odds']['player2']:.2f}]"
            print(f"  {m['scheduled_at'] or '?':>20}  {m['player1']} vs {m['player2']}{odds_str}  ({m['tournament']})")
        if len(unique_matches) > 10:
            print(f"  ... et {len(unique_matches) - 10} autres")
    else:
        os.makedirs(os.path.dirname(args.out), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f"[1xBet] ✅ {len(unique_matches)} matchs ({with_odds} avec cotes) → {args.out}")


if __name__ == "__main__":
    main()
