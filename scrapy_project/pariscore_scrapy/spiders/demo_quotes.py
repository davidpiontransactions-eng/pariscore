"""
Demo spider — quotes.toscrape.com.

quotes.toscrape.com is a PUBLIC sandbox explicitly designed for scraping
practice (no ToS restriction, no robots.txt block, no anti-bot). Use this
spider to validate the Scrapy setup and as a template for new spiders.

Run:
    cd scrapy_project
    scrapy crawl demo_quotes
    scrapy crawl demo_quotes -a tag=love          # filter by tag
    scrapy crawl demo_quotes -o quotes.json        # export to JSON
"""
import scrapy

from pariscore_scrapy.items import DemoQuoteItem


class DemoQuotesSpider(scrapy.Spider):
    """Scrape paginated quotes from the public quotes.toscrape.com sandbox."""

    name = "demo_quotes"
    allowed_domains = ["quotes.toscrape.com"]

    def __init__(self, tag=None, *args, **kwargs):
        """Optional `-a tag=love` to crawl only quotes tagged 'love'."""
        super().__init__(*args, **kwargs)
        self.tag = tag
        if tag:
            self.start_urls = [f"https://quotes.toscrape.com/tag/{tag}"]
        else:
            self.start_urls = ["https://quotes.toscrape.com/"]

    def parse(self, response):
        # Extract each quote block on the page
        for quote in response.css("div.quote"):
            item = DemoQuoteItem()
            item["text"] = quote.css("span.text::text").get(default="").strip("\u201c\u201d ")
            item["author"] = quote.css("small.author::text").get(default="")
            item["tags"] = quote.css("div.tags a.tag::text").getall()
            item["url"] = response.urljoin(
                quote.css("span a::attr(href)").get(default=response.url)
            )
            yield item

        # Follow pagination — "Next →" link
        next_page = response.css("li.next a::attr(href)").get()
        if next_page:
            yield response.follow(next_page, callback=self.parse)
