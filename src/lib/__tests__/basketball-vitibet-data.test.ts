import { describe, expect, test } from "bun:test";
import { loadVitibetSnapshot } from "../basketball-vitibet-data";
import { calibratedBasketballLeagues } from "../basketball-vitibet-league";

const snap = loadVitibetSnapshot(calibratedBasketballLeagues());

describe("dump 1xBet — contrat d'intégrité", () => {
  test("le dump est lisible (sinon les tests suivants ne prouveraient rien)", () => {
    expect(snap).not.toBeNull();
    expect(snap!.matches.length).toBeGreaterThan(0);
  });

  test("seules les ligues CALIBRÉES sont servies", () => {
    const calibrees = new Set(calibratedBasketballLeagues());
    for (const m of snap!.matches) {
      expect(calibrees.has(m.league), `${m.league} non calibrée servie`).toBe(true);
    }
  });

  test("predictionsAvailable ⇔ probas domicile ET extérieur non nulles", () => {
    for (const m of snap!.matches) {
      const attendu = m.probHome !== null && m.probHome > 0 && m.probAway !== null && m.probAway > 0;
      expect(m.predictionsAvailable).toBe(attendu);
    }
  });

  test("aucun signal financier quand predictionsAvailable est false", () => {
    // Régression centrale : la route ne doit jamais permettre d'afficher un EV
    // sur un match dont la source n'a rien publié.
    for (const m of snap!.matches.filter((x) => !x.predictionsAvailable)) {
      expect(m.probHome).toBeNull();
      expect(m.probAway).toBeNull();
      expect(m.tip).toBeNull();
      expect(m.predictedScore).toBeNull();
      expect(m.index).toBeNull();
      // team_power / calc_form sortent à 0 du parseur (mesuré : 228 zéros, 0
      // null). 0 doit se lire comme une absence, pas comme un Power de 0.0.
      expect(m.teamPower.home).toBeNull();
      expect(m.teamPower.away).toBeNull();
      expect(m.form.home).toBeNull();
      expect(m.form.away).toBeNull();
      // Une raison est TOUJOURS donnée : pas d'absence muette.
      expect(m.predictionsUnavailableReason).toBeTruthy();
    }
  });

  test("aucun 0 déguisé en mesure, nulle part dans le payload", () => {
    // Balayage large : toute métrique censée être absente doit valoir null.
    // Un `0` se lit comme une mesure valide à l'écran.
    for (const m of snap!.matches) {
      if (!m.predictionsAvailable) {
        for (const v of [m.index, m.probHome, m.probDraw, m.probAway]) {
          expect(v, `${m.id}/${m.league} zéro en l'absence de prédiction`).toBeNull();
        }
      }
      for (const t of [m.home, m.away]) {
        if (!t.statsAvailable) expect(t.pointsPerGame).toBeNull();
        else expect(t.pointsPerGame).toBeGreaterThan(0);
      }
    }
  });

  test("aucun signal financier quand predictionsAvailable est true", () => {
    for (const m of snap!.matches.filter((x) => x.predictionsAvailable)) {
      expect(m.probHome).not.toBeNull();
      expect(m.probAway).not.toBeNull();
      expect(m.probHome).toBeGreaterThan(0);
      expect(m.probAway).toBeGreaterThan(0);
      expect(m.predictionsUnavailableReason).toBeNull();
    }
  });

  test("les probabilités servies somment à ~100 avec le nul de book", () => {
    // Mesuré sur HTML réel : 34 / 3 / 63 = 100. Un parseur qui perdrait une
    // cellule donnerait une somme fausse — ce test le voit.
    for (const m of snap!.matches.filter((x) => x.predictionsAvailable)) {
      const somme = m.probHome! + m.probDraw! + m.probAway!;
      expect(somme).toBeGreaterThanOrEqual(95);
      expect(somme).toBeLessThanOrEqual(105);
    }
  });

  test("stats BSD : clé présente mais null ≠ mesure", () => {
    // Le dump stocke `points_per_game: null` quand BSD n'a pas apparié.
    // Exposer `statsAvailable: true` avec `pointsPerGame: null` ferait
    // afficher un « — » qui se lit comme une statistique à zéro.
    for (const m of snap!.matches) {
      for (const t of [m.home, m.away]) {
        expect(t.statsAvailable).toBe(t.pointsPerGame !== null);
        if (t.statsAvailable) expect(t.pointsPerGame!).toBeGreaterThan(0);
      }
    }
  });

  test("le refus de ligue est motivé, pas silencieux", () => {
    // Chaque ligue écartée porte un motif, sinon un futur agent ne saura pas
    // pourquoi LNBP (14 matchs) n'apparaît pas.
    expect(snap!.skippedLeagues.length).toBeGreaterThan(0);
    for (const s of snap!.skippedLeagues) {
      expect(s.reason.length).toBeGreaterThan(5);
      expect(s.matches).toBeGreaterThan(0);
    }
    // Liga A (Argentine) et LNB (Chile) doivent être parmi les refusées.
    const refusees = snap!.skippedLeagues.map((s) => s.vitibetLeague);
    expect(refusees).toContain("Liga A");
    expect(refusees).toContain("LNB");
  });

  test("les ligues mesurées hors périmètre demandé sont refusées", () => {
    const seulementEuro = loadVitibetSnapshot(["euroleague"]);
    for (const m of seulementEuro!.matches) {
      expect(m.league).toBe("euroleague");
    }
  });
});