"""betmines previews spider — proves CF bypass + dumps rendered HTML.

Stage 1 (this): load https://betmines.com/, let Cloudflare clear, save the
rendered HTML to output/home.html and emit a status item. Once we confirm the
page renders (not the CF block page), refine selectors in parse() against the
real DOM saved in output/home.html.

Run:
  docker compose -f tools/docker/scrapy/docker-compose.yml run --rm scrapy \
    sh -c "cd /work/betmines && scrapy crawl previews -o /work/betmines/output/items.json"
"""
import os
import scrapy
from scrapy_playwright.page import PageMethod

OUT_DIR = "/work/betmines/output"


class PreviewsSpider(scrapy.Spider):
    name = "previews"
    allowed_domains = ["betmines.com"]

    async def start(self):
        os.makedirs(OUT_DIR, exist_ok=True)
        yield scrapy.Request(
            "https://betmines.com/",
            meta={
                "playwright": True,
                "playwright_include_page": True,
                "playwright_page_methods": [
                    # let the CF JS challenge run + the SPA hydrate
                    PageMethod("wait_for_load_state", "networkidle"),
                    PageMethod("wait_for_timeout", 8000),
                ],
                # allow CF 403/503 through — playwright may have already solved it
                "handle_httpstatus_list": [403, 503, 429],
            },
            callback=self.parse,
            errback=self.errback,
        )

    async def parse(self, response):
        page = response.meta["playwright_page"]
        try:
            title = await page.title()
            html = await page.content()
        finally:
            await page.close()

        with open(os.path.join(OUT_DIR, "home.html"), "w", encoding="utf-8") as f:
            f.write(html)

        low = (title + " " + html[:2000]).lower()
        blocked = any(s in low for s in ("just a moment", "unable to access", "attention required", "cf-challenge"))

        # Best-effort match-card count (refine once home.html is inspected)
        card_guesses = [
            "div[class*='match']", "a[class*='match']", "div[class*='preview']",
            "div[class*='card']", "article",
        ]
        counts = {sel: len(response.css(sel)) for sel in card_guesses}

        self.logger.info(
            "BETMINES title=%r status=%s blocked=%s html_len=%d cards=%s",
            title, response.status, blocked, len(html), counts,
        )
        yield {
            "url": response.url,
            "status": response.status,
            "title": title,
            "blocked": blocked,
            "html_len": len(html),
            "card_counts": counts,
        }

    async def errback(self, failure):
        page = failure.request.meta.get("playwright_page")
        if page:
            await page.close()
        self.logger.error("BETMINES errback: %s", repr(failure))
