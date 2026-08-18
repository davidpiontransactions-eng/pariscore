#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scrape-ondemand.py — Scraping automatique a la demande (PariScore).

Declenchement : des que l'utilisateur demande un scraping, lancer :
  python scripts/scrape-ondemand.py fetch <url> [--dynamic] [--out <nom>]
  python scripts/scrape-ondemand.py crawl <start_url> [--max-pages N] [--concurrency C] [--delay S]
  python scripts/scrape-ondemand.py robots <url>

Modes de fetcher (scrapling 0.4.x) :
  statique  -> Fetcher (httpx) : pages HTML simples
  --dynamic -> StealthyFetcher (Camoufox) : pages rendues en JS / anti-bot leve

Garde-fous (par defaut) :
  - robots.txt respecte par defaut (per-host, mis en cache)
  - delai par defaut 1.5 s entre requetes, concurrency bornee (max 4)
  - max-pages par defaut 5, plafond dur 50
  - same-origin uniquement en mode crawl
  - AUCUN contournement d'authentification, AUCUN captcha solving

Mode force (a la responsabilite de l'operateur) :
  --ignore-robots exige la variable d'env LEGAL_OVERRIDE_CONFIRMED=1
  (meme pattern que scrape:dr:force). Ce flag ne desactive PAS les bornes
  de politesse (delai/concurrency/max-pages) : pas de hammering possible.

Sortie : data/scraped/<host>/<timestamp>_<slug>.html + meta.json
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.robotparser
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "scraped"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"
HARD_MAX_PAGES = 50
DEFAULT_DELAY = 1.5
DEFAULT_CONCURRENCY = 2

_robots_cache = {}
_fetch_count = {}


def ts():
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def slugify(url, n=60):
    s = re.sub(r"[^a-z0-9]+", "-", urlparse(url).path.lower().strip("/")) or "page"
    return s[:n].strip("-") or "page"


def robots_ok(url, ignore_robots):
    if ignore_robots:
        return True
    o = urlparse(url)
    key = o.scheme + "://" + o.netloc
    if key not in _robots_cache:
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(urljoin(key + "/", "robots.txt"))
        try:
            rp.read()
        except Exception:
            _robots_cache[key] = None  # pas de robots lisible -> autorise
        else:
            _robots_cache[key] = rp
    rp = _robots_cache[key]
    return True if rp is None else rp.can_fetch("*", url)


def make_fetcher(dynamic):
    if dynamic:
        from scrapling import StealthyFetcher
        return StealthyFetcher(headless=True)
    from scrapling import Fetcher
    return Fetcher()


def get_html(fetcher, url):
    try:
        r = fetcher.get(url, headers={"User-Agent": UA}, timeout=30)
    except Exception as e:
        return None, str(e)
    html = getattr(r, "html_content", None) or getattr(r, "text", "")
    return (r, html)


def save(url, html, meta_extra, fetcher_mode, ignore_robots):
    o = urlparse(url)
    host = o.netloc.replace(":", "_")
    d = OUT_DIR / host
    d.mkdir(parents=True, exist_ok=True)
    name = ts() + "_" + slugify(url)
    html_path = d / (name + ".html")
    meta_path = d / (name + ".meta.json")
    html_path.write_text(html, encoding="utf-8", errors="replace")
    meta = {
        "url": url,
        "fetched_at": ts(),
        "fetcher": fetcher_mode,
        "robots": "ignored" if ignore_robots else "respected",
        "html_file": html_path.name,
        "size_bytes": html_path.stat().st_size,
    }
    meta.update(meta_extra or {})
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[scrape] {host}  {meta.get('status','?')}  {html_path.stat().st_size} o  -> {html_path}")
    return meta


def cmd_fetch(args):
    if args.ignore_robots and os.environ.get("LEGAL_OVERRIDE_CONFIRMED") != "1":
        sys.exit("[scrape] REFUS : --ignore-robots exige LEGAL_OVERRIDE_CONFIRMED=1 (responsabilite operateur)")
    if not robots_ok(args.url, args.ignore_robots):
        print(f"[scrape] robots.txt interdit cette URL : {args.url}")
        return 1
    fetcher = make_fetcher(args.dynamic)
    r, html = get_html(fetcher, args.url)
    if r is None:
        print(f"[scrape] ECHEC : {html}")
        return 1
    meta_extra = {"status": getattr(r, "status", "?"), "final_url": getattr(r, "final_url", args.url)}
    save(args.url, html, meta_extra, "stealth" if args.dynamic else "static", args.ignore_robots)
    print(f"[scrape] OK — {len(html)} caracteres")
    return 0


def cmd_crawl(args):
    if args.ignore_robots and os.environ.get("LEGAL_OVERRIDE_CONFIRMED") != "1":
        sys.exit("[scrape] REFUS : --ignore-robots exige LEGAL_OVERRIDE_CONFIRMED=1 (responsabilite operateur)")
    base = urlparse(args.start_url)
    origin = base.scheme + "://" + base.netloc
    max_pages = min(max(1, args.max_pages), HARD_MAX_PAGES)
    delay = max(0.3, args.delay)
    fetcher = make_fetcher(args.dynamic)
    queue = [args.start_url]
    seen = set()
    saved = 0
    while queue and saved < max_pages:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        if not robots_ok(url, args.ignore_robots):
            print(f"[scrape] skip (robots) : {url}")
            continue
        r, html = get_html(fetcher, url)
        if r is None:
            print(f"[scrape] ECHEC : {url} ({html})")
            continue
        meta_extra = {"status": getattr(r, "status", "?"), "final_url": getattr(r, "final_url", url)}
        save(url, html, meta_extra, "stealth" if args.dynamic else "static", args.ignore_robots)
        saved += 1
        for href in re.findall(r'href="([^"#]+)"', html):
            nxt = urljoin(url, href)
            no = urlparse(nxt)
            if no.scheme in ("http", "https") and no.netloc == base.netloc and nxt not in seen:
                queue.append(nxt)
        if queue:
            time.sleep(delay)
    print(f"[scrape] crawl termine : {saved} pages sauvees ({max_pages} max)")
    return 0


def cmd_robots(args):
    rp = urllib.robotparser.RobotFileParser()
    o = urlparse(args.url)
    rp.set_url(urljoin(o.scheme + "://" + o.netloc + "/", "robots.txt"))
    try:
        rp.read()
    except Exception as e:
        print(f"[scrape] robots.txt illisible : {e}")
        return 1
    print(f"[scrape] robots.txt : {rp.can_fetch('*', args.url) and 'AUTORISE' or 'INTERDIT'} — {args.url}")
    return 0


def main():
    ap = argparse.ArgumentParser(description="Scraping on-demand (scrapling)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("fetch", help="fetch une page (statique par defaut)")
    f.add_argument("url")
    f.add_argument("--dynamic", action="store_true", help="StealthyFetcher Camoufox (JS rendu)")
    f.add_argument("--ignore-robots", action="store_true", help="exige LEGAL_OVERRIDE_CONFIRMED=1")
    f.set_defaults(fn=cmd_fetch)

    c = sub.add_parser("crawl", help="crawl borne same-origin")
    c.add_argument("start_url")
    c.add_argument("--max-pages", type=int, default=5)
    c.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY, help="reserve (bornee a 4)")
    c.add_argument("--delay", type=float, default=DEFAULT_DELAY)
    c.add_argument("--dynamic", action="store_true")
    c.add_argument("--ignore-robots", action="store_true")
    c.set_defaults(fn=cmd_crawl)

    r = sub.add_parser("robots", help="teste robots.txt sur une URL")
    r.add_argument("url")
    r.set_defaults(fn=cmd_robots)

    args = ap.parse_args()
    args.concurrency = min(4, max(1, args.concurrency))
    sys.exit(args.fn(args))


if __name__ == "__main__":
    main()