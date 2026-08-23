// Test unitaire de evaluateMarket — logique d'auto-règlement des marchés
import { evaluateMarket } from "../src/lib/bet-manager/auto-settle";
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

console.log(`\n${pass} ok / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);