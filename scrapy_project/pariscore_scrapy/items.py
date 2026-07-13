"""
Item definitions for PariScore Scrapy spiders.

Items are typed containers that flow through the pipeline:
  Spider → Item → Pipeline (validation, dedup, DB write).

Add new item classes here as you build spiders for new data types.
"""
import scrapy


class PariscoreScrapyItem(scrapy.Item):
    """Base item — common fields for all PariScore scraped items."""
    source = scrapy.Field()       # spider name that produced this item
    scraped_at = scrapy.Field()   # ISO timestamp
    url = scrapy.Field()          # source URL


class DemoQuoteItem(PariscoreScrapyItem):
    """Demo item — quote from quotes.toscrape.com (public scraping sandbox)."""
    text = scrapy.Field()
    author = scrapy.Field()
    tags = scrapy.Field()


class TeamLogoItem(PariscoreScrapyItem):
    """Logo item — team/championship logo extracted from an authorized source."""
    team_name = scrapy.Field()
    team_name_norm = scrapy.Field()   # normalized lookup key (lowercase, no accents)
    logo_url = scrapy.Field()
    country = scrapy.Field()
    league = scrapy.Field()
