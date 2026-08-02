#!/usr/bin/env python3
"""scrapy-mcp-server.py — Serveur MCP Scrapy pour PariScore.

Expose le framework de crawling massif Scrapy via MCP (outils):
  - check_robots(url)      : vérifie robots.txt avant crawl
  - crawl(url, max_pages)  : crawl simple avec respect robots.txt + autothrottle
  - crawl_to_json(...)     : crawl et retourne le résultat en JSON

MCP server #10 de PariScore. Démarre via `python scripts/scrapy-mcp-server.py`
(configuré dans .mcp.json) ou manuellement en stdio.
"""

import asyncio
import json
import sys
from typing import Any, Dict, List, Optional

try:
    from mcp.server.fastmcp import FastMCP
except ImportError as e:
    print(json.dumps({
        "error": "mcp SDK required",
        "install": "pip install mcp",
        "detail": str(e),
    }), file=sys.stderr)
    sys.exit(1)

mcp = FastMCP("pariscore-scrapy")


def _can_import_scrapy() -> Optional[str]:
    try:
        import scrapy  # noqa: F401
        return None
    except ImportError:
        return "scrapy non installé — pip install scrapy"


@mcp.tool()
def check_robots(url: str) -> Dict[str, Any]:
    """Vérifie si l'URL est autorisée par robots.txt (politesse avant crawl)."""
    err = _can_import_scrapy()
    if err:
        return {"ok": False, "error": err, "url": url}
    try:
        from urllib.robotparser import RobotFileParser
        from urllib.parse import urlparse
        from urllib.request import urlopen
        parsed = urlparse(url)
        rp = RobotFileParser()
        rp.set_url(f"{parsed.scheme}://{parsed.netloc}/robots.txt")
        rp.read()
        return {
            "ok": True,
            "url": url,
            "allowed": rp.can_fetch("*", url),
            "robots_url": rp.url,
        }
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "url": url, "error": str(e)[:300]}


@mcp.tool()
def crawl_to_json(url: str, max_pages: int = 10) -> Dict[str, Any]:
    """Crawl un site (respect robots.txt, autothrottle) et retourne les pages en JSON."""
    err = _can_import_scrapy()
    if err:
        return {"error": err, "url": url, "pages": []}
    if max_pages < 1 or max_pages > 200:
        max_pages = 10
    try:
        import re
        from urllib.parse import urlparse
        import scrapy
        from scrapy.crawler import CrawlerProcess, CrawlerRunner
        from scrapy.utils.project import get_project_settings
        from twisted.internet import reactor

        start_url = url
        domain = urlparse(start_url).netloc

        class PariCoreSpider(scrapy.Spider):
            name = "pariscore_spider"
            allowed_domains = [domain]
            start_urls = [start_url]
            custom_settings = {
                "ROBOTSTXT_OBEY": True,
                "AUTOTHROTTLE_ENABLED": True,
                "AUTOTHROTTLE_START_DELAY": 2.0,
                "AUTOTHROTTLE_MAX_DELAY": 15.0,
                "DOWNLOAD_DELAY": 1.0,
                "LOG_LEVEL": "ERROR",
            }

            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.results: List[Dict[str, Any]] = []

            def parse(self, response):
                self.results.append({
                    "url": response.url,
                    "status": response.status,
                    "title": response.css("title::text").get("")[:200],
                    "text_len": len(response.text or ""),
                    "text": (response.text or "")[:8000],
                })
                if len(self.results) >= max_pages:
                    return
                for href in response.css("a::attr(href)").getall()[:50]:
                    nxt = response.urljoin(href)
                    if urlparse(nxt).netloc == domain:
                        yield scrapy.Request(nxt, callback=self.parse)

        process = CrawlerProcess(get_project_settings())
        process.crawl(PariCoreSpider)
        runner = CrawlerRunner(get_project_settings())
        deferred = runner.crawl(PariCoreSpider)
        deferred.addBoth(lambda _: reactor.stop())
        reactor.run()
        spider = None
        for c in runner.crawlers:
            spider = c.spider
        pages = spider.results if spider else []
        return {"url": url, "pages_count": len(pages), "pages": pages[:max_pages]}
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)[:300], "url": url, "pages": []}


@mcp.tool()
def list_spiders() -> Dict[str, Any]:
    """Liste les spiders Scrapy disponibles dans scripts/spiders/ (si présent)."""
    import os
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "spiders")
    if not os.path.isdir(base):
        return {"spiders": [], "dir": base, "note": "dossier spiders/ absent"}
    files = sorted(f[:-3] for f in os.listdir(base) if f.endswith(".py") and not f.startswith("_"))
    return {"spiders": files, "dir": base}


if __name__ == "__main__":
    mcp.run()
