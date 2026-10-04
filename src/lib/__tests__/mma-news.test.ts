import { describe, expect, test } from "bun:test";
import { parseFeed, type FeedSource } from "@/lib/news-aggregate";
import {
  chunk,
  MMA_FEEDS,
  ITEMS_PER_FEED,
  TRANSLATE_BATCH,
  TRANSLATE_MAX_ITEMS,
} from "@/lib/mma-news";

const feed: FeedSource = {
  id: "bbc-mma",
  name: "BBC Sport",
  url: "https://feeds.bbci.co.uk/sport/mixed-martial-arts/rss.xml",
  lang: "en",
};

// Fragment BBC réel : le flux qui a été mesuré comme reliable en hotlink.
const BBC = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
  <item>
    <title><![CDATA[Figueiredo targets statement fight after win over Talbott]]></title>
    <link>https://exemple.test/a</link>
    <pubDate>Sat, 03 Oct 2026 22:12:13 GMT</pubDate>
    <media:thumbnail url="https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/aaa/live/x.jpg" />
  </item>
  <item>
    <title>Pas de vignette</title>
    <link>https://exemple.test/b</link>
    <enclosure type="image/jpeg" url="https://ichef.bbci.co.uk/ace/standard/240/b.jpg" />
  </item>
  <item>
    <title>Image relative</title>
    <link>https://exemple.test/c</link>
    <description>&lt;img src="/media/relative.jpg" /&gt;</description>
  </item>
  <item>
    <title>Aucune image</title>
    <link>https://exemple.test/d</link>
    <description>Un resume sans image</description>
  </item>
</channel></rss>`;

describe("parseFeed — extraction d'image", () => {
  test("lit media:thumbnail et absolutise les URL", () => {
    const items = parseFeed(BBC, feed, 10, true);
    expect(items).toHaveLength(4);
    expect(items[0].image).toBe("https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/aaa/live/x.jpg");
  });

  test("enclosure type=image pris en repli", () => {
    expect(parseFeed(BBC, feed, 10, true)[1].image).toBe("https://ichef.bbci.co.uk/ace/standard/240/b.jpg");
  });

  test("URL relative absolutisee sur l'URL du flux", () => {
    expect(parseFeed(BBC, feed, 10, true)[2].image).toBe("https://feeds.bbci.co.uk/media/relative.jpg");
  });

  test("item sans image -> null, jamais chaine vide", () => {
    // `""` passerait un truthy-check mal écrit ; on veut un null franc.
    expect(parseFeed(BBC, feed, 10, true)[3].image).toBeNull();
  });

  test("withImages:false -> toujours null (decision du foot)", () => {
    const items = parseFeed(BBC, feed, 10, false);
    for (const i of items) expect(i.image).toBeNull();
  });
});

describe("parseFeed — resume", () => {
  test("le HTML du resume est netoure et borne", () => {
    const items = parseFeed(BBC, feed, 10, false);
    expect(items[0].summary).toBeNull();
    expect(items[3].summary).toBe("Un resume sans image");
  });

  test("un resume enorme est tronque (payload)", () => {
    const long = `<rss><channel><item><title>T</title><link>https://e.test/1</link>
      <description>${"a".repeat(5000)}</description></item></channel></rss>`;
    const s = parseFeed(long, feed, 10, false)[0].summary ?? "";
    expect(s.length).toBeLessThanOrEqual(280);
  });
});

describe("registre des flux MMA", () => {
  test("les 3 flux mesures sont la, et rien d'autre", () => {
    expect(MMA_FEEDS.map((f) => f.id).sort()).toEqual(["bbc-mma", "sherdog", "ufc"]);
  });

  test("aucun flux mort connu dans la liste", () => {
    const urls = MMA_FEEDS.map((f) => f.url).join(" ");
    // Morts mesures le 2026-10-03 : MMA Junkie 402, Cage Warriors 403,
    // Reddit 403, Bleacher Report 404, ONE FC 404.
    for (const dead of ["mmajunkie", "cagewarriors", "reddit.com", "bleacherreport", "onefc", "espn.com/espn/rss/mma"]) {
      expect(urls).not.toContain(dead);
    }
  });

  test("ids uniques et HTTPS", () => {
    const ids = MMA_FEEDS.map((f) => f.id);
    expect(ids.length).toBe(new Set(ids).size);
    for (const f of MMA_FEEDS) expect(f.url.startsWith("https://")).toBe(true);
  });

  test("host d'image BBC autorise dans next.config", async () => {
    const cfg = await Bun.file("next.config.ts").text();
    expect(cfg).toContain("ichef.bbci.co.uk");
  });

  test("ITEMS_PER_FEED borne", () => {
    expect(ITEMS_PER_FEED).toBeGreaterThan(0);
    expect(ITEMS_PER_FEED).toBeLessThanOrEqual(20);
  });
});

describe("decoupage en lots de traduction", () => {
  test("20 items -> 3 lots (8 + 8 + 4)", () => {
    // C'est ce qui manquait : 8 traduits sur 20 laissait 12 titres en anglais.
    const lots = chunk(Array.from({ length: 20 }, (_, i) => i), TRANSLATE_BATCH);
    expect(lots).toHaveLength(3);
    expect(lots.map((l) => l.length)).toEqual([8, 8, 4]);
  });

  test("aucune perte, aucun doublon", () => {
    const src = Array.from({ length: 20 }, (_, i) => `i${i}`);
    const flat = chunk(src, TRANSLATE_BATCH).flat();
    expect(flat).toEqual(src);
  });

  test("liste vide et taille invalide", () => {
    expect(chunk([], 8)).toEqual([]);
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });

  test("le plafond couvre la page affichee", () => {
    // L'UI affiche 12 items : le plafond doit couvrir large sans partir en
    // boucle de lots sur un flux qui grossit.
    expect(TRANSLATE_MAX_ITEMS).toBeGreaterThanOrEqual(12);
    expect(TRANSLATE_BATCH).toBeGreaterThan(0);
    expect(TRANSLATE_BATCH).toBeLessThanOrEqual(TRANSLATE_MAX_ITEMS);
  });
});