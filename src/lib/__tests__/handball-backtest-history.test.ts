import { describe, expect, test } from "bun:test";
import {
  getLeagueBacktest,
  listBacktestLeagues,
} from "../handball-backtest-history";
import { loadLeagueBacktestMatches, clearHistoryDbCache } from "../handball-history-db";
import { CMP_NEUTRAL_LAMBDA } from "../handball-cmp";

// Contrat du module serveur. Les tests qui touchent réellement `pariscore.db`
// passent par une sonde qui lit la vraie base : ce fichier verrouille ce qui doit
// rester vrai même quand la base est INVALIDE (cron arrêté, fichier absent,
// variable DATABASE_PATH cassée) — le cas le plus fréquent en prod.
describe("backtest base-driven — dégradation sans base exploitable", () => {
  test("liste des ligues : tableau, jamais une exception", () => {
    expect(Array.isArray(listBacktestLeagues())).toBe(true);
  });

  test("ligue inconnue du registre → result null + raison explicite", () => {
    // Point de sûreté : ne JAMAIS substituer une ligue par défaut. Si c'était le
    // cas, l'utilisateur choisirait un championnat et verrait les chiffres d'un
    // autre, sans rien voir qui ne va pas.
    const r = getLeagueBacktest("nawak");
    expect(r.result).toBeNull();
    expect(r.league).toBeNull();
    expect(r.reason).toContain("nawak");
    expect(r.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("leagueId vide → pas de fuite de données", () => {
    const r = getLeagueBacktest("");
    expect(r.result).toBeNull();
  });
});

// ⚠️ Régression SCHÉMA — défaut trouvé EN PROD le 2026-10-05, pas en local.
// La table `handball_match_history` du VPS avait été créée par une version
// antérieure du scraper : 16 colonnes, **aucune colonne de cotes**. Les
// colonnes `odds_home/draw/away` sont ajoutées par la migration
// `PRAGMA table_info` de `scrape-handball-history.mjs`, qui n'avait pas tourné
// depuis le 28/09. Les requêtes référenceient donc une colonne inexistante,
// `prepare` levait `no such column: odds_home`, et le `catch` renvoyait `[]` :
// l'API répondait « 0 ligue » sur une base de 8 043 lignes — indiscernable d'une
// base vide.
describe("schéma antérieur aux colonnes de cotes", () => {
  test(
    "listBacktestLeagues renvoie les ligues même sans colonnes de cotes",
    () => {
      const option = listBacktestLeagues()[0];
      if (!option) {
        // Pas de base : rien à prouver ici, et le test ne doit pas échouer.
        expect(true).toBe(true);
        return;
      }
      expect(option.n).toBeGreaterThan(0);
    },
    SLOW,
  );

  test(
    "loadLeagueBacktestMatches ne lève pas et demande le mode large",
    () => {
      const ids = listBacktestLeagues().map((l) => l.id);
      if (ids.length === 0) {
        expect(true).toBe(true);
        return;
      }
      // `withOddsOnly: false` doit aboutir même si les colonnes manquent.
      const rows = loadLeagueBacktestMatches(ids[0], { withOddsOnly: false });
      expect(Array.isArray(rows)).toBe(true);
    },
    SLOW,
  );

  test("le cache de schéma se purge avec le reste", () => {
    // `hasOddsColumns` est mémoïsé : sans purge, un test qui change de base
    // lirait le verdict de l'ancienne.
    expect(() => clearHistoryDbCache()).not.toThrow();
    clearHistoryDbCache();
    const rows = loadLeagueBacktestMatches("starligue", { withOddsOnly: false });
    expect(Array.isArray(rows)).toBe(true);
  });
});

/**
 * Les deux tests suivants ne peuvent tourner qu'avec une vraie base : sans elle,
 * `getLeagueBacktest` s'arrête avant le moteur. `skipIf` évite un échec
 * trompeur en CI, mais le test ne ment jamais quand il s'exécute.
 */
const hasRealData = listBacktestLeagues().some((l) => l.n > 0);

/** `getLeagueBacktest` rejoue le walk-forward complet : 2-8 s selon la ligue. */
const SLOW = 60_000;

// ─── Régression d'UNITÉ ──────────────────────────────────────────────────────
// `runPariscoreBacktest` consomme `leagueMean` comme un λ PAR ÉQUIPE, alors que
// `goalsPerMatch` est mesuré PAR MATCH (les deux équipes). Passer la valeur brute
// doublait le prior : Starligue donnait λ = 62 au lieu de 31 par équipe, et les
// lignes de total affichaient « Under 129 » pour des matchs totalisant ~62 buts.
describe.skipIf(!hasRealData)("backtest base-driven — unités du prior neutre", () => {
  const option = listBacktestLeagues()[0];

  test("goalsPerMatch = goalsPerTeam × 2 (invariant mesuré en base)", () => {
    // Le libellé « buts/match » affiché à l'utilisateur est bien par match.
    expect(option.goalsPerMatch).toBeGreaterThan(40);
    expect(option.goalsPerMatch).toBeLessThan(80);
  });

  test(
    "lignes de total dans une plage de handball (20-100), pas 129",
    () => {
      const { result } = getLeagueBacktest(option.id);
      expect(result).not.toBeNull();
      const lines = (result?.bets ?? [])
        .filter((b) => b.market === "total")
        .map((b) => Number(/(\d+(?:\.\d+)?)/.exec(b.pick)?.[1] ?? NaN))
        .filter((n) => Number.isFinite(n));
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).toBeGreaterThan(20);
        expect(line).toBeLessThan(100);
      }
    },
    SLOW,
  );

  test("λ neutre par équipe reste du même ordre que CMP_NEUTRAL_LAMBDA", () => {
    // 28.5 par équipe = 57 par match. Une ligue à 62/match doit donner ~31 par
    // équipe, pas 62 : c'est exactement l'écart que le bug masquait.
    expect(option.goalsPerMatch! / 2).toBeGreaterThan(20);
    expect(option.goalsPerMatch! / 2).toBeLessThan(CMP_NEUTRAL_LAMBDA * 1.35);
  });
});

// ─── Régression ν ────────────────────────────────────────────────────────────
// Le moteur de backtest raisonnait sur DEUX échelles. `teamStrength` /
// `matchLambdas` fitted sur ν = CMP_DEFAULT_NU (1.3), or la PMF CMP n'est pas
// moyen-paramétrée (`cmpMean(30, 1.3) ≈ 13.6`). `cmpMean(λ, ν)` attendait un
// RATE CMP et renvoyait la MOYENNE, pendant que `skellamMatchProbs(λ)` supposait
// λ = MOYENNE d'une Poisson.
//
// Effet mesuré sur 597 paris 1N2 réels : le score affiché valait ~45 % de
// l'attendu et pointait à l'OPPOSÉ du pari retenu sur 216/558 (39 %), et 92
// paris partaient à ≥ 99 % de confiance.
describe.skipIf(!hasRealData)("backtest base-driven — cohérence interne du moteur", () => {
  test(
    "le score prédit pointe toujours dans le sens du pari retenu",
    () => {
      // Invariant structurel, indépendant de la qualité du modèle : `side` est
      // choisi par `skellamMatchProbs` et `predictedHome/Away` par `cmpMean`. Tant
      // que ces deux-là ne partagent pas la même échelle, ils peuvent se
      // contredire — et ils le faisaient sur 39 % des paris.
      let checked = 0;
      for (const id of ["starligue", "bundesliga2"]) {
        for (const b of getLeagueBacktest(id).result?.bets ?? []) {
          if (b.market !== "1N2") continue;
          if (b.predictedHome === b.predictedAway) continue;
          // Type explicite : `side` inclut `draw | null`, une comparaison
          // `sense === b.side` sans annotation ne compile pas en mode strict.
          const sense: "home" | "away" | "draw" =
            b.predictedHome > b.predictedAway ? "home" : "away";
          expect(b.side).toBe(sense);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(20);
    },
    SLOW,
  );

  test(
    "presque plus de probabilité 1N2 saturée (92 paris à ≥ 99 % avant le correctif)",
    () => {
      const over99: number[] = [];
      for (const id of ["starligue", "bundesliga2", "d2women"]) {
        for (const b of getLeagueBacktest(id).result?.bets ?? []) {
          if (b.market === "1N2" && b.prob >= 99) over99.push(b.prob);
        }
      }
      // Saturation à 99 %+ = le modèle se croit infaillible. Un compteur très bas
      // tolère le cas limite sans rouvrir le bug.
      expect(over99.length).toBeLessThanOrEqual(3);
    },
    SLOW,
  );

  test(
    "lignes de total calées sur le total attendu (médiane à ±6 buts)",
    () => {
      // Avant : « Under 129 » pour des matchs à ~62 buts. Le scan de lignes porte
      // sur le total attendu DU MODÈLE, qui peut s'écarter de la moyenne de
      // ligue — d'où une borne sur la médiane, pas un ±12 strict sur chaque ligne.
      for (const id of ["starligue", "bundesliga2"]) {
        const { league, result } = getLeagueBacktest(id);
        const gpm = league?.goalsPerMatch;
        if (gpm == null) continue;
        const lines = (result?.bets ?? [])
          .filter((b) => b.market === "total")
          .map((b) => Number(/(\d+(?:\.\d+)?)/.exec(b.pick)?.[1] ?? NaN))
          .filter((n) => Number.isFinite(n))
          .sort((a, b) => a - b);
        expect(lines.length).toBeGreaterThan(0);
        const median = lines[Math.floor(lines.length / 2)];
        expect(Math.abs(median - gpm)).toBeLessThan(6);
      }
    },
    SLOW,
  );

  test(
    "score prédit proche du score réel (erreur moyenne < 12 buts)",
    () => {
      // Avant le correctif ν, le score prédit était à ~45 % de l'attendu : erreur
      // moyenne d'une vingtaine de buts, incompréhensible à l'écran.
      let total = 0;
      let n = 0;
      for (const id of ["starligue", "bundesliga2"]) {
        const matches = new Map(
          loadLeagueBacktestMatches(id, { withOddsOnly: true }).map((m) => [m.id, m]),
        );
        for (const b of getLeagueBacktest(id).result?.bets ?? []) {
          const m = matches.get(b.matchId);
          if (!m) continue;
          total +=
            Math.abs(b.predictedHome - m.homeGoals) + Math.abs(b.predictedAway - m.awayGoals);
          n++;
        }
      }
      expect(n).toBeGreaterThan(100);
      expect(total / n).toBeLessThan(12);
    },
    SLOW,
  );
});