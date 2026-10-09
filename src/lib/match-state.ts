/**
 * États de match nommés — vocabulaire partagé par tous les onglets sport.
 *
 * Règle structurante (SDLC, corpus benchmark §2.2) : **tout état doit être visible et
 * nommé**. Un changement de cote non signalé, un marché suspendu sans raison = perte
 * de confiance immédiate. D'où un vocabulaire fermé plutôt qu'un booléen `isLive`.
 *
 * Pourquoi `odds-changed` est un état et pas un booléen `changed` : sa durée de vie est
 * **bornée**. Il signale, puis retombe sur `live`. Un booléen, lui, reste `true` jusqu'à
 * ce que le flux le remette à `false` — donc potentiellement pendant tout le match.
 */

/** États d'un match, tous sports confondus. */
export type MatchState =
  | "scheduled"
  | "live"
  | "halftime"
  | "suspended"
  | "odds-changed"
  | "finished"
  | "postponed"
  | "canceled";

/**
 * États qui doivent porter une raison affichée à l'utilisateur.
 *
 * `suspended` sans raison = marché gelé sans explication, exactement le pattern que le
 * benchmark désigne comme destructeur de confiance.
 */
const REQUIRES_REASON: ReadonlySet<MatchState> = new Set<MatchState>([
  "suspended",
  "postponed",
  "canceled",
]);

/**
 * États transitoires : un état de **notification** posé sur un match, qui retombe
 * automatiquement sur l'état réel.
 *
 * **`halftime` n'est PAS transitoire.** Il l'a été dans la première version de ce fichier,
 * et le badge tombait en « Live » après 3 s alors que la mi-temps dure ~15 minutes : un
 * état réel présenté comme un simple éclair. Une mi-temps a sa propre icône, sa propre
 * couleur, sa propre durée — elle reste affichée jusqu'à ce que le flux dise autre chose.
 *
 * Seul `odds-changed` est transitoire : il annonce un fait ponctuel (la cote a bougé), puis
 * se tait. La note devient caduque en trois secondes ; le match, lui, continue.
 */
const TRANSIENT_FALLBACK: Readonly<Partial<Record<MatchState, MatchState>>> = {
  "odds-changed": "live",
};

/** `true` si l'état impose l'affichage d'une raison. */
export function stateRequiresReason(state: MatchState): boolean {
  return REQUIRES_REASON.has(state);
}

/** `true` si l'état est transitoire (borné dans le temps). */
export function isTransientState(state: MatchState): boolean {
  return state in TRANSIENT_FALLBACK;
}

/**
 * État stable correspondant à un état transitoire, ou `null` si l'état est stable.
 *
 * Utilisé par le composant pour déclencher le retour automatique sans dupliquer la
 * table des états.
 */
export function transientFallback(state: MatchState): MatchState | null {
  return TRANSIENT_FALLBACK[state] ?? null;
}

/**
 * Dérive l'état affiché d'un état reçu, en résolvant la cascade transitoire.
 *
 * Fonction **pure** : c'est elle qui est testée, pas le composant. Le composant ne fait
 * que l'afficher + gérer le timer.
 *
 * Déclarée avant `isInPlay` : une fonction citée dans un module doit être définie au-dessus
 * de son premier usage, sans compter sur le hoisting pour rester lisible.
 */
export function resolveState(state: MatchState): MatchState {
  let resolved = state;
  // Cascade : un transitoire dont le fallback est lui-même transitoire doit remonter
  // jusqu'à un état stable. Boucle bornée par la taille de TRANSIENT_FALLBACK.
  for (let i = 0; i < 8; i += 1) {
    const next = transientFallback(resolved);
    if (next == null) return resolved;
    resolved = next;
  }
  return resolved;
}

/**
 * `true` si le match est en cours de jeu (live, mi-temps, ou notification posée dessus).
 *
 * Dérivé de `resolveState` plutôt que d'une liste écrite à la main : un nouvel état
 * transitoire hérite ainsi automatiquement du sens de sa cible, au lieu d'ouvrir une
 * deuxième liste à maintenir en parallèle — qui finit toujours par diverger.
 */
export function isInPlay(state: MatchState): boolean {
  const resolved = resolveState(state);
  return resolved === "live" || resolved === "halftime";
}