#!/usr/bin/env python3
"""crawl4ai-mcp-server.py — Serveur MCP Crawl4AI pour PariScore.

Expose le scraping web Crawl4AI via MCP (outils):
  - fetch_markdown(url) : page → markdown propre (CSS/JS rendu)
  - fetch_logo(url)     : extraction du logo d'un site (fallback team_logos)
  - check_ready()       : disponibilité du moteur (import crawl4ai)

MCP server #7 de PariScore. Démarre via `python scripts/crawl4ai-mcp-server.py`
(configuré dans .mcp.json). crawl4ai est optionnel — si le package n'est pas
installé, les outils retournent une erreur claire sans crasher le serveur.
"""

import json
import sys
from typing import Any, Dict, Optional

try:
    from mcp.server.fastmcp import FastMCP
except ImportError as e:
    print(json.dumps({
        "error": "mcp SDK required",
        "install": "pip install mcp",
        "detail": str(e),
    }), file=sys.stderr)
    sys.exit(1)

mcp = FastMCP("pariscore-crawl4ai")


def _engine() -> Optional[Any]:
    """Retourne le module crawl4ai ou None avec raison."""
    try:
        import crawl4ai
        return crawl4ai
    except ImportError:
        return None


@mcp.tool()
def check_ready() -> Dict[str, Any]:
    """Vérifie que le moteur crawl4ai est installé et utilisable."""
    eng = _engine()
    if eng is None:
        return {"ok": False, "error": "crawl4ai non installé — pip install crawl4ai"}
    return {"ok": True, "version": getattr(eng, "__version__", "unknown")}


@mcp.tool()
def fetch_markdown(url: str, max_chars: int = 20000) -> Dict[str, Any]:
    """Récupère une page → markdown propre (rendu JS inclus)."""
    eng = _engine()
    if eng is None:
        return {"ok": False, "error": "crawl4ai non installé — pip install crawl4ai"}
    try:
        import asyncio
        from crawl4ai import AsyncWebCrawler, CrawlerRunConfig

        async def _run():
            async with AsyncWebCrawler(verbose=False) as crawler:
                result = await crawler.arun(
                    url=url,
                    config=CrawlerRunConfig(verbose=False),
                )
                return result

        res = asyncio.run(_run())
        md = (getattr(res, "markdown", None) or "")[:max_chars]
        return {
            "ok": True,
            "url": url,
            "markdown": md,
            "len": len(md),
        }
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "url": url, "error": str(e)[:300]}


@mcp.tool()
def fetch_logo(url: str) -> Dict[str, Any]:
    """Extrait l'URL du logo d'un site (og:image / favicon / apple-touch-icon)."""
    try:
        import re
        from urllib.request import Request, urlopen
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        html = urlopen(req, timeout=15).read().decode("utf-8", errors="replace")[:200000]
        candidates = []
        for pat in [r'<link[^>]+rel=["\']apple-touch-icon["\'][^>]*href=["\']([^"\']+)',
                    r'<link[^>]+rel=["\']icon["\'][^>]*href=["\']([^"\']+)',
                    r'<meta[^>]+property=["\']og:image["\'][^>]*content=["\']([^"\']+)']:
            m = re.search(pat, html, re.I)
            if m:
                href = m.group(1)
                if href.startswith("/"):
                    from urllib.parse import urlparse
                    p = urlparse(url)
                    href = f"{p.scheme}://{p.netloc}{href}"
                candidates.append(href)
        return {"ok": True, "url": url, "logo": candidates[0] if candidates else None,
                "candidates": candidates}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "url": url, "error": str(e)[:300]}


if __name__ == "__main__":
    mcp.run()
