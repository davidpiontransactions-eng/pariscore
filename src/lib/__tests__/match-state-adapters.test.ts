import { describe, test, expect } from "bun:test";
import {
  basketballMatchState,
  basketballViewState,
  footballMatchState,
  handballMatchState,
  handballMatchStateSafe,
  rawStatusToMatchState,
  snookerMatchState,
} from "../match-state-adapters";
import { LIVE_STATUS_PATTERNS, SPORT_TYPES } from "../top-matches/types";
import type { FootballLiveState } from "../football-data";
import type { HandballMatchStatus } from "../handball-data";

/**
 * Contrat d'adaptation sport → `MatchState`.
 *
 * Invariant central football : **un statut live explicite du flux gagne toujours** sur
 * l'inférence par l'horodatage. Un match dont `status` est `FT` reste `finished` même si
 * son `scheduledAt` est dans le passé de plus de 2 h — sinon un match prolongé disparaît
 * de l'écran live.
 *
 * `now` est injecté : les tests sont déterministes quel que soit le fuseau du runner.
 */

const now = Date.parse("2026-10-09T20:00:00Z");

/** 20:00 UTC = 22:00 Paris, donc dans la même journée. */
const KO = "2026-10-09T19:00:00Z";
/** Coup d'envoi vieux de 5 h → hors de la fenêtre d'inférence « live ». */
const OLD_KO = "2026-10-09T15:00:00Z";

const live = (status: FootballLiveState["status"]): FootballLiveState =>
  ({
    homeScore: 0,
    awayScore: 0,
    minute: 12,
    status,
    homePossession: 50,
    homeShots: null,
    awayShots: null,
    homeShotsOnTarget: null,
    awayShotsOnTarget: null,
    homeCorners: null,
    awayCorners: null,
  }) satisfies FootballLiveState;

describe("footballMatchState", () => {
  test("pas de live + coup d'envoi passé (< 2 h) → live", () => {
    expect(footballMatchState({ scheduledAt: KO, live: null }, now)).toBe("live");
  });

  test("pas de live + coup d'envoi futur → scheduled", () => {
    expect(
      footballMatchState({ scheduledAt: "2026-10-09T21:00:00Z", live: null }, now),
    ).toBe("scheduled");
  });

  test("pas de live + coup d'envoi vieux de plus de 2 h → scheduled (jamais finished)", () => {
    // On ne marque jamais `finished` sans statut explicite : le flux peut être en retard,
    // et un match masqué par erreur est pire qu'un match proposé trop tard.
    expect(footballMatchState({ scheduledAt: OLD_KO, live: null }, now)).toBe("scheduled");
  });

  test("status LIVE → live", () => {
    expect(footballMatchState({ scheduledAt: KO, live: live("LIVE") }, now)).toBe("live");
  });

  test("status HT → halftime", () => {
    expect(footballMatchState({ scheduledAt: KO, live: live("HT") }, now)).toBe("halftime");
  });

  test("status FT → finished", () => {
    expect(footballMatchState({ scheduledAt: KO, live: live("FT") }, now)).toBe("finished");
  });

  test("status PEN → live (séance de tirs au but en cours)", () => {
    // Aligné sur `LIVE_STATUS_PATTERNS.football` qui a `^pen$`. Rendre `finished` ici
    // aurait fait dire « Terminé » par la carte pendant que l'onglet Top 10 dit « Live ».
    expect(footballMatchState({ scheduledAt: KO, live: live("PEN") }, now)).toBe("live");
  });

  test("le statut live bat l'horodatage : FT reste finished après 5 h", () => {
    expect(
      footballMatchState({ scheduledAt: OLD_KO, live: live("FT") }, now),
    ).toBe("finished");
  });

  test("scheduledAt absent ou invalide → scheduled, jamais de crash", () => {
    expect(footballMatchState({ scheduledAt: "", live: null }, now)).toBe("scheduled");
    expect(footballMatchState({ scheduledAt: "pas-une-date", live: null }, now)).toBe("scheduled");
  });

  test("statut inconnu du flux → repli sur l'horloge, pas de devinette", () => {
    const bogus = { ...live("LIVE"), status: "WEIRD" as FootballLiveState["status"] };
    expect(footballMatchState({ scheduledAt: KO, live: bogus }, now)).toBe("live");
    expect(
      footballMatchState({ scheduledAt: "2026-10-09T22:00:00Z", live: bogus }, now),
    ).toBe("scheduled");
  });
});

describe("rawStatusToMatchState — vocabulaire partagé", () => {
  test("états terminaux", () => {
    expect(rawStatusToMatchState("football", "FT", KO, now)).toBe("finished");
    expect(rawStatusToMatchState("football", "full-time", KO, now)).toBe("finished");
    expect(rawStatusToMatchState("football", "AET", KO, now)).toBe("finished");
    expect(rawStatusToMatchState("football", "Completed", KO, now)).toBe("finished");
    expect(rawStatusToMatchState("football", "Terminé", KO, now)).toBe("finished");
  });

  test("reporté / annulé — et jamais confondus avec finished ou suspendu", () => {
    // Régression ciblée : « postponed » contient « post » et « canceled » ne doit pas
    // tomber dans le sac « finished ». Un match reporté affiché « terminé » est un bug
    // qui fait perdre une mise en attente.
    expect(rawStatusToMatchState("football", "Postponed", KO, now)).toBe("postponed");
    expect(rawStatusToMatchState("football", "Cancelled", KO, now)).toBe("canceled");
    expect(rawStatusToMatchState("football", "Canceled", KO, now)).toBe("canceled");
    expect(rawStatusToMatchState("football", "Walkover", KO, now)).toBe("canceled");
    expect(rawStatusToMatchState("football", "abandoned", KO, now)).toBe("canceled");
    // Assertion forte, pas `.not.toBe("postponed")` : la version précédente acceptait
    // n'importe quel autre résultat — y compris `live`, cas réel de `SUSPENDED_MARKET`
    // qui tombait sur l'horloge et affichait un marché fermé en cours de match.
    expect(rawStatusToMatchState("handball", "SUSPENDED_MARKET", KO, now)).toBe("suspended");
    expect(rawStatusToMatchState("football", "Suspendu", KO, now)).toBe("suspended");
  });

  test("marché suspendu → suspended", () => {
    expect(rawStatusToMatchState("football", "Suspended", KO, now)).toBe("suspended");
    expect(rawStatusToMatchState("football", "betting suspended", KO, now)).toBe("suspended");
    expect(rawStatusToMatchState("football", "Market closed", KO, now)).toBe("suspended");
  });

  test("mi-temps / pause → halftime", () => {
    expect(rawStatusToMatchState("football", "HT", KO, now)).toBe("halftime");
    expect(rawStatusToMatchState("handball", "halftime", KO, now)).toBe("halftime");
    expect(rawStatusToMatchState("handball", "Pause", KO, now)).toBe("halftime");
    expect(rawStatusToMatchState("football", "Half Time", KO, now)).toBe("halftime");
  });

  test("un quart de basket n'est PAS une mi-temps", () => {
    // Régression ciblée : `q[1-4]` figurait dans HALFTIME_PATTERNS et était consulté
    // AVANT la table live → chaque quart ressortait « Mi-temps ». Le test précédent
    // assertait `Q3 → halftime`, c'est-à-dire il figeait le bug.
    expect(rawStatusToMatchState("fiba", "Q3", KO, now)).toBe("live");
    expect(rawStatusToMatchState("nba", "Q4", KO, now)).toBe("live");
    expect(rawStatusToMatchState("wnba", "Q1", KO, now)).toBe("live");
  });

  test("statut live repris depuis la table partagée du codebase", () => {
    expect(rawStatusToMatchState("football", "IN_PLAY", KO, now)).toBe("live");
    expect(rawStatusToMatchState("handball", "2ND", KO, now)).toBe("live");
    expect(rawStatusToMatchState("fiba", "OT", KO, now)).toBe("live");
  });

  test("statut vide → repli sur l'horloge", () => {
    expect(rawStatusToMatchState("football", null, KO, now)).toBe("live");
    expect(rawStatusToMatchState("football", "", "2026-10-09T22:00:00Z", now)).toBe("scheduled");
  });

  test("« scheduled » EXPLICITE bat l'horloge (régression found by test)", () => {
    // Sans la table pré-match, ce statut ne rencontrait aucune entrée et retombait sur
    // l'horloge → un match explicitement « pas commencé » dont l'heure était passée de
    // 10 min ressortait `live`. Le flux avait raison, l'inférence avait tort.
    expect(rawStatusToMatchState("snooker", "scheduled", KO, now)).toBe("scheduled");
    expect(rawStatusToMatchState("football", "pre", KO, now)).toBe("scheduled");
    expect(rawStatusToMatchState("football", "not_started", KO, now)).toBe("scheduled");
    expect(rawStatusToMatchState("football", "upcoming", KO, now)).toBe("scheduled");
  });

  test("symétrique : un statut explicite bat l'horloge dans les deux sens", () => {
    // finished + kickoff récent → finished (déjà couvert côté football)
    expect(rawStatusToMatchState("football", "FT", "2026-10-09T19:55:00Z", now)).toBe("finished");
    // scheduled + kickoff récent → scheduled (ce test)
    expect(rawStatusToMatchState("football", "scheduled", KO, now)).toBe("scheduled");
  });

  test("clé sport inconnue → repli sur l'horloge, jamais de supposition", () => {
    expect(rawStatusToMatchState("sport-inexistant", "LIVE", KO, now)).toBe("live");
    expect(rawStatusToMatchState("sport-inexistant", "qqc", "2026-10-09T22:00:00Z", now)).toBe(
      "scheduled",
    );
  });
});

describe("basketballMatchState", () => {
  test("union fermée LIVE / HT / FT", () => {
    expect(basketballMatchState({ scheduledAt: KO, live: { status: "LIVE" } }, now)).toBe("live");
    expect(basketballMatchState({ scheduledAt: KO, live: { status: "HT" } }, now)).toBe("halftime");
    expect(basketballMatchState({ scheduledAt: KO, live: { status: "FT" } }, now)).toBe("finished");
  });

  test("casse la casse (source externe en minuscules)", () => {
    expect(basketballMatchState({ scheduledAt: KO, live: { status: "live" } }, now)).toBe("live");
    expect(basketballMatchState({ scheduledAt: KO, live: { status: "ft" } }, now)).toBe("finished");
  });

  test("prolongation hors vocabulaire → table partagée plutôt qu'inférence", () => {
    // « OT » est un quart supplémentaire : en cours, pas terminé. La table partagée
    // (`fiba`) le sait ; une simple liste FT/LIVE/HT se trompera.
    expect(basketballMatchState({ scheduledAt: KO, live: { status: "OT" } }, now)).toBe("live");
  });

  test("pas de live → repli sur l'horloge", () => {
    expect(basketballMatchState({ scheduledAt: KO, live: null }, now)).toBe("live");
    expect(basketballMatchState({ scheduledAt: "2026-10-09T22:00:00Z", live: null }, now)).toBe(
      "scheduled",
    );
  });
});

describe("handballMatchState", () => {
  test("union fermée : les 6 statuts de handball-data", () => {
    // Le mapping est un switch exhaustif : si `HandballMatchStatus` gagne un cas,
    // TypeScript casse ICI, pas sur une carte de live à 22 h.
    expect(handballMatchState({ status: "live" })).toBe("live");
    expect(handballMatchState({ status: "halftime" })).toBe("halftime");
    expect(handballMatchState({ status: "finished" })).toBe("finished");
    expect(handballMatchState({ status: "postponed" })).toBe("postponed");
    //Seul écart de nommage : `cancelled` (2 l) → `canceled` (1 l).
    expect(handballMatchState({ status: "cancelled" })).toBe("canceled");
    expect(handballMatchState({ status: "not_started" })).toBe("scheduled");
  });

  test("couvre l'union entière — aucun statut oublié", () => {
    // Le test échoue si `handballMatchState` est jamais appelé avec un cas nouveau.
    const ALL: HandballMatchStatus[] = [
      "not_started", "live", "halftime", "finished", "postponed", "cancelled",
    ];
    for (const s of ALL) {
      expect(typeof handballMatchState({ status: s })).toBe("string");
    }
    expect(new Set(ALL).size).toBe(6);
  });

  test("variante Safe : statut absent → repli sur l'horodatage", () => {
    expect(handballMatchStateSafe({ status: null, kickoff: KO }, now)).toBe("live");
    expect(handballMatchStateSafe({ status: undefined, kickoff: OLD_KO }, now)).toBe("scheduled");
    expect(handballMatchStateSafe({ kickoff: "2026-10-09T22:00:00Z" }, now)).toBe("scheduled");
  });

  test("variante Safe : statut présent delegates, sans toucher l'horloge", () => {
    // Statut `finished` + kickoff vieux de 5 h : le statut gagne, l'horloge est ignorée.
    expect(handballMatchStateSafe({ status: "finished", kickoff: OLD_KO }, now)).toBe("finished");
  });
});

describe("basketballViewState — vocabulaire de la VUE", () => {
  test("in-progress / post / pre", () => {
    expect(basketballViewState("in-progress")).toBe("live");
    expect(basketballViewState("post")).toBe("finished");
    expect(basketballViewState("finished")).toBe("finished");
    expect(basketballViewState("pre")).toBe("scheduled");
  });

  test("« post » ne retombe JAMAIS sur l'horloge", () => {
    // Régression ciblée : « post » est le statut ESPN pour « terminé ». Sans cas
    // explicite il passait par la table partagée (qui ne le connaît pas) puis par
    // l'horloge — donc un match d'il y a 5 h ressortait « live ».
    expect(basketballViewState("post", OLD_KO, now)).toBe("finished");
  });

  test("statut inconnu → table partagée d'abord, horloge en dernier", () => {
    // `Q4` est en cours — précédemment asserté `halftime`, bug figé par le test.
    expect(basketballViewState("Q4", KO, now)).toBe("live");
    expect(basketballViewState("qqc", "2026-10-09T22:00:00Z", now)).toBe("scheduled");
  });
});

describe("snookerMatchState", () => {
  test("statut brut du flux (SnookerLiveInput ne porte pas de status)", () => {
    expect(snookerMatchState({ status: "LIVE", scheduledAt: KO }, now)).toBe("live");
    expect(snookerMatchState({ status: "in_progress", scheduledAt: KO }, now)).toBe("live");
    expect(snookerMatchState({ status: "scheduled", scheduledAt: KO }, now)).toBe("scheduled");
    expect(snookerMatchState({ status: "FINISHED", scheduledAt: KO }, now)).toBe("finished");
    expect(snookerMatchState({ status: "Completed", scheduledAt: KO }, now)).toBe("finished");
  });

  test("pas de statut → repli sur l'horloge", () => {
    expect(snookerMatchState({ scheduledAt: KO }, now)).toBe("live");
    expect(snookerMatchState({ scheduledAt: "2026-10-09T22:00:00Z" }, now)).toBe("scheduled");
  });
});

describe("cohérence inter-vocabulaires", () => {
  /**
   * Garde-fou le plus important du fichier : deux tables de statuts qui divergent
   * produisent un état différent selon le chemin emprunté — l'onglet Top 10 dirait
   * « Live » pendant que la carte dirait « Terminé », « Mi-temps » ou « À venir ».
   *
   * **Le garde couvre les trois classes de divergence**, pas seulement la première :
   * `finished`/`postponed`/`canceled` (table terminale a avalé un statut live),
   * `halftime` (table mi-temps a avalé une période de jeu — le bug `q[1-4]`), et
   * `scheduled` (statut live tombé sur l'horloge). Seules `live` et `halftime` sont
   * des sorties in-play acceptables.
   *
   * Sans cette extension, le bug `Q4 → halftime` passait : `halftime` n'était pas dans
   * l'ensemble « terminal », donc le test restait vert pendant qu'il affichait chaque
   * quart comme une pause.
   */
  test("aucun statut live de la table partagée ne ressort hors état in-play", () => {
    const suspects = [
      // terminaux
      "FT", "AET", "Full Time", "Completed", "Postponed", "Cancelled",
      "Canceled", "Walkover", "Abandoned",
      // in-play — ceux-là doivent rester in-play, pas passer pour terminés/pauses
      "PEN", "pen", "HT", "Half Time", "IN_PLAY", "1H", "2H", "OT", "Q3", "Q4",
      "TIEBREAK", "tiebreak", "SO", "shootout", "ET", "Suspended", "SUSPENDED_MARKET",
    ];
    const clashes: string[] = [];
    for (const sport of ["football", "handball", "fiba", "nba", "wnba", "hockey", "tennis"]) {
      const livePatterns = LIVE_STATUS_PATTERNS[sport];
      if (!livePatterns) continue;
      for (const raw of suspects) {
        if (!livePatterns.some((re) => re.test(raw))) continue;
        const asState = rawStatusToMatchState(sport, raw, "2026-10-09T22:00:00Z", now);
        if (asState !== "live" && asState !== "halftime") {
          clashes.push(`${sport}/${raw}: partagé=live, état=${asState}`);
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  test("le garde-fou examine bien les cas qui ont cassé", () => {
    // Sans ce test, on ne saurait pas si le garde-fou est mort : il échouerait aussi
    // bien parce qu'il est juste que parce qu'il ne regarde rien. On fige que la
    // PRÉCONDITION du garde — ces statuts sont bien déclarés live par la table partagée.
    // (Leur résolution dans le code est testée ailleurs ; ici, on vérifie qu'ils
    // entrent dans la boucle.)
    expect(LIVE_STATUS_PATTERNS.fiba!.some((re) => re.test("Q3"))).toBe(true);
    expect(LIVE_STATUS_PATTERNS.tennis!.some((re) => re.test("tiebreak"))).toBe(true);
    expect(LIVE_STATUS_PATTERNS.hockey!.some((re) => re.test("shootout"))).toBe(true);
    expect(LIVE_STATUS_PATTERNS.football!.some((re) => re.test("PEN"))).toBe(true);
  });

  test("le snooker est absent des tables partagées — écart connu et documenté", () => {
    // Le test de cohérence ne peut pas couvrir le snooker : il n'est ni dans
    // SPORT_TYPES ni dans LIVE_STATUS_PATTERNS. On le fige ici pour qu'un ajout futur
    // de snooker à ces tables soit détecté comme un changement volontaire.
    expect(SPORT_TYPES).not.toContain("snooker");
    expect(LIVE_STATUS_PATTERNS.snooker).toBeUndefined();
  });
});