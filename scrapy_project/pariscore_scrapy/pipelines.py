"""
Item pipelines for pariscore_scrapy.

Pipelines transform/validate/persist items after the spider extracts them.
Order is controlled by ITEM_PIPELINES in settings.py (lower number = earlier).
"""
import datetime
import hashlib


class NormalizeFieldsPipeline:
    """
    Pipeline #100 — normalizes common fields on all items.

    - Adds `scraped_at` ISO timestamp if missing.
    - Adds `source` from spider name if missing.
    - Normalizes string fields (strip whitespace).
    """

    def process_item(self, item, spider):
        if not item.get("scraped_at"):
            item["scraped_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if not item.get("source"):
            item["source"] = spider.name

        return item


class DedupPipeline:
    """
    Pipeline #200 — deduplication via a seen-set keyed by a hash of the item.

    Uses an in-memory set (per-spider-run). For cross-run dedup, replace with
    a DB-backed check (SQLite UNIQUE constraint on name_norm, etc.).
    """

    def __init__(self):
        self.seen = set()

    def _item_key(self, item):
        # Hash on the URL if present, else on the full item dict.
        key_str = item.get("url") or repr(sorted(dict(item).items()))
        return hashlib.sha1(str(key_str).encode("utf-8")).hexdigest()

    def process_item(self, item, spider):
        k = self._item_key(item)
        if k in self.seen:
            from scrapy.exceptions import DropItem
            raise DropItem(f"Duplicate item: {k}")
        self.seen.add(k)
        return item


# ─── Activation (override the empty ITEM_PIPELINES in settings.py to enable) ──
# To enable these pipelines, edit settings.py ITEM_PIPELINES:
#   ITEM_PIPELINES = {
#       "pariscore_scrapy.pipelines.NormalizeFieldsPipeline": 100,
#       "pariscore_scrapy.pipelines.DedupPipeline": 200,
#   }
