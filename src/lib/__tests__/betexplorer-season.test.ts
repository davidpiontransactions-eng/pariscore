import { describe, expect, test } from "bun:test";
import {
  discoverSeasonLinks,
  isCoherentOddsTriple,
  isoFromDayMonth,
  parseSeasonRows,
} from "../../../scripts/lib/betexplorer-season.mjs";

// Markup RÉEL capturé sur https://www.betexplorer.com/handball/france/starligue-2025-2026/results/
// le 2026-10-04 (extraits verbatim). Les 3 lignes couvrent les 3 issues
// possibles : `<strong>` à gauche, à droite, et absent (nul).
//
// ⚠️ Le fixture précédent mettait `<strong>Nantes</strong>` sur un match dont le
// score (27:31) donnait LIMOGES vainqueur — un markup que BetExplorer n'émet
// jamais. Le test passait donc pour la mauvaise raison et masquait le vrai
// bug : ancré sur `<strong>`, le parseur perdait toute ligne où l'EXTÉRIEUR
// gagne, ainsi que tous les nuls (mesuré : 120 lignes perdues sur 241).
const REAL_ROWS = `
<table class="table-main js-tablebanner-t js-tablebanner-ntb"><tr><th class="h-text-left" colspan="2">30. Round</th><th class="h-text-center">1</th><th class="h-text-center">X</th><th class="h-text-center">2</th><th>&nbsp;</th></tr>
<tr><td class="h-text-left"><a data-test="8987045" href="/handball/france/starligue-2025-2026/chambery-savoie-istres/IqgXBKtf/" class="in-match"><span><strong>Chambery Savoie</strong></span> - <span>Istres</span></a></td><td class="h-text-center"><a href="/handball/france/starligue-2025-2026/chambery-savoie-istres/IqgXBKtf/">30:28</a></td><td class="table-main__odds colored" data-oid="8i8d5xv464x0xnjoad"><span><span><span data-odd="1.40"></span></span></span></td><td class="table-main__odds" data-oid="8i8d5xv498x0x0" data-odd="9.47"></td><td class="table-main__odds" data-oid="8i8d5xv464x0xnjoaf" data-odd="3.77"></td><td class="h-text-right h-text-no-wrap">06.06.</td></tr>
<tr><td class="h-text-left"><a data-test="8987046" href="/handball/france/starligue-2025-2026/limoges-nantes/AbCdEfG/" class="in-match"><span>Limoges</span> - <span><strong>Nantes</strong></span></a></td><td class="h-text-center"><a href="/handball/france/starligue-2025-2026/limoges-nantes/AbCdEfG/">27:31</a></td><td class="table-main__odds" data-oid="a1" data-odd="2.10"></td><td class="table-main__odds" data-oid="a2" data-odd="10.5"></td><td class="table-main__odds" data-oid="a3" data-odd="1.85"></td><td class="h-text-right h-text-no-wrap">04.10.</td></tr>
<tr><td class="h-text-left"><a data-test="8987055" href="/handball/france/starligue-2025-2026/selestat-dunkerque/vDMEOcQa/" class="in-match"><span>Selestat</span> - <span>Dunkerque</span></a></td><td class="h-text-center"><a href="/handball/france/starligue-2025-2026/selestat-dunkerque/vDMEOcQa/">30:30</a></td><td class="table-main__odds" data-oid="8i8dfxv464x0xnjob1" data-odd="1.92"></td><td class="table-main__odds colored" data-oid="8i8dfxv498x0x0"><span><span><span data-odd="7.99"></span></span></span></td><td class="table-main__odds" data-oid="8i8dfxv498x0x1"><span><span><span data-odd="2.02"></span></span></span></td><td class="h-text-right h-text-no-wrap">12.01.</td></tr>
</table>`;

// Extrait réel du <select> des saisons sur la page ligue (2026-10-04).
const REAL_SELECT = `
    <select><option value="/handball/france/starligue-2027-2028/">2027/2028</option>
    <option value="/handball/france/starligue/">2026/2027</option>
    <option value="/handball/france/starligue-2025-2026/">2025/2026</option>
    <option value="/handball/france/starligue-2024-2025/">2024/2025</option></select>
    <select><option value="d" selected="selected">date</option><option value="r">round</option></select>`;

// ─── Dates ───

describe("isoFromDayMonth — déduire l'année de la saison", () => {
  test("mois ≥ 8 → année de DÉBUT de saison", () => {
    expect(isoFromDayMonth("04.10.", "2025-2026")).toBe("2025-10-04");
    expect(isoFromDayMonth("12.12.", "2025-2026")).toBe("2025-12-12");
  });

  test("mois ≤ 7 → année de FIN de saison", () => {
    expect(isoFromDayMonth("06.06.", "2025-2026")).toBe("2026-06-06");
    expect(isoFromDayMonth("28.02.", "2025-2026")).toBe("2026-02-28");
  });

  test("formats tolérés (espaces, point final)", () => {
    expect(isoFromDayMonth("6.6", "2025-2026")).toBe("2026-06-06");
    expect(isoFromDayMonth("06.06", "2025-2026")).toBe("2026-06-06");
  });

  test("libellé de saison au SLASH (format réel de discoverSeasonLinks)", () => {
    // BetExplorer écrit « 2025/2026 » dans le <select> et « 2025-2026 » dans
    // l'URL. Ne gérer que le tiret faisait retomber toutes les dates à null sur
    // du HTML réel (dry-run : 190 pages, 0 match).
    expect(isoFromDayMonth("06.06.", "2025/2026")).toBe("2026-06-06");
    expect(isoFromDayMonth("04.10.", "2025/2026")).toBe("2025-10-04");
    expect(isoFromDayMonth("04.10.", "2026/2027")).toBe("2026-10-04");
  });

  test("entrées invalides → null (jamais de date inventée)", () => {
    expect(isoFromDayMonth("06.06.", "")).toBeNull();
    expect(isoFromDayMonth("06.06.", "2025")).toBeNull();
    expect(isoFromDayMonth("pas une date", "2025-2026")).toBeNull();
    expect(isoFromDayMonth("32.13.", "2025-2026")).toBeNull();
    expect(isoFromDayMonth("", "2025-2026")).toBeNull();
  });

  // Mesuré le 2026-10-04 sur la saison en cours : BetExplorer affiche « Today »
  // et « Yesterday » au lieu de `DD.MM.` pour les matchs récents. Sans ce cas,
  // `isoFromDayMonth` renvoyait null et le cron QUOTIDIEN perdait précisément
  // les matchs de la veille.
  describe("dates relatives (Today / Yesterday)", () => {
    test("résolues contre la date de référence fournie", () => {
      expect(isoFromDayMonth("Today", "2026/2027", "2026-10-04")).toBe("2026-10-04");
      expect(isoFromDayMonth("Yesterday", "2026/2027", "2026-10-04")).toBe("2026-10-03");
    });

    test("indépendantes du libellé de saison (une saison passe l'année)", () => {
      // Un match d'août affiché « Today » le 2026-01-01 doit donner 2026, pas
      // 2025 : on applique le décalage réel, sans l'inférence « mois ≥ 8 ».
      expect(isoFromDayMonth("Today", "2025/2026", "2026-01-01")).toBe("2026-01-01");
      expect(isoFromDayMonth("Yesterday", "2026/2027", "2026-01-01")).toBe("2025-12-31");
    });

    test("franchit un mois et une année sans dérive", () => {
      expect(isoFromDayMonth("Yesterday", "2026/2027", "2026-03-01")).toBe("2026-02-28");
      expect(isoFromDayMonth("Yesterday", "2026/2027", "2026-01-01")).toBe("2025-12-31");
    });

    test("casse insensible + variantes FR", () => {
      expect(isoFromDayMonth("TODAY", "2026/2027", "2026-10-04")).toBe("2026-10-04");
      expect(isoFromDayMonth("hier", "2026/2027", "2026-10-04")).toBe("2026-10-03");
    });

    test("sans refDate → aujourd'hui (utile en appel direct)", () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(isoFromDayMonth("Today", "2026/2027")).toBe(today);
    });

    test("refDate invalide → null, jamais une date bidon", () => {
      expect(isoFromDayMonth("Today", "2026/2027", "pas-une-date")).toBeNull();
    });
  });
});

// ─── Parsing ───

describe("parseSeasonRows — markup réel des pages de saison", () => {
  const rows = parseSeasonRows(REAL_ROWS, "2025-2026");

  test("extrait les 3 matchs et saute la ligne de journée", () => {
    expect(rows).toHaveLength(3);
  });

  test("ordre domicile/extérieur = ordre du HTML, JAMAIS celui du vainqueur", () => {
    // Victoire à DOMICILE : <strong> à gauche.
    expect(rows[0].home).toBe("Chambery Savoie");
    expect(rows[0].away).toBe("Istres");
    // Victoire à l'EXTÉRIEUR : <strong> à droite. C'est ce cas que l'ancien
    // parseur ancré sur <strong> faisait disparaître (away = "" → rejet).
    expect(rows[1].home).toBe("Limoges");
    expect(rows[1].away).toBe("Nantes");
    // NUL : aucun <strong> du tout, la ligne était également rejetée.
    expect(rows[2].home).toBe("Selestat");
    expect(rows[2].away).toBe("Dunkerque");
  });

  test("scores finaux — le vainqueur se déduit du score, pas du <strong>", () => {
    expect(rows[0].homeGoals).toBe(30);
    expect(rows[0].awayGoals).toBe(28);
    // 27:31 → Nantes (l'extérieur) gagne, alors que <strong> est à droite.
    expect(rows[1].homeGoals).toBe(27);
    expect(rows[1].awayGoals).toBe(31);
    expect(rows[2].homeGoals).toBe(30);
    expect(rows[2].awayGoals).toBe(30);
  });

  test("les 3 issues possibles sont conservées (bias check anti-dérive)", () => {
    // Garde-fou le plus important du fichier : si le parseur réintroduit un
    // ancrage sur <strong>, cet invariant casse et le test le dit.
    const outcomes = rows.map((r) =>
      r.homeGoals > r.awayGoals ? "home" : r.homeGoals < r.awayGoals ? "away" : "draw",
    );
    expect(outcomes.sort()).toEqual(["away", "draw", "home"]);
  });

  test("cotes 1X2 réelles récupérées", () => {
    expect(rows[0].oddsHome).toBe(1.4);
    expect(rows[0].oddsDraw).toBe(9.47);
    expect(rows[0].oddsAway).toBe(3.77);
  });

  test("dates déduites de la saison", () => {
    expect(rows[0].date).toBe("2026-06-06");
    expect(rows[1].date).toBe("2025-10-04");
    // 12.01. → mois ≤ 7 → année de FIN de saison.
    expect(rows[2].date).toBe("2026-01-12");
  });

  test("id de match stable extrait de l'URL", () => {
    expect(rows[0].refId).toBe("IqgXBKtf");
    expect(rows[1].refId).toBe("AbCdEfG");
    expect(rows[2].refId).toBe("vDMEOcQa");
  });

  test("PAS de score mi-temps sur ces pages (limite assumée)", () => {
    // Le markup ne contient pas `table-main__partial` : on ne l'invente pas.
    for (const r of rows) {
      expect((r as { halftime?: unknown }).halftime).toBeUndefined();
    }
  });

  test("html vide / sans résultat → []", () => {
    expect(parseSeasonRows("", "2025-2026")).toEqual([]);
    expect(parseSeasonRows("<div>rien</div>", "2025-2026")).toEqual([]);
    expect(parseSeasonRows(REAL_ROWS, "sans-saison")[0].date).toBeNull();
  });

  test("chaîne complète : libellé du <select> → dates exploitables", () => {
    // Chaîne découverte → page de saison, telle que le scripteur l'enchaîne.
    const path = discoverSeasonLinks(REAL_SELECT).get("2025/2026")!;
    const rows = parseSeasonRows(REAL_ROWS, "2025/2026");
    expect(path).toBe("/handball/france/starligue-2025-2026/");
    expect(rows.every((r) => r.date != null)).toBe(true);
  });

  // Les clubs portent des tirets SANS espaces dans leur nom (« St. Raphael »,
  // « Cesson Rennes-Metropole ») : un séparateur naïf au `-` nu les couperait en
  // deux et fabriquerait une équipe fantôme du nom du slicing.
  test("noms d'équipe contenant un tiret sans espaces : pas de slicing", () => {
    const html = `<table><tr>
      <td class="h-text-left"><a href="/x/St-Raphael-Tremblay/vLlVe8jd/" class="in-match"><span>Tremblay</span> - <span><strong>St. Raphael</strong></span></a></td>
      <td class="h-text-center"><a href="/x/St-Raphael-Tremblay/vLlVe8jd/">29:31</a></td>
      <td data-odd="1.70"></td><td data-odd="8.00"></td><td data-odd="2.05"></td>
      <td class="h-text-right">05.05.</td></tr></table>`;
    const [r] = parseSeasonRows(html, "2025/2026");
    expect(r.home).toBe("Tremblay");
    expect(r.away).toBe("St. Raphael");
  });

  test("cellule équipes sans séparateur → ligne ignorée (jamais de nom inventé)", () => {
    const html = `<table><tr>
      <td class="h-text-left"><a href="/x/foo/abcdef/">PasDeSeparateur</a></td>
      <td class="h-text-center"><a href="/x/foo/abcdef/">30:28</a></td>
      <td data-odd="1.70"></td><td data-odd="8.00"></td><td data-odd="2.05"></td>
      <td class="h-text-right">05.05.</td></tr></table>`;
    expect(parseSeasonRows(html, "2025/2026")).toEqual([]);
  });

  test("footer sans cellules de match (bannière OddsPortal) → ignoré", () => {
    const html = `<table><tr>
      <td style="vertical-align: middle;"><a href="/redirects/"><img src="/x.gif" alt="OddsPortal.com" /></a></td>
      <td style="vertical-align: middle;">Betting odds service provided by OddsPortal.com</td></tr></table>`;
    expect(parseSeasonRows(html, "2025/2026")).toEqual([]);
  });
});

// ─── Validation des cotes 1X2 ───

// Les cellules de cote sont lues par POSITION (`tds[2..4]`), ce qui casse sur une
// ligne dont la mise en page diffère. Mesuré 2026-10-04 sur la vraie base :
// `SIK Viborg W vs Rodovre W` stockait `80.9 / 86.73 / 1.98`, somme de
// probabilités implicites = 0.53. Mathématiquement impossible.
describe("isCoherentOddsTriple — invariant métier, pas heuristique de markup", () => {
  test("triplet réel accepté", () => {
    expect(isCoherentOddsTriple(1.4, 9.47, 3.77)).toBe(true);
    expect(isCoherentOddsTriple(1.01, 43.25, 33.63)).toBe(true);
    expect(isCoherentOddsTriple(2.1, 12, 2.4)).toBe(true);
  });

  test("cotes impossibles rejetées (somme de 1/p < 0.9)", () => {
    expect(isCoherentOddsTriple(80.9, 86.73, 1.98)).toBe(false);
    expect(isCoherentOddsTriple(40, 40, 40)).toBe(false);
  });

  test("cote < 1 rejetée (une cote décimale sous 1 n'existe pas)", () => {
    expect(isCoherentOddsTriple(0.98, 9.5, 4.5)).toBe(false);
    expect(isCoherentOddsTriple(0.5, 9.5, 4.5)).toBe(false);
  });

  test("favoris lourds réels à 1.00 / 1.01 ACCEPTÉS (seuil à 1, pas 1.01)", () => {
    // Ces deux lignes sont dans la vraie base. Un garde-fou à 1.01 les aurait
    // jetées : c'est le test sur triplet réel qui l'a révélé.
    expect(isCoherentOddsTriple(1.0, 37, 34.88)).toBe(true);
    expect(isCoherentOddsTriple(1.01, 43.25, 33.63)).toBe(true);
  });

  test("cote manquante ou non finie rejetée", () => {
    expect(isCoherentOddsTriple(null, 9.5, 4.5)).toBe(false);
    expect(isCoherentOddsTriple(1.8, null, 4.5)).toBe(false);
    expect(isCoherentOddsTriple(1.8, 9.5, null)).toBe(false);
    expect(isCoherentOddsTriple(NaN, 9.5, 4.5)).toBe(false);
    expect(isCoherentOddsTriple(Infinity, 9.5, 4.5)).toBe(false);
  });

  test("marge absurde rejetée (somme > 1.4)", () => {
    // 3 cotes à 3.0 → Σ 1/p = 1.0, OK. À 1.05 partout → Σ = 2.86, impossible.
    expect(isCoherentOddsTriple(1.05, 1.05, 1.05)).toBe(false);
  });

  test("une ligne à cotes illisibles est conservée SANS cote, pas écrasée", () => {
    // Le score reste bon : on garde le match, on juste refuse la cote fausse.
    const html = `<table><tr>
      <td class="h-text-left"><a href="/x/foo/abcdef/" class="in-match"><span>SIK Viborg W</span> - <span><strong>Rodovre W</strong></span></a></td>
      <td class="h-text-center"><a href="/x/foo/abcdef/">18:27</a></td>
      <td data-odd="80.9"></td><td data-odd="86.73"></td><td data-odd="1.98"></td>
      <td class="h-text-right">07.09.</td></tr></table>`;
    const [r] = parseSeasonRows(html, "2025/2026");
    expect(r.home).toBe("SIK Viborg W");
    expect(r.homeGoals).toBe(18);
    expect(r.awayGoals).toBe(27);
    expect(r.oddsHome).toBeNull();
    expect(r.oddsDraw).toBeNull();
    expect(r.oddsAway).toBeNull();
  });
});

// ─── Découverte des saisons ───

describe("discoverSeasonLinks — le slug change d'une saison à l'autre", () => {
  const links = discoverSeasonLinks(REAL_SELECT);

  test("découvre les saisons triées, saison en cours incluse (pas de suffixe)", () => {
    expect(links.size).toBe(4);
    expect(links.get("2026/2027")).toBe("/handball/france/starligue/");
    expect(links.get("2025/2026")).toBe("/handball/france/starligue-2025-2026/");
  });

  test("ignore les <option> qui ne sont pas des saisons", () => {
    expect(links.has("date")).toBe(false);
    expect(links.has("round")).toBe(false);
  });

  test("MOL Liga : slugs successifs différents (pas de slug figé)", () => {
    const mol = `<select>
      <option value="/handball/europe/doprastav-liga-women/">2026/2027</option>
      <option value="/handball/europe/doprastav-liga-women-2025-2026/">2025/2026</option>
      <option value="/handball/europe/mol-liga-women-2024-2025/">2024/2025</option>
      <option value="/handball/europe/whil-women-2016-2017/">2016/2017</option></select>`;
    const m = discoverSeasonLinks(mol);
    expect(m.get("2025/2026")).toBe("/handball/europe/doprastav-liga-women-2025-2026/");
    expect(m.get("2024/2025")).toBe("/handball/europe/mol-liga-women-2024-2025/");
    expect(m.get("2016/2017")).toBe("/handball/europe/whil-women-2016-2017/");
  });

  test("sélection par année décroissante (taper la saison en cours)", () => {
    const entries = [...links.entries()].sort(
      (a, b) => Number(b[0].slice(0, 4)) - Number(a[0].slice(0, 4)),
    );
    expect(entries[0][0]).toBe("2027/2028");
    expect(entries.slice(0, 2).map((e) => e[0])).toEqual(["2027/2028", "2026/2027"]);
  });

  test("page sans <select> de saisons → Map vide", () => {
    expect(discoverSeasonLinks("<div>rien</div>").size).toBe(0);
  });
});
