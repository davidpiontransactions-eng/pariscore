# Plan (ECC, adapté PariScore)

Avant tout code : produire un plan d'implémentation phasé.

## Règles

1. **Research d'abord** : chercher (Grep/Glob) et lire le code existant. Ne jamais deviner.
2. Tâches de 2-5 min, chacune avec un critère vérifiable (`verify: ...`).
3. Le Ladder : nécessaire ? existe déjà ? stdlib/native/dep installée ? une ligne ? sinon code minimum.
4. Pas de code dans cette phase. Pas de features spéculatives (YAGNI).
5. Conventions : CMD uniquement, `bun`, TypeScript strict sans `any`, commentaires français,
   Conventional Commits, 1 feature par commit, jamais de secrets committés.

## Format de sortie

```text
1. [Step] → verify: [check]
2. ...
```

Attendre l'approbation explicite avant d'implémenter.
