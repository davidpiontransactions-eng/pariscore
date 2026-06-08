BOT_NAME = "betmines"
SPIDER_MODULES = ["betmines.spiders"]
NEWSPIDER_MODULE = "betmines.spiders"

# betmines robots.txt allows "/" — but the SPA + CF mean we drive a real browser.
ROBOTSTXT_OBEY = False

# scrapy-playwright wiring
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}
PLAYWRIGHT_BROWSER_TYPE = "chromium"
PLAYWRIGHT_LAUNCH_OPTIONS = {
    "headless": True,  # headless=new chromium; stealth callback hides automation
    "args": [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
    ],
}
PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT = 60000
# Apply playwright-stealth to every new page (anti-fingerprint)
PLAYWRIGHT_PAGE_INIT_CALLBACK = "betmines.stealth.init_stealth"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Polite + cache-friendly
CONCURRENT_REQUESTS = 2
DOWNLOAD_DELAY = 2
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1
AUTOTHROTTLE_MAX_DELAY = 10
LOG_LEVEL = "INFO"
FEED_EXPORT_ENCODING = "utf-8"
