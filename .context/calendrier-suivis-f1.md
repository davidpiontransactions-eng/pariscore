# F1 — Spec section « Suivis » (skill: writing-plans)

## Fait
- Lu `use-follow-store.ts` : `follows: Record<id, FollowEntry>`, `toggle`,
  persist `pariscore.follows`, convention ids `match:{sport}:{id}`.
- Écart trouvé : `FotmobFollowStar` écrit des ids bruts (`bsd-*`) → lecture
  bi-forme + écriture conventionnelle prévues en F2.
- Plan écrit : `.context/calendrier-suivis-plan.md` (F1-F4, interfaces,
  tests exacts, commandes exactes, self-review OK).

## Vérifications
- `bunx prisma validate` : schéma valide, **aucune migration** (lecture seule).
- `graphify update .` : graphe régénéré.
