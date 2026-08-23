#!/usr/bin/env python3
"""
scrape_betmines.py — Scraping multi-ligues de betmines.com (Cloudflare inclus).

Stratégie :
  1. Une session Camoufox (StealthySession) résout le challenge Turnstile UNE fois.
  2. Navigue ensuite de ligue en ligue dans le même contexte navigateur —
     le clearance persiste, plus de challenge (~25-45 s/page, payload ~2 Mo).
  3. Le payload __NUXT__ est évalué par scripts/betmines_extract.cjs (Node)
     et réduit à un JSON compact par ligue → public/data/betmines/{id}.json.

Reprise : les ligues déjà présentes en sortie sont ignorées sauf --force.
Politesse : délai + jitter entre pages ; un seul onglet, pas de parallélisme.

USAGE:
    python scripts/scrape_betmines.py --all                 # catalogue complet
    python scripts/scrape_betmines.py --limit 20            # batch de test
    python scripts/scrape_betmines.py --ids 301,8,564       # ligues précises
"""

import sys, os, json, time, random, argparse, subprocess, tempfile
from datetime import datetime, timezone
from typing import Optional

try:
    from scrapling.fetchers import StealthySession
except ImportError as e:
    print(f"Deps missing: {e}", file=sys.stderr)
    sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOG = os.path.join(HERE, "..", "data", "betmines-leagues-all.txt")
OUT_DIR = os.path.join(HERE, "..", "public", "data", "betmines")
EXTRACT_CJS = os.path.join(HERE, "betmines_extract.cjs")


def load_catalog() -> list[tuple[int, str]]:
    rows = []
    with open(CATALOG, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or "\t" not in line:
                continue
            lid, slug = line.split("\t", 1)
            rows.append((int(lid), slug))
    return rows


def extract(html: str, league_id: int, slug: str) -> Optional[dict]:
    """Évalue window.__NUXT__ via Node puis réduit au compact."""
    start = html.find("window.__NUXT__=")
    if start < 0:
        return None
    end = html.find("</script>", start)
    expr = html[start + len("window.__NUXT__=") : end].strip().rstrip(";")

    tmp_dir = tempfile.mkdtemp(prefix="betmines-")
    try:
        # Évaluer l'expression Nuxt2 dans Node — via fichier (l'expr fait
        # ~275 Ko, trop longue pour la ligne de commande Windows).
        eval_path = os.path.join(tmp_dir, "eval.cjs")
        with open(eval_path, "w", encoding="utf-8") as f:
            f.write(
                "const vm=require('vm'),fs=require('fs');\n"
                f"const val=vm.runInNewContext({json.dumps(expr)},{{}},{{timeout:15000}});\n"
                f"fs.writeFileSync({json.dumps(os.path.join(tmp_dir, 'payload.json'))},JSON.stringify(val));\n"
            )
        r = subprocess.run(
            ["node", eval_path], capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=30,
        )
        if r.returncode != 0:
            return None
        payload_path = os.path.join(tmp_dir, "payload.json")
        if not os.path.exists(payload_path):
            return None

        # Réduction compacte
        r2 = subprocess.run(
            ["node", EXTRACT_CJS, payload_path, str(league_id), slug],
            capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=30,
        )
        if r2.returncode != 0:
            return None
        return json.loads(r2.stdout)
    except json.JSONDecodeError:
        return None
    finally:
        try:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


def main():
    ap = argparse.ArgumentParser(description="BetMines leagues scraper")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--ids", type=str, help="IDs séparés par des virgules")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true", help="re-scrape même si présent")
    ap.add_argument("--delay", type=float, default=1.5)
    ap.add_argument("--out-dir", type=str, default=OUT_DIR)
    args = ap.parse_args()

    catalog = load_catalog()
    if not catalog:
        print("Catalogue vide — lance probe_bm_sitemap4.py d'abord.", file=sys.stderr)
        sys.exit(1)

    if args.ids:
        wanted = {int(x) for x in args.ids.split(",")}
        targets = [(i, s) for i, s in catalog if i in wanted]
    elif args.all:
        targets = catalog
    else:
        print("Use --all, --ids ou --limit", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.out_dir, exist_ok=True)

    # Reprise : skip existants
    todo = []
    for lid, slug in targets:
        out_path = os.path.join(args.out_dir, f"{lid}.json")
        if not args.force and os.path.exists(out_path):
            continue
        todo.append((lid, slug))
    if args.limit and args.limit > 0:
        todo = todo[: args.limit]

    total, done, fail = len(todo), 0, 0
    print(f"[betmines] {total} ligues à scraper ({len(targets) - total} déjà présentes)", file=sys.stderr)
    t_start = time.time()

    with StealthySession(headless=True, solve_cloudflare=True) as sess:
        for n, (lid, slug) in enumerate(todo, 1):
            # le slug du catalogue contient déjà « pronostics- »
            page_slug = slug if slug.startswith("pronostics-") else f"pronostics-{slug}"
            url = f"https://betmines.com/fr/ligue/{page_slug}_{lid}"
            t0 = time.time()
            try:
                page = sess.fetch(url)
                if page.status != 200:
                    raise RuntimeError(f"HTTP {page.status}")
                data = extract(page.html_content, lid, slug)
                if not data:
                    raise RuntimeError("extraction vide")
                data["scrapedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
                out_path = os.path.join(args.out_dir, f"{lid}.json")
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
                done += 1
                eta = (time.time() - t_start) / done * (total - done) / 60
                print(f"[{n}/{total}] {lid} {data.get('name') or slug}: "
                      f"{data['nFixtures']} fixtures ({time.time()-t0:.0f}s, ETA {eta:.0f} min)", flush=True)
            except Exception as e:
                fail += 1
                print(f"[{n}/{total}] {lid} FAIL: {str(e)[:90]}", flush=True)
                # trop d'échecs consécutifs → la session est peut-être morte
                if fail >= 8 and done == 0:
                    print("Abandon: session inutilisable.", file=sys.stderr)
                    break
            time.sleep(args.delay + random.uniform(0, 1.0))

    print(f"\nTerminé: {done} OK, {fail} échecs, {total - done - fail} restants "
          f"({(time.time()-t_start)/60:.0f} min)", file=sys.stderr)


if __name__ == "__main__":
    main()
