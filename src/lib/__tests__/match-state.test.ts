import { describe, test, expect } from "bun:test";
import {
  isInPlay,
  isTransientState,
  resolveState,
  stateRequiresReason,
  transientFallback,
  type MatchState,
} from "../match-state";

/**
 * Contrat des états de match (cahier des charges §5.1).
 *
 * Ces tests verrouillent deux invariants non négociables :
 * 1. aucun état en attente de raison ne peut être rendu sans raison ;
 * 2. aucun état transitoire ne peut rester affiché indéfiniment.
 */

const ALL: MatchState[] = [
  "scheduled",
  "live",
  "halftime",
  "suspended",
  "odds-changed",
  "finished",
  "postponed",
  "canceled",
];

describe("stateRequiresReason", () => {
  test("suspended / postponed / canceled exigent une raison", () => {
    expect(stateRequiresReason("suspended")).toBe(true);
    expect(stateRequiresReason("postponed")).toBe(true);
    expect(stateRequiresReason("canceled")).toBe(true);
  });

  test("les états normaux n'exigent pas de raison", () => {
    for (const s of ["scheduled", "live", "halftime", "finished", "odds-changed"] as MatchState[]) {
      expect(stateRequiresReason(s)).toBe(false);
    }
  });

  test("chaque état exigeant une raison est un état non jouable", () => {
    // Un marché gelé ou annulé n'est pas « en jeu » : si ces deux notions se
    // confondaient, l'UI afficherait « Live » sur un match reporté.
    for (const s of ["suspended", "postponed", "canceled"] as MatchState[]) {
      expect(isInPlay(s)).toBe(false);
    }
  });
});

describe("transientFallback", () => {
  test("odds-changed retombe sur live", () => {
    expect(transientFallback("odds-changed")).toBe("live");
    expect(isTransientState("odds-changed")).toBe(true);
  });

  test("halftime n'est PAS transitoire", () => {
    // Régression ciblée : `halftime` était dans TRANSIENT_FALLBACK et tombait en « Live »
    // au bout de 3 s alors qu'une mi-temps dure ~15 minutes. Un état réel présenté comme
    // un éclair, avec la propre icône et la propre couleur de l'état effacé.
    expect(transientFallback("halftime")).toBeNull();
    expect(isTransientState("halftime")).toBe(false);
    expect(resolveState("halftime")).toBe("halftime");
  });

  test("les états stables n'ont pas de fallback", () => {
    for (const s of ["scheduled", "live", "halftime", "finished", "suspended", "postponed", "canceled"] as MatchState[]) {
      expect(transientFallback(s)).toBeNull();
      expect(isTransientState(s)).toBe(false);
    }
  });

  test("la table transitoire ne contient que des notifications", () => {
    // Chaque transitoire doit viser un état in-play : c'est ce qui garantit que
    // `isInPlay` hérite d'un sens correct (voir `isInPlay`).
    for (const s of ALL) {
      const fb = transientFallback(s);
      if (fb != null) expect(isInPlay(fb)).toBe(true);
    }
  });
});

describe("resolveState", () => {
  test("un état stable reste lui-même", () => {
    for (const s of ["scheduled", "live", "halftime", "finished", "suspended", "postponed", "canceled"] as MatchState[]) {
      expect(resolveState(s)).toBe(s);
    }
  });

  test("un transitoire simple se résout immédiatement", () => {
    expect(resolveState("odds-changed")).toBe("live");
  });

  test("aucun état ne boucle à l'infini", () => {
    // La cascade est bornée : même si la table créait un cycle, resolveState
    // doit terminer. Test de garde contre une future régression de table.
    for (const s of ALL) {
      expect(typeof resolveState(s)).toBe("string");
    }
  });
});

describe("isInPlay", () => {
  test("live et halftime sont en jeu", () => {
    expect(isInPlay("live")).toBe(true);
    expect(isInPlay("halftime")).toBe(true);
  });

  test("odds-changed est en jeu : c'est une notification posée sur un match live", () => {
    // Dérivé de `resolveState` : `odds-changed` retombe sur `live`, donc en jeu.
    // La version précédente renvoyait `false` — une liste écrite à la main qui avait
    // divergé du sens de la table transitoire.
    expect(isInPlay("odds-changed")).toBe(true);
  });

  test("les états terminaux ne sont pas en jeu", () => {
    for (const s of ["scheduled", "finished", "postponed", "canceled", "suspended"] as MatchState[]) {
      expect(isInPlay(s)).toBe(false);
    }
  });
});