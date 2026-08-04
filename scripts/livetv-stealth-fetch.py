#!/usr/bin/env python3
"""
scripts/livetv-stealth-fetch.py — fetch stealth Camoufox (Scrapling StealthyFetcher)
pour LiveTV (livetv902.me) quand le fetch natif est bloqué (HTTP 451 / 403).

Usage CLI :
  python scripts/livetv-stealth-fetch.py <url> [--proxy <url>] [--timeout <ms>]

Sortie (stdout, JSON one-line) :
  {"ok": true, "status": 200, "url": "...", "path": "<tmp file with html>", "elapsed_ms": 1234}
  {"ok": false, "status": null, "error": "msg", "elapsed_ms": 1234}

L'HTML est écrit dans un fichier temp (jamais sur stdout) pour éviter
l'injection de contenu antisocial dans la sortie JSON du spawn Node.

Dépendances : scrapling[camoufox] (pip install "scrapling[camoufox]")
+ binaire Camoufox téléchargé via `scrapling install`.
"""

import argparse
import json
import os
import sys
import tempfile
import time


def main() -> int:
    parser = argparse.ArgumentParser(description="Stealth fetch Scrapling pour LiveTV")
    parser.add_argument("url", help="URL cible (ex: https://livetv902.me/enx/megasearch/?msq=psg)")
    parser.add_argument("--proxy", default=None, help="URL proxy (ex: http://user:pass@host:8080)")
    parser.add_argument("--timeout", type=int, default=90000, help="Timeout ms pour Camoufox")
    args = parser.parse_args()

    t0 = time.time()

    def out(payload: dict) -> int:
        payload["elapsed_ms"] = int((time.time() - t0) * 1000)
        print(json.dumps(payload, ensure_ascii=False))
        return 0 if payload.get("ok") else 1

    try:
        from scrapling.fetchers import StealthyFetcher
    except ImportError as e:
        return out({"ok": False, "status": None, "error": f"scrapling non installé: {e}"})

    try:
        page = StealthyFetcher.fetch(
            args.url,
            headless=True,
            humanize=True,          # mouvements souris humains (anti-détection)
            os_randomize=True,      # fingerprint OS cohérent aléatoire
            solve_cloudflare=True,  # challenges JS génériques
            network_idle=True,
            wait_selector="body",
            timeout=args.timeout,
            proxy=args.proxy,       # None = IP directe ; résidentiel recommandé
        )
    except Exception as e:
        return out({"ok": False, "status": None, "error": f"stealth fetch error: {e}"})

    status = getattr(page, "status", None)
    html = getattr(page, "html_content", None)
    if not html:
        # fallback sur .text (quelques versions exposent le DOM brut là)
        html = getattr(page, "text", "") or ""

    if status not in (200, 304) or len(html) < 500:
        return out(
            {
                "ok": False,
                "status": status,
                "error": f"stealth refusé (status={status}, len={len(html)})",
            }
        )

    fd, path = tempfile.mkstemp(prefix="livetv-stealth-", suffix=".html")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(html)
    except Exception as e:
        try:
            os.unlink(path)
        except OSError:
            pass
        return out({"ok": False, "status": status, "error": f"écriture tmp: {e}"})

    return out(
        {
            "ok": True,
            "status": status,
            "url": getattr(page, "url", None) or args.url,
            "path": path,
            "bytes": len(html),
        }
    )


if __name__ == "__main__":
    sys.exit(main())