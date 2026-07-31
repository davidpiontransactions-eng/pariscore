#!/usr/bin/env python3
"""
PariScore — Scraper des leaderboards statistiques officiels ATP/WTA.

Alimente la page /tennis/stats quand les stats internes (tennis_matches_internal,
colonnes w_svpt…) ne sont pas encore peuplées (ETL Phase 4.1.1 en attente).

Sources :
  ATP  https://www.atptour.com/en/-/www/StatsLeaderboard/{board}/52week/{surface}/{vsRank}/false?v=1
       Protégé par Cloudflare → session Camoufox (Firefox stealth) : on charge
       la page leaderboard pour obtenir le clearance cookie, puis on appelle
       l'endpoint JSON dans le contexte navigateur.
       Couverture : boards serve/return/pressure, timeFrame=52week (seul dispo),
       surfaces all/hard/clay/grass, vsRank all/top10/top20.
  WTA  https://api.wtatennis.com/tennis/stats/{année}/first_serve_percent?pageSize=100&sort=desc
       Pas d'auth (headers Origin/Referer suffisent). Une seule requête renvoie
       100 joueuses avec TOUS les compteurs bruts (36 champs) → 3 boards
       calculables. Couverture : année courante (ytd), surface all, vsRank all.

Sortie :
  data/tour-leaderboards/atp.json   { tour, generatedAt, period, datasets: {"board|surface|vsRank": [...] } }
  data/tour-leaderboards/wta.json   { tour, generatedAt, year, rows: [...] }

Robustesse : si une source échoue, le cache précédent est conservé (jamais
d'écrasement par du vide). Fréquence conseillée : hebdomadaire (pm2 cron,
lundi 04h30 UTC) — ces classements évoluent lentement.

Usage : python scripts/scrape-tour-leaderboards.py [--atp-only|--wta-only] [--verbose]
Exit  : 0 = au moins une source OK · 1 = échec total
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "tour-leaderboards"

ATP_PAGE = (
    "https://www.atptour.com/en/stats/leaderboard"
    "?boardType=serve&timeFrame=52week&surface=all&versusRank=all"
)
ATP_BOARDS = ["serve", "return", "pressure"]
ATP_SURFACES = ["all", "hard", "clay", "grass"]
ATP_VSRANKS = ["all", "top10", "top20"]

WTA_URL_TPL = (
    "https://api.wtatennis.com/tennis/stats/{year}/first_serve_percent"
    "?pageSize=100&sort=desc"
)
WTA_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Origin": "https://www.wtatennis.com",
    "Referer": "https://www.wtatennis.com/",
    "Accept": "application/json",
}


def log(msg: str) -> None:
    print(f"[scrape-leaderboards] {msg}", flush=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def atomic_write(path: Path, payload: dict) -> None:
    """Écriture atomique (tmp + rename) — jamais de cache tronqué."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


def scrape_wta(verbose: bool = False) -> bool:
    year = datetime.now(timezone.utc).year
    url = WTA_URL_TPL.format(year=year)
    log(f"WTA : GET {url}")
    req = urllib.request.Request(url, headers=WTA_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            rows = json.loads(res.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        log(f"WTA : ECHEC ({type(e).__name__}: {e}) — cache conservé")
        return False
    if not isinstance(rows, list) or not rows:
        log("WTA : réponse vide/inattendue — cache conservé")
        return False
    payload = {"tour": "wta", "generatedAt": now_iso(), "year": year, "rows": rows}
    atomic_write(OUT_DIR / "wta.json", payload)
    log(f"WTA : {len(rows)} joueuses écrites (ex: {rows[0].get('First_Name', '')} "
        f"{rows[0].get('Last_Name', '')}, MatchCount={rows[0].get('MatchCount')})")
    if verbose:
        log(f"WTA champs: {sorted(rows[0].keys())}")
    return True


def scrape_atp(verbose: bool = False) -> bool:
    try:
        from camoufox.sync_api import Camoufox
    except ImportError:
        log("ATP : camoufox non installé (pip install camoufox) — source skippée")
        return False

    datasets: dict[str, list] = {}
    log("ATP : lancement Camoufox (challenge Cloudflare, 30-90s)...")
    try:
        with Camoufox(headless=True, humanize=True, i_know_what_im_doing=True) as browser:
            page = browser.new_page()
            page.goto(ATP_PAGE, wait_until="domcontentloaded", timeout=120_000)
            # Laisse le challenge Cloudflare se résoudre
            page.wait_for_timeout(12_000)

            total = len(ATP_BOARDS) * len(ATP_SURFACES) * len(ATP_VSRANKS)
            done = 0
            for board in ATP_BOARDS:
                for surface in ATP_SURFACES:
                    for vs_rank in ATP_VSRANKS:
                        url = (
                            f"/en/-/www/StatsLeaderboard/{board}/52week"
                            f"/{surface}/{vs_rank}/false?v=1"
                        )
                        done += 1
                        try:
                            res = page.evaluate(
                                """async (u) => {
                                    const r = await fetch(u, {headers: {'X-Requested-With': 'XMLHttpRequest'}});
                                    const t = await r.text();
                                    return {status: r.status, body: t};
                                }""",
                                url,
                            )
                            if res["status"] != 200:
                                log(f"ATP {board}/{surface}/{vs_rank} : HTTP {res['status']} — skip")
                                continue
                            entries = json.loads(res["body"]).get("Leaderboard", [])
                            if entries:
                                datasets[f"{board}|{surface}|{vs_rank}"] = entries
                            if verbose and done == 1:
                                log(f"ATP entry shape: {json.dumps(entries[0], ensure_ascii=False)[:600]}")
                        except Exception as e:  # noqa: BLE001
                            log(f"ATP {board}/{surface}/{vs_rank} : ECHEC ({e}) — skip")
                        # Politesse : petite pause entre appels (36 requêtes total)
                        time.sleep(0.4)
                        if done % 12 == 0:
                            log(f"ATP : {done}/{total} requêtes...")
    except Exception as e:  # noqa: BLE001
        log(f"ATP : ECHEC session navigateur ({type(e).__name__}: {e}) — cache conservé")
        return False

    if not datasets:
        log("ATP : aucun dataset collecté — cache conservé")
        return False
    payload = {
        "tour": "atp",
        "generatedAt": now_iso(),
        "period": "52week",
        "datasets": datasets,
    }
    atomic_write(OUT_DIR / "atp.json", payload)
    n_players = len(datasets.get("serve|all|all", []))
    log(f"ATP : {len(datasets)} datasets écrits ({n_players} joueurs sur serve|all|all)")
    return True


def main() -> int:
    # Console Windows (cp1252) : évite les UnicodeEncodeError sur ✓/émojis.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--atp-only", action="store_true")
    ap.add_argument("--wta-only", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    ok_atp = ok_wta = True
    if not args.atp_only:
        ok_wta = scrape_wta(args.verbose)
    if not args.wta_only:
        ok_atp = scrape_atp(args.verbose)

    if ok_atp and ok_wta:
        log("TERMINE : ATP + WTA à jour ✓")
        return 0
    if ok_atp or ok_wta:
        log("TERMINE partiel (une source en échec, cache conservé pour l'autre)")
        return 0
    log("ECHEC TOTAL : aucune source collectée, caches inchangés")
    return 1


if __name__ == "__main__":
    sys.exit(main())
