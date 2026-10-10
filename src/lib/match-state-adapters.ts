import type { FootballMatch } from "./football-data";
import type { HandballMatch } from "./handball-data";
import type { GameStatus } from "./baseball/types";
import { LIVE_STATUS_PATTERNS } from "./top-matches/types";
import type { MatchState } from "./match-state";

/**
 * Adaptateurs : type de match de chaque sport → `MatchState` (vocabulaire du
 * `MatchShell` et du `MatchStateBadge`).
 *
 * Règle du dépôt : **jamais de donnée inventée**. Un statut absent ou inconnu retombe sur
 * l'inférence par l'horodatage — et celle-ci est explicite, jamais un « on suppose live ».
 *
 * Toutes les fonctions sont **pures** et prennent `nowMs` en paramètre : testables sans
 * React ni réseau, et déterministes quel que soit le fuseau du runner.
 */

// ---------------------------------------------------------------------------
// Vocabulaire des états terminaux / bloqués
// ---------------------------------------------------------------------------

/**
 * Le codebase avait déjà « qu'est-ce qui est live ? » (`LIVE_STATUS_PATTERNS` dans
 * `top-matches/types.ts`). Il n'avait **rien** pour « qu'est-ce qui est fini, reporté ou
 * annulé ? » — ce qui est précisément le vocabulaire que `MatchStateBadge` exige.
 *
 * D'où cette table. Elle est volontairement **stricte** : une regex trop laxiste ferait
 * passer « finished » pour « live » à la moindre sous-chaîne.
 */
const TERMINAL_PATTERNS: { re: RegExp; state: Extract<MatchState, "finished" | "postponed" | "canceled"> }[] = [
  // Report / annulation — testés AVANT `finished` : « POSTPONED » contient « POST »,
  // et « after extra time » contient « time ». L'ordre fait partie du contrat.
  { re: /^(postponed|delay|delayed|postponement)$/i, state: "postponed" },
  { re: /^(cancelled|canceled|abandoned|abandonn[ée]|annul[ée]|walkover|forfeit|retired)$/i, state: "canceled" },
  // Fin de rencontre. `aet` et « after extra time » restent : ils signifient que la
  // rencontre est PASSÉE en prolongation, contrairement à `et` seul, que la table live
  // connaît et lit comme « prolongation en cours ».
  { re: /^(ft|full[\s_-]?time|finished|final|end|ended|completed|termine|terminé|over)$/i, state: "finished" },
  { re: /^(aet|after[\s_-]?extra[\s_-]?time)$/i, state: "finished" },
];

/**
 * **Ne pas ajouter `suspendu?` ici.** La version précédente de cette table le contenait
 * au rang « reporté », et elle est consultée AVANT la table `SUSPENDED_PATTERNS` :
 * le statut exact `"Suspendu"` ressortait donc `postponed` — un marché gelé affiché
 * « Reporté ». `SUSPENDED_PATTERNS` couvre déjà ce cas.
 *
 * **Ne pas ajouter non plus `pen` / `shootout` / `tiebreak` : ces trois-là sont EN
 * COURS.** La table partagée du dépôt les classe live (`LIVE_STATUS_PATTERNS.football`
 * a `^pen$`, `.hockey` a `^so$`/`^shootout$`, `.tennis` a `^tiebreak$`). Les traiter comme
 * terminaux ferait afficher « Terminé » au moment exact où la séance de tirs au but ou le
 * tiebreak se joue — et serait contredit par l'onglet Top 10 du même match.
 */

/** Mi-temps / pause réglementaire — un match en cours, pas un match arrêté.
 *
 * `q[1-4]` n'est PAS ici : un quart de basket est une période de jeu, pas une pause.
 * Il était présent au départ et faisait ressortir chaque quart en « Mi-temps » — le
 * test `Q4` figeait ce bug au lieu de le signaler. La table live (`fiba`, `nba`, `wnba`)
 * les classe déjà correctement. */
const HALFTIME_PATTERNS = /^(ht|half[\s_-]?time|halftime|mi[\s-]?temps|pause|interval|break[\s_-]?time)$/i;

/**
 * Pré-match explicite.
 *
 * **Pourquoi cette table existe** (trouvée par un test rouge, pas par une relecture) : sans
 * elle, un statut `"scheduled"` explicite traversait les tables ci-dessus, ne rencontrait
 * aucune entrée de la table live — puis **retombait sur l'horloge**. Un match explicitement
 * marqué « pas commencé » dont l'heure de coup d'envoi était passée de dix minutes
 * ressortait donc `live`. Le flux avait raison, l'inférence avait tort.
 *
 * Règle générale : un statut **explicite** du flux bat toujours l'horodatage, dans les deux
 * sens. Mal afficher un match `live` coûte une mise ; mal l'afficher `scheduled` coûte une
 * opportunité — mais les deux sont faux, donc aucun ne doit venir d'un calcul d'horloge
 * quand le flux a parlé.
 */
const SCHEDULED_PATTERNS =
  /^(pre|pre[\s_-]?match|scheduled|upcoming|not[\s_-]?started|notstarted|ns|pending|a_venir)$/i;

/**
 * Marché gelé / cotes suspendues : le match continue mais on ne peut plus parier.
 *
 * Regex **non ancrée** et volontairement large sur « suspend » : le flux est libre de
 * suffixer (`SUSPENDED_MARKET`, `Market_suspended`) et une regex ancrée laissait ces
 * formes tomber sur l'horloge — donc afficher `live` sur un marché fermé.
 */
const SUSPENDED_PATTERNS = /(suspend|market[\s_-]?closed|betting[\s_-]?closed|pause[\s_-]?paris)/i;

/**
 * Inférence par l'horodatage, utilisée quand le flux ne donne aucun statut exploitable.
 *
 * Marge de 2 h après le coup d'envoi : couvre les prolongations et les retards de
 * minutage. **Ne renvoie jamais `finished`** : le flux peut être en retard, et un match
 * masqué par erreur est pire qu'un match proposé trop tard.
 */
function inferFromClock(scheduledAt: string | undefined, nowMs: number): MatchState {
  if (!scheduledAt) return "scheduled";
  const kickoff = Date.parse(scheduledAt);
  if (Number.isNaN(kickoff)) return "scheduled";
  return nowMs >= kickoff && nowMs < kickoff + 2 * 3_600_000 ? "live" : "scheduled";
}

/**
 * Statut brut du flux → `MatchState`, pour les sports dont le type live ne porte pas de
 * `status` (`SnookerLiveInput` n'en a pas : c'est une entrée de moteur, pas un état de
 * rencontre).
 *
 * `sportKey` doit être une clé de `LIVE_STATUS_PATTERNS`. Clé inconnue → repli sur
 * l'horloge plutôt qu'une supposition.
 */
export function rawStatusToMatchState(
  sportKey: string,
  rawStatus: string | null | undefined,
  scheduledAt?: string,
  nowMs: number = Date.now(),
): MatchState {
  const s = String(rawStatus ?? "").trim();
  if (!s) return inferFromClock(scheduledAt, nowMs);

  for (const { re, state } of TERMINAL_PATTERNS) {
    if (re.test(s)) return state;
  }
  if (SUSPENDED_PATTERNS.test(s)) return "suspended";
  if (HALFTIME_PATTERNS.test(s)) return "halftime";
  if (SCHEDULED_PATTERNS.test(s)) return "scheduled";

  // « Est-ce live ? » n'est pas réinventé : on interroge la table existante.
  const livePatterns = LIVE_STATUS_PATTERNS[sportKey.toLowerCase()];
  if (livePatterns?.some((re) => re.test(s))) return "live";

  return inferFromClock(scheduledAt, nowMs);
}

// ---------------------------------------------------------------------------
// Football
// ---------------------------------------------------------------------------

/**
 * `FootballLiveState.status` est une **union fermée** (`"LIVE" | "HT" | "FT" | "PEN"`) :
 * c'est la source la plus fiable du dépôt, elle est donc utilisée en priorité plutôt que
 * la table de regex.
 */
export function footballMatchState(match: Pick<FootballMatch, "scheduledAt" | "live">, nowMs = Date.now()): MatchState {
  const live = match.live;
  if (!live) return inferFromClock(match.scheduledAt, nowMs);

  switch (live.status) {
    case "LIVE":
      return "live";
    case "HT":
      return "halftime";
    // `PEN` = séance de tirs au but EN COURS, pas match terminé. La table partagée du
    // dépôt classe `^pen$` en live ; rendre ici `finished` ferait dire « Terminé » par la
    // carte pendant que l'onglet Top 10 dit « Live » pour le même match.
    case "PEN":
      return "live";
    case "FT":
      return "finished";
    default:
      // Statut inconnu reçu du flux : on ne devine pas l'état, on retombe sur l'horloge.
      return inferFromClock(match.scheduledAt, nowMs);
  }
}

// ---------------------------------------------------------------------------
// Basketball
// ---------------------------------------------------------------------------

/**
 * Statut de la **vue** basketball (`basketball-view.ts` / `basketball-calendar.ts`), pas
 * du flux : `"in-progress" | "post" | "pre"`.
 *
 * `"post"` est le piège : ESPN l'emploie pour « match terminé » et la table partagée ne
 * le connaît pas. Sans cas explicite, un match terminé au pied de l'onglet calendrier
 * retombait sur l'horloge — donc affiché « à venir » ou « live » selon l'heure du jour.
 * Le traiter comme `finished` est un switch explicite, pas une déduction.
 */
export function basketballViewState(status: string, scheduledAt?: string, nowMs = Date.now()): MatchState {
  switch (status) {
    case "in-progress":
      return "live";
    case "post":
    case "finished":
      return "finished";
    case "pre":
    case "scheduled":
      return "scheduled";
    default:
      // Statut inconnu (nouvelle source ?) : on passe par le vocabulaire partagé avant
      // de retomber sur l'horloge. Jamais de devinette directe.
      return rawStatusToMatchState("fiba", status, scheduledAt, nowMs);
  }
}

/**
 * Wrapper pour un objet porteur d'un `live.status` normalisé `"LIVE" | "HT" | "FT"`.
 * L'union est fermée côté codebase, mais une source externe peut l'envoyer en
 * minuscules — d'où le `toUpperCase()`.
 */
export function basketballMatchState(
  match: { scheduledAt?: string; live?: { status: string } | null },
  nowMs = Date.now(),
): MatchState {
  const status = match.live?.status;
  if (!status) return inferFromClock(match.scheduledAt, nowMs);
  const s = status.trim().toUpperCase();
  if (s === "LIVE") return "live";
  if (s === "HT") return "halftime";
  if (s === "FT") return "finished";
  // Hors union fermée (prolongation « OT », source inconnue) : la table partagée et la
  // table terminale savent mieux que nous. `OT` = quart supplémentaire EN COURS.
  return rawStatusToMatchState("fiba", s, match.scheduledAt, nowMs);
}

// ---------------------------------------------------------------------------
// Handball
// ---------------------------------------------------------------------------

/**
 * `HandballMatch.status` est une **union fermée** (`"not_started" | "live" | "halftime" |
 * "finished" | "postponed" | "cancelled"`) qui couvre déjà tout le vocabulaire dont le
 * badge a besoin. Mapping par switch exhaustif : si le type gagne un cas, TypeScript
 * casse la compilation **ici** plutôt qu'à l'exécution sur une carte de live.
 *
 * Le seul écart de nommage est `cancelled` (2 l) → `canceled` (1 l) : l'union suit
 * l'orthographe anglaise ambiante, `MatchState` la forme americanisée déjà utilisée dans
 * le dépôt.
 */
export function handballMatchState(input: {
  status: HandballMatch["status"];
  kickoff?: string;
}, nowMs = Date.now()): MatchState {
  switch (input.status) {
    case "live":
      return "live";
    case "halftime":
      return "halftime";
    case "finished":
      return "finished";
    case "postponed":
      return "postponed";
    case "cancelled":
      return "canceled";
    case "not_started":
      return "scheduled";
    default: {
      const exhaustive: never = input.status;
      return exhaustive;
    }
  }
}

/**
 * Variante « le flux a perdu son statut » : on retombe alors sur l'horodatage.
 * Séparée de la précédente pour que l'exhaustivité reste vérifiable : ici, `status`
 * est optionnel et le repli est légitime.
 */
export function handballMatchStateSafe(
  input: { status?: HandballMatch["status"] | null; kickoff?: string },
  nowMs = Date.now(),
): MatchState {
  if (!input.status) return inferFromClock(input.kickoff, nowMs);
  return handballMatchState({ status: input.status, kickoff: input.kickoff }, nowMs);
}

// ---------------------------------------------------------------------------
// Baseball
// ---------------------------------------------------------------------------

/**
 * `BaseballGameRecord.status` est l'**union fermée** `GameStatus = "scheduled" | "live" |
 * "final"` (`baseball/types.ts:24`), déjà normalisée par les scrapers MLB/KBO/NPB.
 *
 * Mapping par switch exhaustif, comme `handballMatchState` : si le type gagne un cas,
 * la compilation casse ICI plutôt qu'à l'exécution sur une carte de live. Le baseball
 * n'a ni `postponed` ni `canceled` dans son vocabulaire — pas de cas à inventer, c'est
 * justement ce qui distingue un mapping d'une devinette.
 */
export function baseballMatchState(input: {
  status: GameStatus;
  gameDateIso?: string;
}): MatchState {
  switch (input.status) {
    case "live":
      return "live";
    case "final":
      return "finished";
    case "scheduled":
      return "scheduled";
    default: {
      const exhaustive: never = input.status;
      return exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Snooker
// ---------------------------------------------------------------------------

/**
 * `SnookerLiveInput` ne porte **pas non plus** de statut (frames, points, joueur à la
 * table). Mêmes conséquences que le handball.
 *
 * **Honnêteté sur le vocabulaire** : le dépôt ne contient aucune table de statut snooker
 * (le snooker est absent de `LIVE_STATUS_PATTERNS` comme de `SPORT_TYPES`). Les motifs
 * ci-dessous sont donc ceux des flux génériques, pas une nomenclature vérifiée dans ce
 * codebase. Si le flux snooker expose un vocabulaire propre, c'est ici qu'il va — et le
 * test de cohérence (`match-state-adapters.test.ts`) signale toute divergence.
 */
export function snookerMatchState(
  input: { status?: string | null; scheduledAt?: string },
  nowMs = Date.now(),
): MatchState {
  return rawStatusToMatchState("snooker", input.status, input.scheduledAt, nowMs);
}