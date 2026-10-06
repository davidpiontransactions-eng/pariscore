// Test unitaire de evaluateMarket — logique d'auto-règlement des marchés
// + sélection sync/backfill selectToSettle (phase P5 bettrack)
import { evaluateMarket, selectToSettle } from "../src/lib/bet-manager/auto-settle";
import type { Bet } from "../src/lib/bet-manager/types";

function mkBet(partial: Partial<Bet>): Bet {
  return {
    id: "b1",
    bankrollId: "bk1",
    betType: "single",
    sport: "football",
    stake: 10,
    odds: 2,
    status: "pending",
    placedAt: "2026-08-20T00:00:00.000Z",
    legs: [],
    ...partial,
  } as Bet;
}

const fx = (home: number | null, away: number | null) => ({
  fixture: { id: 1, date: "2026-08-20T00:00:00Z", status: { short: "FT" } },
  teams: { home: { name: "Paris Saint Germain" }, away: { name: "Olympique de Marseille" } },
  goals: { home, away },
  score: { halftime: { home: null, away: null } },
});

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean, got?: any) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label} →`, got);
  }
};

// 1X2
check("1X2 home win → pari domicile gagné", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "1X2", pick: "PSG" }), fx(2, 0)) === "won");
check("1X2 home win → pari extérieur perdu", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "1X2", pick: "OM" }), fx(2, 0)) === "lost");
check("1X2 nul → pari nul gagné", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "1X2", pick: "Nul" }), fx(1, 1)) === "won");
check("1X2 nom complet du pick", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "1X2", pick: "Paris Saint-Germain" }), fx(3, 1)) === "won");
check("1X2 vainqueur (alias marché)", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "Vainqueur", pick: "Marseille" }), fx(0, 2)) === "won");

// Over/Under
check("Over 2.5 avec 3 buts → gagné", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "Over/Under", pick: "Over 2.5" }), fx(2, 1)) === "won");
check("Over 2.5 avec 2 buts → perdu", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "Over/Under", pick: "Over 2.5" }), fx(1, 1)) === "lost");
check("Under 2.5 avec 2 buts → gagné", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "Over/Under", pick: "Under 2.5" }), fx(1, 1)) === "won");
check("Over 3.0 avec 3 buts → void (ligne entière)", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "Total buts", pick: "Plus de 3.0" }), fx(2, 1)) === "void");
check("Over 1.5 marché FR (2 buts → gagné)", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "Total buts", pick: "Plus de 1.5" }), fx(1, 1)) === "won");

// BTTS
check("BTTS oui + 1-1 → gagné", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "BTTS", pick: "Oui" }), fx(1, 1)) === "won");
check("BTTS oui + 2-0 → perdu", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "Les deux équipes marquent", pick: "Oui" }), fx(2, 0)) === "lost");
check("BTTS non + 2-0 → gagné", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "BTTS", pick: "Non" }), fx(2, 0)) === "won");

// Double chance
check("1X avec victoire domicile → gagné", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "Double chance", pick: "1X" }), fx(2, 1)) === "won");
check("1X avec victoire extérieur → perdu", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "Double chance", pick: "1X" }), fx(0, 2)) === "lost");
check("12 avec nul → perdu", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "Double chance", pick: "12" }), fx(1, 1)) === "lost");

// Non supporté
check("Marché inconnu → null (règlement manuel)", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "Score exact", pick: "2-0" }), fx(2, 0)) === null);
check("Score null → null", evaluateMarket(mkBet({ matchLabel: "PSG vs OM", market: "1X2", pick: "PSG" }), fx(null, null)) === null);

// ─── P5 : sélection sync + backfill (selectToSettle) ─────────────────────────
const NOW = new Date("2026-10-06T12:00:00Z").getTime();
const mkP = (id: string, daysAgo: number) => ({ id, placedAt: new Date(NOW - daysAgo * 86400000).toISOString() });

// Scénario A : 50 récents + 40 anciens (>3 j) → fresh 50 + backfill 20 (cap), sans doublon
const recentsA = Array.from({ length: 50 }, (_, i) => mkP(`r${i}`, i * 0.02));
const anciensA = Array.from({ length: 40 }, (_, i) => mkP(`s${i}`, 5 + i));
const selA = selectToSettle([...recentsA, ...anciensA], NOW);
check("sélection A : 50 fresh + 20 backfill = 70", selA.length === 70, selA.length);
check("sélection A : aucun doublon", new Set(selA.map((b) => b.id)).size === selA.length);
check(
  "sélection A : backfill du plus ancien au plus récent (tête = 44 j)",
  selA[50]?.id === "s39",
  selA[50]?.id
);
check(
  "sélection A : les 50 fresh sont les plus récents (tête = r0)",
  selA[0]?.id === "r0",
  selA[0]?.id
);

// Scénario B : fonds petit → un pending de 3,5 j (hors fresh) est bien backfillé
const recentsB = Array.from({ length: 60 }, (_, i) => mkP(`br${i}`, i * 0.01));
const selB = selectToSettle([...recentsB, mkP("mid", 3.5), ...Array.from({ length: 5 }, (_, i) => mkP(`bo${i}`, 10 + i))], NOW);
check("sélection B : mid (3,5 j) backfillé", selB.some((b) => b.id === "mid"), selB.map((b) => b.id));
check("sélection B : les 5 anciens backfillés", ["bo0", "bo1", "bo2", "bo3", "bo4"].every((id) => selB.some((b) => b.id === id)));
check("sélection B : total = 50 + 6", selB.length === 56, selB.length);

// Scénario C : tout tient dans fresh → pas de backfill, pas de doublon
const selC = selectToSettle(Array.from({ length: 10 }, (_, i) => mkP(`c${i}`, i)), NOW);
check("sélection C : 10/10 sans effet de bord", selC.length === 10 && new Set(selC.map((b) => b.id)).size === 10);

// Scénario D : pending de 2 j hors fresh → PAS backfillé (trop récent pour le fonds)
const selD = selectToSettle([...Array.from({ length: 60 }, (_, i) => mkP(`dr${i}`, i * 0.01)), mkP("young2j", 2)], NOW);
check("sélection D : 2 j hors fresh exclu du backfill", !selD.some((b) => b.id === "young2j"), selD.length);
check("sélection D : longueur bornée à 50 (fresh seul)", selD.length === 50, selD.length);

console.log(`\n${pass} ok / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);