"""
Scrapy settings for the pariscore_scrapy project.

Generated 2026-07-13 for PariScore ZCode integration.
Convention: conservative defaults that respect sources (robots.txt, polite rate
limiting). Aligns with the project policy in .agents/skills/metier-scraping-websearch.
"""
import os
from pathlib import Path

# ─── Project paths ─────────────────────────────────────────────────────────────
# Build paths relative to this file so `scrapy crawl` works from anywhere.
BOT_NAME = "pariscore_scrapy"

PROJECT_DIR = Path(__file__).resolve().parent.parent       # scrapy_project/
SPIDER_MODULES = ["pariscore_scrapy.spiders"]
NEWSPIDER_MODULE = "pariscore_scrapy.spiders"

# ─── Compliance (DEFAULT = respectful) ─────────────────────────────────────────
# Obey robots.txt by default. This aligns with PariScore's legal policy
# (metier-scraping-websearch skill). Override per-spider ONLY with explicit
# authorization from the target site.
ROBOTSTXT_OBEY = True

# Identify the bot honestly — sites can see and block/allow us.
USER_AGENT = "pariscore-scrapy-bot/1.0 (+https://github.com/D4Vinci contact)"

# ─── Politeness ────────────────────────────────────────────────────────────────
# Conservative defaults; tune per-spider with custom_settings if a partner
# explicitly allows higher rates.
CONCURRENT_REQUESTS = 8            # max simultaneous requests overall
CONCURRENT_REQUESTS_PER_DOMAIN = 2 # max simultaneous requests per domain
DOWNLOAD_DELAY = 1.0               # seconds between requests (per domain)
DOWNLOAD_TIMEOUT = 30              # seconds before a request times out
AUTOTHROTTLE_ENABLED = True        # adaptive throttling based on server load
AUTOTHROTTLE_START_DELAY = 1.0
AUTOTHROTTLE_MAX_DELAY = 60.0
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0

# ─── Retry & resilience ────────────────────────────────────────────────────────
RETRY_ENABLED = True
RETRY_TIMES = 2                    # conservative (don't hammer on transient errors)
RETRY_HTTP_CODES = [429, 500, 502, 503, 504, 408, 403]

# ─── Caching (dev-friendly) ───────────────────────────────────────────────────
# Cache HTTP responses for 24h during development to avoid re-hitting sources.
# Disabled in production (set HTTPCACHE_ENABLED=False via env).
HTTPCACHE_ENABLED = os.environ.get("SCRAPY_HTTPCACHE", "1") == "1"
HTTPCACHE_EXPIRATION_SECS = 86400  # 24h
HTTPCACHE_DIR = str(PROJECT_DIR / ".scrapy" / "httpcache")

# ─── Output ────────────────────────────────────────────────────────────────────
# Default export format when using `scrapy crawl X -o file.json`.
FEED_EXPORT_ENCODING = "utf-8"
FEED_FORMAT = "json"

# ─── Logging ───────────────────────────────────────────────────────────────────
LOG_LEVEL = os.environ.get("SCRAPY_LOG_LEVEL", "INFO")

# ─── Middlewares & pipelines ──────────────────────────────────────────────────
DOWNLOADER_MIDDLEWARES = {
    # Default: built-in middlewares. Add custom UA rotation / proxy middleware here.
    # "pariscore_scrapy.middlewares.PariscoreScrapyDownloaderMiddleware": 543,
}

ITEM_PIPELINES = {
    # Example: validate + dedup before DB write.
    # "pariscore_scrapy.pipelines.PariscoreScrapyPipeline": 300,
}

# ─── Twisted reactor (Windows + asyncio compatibility) ─────────────────────────
# Required on Windows to avoid "AttributeError: module 'signal' has no attribute
# 'SIGCHLD'" and to work with asyncio-based middlewares (scrapy-playwright etc.).
# NOTE: must be set before reactor is imported. Kept here per Scrapy convention.
try:
    from twisted.internet import asyncioreactor
    asyncioreactor.install()
except Exception:
    # Reactor may already be installed — fine in subprocess-per-crawl mode.
    pass
