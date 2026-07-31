// Tests du repli officiel ATP/WTA — mapping pur des entrées scrapées vers
// LeaderboardRow, et garde-fous de couverture de getOfficialLeaderboard.
// Lancer : bun test src/lib/tennis-stats/official-leaderboard.test.ts

import { describe, expect, it } from "bun:test";
import {
  atpEntryToRow,
  getOfficialLeaderboard,
  wtaRawToRow,
} from "./official-leaderboard";
import type { LeaderboardParams } from "./leaderboard";

// Forme réelle observée (scripts/scrape-tour-leaderboards.py, 2026-07-31).
const SINNER_SERVE = {
  Stats: {
    ServeRating: "302.4",
    FirstServePct: "63.8%",
    FirstServePointsWonPct: "80.9%",
    SecondServePointsWonPct: "58.1%",
    ServiceGamesWonPct: "92.9%",
    AvgAcesPerMatch: "8.2",
    AvgDblFaultsPerMatch: "1.5",
    ServeRatingSortField: 302.4,
    FirstServePctSortField: 63.8,
    FirstServePointsWonPctSortField: 80.9,
    SecondServePointsWonPctSortField: 58.1,
    ServiceGamesWonPctSortField: 92.9,
    AvgAcesPerMatchSortField: 8.2,
    AvgDblFaultsPerMatchSortField: 1.5,
  },
  PlayerRank: 1,
  PlayerId: "S0AG",
  PlayerName: "Jannik Sinner",
  PlayerCountryCode: "ITA",
};

const MARTINCOVA = {
  PlayerNbr: "318060",
  Last_Name: "MARTINCOVA",
  First_Name: "TEREZA",
  Nationality: "CZE",
  Current_Rank: 300,
  Aces: 1,
  Double_Faults: 7,
  MatchCount: 3,
  first_serve_won_percent: 54.1,
  second_serve_won_percent: 45.7,
  first_return_percent: 35.9,
  second_return_percent: 50,
  breakpoint_converted_percent: 50,
  first_serve_percent: 83.8,
  return_games_won_percent: 25,
  breakpoint_saved_percent: 53.3,
  service_games_won_percent: 57.6,
};

describe("atpEntryToRow", () => {
  it("mappe le board serve avec le rating officiel", () => {
    const row = atpEntryToRow(SINNER_SERVE, "serve");
    expect(row).not.toBeNull();
    expect(row!.player).toBe("Jannik Sinner");
    expect(row!.playerId).toBe("S0AG");
    expect(row!.ioc).toBe("it");
    expect(row!.matches).toBeNull(); // non publié par l'ATP
    expect(row!.rating).toBe(302.4);
    expect(row!.firstServePct).toBe(63.8);
    expect(row!.firstServeWonPct).toBe(80.9);
    expect(row!.secondServeWonPct).toBe(58.1);
    expect(row!.serviceGamesWonPct).toBe(92.9);
    expect(row!.acesPerMatch).toBe(8.2);
    expect(row!.dfsPerMatch).toBe(1.5);
    // Autres boards non remplis (un board par dataset ATP).
    expect(row!.returnFirstWonPct).toBeNull();
    expect(row!.bpSavedPct).toBeNull();
  });

  it("retombe sur la chaîne pourcentage si le SortField manque", () => {
    const row = atpEntryToRow(
      {
        Stats: { FirstServePct: "65.9%", ServiceGamesWonPct: "91.2%" },
        PlayerName: "Test Player",
      },
      "serve"
    );
    expect(row!.firstServePct).toBe(65.9);
    expect(row!.serviceGamesWonPct).toBe(91.2);
    expect(row!.rating).toBeNull(); // pas de ServeRating → calculé ensuite
  });

  it("rejette une entrée sans nom de joueur", () => {
    expect(atpEntryToRow({ Stats: {} }, "serve")).toBeNull();
  });
});

describe("wtaRawToRow", () => {
  it("mappe une ligne complète sur les 3 boards", () => {
    const row = wtaRawToRow(MARTINCOVA);
    expect(row).not.toBeNull();
    expect(row!.player).toBe("Tereza Martincova");
    expect(row!.playerId).toBe("318060");
    expect(row!.ioc).toBe("cz");
    expect(row!.matches).toBe(3);
    expect(row!.firstServePct).toBe(83.8);
    expect(row!.acesPerMatch).toBe(0.3); // 1 ace / 3 matchs
    expect(row!.dfsPerMatch).toBe(2.3); // 7 DF / 3 matchs
    expect(row!.returnFirstWonPct).toBe(35.9);
    expect(row!.bpSavedPct).toBe(53.3);
    // Non publiés par la WTA.
    expect(row!.tiebreaksWonPct).toBeNull();
    expect(row!.decidingSetsWonPct).toBeNull();
  });

  it("rejette une ligne sans nom", () => {
    expect(wtaRawToRow({ First_Name: "", Last_Name: "" })).toBeNull();
  });
});

describe("getOfficialLeaderboard — couverture", () => {
  const base: LeaderboardParams = {
    board: "serve",
    tour: "atp",
    surface: "all",
    period: "52w",
    vsRank: "all",
    minMatches: 5,
  };

  // Résultat null déterministe, cache présent ou non (clé absente ou rejet amont).
  it("retourne null pour les filtres non couverts par les sources", () => {
    expect(
      getOfficialLeaderboard({ ...base, vsRank: "top5" })
    ).toBeNull(); // ATP : top5 non publié
    expect(
      getOfficialLeaderboard({ ...base, tour: "wta", vsRank: "top10" })
    ).toBeNull(); // WTA : vsRank non filtrable
    expect(
      getOfficialLeaderboard({ ...base, tour: "wta", surface: "clay" })
    ).toBeNull(); // WTA : surface non filtrable
  });
});
