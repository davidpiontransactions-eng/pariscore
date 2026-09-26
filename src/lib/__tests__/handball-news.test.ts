// Tests handball-news — parsing RSS, décodage entités, agrégation/dédup/cap.
// Convention projet : import explicite depuis "bun:test".
import { describe, expect, test } from "bun:test";
import {
  aggregateNews,
  decodeXmlEntities,
  parseRssItems,
  stripGoogleNewsSuffix,
} from "../handball-news";

describe("decodeXmlEntities", () => {
  // Entité amp; construite dynamiquement (pas de littéral décodable par la chaîne d'outils).
  const AMP_ENT = String.fromCharCode(38) + "amp;";

  test("décode CDATA, entités nommées et numériques", () => {
    expect(decodeXmlEntities("<![CDATA[Aix & Caen]]>")).toBe("Aix & Caen");
    expect(decodeXmlEntities("&#8217;un but")).toBe("’un but");
    expect(decodeXmlEntities("L&#x27;Équipe " + AMP_ENT + " Eurosport")).toBe(
      "L" + String.fromCharCode(39) + "Équipe & Eurosport",
    );
    expect(decodeXmlEntities("Coupe &#8230; fin")).toBe("Coupe … fin");
    // amp en dernier : « &lt; » devient « < » sans être re-décodé en « < »
    expect(decodeXmlEntities(AMP_ENT + "lt;strong" + String.fromCharCode(38) + "gt;")).toBe(
      String.fromCharCode(38) + "lt;strong>",
    );
  });
});

describe("stripGoogleNewsSuffix", () => {
  test("retire le suffixe « - Source » ajouté par Google News", () => {
    expect(stripGoogleNewsSuffix("PSG bat Montpellier - L'Équipe", "L'Équipe")).toBe(
      "PSG bat Montpellier",
    );
    expect(stripGoogleNewsSuffix("Titre sans suffixe", "L'Équipe")).toBe("Titre sans suffixe");
  });
});

describe("parseRssItems", () => {
  const XML = `<?xml version="1.0"?><rss version="2.0"><channel>
    <item>
      <title><![CDATA[STL (J4) | Aix retrouve le sourire]]></title>
      <link>https://handnews.fr/2026/stl-j4/</link>
      <pubDate>Fri, 25 Sep 2026 20:04:00 +0000</pubDate>
    </item>
    <item>
      <title>Ligue des champions &#8212; résumé</title>
      <link>https://www.handball-planet.com/x/</link>
      <pubDate>Thu, 24 Sep 2026 07:05:02 +0000</pubDate>
    </item>
    <item>
      <title>Sans lien → ignoré</title>
      <pubDate>Thu, 24 Sep 2026 07:05:02 +0000</pubDate>
    </item>
  </channel></rss>`;

  test("extrait titre, lien, date ISO ; ignore les items sans lien", () => {
    const items = parseRssItems(XML);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("STL (J4) | Aix retrouve le sourire");
    expect(items[0].url).toBe("https://handnews.fr/2026/stl-j4/");
    expect(items[0].publishedAt).toBe("2026-09-25T20:04:00.000Z");
  });

  test("retourne [] sur XML invalide/vide", () => {
    expect(parseRssItems("")).toEqual([]);
    expect(parseRssItems("<html>pas du rss</html>")).toEqual([]);
  });
});

describe("aggregateNews", () => {
  const mk = (url: string, publishedAt: string) => ({ title: `T ${url}`, url, publishedAt });

  test("dédoublonne par URL, trie par date décroissante", () => {
    const out = aggregateNews({
      handnews: [mk("https://a", "2026-09-25T20:00:00Z"), mk("https://b", "2026-09-24T20:00:00Z")],
      lequipe: [mk("https://a", "2026-09-26T20:00:00Z"), mk("https://c", "2026-09-23T20:00:00Z")],
    });
    expect(out).toHaveLength(3);
    expect(out.map((i) => i.url)).toEqual(["https://a", "https://b", "https://c"]);
    // tri décroissant — /a garde la version handnews (25/09), le doublon lequipe 26/09 est ignoré
    expect(out[0].publishedAt).toBe("2026-09-25T20:00:00Z");
  });

  test("cap par source puis total, suffixe Google News retiré", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      mk(`https://www.handball-planet.com/p${i}`, `2026-09-2${i % 9}T10:00:00Z`),
    );
    const out = aggregateNews(
      {
        planet: many.map((m) => ({ ...m, title: `${m.title} - Handball Planet` })),
        lequipe: [mk("https://lq", "2026-09-26T12:00:00Z")],
      },
      { maxPerSource: 4, maxTotal: 5 },
    );
    expect(out).toHaveLength(5);
    expect(out.filter((i) => i.source === "planet")).toHaveLength(4);
    const lq = out.find((i) => i.source === "lequipe");
    expect(lq?.title.endsWith(" - Handball Planet")).toBe(false);
  });

  test("marque les items EN sources non traduites", () => {
    const out = aggregateNews({ planet: [mk("https://p", "2026-09-26T00:00:00Z")] });
    expect(out[0].lang).toBe("en");
    expect(out[0].sourceName).toBe("Handball Planet");
  });

  test("source handball365 (Google News) : FR natif, suffixe source retiré", () => {
    const out = aggregateNews({
      handball365: [
        {
          title: "Aalborg remporte le classique - handball365.fr",
          url: "https://news.google.com/rss/articles/x",
          publishedAt: "2026-09-26T09:00:00Z",
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("handball365");
    expect(out[0].lang).toBe("fr");
    expect(out[0].title).toBe("Aalborg remporte le classique - handball365.fr");
  });
});
