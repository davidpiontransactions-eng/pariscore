// Test du parser OCR 1xbet — textes de tickets simulés (sortie tesseract typique)
import { parse1xbetTicket, parseTicketText } from "../src/lib/bet-manager/ocr";
import { splitMatchLabel } from "../src/lib/bet-manager/auto-settle";

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

console.log(`\n${pass} ok / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);