"""
Downloader middlewares for pariscore_scrapy.

Currently minimal — Scrapy's built-in defaults handle UA, cookies, retries.
Add custom middleware here (e.g. proxy rotation, UA rotation) as needed.
"""
from scrapy import signals


class PariscoreScrapySpiderMiddleware:
    """Spider middleware — hooks into spider input/output processing."""

    @classmethod
    def from_crawler(cls, crawler):
        s = cls()
        crawler.signals.connect(s.spider_opened, signal=signals.spider_opened)
        return s

    def process_spider_input(self, response, spider):
        return None

    def process_spider_output(self, response, result, spider):
        for i in result:
            yield i

    def spider_opened(self, spider):
        spider.logger.info("Spider opened: %s", spider.name)


class PariscoreScrapyDownloaderMiddleware:
    """Downloader middleware — hooks into request/response cycle."""

    @classmethod
    def from_crawler(cls, crawler):
        s = cls()
        crawler.signals.connect(s.spider_opened, signal=signals.spider_opened)
        return s

    def process_request(self, request, spider):
        return None  # let Scrapy's default handling proceed

    def process_response(self, request, response, spider):
        return response

    def process_exception(self, request, exception, spider):
        return None

    def spider_opened(self, spider):
        spider.logger.info("Spider opened: %s", spider.name)
