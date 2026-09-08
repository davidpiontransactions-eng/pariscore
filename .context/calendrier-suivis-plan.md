# Section « Suivis » FotMob — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: test-driven-development for F2,
> verification-before-completion for F3, finishing-a-development-branch for F4.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dans `FotmobCalendarTable`, les matchs suivis (étoile) remontent dans
une section « Suivis » épinglée en tête, comme FotMob.

**Architecture:** Partition pure des matchs du jour par ids suivis
(`useFollowStore`, persisté `pariscore.follows`) ; section « Suivis »
= `FotmobLeagueSection` avec icône étoile ; exclusion des suivis des groupes
ligues (déplacement, pas duplication).

**Tech Stack:** React 19 + zustand persist + bun:test + Tailwind v4 (hex inline).

## Global Constraints

- TypeScript strict, aucun `any`.
- Commentaires FR, style du fichier existant (hex inline, pas de tokens).
- FR hardcodé (convention `fotmob-calendar-table.tsx`, pas de next-intl ici).
- Convention ids matchs suivis : `match:football:<id>` (cf. header store) ;
  lecture tolérante aux anciens ids bruts `bsd-*` (déployés le 2026-09-08).
- Aucune migration Prisma (lecture seule, UI-only).

---

## File Structure

- `src/lib/fotmob-follow.ts` (nouveau) : `partitionFollowed` pure + `toFollowId`.
- `tests/fotmob-follow.test.ts` (nouveau) : spec bun:test.
- `src/components/football/fotmob-calendar-table.tsx` : section Suivis + icon prop.
- `.context/calendrier-suivis-fN.md` : traçabilité par tâche.

---

### Task F1: Spec (cette tâche)

**Files:** `.context/calendrier-suivis-plan.md` (plan), `.context/calendrier-suivis-f1.md` (trace).

- [x] **Step 1: Lire le store** — `use-follow-store.ts` : `follows: Record<id, FollowEntry>`,
  `toggle(entry: Omit<FollowEntry,"addedAt">)`, persist `pariscore.follows`.
- [x] **Step 2: Écart convention** — `FotmobFollowStar` écrit des ids bruts
  (`bsd-*`) alors que `getFollowedMatchIds()` attend `match:*`. Lecture
  bi-forme + écriture conventionnelle en F2.
- [x] **Step 3: Écrire le plan** — ce document.
- [x] **Step 4: prisma + graphify** — `bunx prisma validate`, `graphify update .`.

### Task F2: Implémentation TDD

**Files:**
- Create: `src/lib/fotmob-follow.ts`, `tests/fotmob-follow.test.ts`
- Modify: `src/components/football/fotmob-calendar-table.tsx`

**Interfaces:**
- Consumes: `FotmobCalMatch` (table), `useFollowStore(s => s.follows)`.
- Produces: `partitionFollowed(matches, followedIds)` →
  `{ followed: FotmobCalMatch[]; rest: FotmobCalMatch[] }` (ordre préservé) ;
  `toFollowId(rawId: string)` → `"match:football:<rawId>"` (idempotent).

- [ ] **Step 1: Écrire le test qui échoue** (`tests/fotmob-follow.test.ts`,
  `bun:test` : `describe/test/expect`) :
```ts
import { describe, expect, test } from "bun:test";
import { partitionFollowed, toFollowId } from "@/lib/fotmob-follow";
const m = (id: string) => ({ id, scheduledAt: "2026-09-08T19:00:00Z",
  home: { name: "A" }, away: { name: "B" } });
test("toFollowId idempotent", () => {
  expect(toFollowId("bsd-1")).toBe("match:football:bsd-1");
  expect(toFollowId("match:football:bsd-1")).toBe("match:football:bsd-1");
});
test("partition sépare suivis (2 formes) et préserve l'ordre", () => {
  const ms = [m("bsd-1"), m("bsd-2"), m("bsd-3")];
  const { followed, rest } = partitionFollowed(ms, ["match:football:bsd-2", "bsd-3"]);
  expect(followed.map((x) => x.id)).toEqual(["bsd-2", "bsd-3"]);
  expect(rest.map((x) => x.id)).toEqual(["bsd-1"]);
});
test("partition vide", () => {
  expect(partitionFollowed([], ["match:football:x"])).toEqual({ followed: [], rest: [] });
});
```
- [ ] **Step 2: Lancer, constater l'échec** — `bun test tests/fotmob-follow.test.ts`
  (module manquant).
- [ ] **Step 3: Implémenter** `src/lib/fotmob-follow.ts` (normalisation :
  `fid === id || fid === "match:football:" + id`), prop `icon?: ReactNode`
  sur `FotmobLeagueSection`, section « Suivis » (étoile 24px du sample,
  badge x/y existant, collapse clé `"__suivis"`), exclusion des suivis des
  groupes, `FotmobFollowStar` → `toFollowId`.
- [ ] **Step 4: Relancer** — `bun test` PASS + `bun run lint` + `bun run typecheck`.
- [ ] **Step 5: Doc + prisma + graphify** — `.context/calendrier-suivis-f2.md`.

### Task F3: QA navigateur

- [ ] **Step 1: Déployer** (boucle manuelle SSH, `SKIP_TESTS=1`).
- [ ] **Step 2: Probe** — suivre 2 étoiles → section « Suivis » première,
  badge `2/2`, `aria-expanded`, unfollow → retour ligue, reload → persistance.
- [ ] **Step 3: 0 console error / 0 requête 4xx.**
- [ ] **Step 4: Doc** — `.context/calendrier-suivis-f3.md`.

### Task F4: Intégration

- [ ] **Step 1: Commit** — `feat(football): Suivis section in calendar table`.
- [ ] **Step 2: Push + deploy + smoke** (`/`, `/calendrier-foot`,
  `?sport=football`).
- [ ] **Step 3: Doc** — `.context/calendrier-suivis-f4.md`.

## Self-Review

1. **Couverture** : spec (F1) ✓, partition+UI (F2) ✓, QA (F3) ✓, release (F4) ✓.
2. **Placeholders** : aucun (code et commandes exacts ci-dessus).
3. **Types** : `FotmobCalMatch` réutilisé tel quel ; `icon: ReactNode` importé
   de `react` dans le composant.
