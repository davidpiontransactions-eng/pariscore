// Test du parser OCR 1xbet — textes de tickets simulés (sortie tesseract typique)
// + test du service unifié d'import HTML/ZIP (phase P4 bettrack).
import { parse1xbetTicket, parseTicketText } from "../src/lib/bet-manager/ocr";
import { splitMatchLabel } from "../src/lib/bet-manager/auto-settle";
import {
  couponToBet,
  detect1xbetSource,
  ingest1xbet,
  mapStatus,
  parse1xbetHtml,
  zipEntries,
} from "../src/lib/bet-manager/import-1xbet";

const ticket1xbetSimple = `
Mon compte
N° de coupon : 183945728364
20.08.2026 18:45

Championnat de France. Ligue 1
PSG — Olympique de Marseille
Résultat du match :
Paris Saint-Germain va gagner 1.85

Montant du pari 10.00 EUR
Gain possible 18.50 EUR
`;

const ticket1xbetCombo = `
N° de coupon : 183945728400
20.08.2026

Ligue 1
Lyon — AS Monaco
Résultat du match :
Olympique Lyonnais 2.10

La Liga
Real Madrid — FC Barcelone
Total buts :
Plus de 2.5 1.72

Serie A
Inter — Milan
Les deux équipes marquent :
Oui 1.65

Cote totale : 5.95
Montant du pari 5.00 EUR
Gain possible 29.75 EUR
`;

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean, extra?: any) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}`, extra ?? "");
  }
};

// splitMatchLabel
check("split 'PSG vs OM'", JSON.stringify(splitMatchLabel("PSG vs OM")) === '["psg","om"]');
check("split 'Real Madrid — FC Barcelone'", splitMatchLabel("Real Madrid — FC Barcelone")?.[0] === "real madrid");
check("split null sur texte simple", splitMatchLabel("Coucou") === null);

// Ticket simple
const t1 = parse1xbetTicket(ticket1xbetSimple);
check("simple: 1 leg", t1.legs.length === 1, t1.legs);
check("simple: matchLabel", t1.matchLabel === "PSG vs Olympique de Marseille", t1.matchLabel);
check("simple: market 1X2", t1.market === "1X2", t1.market);
check("simple: pick", /paris saint/i.test(t1.pick ?? ""), t1.pick);
check("simple: odds 1.85", t1.odds === 1.85, t1.odds);
check("simple: stake 10", t1.stake === 10, t1.stake);
check("simple: betType single", t1.betType === "single");
check("simple: bookmaker", t1.bookmaker === "1xbet");

// Ticket combiné
const t2 = parse1xbetTicket(ticket1xbetCombo);
check("combo: 3 legs", t2.legs.length === 3, t2.legs);
check("combo: betType combo", t2.betType === "combo");
check("combo: cote totale 5.95", Math.abs((t2.odds ?? 0) - 5.95) < 0.01, t2.odds);
check("combo: leg2 market Over/Under", t2.legs[1]?.market === "Over/Under", t2.legs[1]?.market);
check("combo: leg3 market BTTS", t2.legs[2]?.market === "BTTS", t2.legs[2]?.market);
check("combo: stake 5", t2.stake === 5, t2.stake);
check("combo: leg2 pick Plus de 2.5", /plus de 2\.5/i.test(t2.legs[1]?.pick ?? ""), t2.legs[1]?.pick);

// Fallback générique : texte quelconque
const t3 = parseTicketText("Bet365\nLille\nLens\n2.50\n10 €\nwon");
check("fallback: odds trouvé", t3.odds === 2.5, t3.odds);
check("fallback: stake trouvé", t3.stake === 10, t3.stake);

// ─── P4 : service unifié import-1xbet (HTML historique, ZIP, dédup) ─────────

const HTML_PAGE = `<!DOCTYPE html><html><body>
<div class="cupHisZ">Nombre de paris : 2 · Total des gains : 0,00 EUR · Montant des paris non traités : 5.00 EUR</div>
<div class="cupHisNew">
  <div class="time">№ 183945728364 20.08.2026 18:45</div>
  <div class="ri">Type de pari : Simple</div>
  <table class="table_prop">
    <tr>
      <td class="ha"><b>Football. Ligue 1. PSG — Olympique de Marseille</b></td>
      <td class="ce" rowspan="2">Paris Saint-Germain va gagner</td>
      <td class="ce">1.85</td>
      <td class="ce">Payé</td>
    </tr>
    <tr>
      <td id="tdH">Cote totale 1.85</td>
      <td class="ce">10.00 EUR</td>
      <td class="ce">18.50 EUR</td>
      <td class="ce">Payé</td>
    </tr>
  </table>
</div>
<div class="cupHisNew">
  <div class="time">№ 183945728400 21.08.2026</div>
  <div class="ri">Type de pari : Combiné</div>
  <table class="table_prop">
    <tr>
      <td class="ha"><b>Football. Ligue 1. Lyon — AS Monaco</b></td>
      <td class="ce" rowspan="2">Olympique Lyonnais va gagner</td>
      <td class="ce">2.10</td>
      <td class="ce">Perdue</td>
    </tr>
    <tr>
      <td class="ha"><b>Football. La Liga. Real Madrid — FC Barcelone</b></td>
      <td class="ce" rowspan="2">Plus de 2.5 buts</td>
      <td class="ce">1.72</td>
      <td class="ce">Perdue</td>
    </tr>
    <tr>
      <td class="ha"><b>Football. Serie A. Inter — Milan</b></td>
      <td class="ce" rowspan="2">Oui</td>
      <td class="ce">1.65</td>
      <td class="ce">Perdue</td>
    </tr>
    <tr>
      <td id="tdH">Cote totale : 5.95</td>
      <td class="ce">5.00 EUR</td>
      <td class="ce">0.00 EUR</td>
      <td class="ce">Perdue</td>
    </tr>
  </table>
</div>
</body></html>`;

/** ZIP STOCKÉ minimal (méthode 0) — construit à la main, zéro dépendance. */
function buildStoredZip(name: string, content: string): ArrayBuffer {
  const enc = new TextEncoder();
  const data = enc.encode(content);
  const nb = enc.encode(name);
  let crc = ~0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  crc = ~crc >>> 0;
  const lh = 30 + nb.length;
  const cd = 46 + nb.length;
  const total = lh + data.length + cd + 22;
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  // Local file header
  dv.setUint32(0, 0x04034b50, true);
  dv.setUint16(4, 20, true);
  dv.setUint32(8, 0, true); // méthode 0 = stocké
  dv.setUint32(14, crc, true);
  dv.setUint32(18, data.length, true);
  dv.setUint32(22, data.length, true);
  dv.setUint16(26, nb.length, true);
  u8.set(nb, 30);
  u8.set(data, lh);
  // Central directory
  const off = lh + data.length;
  dv.setUint32(off, 0x02014b50, true);
  dv.setUint16(off + 4, 20, true);
  dv.setUint16(off + 6, 20, true);
  dv.setUint32(off + 16, crc, true);
  dv.setUint32(off + 20, data.length, true);
  dv.setUint32(off + 24, data.length, true);
  dv.setUint16(off + 28, nb.length, true);
  dv.setUint32(off + 42, 0, true);
  u8.set(nb, off + 46);
  // EOCD
  const eo = off + cd;
  dv.setUint32(eo, 0x06054b50, true);
  dv.setUint16(eo + 8, 1, true);
  dv.setUint16(eo + 10, 1, true);
  dv.setUint32(eo + 12, cd, true);
  dv.setUint32(eo + 16, off, true);
  return buf;
}

// HTML : page d'historique à 2 coupons + résumé
const parsed = parse1xbetHtml(HTML_PAGE);
check("html: 2 coupons", parsed.coupons.length === 2, parsed.coupons.length);
check("html: résumé count=2", parsed.summary?.count === 2, parsed.summary);
check("html: résumé unsettled=5", parsed.summary?.unsettled === 5, parsed.summary);
check("html: réf coupon simple", parsed.coupons[0]?.externalRef === "183945728364", parsed.coupons[0]?.externalRef);
check("html: date placement 2026-08-20", parsed.coupons[0]?.placedKey === "2026-08-20", parsed.coupons[0]?.placedKey);
check("html: type « simple »", parsed.coupons[0]?.betTypeLabel === "simple", parsed.coupons[0]?.betTypeLabel);

const betSimple = couponToBet(parsed.coupons[0]!);
check("coupon simple → bet: non null", betSimple !== null);
check("coupon simple: single / 1 leg", betSimple?.betType === "single" && betSimple.legs.length === 1);
check("coupon simple: odds 1.85", betSimple?.odds === 1.85, betSimple?.odds);
check("coupon simple: stake 10", betSimple?.stake === 10, betSimple?.stake);
check("coupon simple: status won", betSimple?.status === "won", betSimple?.status);
check("coupon simple: payout 18.5 / profit 8.5", betSimple?.payout === 18.5 && betSimple?.profit === 8.5, betSimple);
check("coupon simple: sport football", betSimple?.sport === "football", betSimple?.sport);
check("coupon simple: compétition Ligue 1", betSimple?.competition === "Ligue 1", betSimple?.competition);
check("coupon simple: matchLabel", betSimple?.matchLabel === "PSG — Olympique de Marseille", betSimple?.matchLabel);
check("coupon simple: bookmaker 1xbet", betSimple?.bookmaker === "1xbet");
check("coupon simple: placedAt ISO", betSimple?.placedAt === "2026-08-20", betSimple?.placedAt);

const betCombo = couponToBet(parsed.coupons[1]!);
check("coupon combo: combo / 3 legs", betCombo?.betType === "combo" && betCombo.legs.length === 3, betCombo?.legs.length);
check("coupon combo: cote totale 5.95", betCombo?.odds === 5.95, betCombo?.odds);
check("coupon combo: status lost, payout 0, profit −5", betCombo?.status === "lost" && betCombo?.payout === 0 && betCombo?.profit === -5, betCombo);
check("coupon combo: matchLabel « 3 sélections »", betCombo?.matchLabel === "3 sélections", betCombo?.matchLabel);
check("coupon combo: market Combiné", betCombo?.market === "Combiné", betCombo?.market);

// ZIP : archive stockée contenant la même page
const zipBuf = buildStoredZip("coupon.html", HTML_PAGE);
check("zip: entrée lisible", zipEntries(zipBuf).length === 1 && zipEntries(zipBuf)[0].name === "coupon.html");
const fromZip = await ingest1xbet(zipBuf);
check("zip: source=zip", fromZip.source === "zip", fromZip.source);
check("zip: 2 coupons parsés depuis l'archive", fromZip.bets.length === 2, fromZip.bets.length);
check("zip: bet identique au HTML direct", fromZip.bets[0]?.externalRef === "183945728364");

// Dédup par externalRef
const dedup = await ingest1xbet(HTML_PAGE, { existingRefs: ["183945728364"] });
check("dédup: 1 doublon écarté", dedup.duplicates === 1 && dedup.bets.length === 1, dedup.duplicates);
check("dédup: skippedRefs porté", dedup.skippedRefs[0] === "183945728364", dedup.skippedRefs);

// Texte OCR via le point d'entrée unique (№ « N° de coupon » → externalRef)
const fromText = await ingest1xbet(ticket1xbetSimple);
check("texte: source=text", fromText.source === "text", fromText.source);
check("texte: externalRef du N° de coupon", fromText.bets[0]?.externalRef === "183945728364", fromText.bets[0]?.externalRef);

// Détection de source
check("detect: html", detect1xbetSource(HTML_PAGE) === "html");
check("detect: text", detect1xbetSource(ticket1xbetSimple) === "text");
check("detect: zip (PK)", detect1xbetSource(zipBuf) === "zip");

// Statuts
check("status: Payé → won connu", mapStatus("Payé").status === "won" && mapStatus("Payé").known);
check("status: Perdue → lost connu", mapStatus("Perdue").status === "lost");
check("status: Remboursé → void connu", mapStatus("Remboursé").status === "void");
check("status: Cashout → cashout connu", mapStatus("Cash out").status === "cashout");
check("status: inconnu → pending non connu", (() => { const r = mapStatus("Bidule"); return r.status === "pending" && !r.known; })());

console.log(`\n${pass} ok / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);