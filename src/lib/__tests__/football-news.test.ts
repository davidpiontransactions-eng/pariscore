import { describe, expect, test } from "bun:test";
import {
  clearFootballNewsCache,
  FOOTBALL_FEEDS,
  ITEMS_PER_FEED,
  parseFeed,
  type FeedSource,
} from "@/lib/football-news";

const feed: FeedSource = { id: "test", name: "Test", url: "https://exemple.test/rss", lang: "fr" };

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Test</title>
    <item>
      <title><![CDATA[Le titre &amp; sa suite]]></title>
      <link>https://exemple.test/a</link>
      <pubDate>Tue, 03 Oct 2026 08:00:00 GMT</pubDate>
      <description><![CDATA[Une resume]]></description>
      <media:thumbnail url="https://cdn.exemple.test/a.jpg" />
    </item>
    <item>
      <title>Sans image</title>
      <link>https://exemple.test/b</link>
      <description>&lt;img src="https://cdn.exemple.test/b.jpg" /&gt;</description>
    </item>
    <item>
      <title>Image via enclosure</title>
      <link>https://exemple.test/c</link>
      <enclosure type="image/jpeg" url="https://cdn.exemple.test/c.jpg" />
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom</title>
  <entry>
    <title>Entree atom</title>
    <link rel="alternate" href="https://exemple.test/atom-1" />
    <updated>2026-10-02T10:00:00Z</updated>
    <summary>Resume</summary>
  </entry>
</feed>`;

describe("parseFeed — RSS", () => {
  test("lit titre, lien et source", () => {
    const items = parseFeed(RSS, feed);
    expect(items).toHaveLength(3);
    expect(items[0].title).toBe("Le titre & sa suite");
    expect(items[0].link).toBe("https://exemple.test/a");
    expect(items[0].source).toBe("Test");
    expect(items[0].sourceId).toBe("test");
    expect(items[0].lang).toBe("fr");
  });

  test("convertit pubDate en ISO", () => {
    expect(parseFeed(RSS, feed)[0].publishedAt).toBe("2026-10-03T08:00:00.000Z");
  });

  test("respecte la limite", () => {
    expect(parseFeed(RSS, feed, 2)).toHaveLength(2);
    expect(parseFeed(RSS, feed, 0)).toHaveLength(0);
  });
});

describe("parseFeed — Atom et robustesse", () => {
  test("lit un flux Atom (link href=)", () => {
    const items = parseFeed(ATOM, feed);
    expect(items).toHaveLength(1);
    expect(items[0].link).toBe("https://exemple.test/atom-1");
    expect(items[0].publishedAt).toBe("2026-10-02T10:00:00.000Z");
  });

  test("renvoie [] sur un document qui n'est pas un flux", () => {
    for (const junk of ["", "<html><body>403</body></html>", "not xml at all"]) {
      expect(parseFeed(junk, feed)).toEqual([]);
    }
  });

  test("saute un item sans titre ou sans lien", () => {
    const broken = `<rss><channel>
      <item><link>https://exemple.test/x</link></item>
      <item><title>Sans lien</title></item>
      <item><title>Bon</title><link>https://exemple.test/ok</link></item>
    </channel></rss>`;
    const items = parseFeed(broken, feed);
    expect(items).toHaveLength(1);
    expect(items[0].link).toBe("https://exemple.test/ok");
  });

  test("date illisible → publishedAt null, pas d'exception", () => {
    const bad = `<rss><channel><item>
      <title>T</title><link>https://e.test/1</link><pubDate>pas une date</pubDate>
    </item></channel></rss>`;
    expect(parseFeed(bad, feed)[0].publishedAt).toBeNull();
  });
});

describe("registre des flux", () => {
test("urls HTTPS et id unique", () => {
    expect(FOOTBALL_FEEDS.length).toBeGreaterThan(0);
    const ids = FOOTBALL_FEEDS.map((f) => f.id);
    expect(ids.length).toBe(new Set(ids).size);
    for (const f of FOOTBALL_FEEDS) expect(f.url.startsWith("https://")).toBe(true);
  });

  test("aucun flux mort connu dans la liste", () => {
    const urls = FOOTBALL_FEEDS.map((f) => f.url).join(" ");
    for (const dead of ["lequipe.fr", "rmcsport.bfmtv.com", "footmercato.fr", "transfermarkt", "espn.com"]) {
      expect(urls).not.toContain(dead);
    }
  });

  test("clearFootballNewsCache n leve pas", () => {
    expect(() => clearFootballNewsCache()).not.toThrow();
    expect(ITEMS_PER_FEED).toBeGreaterThan(0);
  });
});