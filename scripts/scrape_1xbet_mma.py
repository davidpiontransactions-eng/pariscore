#!/usr/bin/env python3
"""
scrape_1xbet_mma.py — Scraper 1xBet.rs MMA (nécessite VPN Serbie)

Architecture identique à scrape_betmines.py :
- StealthySession (Camoufox) pour contourner Cloudflare
- Extraction __NUXT__ via Node (betmines_extract.cjs adapté)
- Sortie compacte JSON → data/odds_1xbet_mma.json

USAGE:
    python scripts/scrape_1xbet_mma.py --all              # catalogue complet
    python scripts/scrape_1xbet_mma.py --limit 20         # batch test
    python scripts/scrape_1xbet_mma.py --ids 1,2,3        # ligues précises

REQUIS:
    - VPN Serbie ACTIF (1xBet.rs bloque hors Serbie)
    - scrapling[fetchers] + Camoufox installé
    - Node.js pour l'extraction __NUXT__
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
OUT_FILE = os.path.join(HERE, "..", "data", "odds_1xbet_mma.json")
EXTRACT_CJS = os.path.join(HERE, "1xbet_extract.cjs")

# ─── Configuration 1xBet MMA ─────────────────────────────────────────────────
# URLs à adapter selon la structure réelle du site 1xBet.rs
# Basé sur l'ancien JSON : league_id 3015965, 3017306, 3003541, 3010429, 3020229, 1826608
BASE_URL = "https://1xbet.rs"
MMA_LEAGUES = [
    {"id": 3015965, "slug": "ufc-fight-night", "name": "UFC Fight Night"},
    {"id": 3017306, "slug": "ufc-fight-night-2", "name": "UFC Fight Night"},
    {"id": 3003541, "slug": "ufc-329", "name": "UFC 329"},
    {"id": 3010429, "slug": "ufc-fight-night-3", "name": "UFC Fight Night"},
    {"id": 3020229, "slug": "ufc-330", "name": "UFC 330"},
    {"id": 1826608, "slug": "prospective-fights", "name": "Prospective fights"},
]

# ─── Utilitaires ──────────────────────────────────────────────────────────────

def build_league_url(league: Dict) -> str:
    """Construit l'URL de la ligue MMA sur 1xBet.rs"""
    # À adapter selon la vraie structure d'URL
    return f"{BASE_URL}/line/{league['slug']}/"

def extract_nuxt(html: str) -> Optional[Dict]:
    """Évalue window.__NUXT__ via Node (même méthode que betmines)"""
    start = html.find("window.__NUXT__=")
    if start < 0:
        # Fallback: chercher dans <script id="__NEXT_DATA__"> (Next.js)
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

    tmp_dir = tempfile.mkdtemp(prefix="1xbet-")
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

def extract_fights_from_nuxt(nuxt_data: Dict) -> List[Dict]:
    """
    Extrait les combats MMA depuis la structure __NUXT__ de 1xBet.
    À ADAPTER selon la vraie structure de données retournée.
    """
    fights = []
    try:
        # Structure typique Nuxt 1xBet : nuxt_data.state.lineData ou similaire
        # L'ancien JSON avait : game_id, event_name, league_id, fighter1, fighter2, odds_f1, odds_f2, start_time
        
        # Exploration défensive de la structure
        state = nuxt_data.get("state") or nuxt_data.get("data") or {}
        line_data = state.get("lineData") or state.get("sports") or {}
        
        # Parcourir les ligues connues
        for league in MMA_LEAGUES:
            league_id = str(league["id"])
            league_events = line_data.get(league_id) or line_data.get(league["slug"]) or {}
            
            if isinstance(league_events, dict):
                events = league_events.get("events") or league_events.get("champs") or []
            elif isinstance(league_events, list):
                events = league_events
            else:
                continue
            
            for ev in events:
                if not isinstance(ev, dict):
                    continue
                
                # Extraction défensive des champs
                game_id = ev.get("id") or ev.get("game_id") or ev.get("gameId")
                fighter1 = ev.get("name1") or ev.get("team1") or ev.get("player1") or ev.get("fighter1")
                fighter2 = ev.get("name2") or ev.get("team2") or ev.get("player2") or ev.get("fighter2")
                odds_f1 = ev.get("coeff1") or ev.get("odds1") or ev.get("odd1") or ev.get("c1")
                odds_f2 = ev.get("coeff2") or ev.get("odds2") or ev.get("odd2") or ev.get("c2")
                start_time = ev.get("start_time") or ev.get("startTime") or ev.get("date") or ev.get("ts")
                event_name = ev.get("champ_name") or ev.get("league_name") or league["name"]
                
                if not all([game_id, fighter1, fighter2, odds_f1, odds_f2, start_time]):
                    continue
                
                # Normalisation timestamp
                try:
                    ts = int(start_time)
                    if ts < 1e11:  # secondes → millisecondes
                        ts = ts * 1000
                    dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
                    if dt < datetime.now(timezone.utc):
                        continue  # skip passé
                except Exception:
                    continue
                
                fights.append({
                    "game_id": int(game_id),
                    "event_name": str(event_name).strip(),
                    "league_id": league["id"],
                    "fighter1": str(fighter1).strip(),
                    "fighter2": str(fighter2).strip(),
                    "odds_f1": float(odds_f1),
                    "odds_f2": float(odds_f2),
                    "start_time": int(start_time),  # secondes Unix
                })
    except Exception as e:
        print(f"[extract_fights] Error: {e}", file=sys.stderr)
    
    return fights

# ─── Scraper Principal ────────────────────────────────────────────────────────

def scrape_league(session: StealthySession, league: Dict, delay: float) -> List[Dict]:
    """Scrape une ligue MMA unique"""
    url = build_league_url(league)
    print(f"[1xBet] Scraping {league['name']} ({league['id']}) → {url}")
    
    try:
        # Navigation avec StealthySession (gère Cloudflare automatiquement)
        resp = session.get(url, timeout=30)
        if not resp or resp.status_code != 200:
            print(f"[1xBet] HTTP {resp.status_code if resp else 'None'} for {league['slug']}", file=sys.stderr)
            return []
        
        html = resp.text
        if not html or len(html) < 1000:
            print(f"[1xBet] Empty/small response for {league['slug']}", file=sys.stderr)
            return []
        
        # Extraction __NUXT__
        nuxt = extract_nuxt(html)
        if not nuxt:
            print(f"[1xBet] No __NUXT__ data for {league['slug']}", file=sys.stderr)
            return []
        
        fights = extract_fights_from_nuxt(nuxt)
        print(f"[1xBet] {league['name']}: {len(fights)} fights extracted")
        return fights
    
    except Exception as e:
        print(f"[1xBet] Error scraping {league['slug']}: {e}", file=sys.stderr)
        return []

def main():
    ap = argparse.ArgumentParser(description="1xBet.rs MMA Scraper (VPN Serbie requis)")
    ap.add_argument("--all", action="store_true", help="Toutes les ligues")
    ap.add_argument("--ids", type=str, help="IDs de ligues séparés par virgules")
    ap.add_argument("--limit", type=int, default=0, help="Limiter le nombre de ligues")
    ap.add_argument("--delay", type=float, default=2.0, help="Délai entre ligues (s)")
    ap.add_argument("--out", type=str, default=OUT_FILE, help="Fichier de sortie JSON")
    ap.add_argument("--force", action="store_true", help="Ignorer le cache local")
    args = ap.parse_args()

    # Sélection des ligues
    if args.ids:
        wanted = {int(x) for x in args.ids.split(",")}
        targets = [l for l in MMA_LEAGUES if l["id"] in wanted]
    elif args.all:
        targets = MMA_LEAGUES
    else:
        print("Usage: --all, --ids ou --limit", file=sys.stderr)
        sys.exit(1)

    if args.limit:
        targets = targets[:args.limit]

    print(f"[1xBet] Cible: {len(targets)} ligues MMA")
    print(f"[1xBet] ⚠️  VPN SERBIE REQUIS - Assurez-vous que votre IP est en Serbie")

    # Session Camoufox (StealthySession)
    session = StealthySession()
    
    all_fights = []
    scraped_at = datetime.now(timezone.utc).isoformat()

    try:
        for i, league in enumerate(targets):
            if i > 0:
                time.sleep(args.delay + random.uniform(0, 1))
            
            fights = scrape_league(session, league, args.delay)
            all_fights.extend(fights)
    
    finally:
        session.close()

    # Déduplication par game_id
    seen = set()
    unique_fights = []
    for f in all_fights:
        gid = f["game_id"]
        if gid not in seen:
            seen.add(gid)
            unique_fights.append(f)

    # Tri par date
    unique_fights.sort(key=lambda x: x["start_time"])

    # Sauvegarde
    output = {
        "scraped_at": scraped_at,
        "sport": "UFC",
        "source": "1xBet.rs (via VPN Serbie)",
        "fights_count": len(unique_fights),
        "fights": unique_fights
    }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"[1xBet] ✅ Terminé: {len(unique_fights)} combats uniques → {args.out}")

if __name__ == "__main__":
    main()