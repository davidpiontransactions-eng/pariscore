/**
 * Adaptateurs : payload de route live → entrée de moteur `live-<sport>.ts`.
 *
 * Rôle : chaque route API expose un payload différent, et aucun ne couvre
 * 100 % des champs que son moteur consomme. Cet módulo est le SEUL endroit qui
 * connaît les deux côtés : il lit un payload brut, produit une entrée de moteur
 * — ou `null` quand la donnée MANQUANTE, ce qui est un fait à afficher, pas un
 * défaut à masquer.
 *
 * Contrat de honesty (règle du repo : jamais de donnée inventée) :
 *   - un champ absent du payload reste `undefined` → le moteur retombe sur son
 *     prior de ligue et l'affiche « n/d » ;
 *   - un champ qui rend le marché NON CALCULABLE (pas de score, pas de période)
 *     fait renvoyer `null` à l'adaptateur, et l'UI affiche « données live
 *     indisponibles » au lieu d'afficher 33/33/33 % de repli.
 *
 * Aucun appel réseau ici : fonctions pures, testables sans serveur.
 */

import type { FootballLiveInput } from "./live-football";
import type { BasketballLiveInput } from "./live-basketball";
import type { HockeyLiveInput } from "./live-hockey";
import type { BaseballBases, BaseballLiveInput } from "./live-baseball";
import type { HandballLiveInput } from "./live-handball";
import type { SnookerLiveInput } from "./live-snooker";

// ---------------------------------------------------------------------------
// Helpers partagés
// ---------------------------------------------------------------------------

/** Nombre fini, sinon `undefined`. */
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Entier fini dans [min, max], sinon `undefined`. */
function intIn(v: unknown, min: number, max: number): number | undefined {
  const n = num(v);
  if (n === undefined) return undefined;
  const i = Math.round(n);
  return i >= min && i <= max ? i : undefined;
}

/** Records bruts des routes : on ne fait confiance à AUCUN type de sortie. */
type Raw = Record<string, unknown>;

function obj(v: unknown): Raw | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Raw) : null;
}

// ---------------------------------------------------------------------------
// FOOTBALL — /api/football/live (BSD v2)
// ---------------------------------------------------------------------------

/**
 * Payload BSD v2 (`/api/v2/matches/live/`) ou la forme normalisée
 * `FootballLiveState` de `useLiveFootball`. Les deux sont tolérées : la route
 * brute et le type hook n'ont pas les mêmes noms de champs.
 */
export function adaptFootball(raw: unknown): FootballLiveInput | null {
  const m = obj(raw);
  if (!m) return null;
  // Some wrappers nest the state under `live`.
  const state = obj(m.live) ?? m;

  const minute = num(state.minute);
  const homeScore = num(state.home_score ?? state.homeScore);
  const awayScore = num(state.away_score ?? state.awayScore);
  if (minute === undefined || homeScore === undefined || awayScore === undefined) return null;

  // BSD v2 utilise le snake_case (`home_corners`) ; le type hook
  // `FootballLiveState` le camelCase. Les deux sont lus — sinon les corners
  // présents dans le flux disparaissent silencieusement et le marché « prochain
  // corner » retombe sur son prior de ligue.
  const corners =
    obj(state.corners) ??
    (num(state.home_corners ?? state.homeCorners) !== undefined &&
    num(state.away_corners ?? state.awayCorners) !== undefined
      ? { home: num(state.home_corners ?? state.homeCorners), away: num(state.away_corners ?? state.awayCorners) }
      : null);
  const yellow =
    obj(state.yellow_cards) ??
    obj(state.yellowCards) ??
    (num(state.home_yellow_cards ?? state.homeYellowCards) !== undefined &&
    num(state.away_yellow_cards ?? state.awayYellowCards) !== undefined
      ? {
          home: num(state.home_yellow_cards ?? state.homeYellowCards),
          away: num(state.away_yellow_cards ?? state.awayYellowCards),
        }
      : null);

  return {
    minute,
    homeScore,
    awayScore,
    homeXg: num(state.home_xg ?? state.homeXg),
    awayXg: num(state.away_xg ?? state.awayXg),
    prematch: adaptPrematch(state.prematch),
    homeRedCards: num(state.home_red_cards ?? state.homeRedCards),
    awayRedCards: num(state.away_red_cards ?? state.awayRedCards),
    corners: corners ? { home: num(corners.home) ?? 0, away: num(corners.away) ?? 0 } : undefined,
    yellowCards: yellow ? { home: num(yellow.home) ?? 0, away: num(yellow.away) ?? 0 } : undefined,
    pressureIndex: num(state.pressure_index ?? state.pressureIndex ?? state.momentum),
  };
}

/** Probs pré-match en 0-100 (la forme du moteur) ou 0-1 (certains flux). */
function adaptPrematch(v: unknown): FootballLiveInput["prematch"] {
  const p = obj(v);
  if (!p) return null;
  const home = num(p.homeProb ?? p.home);
  const draw = num(p.drawProb ?? p.draw);
  if (home === undefined || draw === undefined) return null;
  // BSD renvoie des fractions ; le moteur attend des pourcentages.
  const scale = home <= 1 && draw <= 1 ? 100 : 1;
  return {
    homeProb: home * scale,
    drawProb: draw * scale,
    awayProb: num(p.awayProb ?? p.away) !== undefined ? (num(p.awayProb ?? p.away) as number) * scale : undefined,
    over25Prob: num(p.over25Prob ?? p.over25) !== undefined
      ? (num(p.over25Prob ?? p.over25) as number) * (scale === 100 ? 100 : 1)
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// BASKETBALL — /api/fiba/scoreboard (clock + period + linescores)
// ---------------------------------------------------------------------------

/**
 * Le seul payload basket du repo qui porte une horloge ET une période
 * (`FibaMatch`). `linescores` est le cumul par quart — il permet de déduire le
 * score du QUARTIER EN COURS, pas les tirs (FGA/eFG/3PA restent absents, le
 * moteur retombe alors sur les moyennes de ligue — comportement documenté).
 */
export function adaptBasketball(raw: unknown): BasketballLiveInput | null {
  const m = obj(raw);
  if (!m) return null;
  const home = obj(m.home);
  const away = obj(m.away);
  if (!home || !away) return null;

  const homeScore = num(home.score);
  const awayScore = num(away.score);
  const period = intIn(m.period, 1, 10);
  const minutesLeft = parseClockMinutes(m.clock);
  if (homeScore === undefined || awayScore === undefined || period === undefined) return null;

  return {
    period,
    // Une horloge absente en cours de quart : le quart est supposé plein. Une
    // hypothèse explicite vaut mieux qu'un `null` qui rend le marché Q mort.
    periodMinutesLeft: minutesLeft ?? PERIOD_MINUTES_FALLBACK,
    homeScore,
    awayScore,
    homeFga: null,
    awayFga: null,
    homeEfg: null,
    awayEfg: null,
    homeThreeMade: null,
    awayThreeMade: null,
    homeThreeAtt: null,
    awayThreeAtt: null,
  };
}

const PERIOD_MINUTES_FALLBACK = 12;

/** "5:34" ou "05:34" → 5.566 min. Format invalide → `undefined`. */
export function parseClockMinutes(clock: unknown): number | undefined {
  if (typeof clock !== "string") return undefined;
  const m = clock.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return undefined;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec > 59) return undefined;
  return min + sec / 60;
}

// ---------------------------------------------------------------------------
// HOCKEY — /api/hockey/live (scoreboard ESPN NHL)
// ---------------------------------------------------------------------------

/**
 * Hockey : câblé sur le scoreboard ESPN NHL.
 *
 * Le chemin va `route → adaptateur → moteur live-hockey → bundle ready` quand
 * la période ET l'horloge sont présentes. Sans elles, on renvoie `null` :
 * projeter sans connaître la période reviendrait à supposer 60 minutes
 * restantes quelle que soit la situation réelle — un match en 3e période à
 * 20 s verrait ses 20 dernières secondes modélisées comme un quart entier.
 *
 * ponytail: dès qu'une source KHL expose la période + l'horloge (le game feed
 * HockeyTech `/game/{id}/playbyplay` le fait déjà), il suffit d'ajouter la
 * route à `LIVE_ROUTE_BY_SPORT` — l'adaptateur lit les mêmes noms de champs.
 */
export function adaptHockey(raw: unknown): HockeyLiveInput | null {
  const m = obj(raw);
  if (!m) return null;
  const period = intIn(m.period, 1, 4);
  const secondsLeft = num(m.periodSecondsLeft ?? m.clockSeconds);
  const homeScore = num(m.homeGoals ?? m.homeScore);
  const awayScore = num(m.awayGoals ?? m.awayScore);
  if (period === undefined || secondsLeft === undefined) return null;
  if (homeScore === undefined || awayScore === undefined) return null;
  return {
    period,
    // Horloge négative (inter-périodes) : 0 s restant dans la période est la
    // seule lecture physique — le moteur bornera le reste par `min(avant,
    // après)`, donc aucune projection n'est faite sur un temps fantôme.
    periodSecondsLeft: Math.max(0, secondsLeft),
    homeScore,
    awayScore,
    powerPlay: (m.powerPlay === "home" || m.powerPlay === "away" ? m.powerPlay : null),
    powerPlaySecondsLeft: num(m.powerPlaySecondsLeft),
    corsi: obj(m.corsi)
      ? { home: num((obj(m.corsi) as Raw).home) ?? 0, away: num((obj(m.corsi) as Raw).away) ?? 0 }
      : null,
    highDanger: obj(m.highDanger)
      ? { home: num((obj(m.highDanger) as Raw).home) ?? 0, away: num((obj(m.highDanger) as Raw).away) ?? 0 }
      : null,
  };
}

// ---------------------------------------------------------------------------
// BASEBALL — /api/baseball/live (MLB StatsAPI game feed)
// ---------------------------------------------------------------------------

/**
 * Le baseball est le seul sport où l'état est combinatoire (manche × moitié ×
 * outs × bases × compte) : sans ces 5 champs, la matrice d'espérance MLB ne
 * peut pas être indexée et TOUS les marchés deviennent faux. On renvoie donc
 * `null` tant qu'un seul manque — c'est la seule lecture honnête.
 */
export function adaptBaseball(raw: unknown): BaseballLiveInput | null {
  const m = obj(raw);
  if (!m) return null;

  const inning = intIn(m.inning, 1, 30);
  const half = m.half === "bottom" ? "bottom" : m.half === "top" ? "top" : undefined;
  const outs = intIn(m.outs, 0, 2);
  const bases = intIn(m.bases, 0, 7) as BaseballBases | undefined;
  const homeScore = num(m.homeRuns ?? m.homeScore);
  const awayScore = num(m.awayRuns ?? m.awayScore);

  if (
    inning === undefined ||
    half === undefined ||
    outs === undefined ||
    bases === undefined ||
    homeScore === undefined ||
    awayScore === undefined
  ) {
    return null;
  }

  const balls = intIn(m.balls, 0, 4);
  const strikes = intIn(m.strikes, 0, 3);
  return {
    inning,
    half,
    outs,
    bases,
    count: balls !== undefined && strikes !== undefined ? { balls, strikes } : null,
    homeScore,
    awayScore,
  };
}

// ---------------------------------------------------------------------------
// HANDBALL — /api/handball/live (+ /api/handball/live-detail)
// ---------------------------------------------------------------------------

/**
 * Seule source handball qui porte `minute` ET le score de mi-temps
 * (`score.homeHalf`/`awayHalf`). Les drivers avancés (`manAdvantage`,
 * `saveRate`, `transitionSpeed`, `sevenMeterRate`) ne sont PAS dans la route
 * list : le moteur retombe sur ses valeurs de ligue et les jauges affiche
 * « n/d » — jamais un chiffre fabriqué.
 */
export function adaptHandball(raw: unknown): HandballLiveInput | null {
  const m = obj(raw);
  if (!m) return null;
  const score = obj(m.score);
  if (!score) return null;
  const homeScore = num(score.home);
  const awayScore = num(score.away);
  const minute = num(m.minute);
  if (homeScore === undefined || awayScore === undefined || minute === undefined) return null;

  const homeHalf = num(score.homeHalf);
  const awayHalf = num(score.awayHalf);
  return {
    minute,
    homeScore,
    awayScore,
    halfTimeScore:
      homeHalf !== undefined && awayHalf !== undefined
        ? { home: homeHalf, away: awayHalf }
        : null,
    manAdvantage: m.manAdvantage === "home" || m.manAdvantage === "away" ? m.manAdvantage : null,
    manAdvantageSecondsLeft: num(m.manAdvantageSecondsLeft),
    saveRate: obj(m.saveRate)
      ? { home: num((obj(m.saveRate) as Raw).home) ?? 65, away: num((obj(m.saveRate) as Raw).away) ?? 65 }
      : null,
    transitionSpeed: num(m.transitionSpeed),
    sevenMeterRate: num(m.sevenMeterRate),
  };
}

// ---------------------------------------------------------------------------
// SNOOKER — /api/v1/snooker/matches
// ---------------------------------------------------------------------------

/**
 * ⚠️ Snooker : dégradé par construction.
 *
 * Le parseur snooker (`v1/snooker/matches/route.ts:100-104`) ne lit qu'UN
 * entier par camp — le nombre de FRAMES (`parseInt(raw.split("-")[0])`). Les
 * POINTS de la frame en cours (`framePointsA/B`), les points restants sur la
 * table et le joueur à la table n'existent nulle part dans le pipeline.
 *
 * Or `SnookerLiveInput` les exige tous les trois : sans `pointsOnTable` le
 * moteur ne peut pas distinguer « A mène de 13 points » de « A mène de 130 »,
 * et les trois marchés (frame / century / prochaine bille) sont faux. Plutôt
 * qu'un century calculé sur des zéros — qui afficherait « 100 % » au joueur
 * qui n'a pas encore pris la table — on renvoie `null`.
 *
 * ponytail: dès que le scraper FlashScore expose le score de frame
 * (`"3-0 (41-28)"`), ce `null` devient un split sur la parenthèse. Le moteur
 * `live-snooker.ts` est déjà écrit et testé pour ces entrées.
 */
export function adaptSnooker(raw: unknown): SnookerLiveInput | null {
  const m = obj(raw);
  if (!m) return null;
  const framesA = intIn(m.scoreA ?? m.framesA, 0, 20);
  const framesB = intIn(m.scoreB ?? m.framesB, 0, 20);
  const bestOf = intIn(m.bestOf, 1, 35);
  const framePointsA = intIn(m.framePointsA, 0, 147);
  const framePointsB = intIn(m.framePointsB, 0, 147);
  const pointsOnTable = intIn(m.pointsOnTable, 0, 147);

  if (
    framesA === undefined ||
    framesB === undefined ||
    bestOf === undefined ||
    framePointsA === undefined ||
    framePointsB === undefined ||
    pointsOnTable === undefined
  ) {
    return null;
  }

  return {
    framesA,
    framesB,
    bestOf,
    framePointsA,
    framePointsB,
    pointsOnTable,
    playerATable: m.playerATable !== false,
    potRate: num(m.potRate),
    opponentPotRate: num(m.opponentPotRate),
    inBreak: m.inBreak === true,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/** Entrée de moteur d'un sport, sans le nom du moteur. */
export type AnyLiveInput =
  | FootballLiveInput
  | BasketballLiveInput
  | HockeyLiveInput
  | BaseballLiveInput
  | HandballLiveInput
  | SnookerLiveInput;

const ADAPTERS: Record<string, (raw: unknown) => AnyLiveInput | null> = {
  football: adaptFootball,
  basketball: adaptBasketball,
  hockey: adaptHockey,
  baseball: adaptBaseball,
  handball: adaptHandball,
  snooker: adaptSnooker,
};

/** Applique l'adaptateur du sport. Sport inconnu ou payload nul → `null`. */
export function adaptLivePayload(sport: string, raw: unknown): AnyLiveInput | null {
  const adapter = ADAPTERS[sport];
  return adapter ? adapter(raw) : null;
}

/**
 * Raisons pour lesquelles un sport n'a pas de marché calculable aujourd'hui.
 *
 * Exposées pour que l'UI affiche un message SPÉCIFIQUE (« pas de période » vs
 * « flux indisponible ») plutôt qu'un « indisponible » générique qui laisse
 * croire à une panne.
 */
export const LIVE_UNAVAILABLE_REASON: Record<string, string> = {
  snooker: "Le flux snooker ne fournit que le score de frames : les points de la frame en cours manquent.",
};