# C3 — QA popup (skill: verification-before-completion)

## Preuves navigateur (prod, fraîches)
- Dialog : fond uni `rgb(250, 250, 250)` (translucidité supprimée) ✓.
- `Meilleures statistiques` ✓ (live : possession 78/22, fautes 1/3 ;
  xG omis si null — correct).
- Prematch : heatmap ✓ (59 motifs scores), Top3 ✓, 0 erreur page.
- Live : heatmap absente (voulu, prematch-only) ; venue absente si
  `venue: null` (correct, pas de faux bloc).

## Vérifications
- `bunx prisma validate` : schéma valide, 0 migration.
- `graphify update .` : graphe régénéré.
