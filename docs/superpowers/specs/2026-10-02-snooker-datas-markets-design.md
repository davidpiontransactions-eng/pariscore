## 📋 SPEC — Snooker : datas visibles, backtesting par marché, conformité design

> Brainstorming du 2026-10-02. Cadrage validé par David.
> Statut : **en cours** — vague 0 en construction.

### Décisions prises

| Sujet | Décision |
|---|---|
| Backtesting marchés 1xbet | **(A) accuracy par marché d'abord, (B) ROI réel ensuite** |
| Ordre des chantiers | **bug prod → datas visibles → backtesting marchés → design** |

### Vague 0 — BUG PROD : la page n'affiche rien (BLOQUANT)

**Constat mesuré le 2026-10-02, sur PROD :**

- `https://pariscore.fr/snooker` affiche `0 matchs analysés · 0 avec cotes · 0 en live`
- `https://pariscore.fr/api/v1/snooker/matches?limit=5` répond **HTTP 200 avec 4 matchs** :
  Robertson 5-3 Wakelin · Trump 5-0 Selby · Murphy 4-5 Wu (tous `finished`, tous datés du 2026-10-02)
- Même symptôme en local (`localhost:3000/snooker`), mais **la cause est bien en prod**
  → ce n'est PAS un problème d'environnement de dev.

**Cause identifiée en local (Playwright sous node) :** le client **n'émet aucune
requête** vers `/api/v1/snooker/matches`. Les seules requêtes réseau de la page sont
`/logo-header.svg`, la page elle-même, et `/sports-athlete-header.svg`. Le
squelette de chargement ne se résout donc jamais.

Hypothèses à trancher (à confirmer sur le code avant de conclure) :
1. Le hook SWR est conditionné à un état du store (`useSportsSidebarStore`) qui
   n'est pas armé sur `/snooker` en accès direct — cohérent avec la nav sport qui
   reste sur « Football ».
2. Le composant attend un `sport` actif qui n'est jamais positionné en entrée
   directe sur la route.

Critère de sortie : `pariscore.fr/snooker` affiche les matchs réels de l'API,
zéro squelette bloqué, et la nav sport « Snooker » active.

### Vague 0 bis — le pipeline de données ne produit rien d'exploitable

Constat lié : les 4 matchs retournés sont **tous `finished`**, **tous du jour**, et
**aucun ne porte de cote**. Donc même une page fonctionnelle afficherait :
- « live » vide (aucun match en cours),
- « Top 10 » vide (aucun match à venir avec cote à évaluer).

Il faut donc traiter **le fournisseur de données**, pas seulement le rendu :
- viser des matchs **à venir** dans une fenêtre glissante,
- récupérer les **cotes** par marché (prérequis de la vague 2B).

Critère de sortie : l'API renvoie des matchs à venir avec cotes sur les marchés
jouables, sinon les marchés ne sont pas constructibles.

### Vague 2A — Backtesting : accuracy par marché (sans cote)

`backtest-history.ts:7` : « Il n'y a PAS de cotes historiques gratuites pour le
snooker → pas de ROI ». Donc on mesure ce qui est mesurable :

Pour chaque marché jouable (Gagnant, 1er à N frames, Over/Under frames totales,
Handicap P1/P2, joueur le + de frames), et par stratégie :
- n (échantillon), proba moyenne prédite, **accuracy** (proba ≥ 50 % ⇔ gagné),
  Brier, log-loss,
- comparé à la baseline existante (« favori au classement »),
- **agrégé et par segment de confiance**, comme le backtest actuel.

Point d'honnêteté produit : c'est la **qualité de la probabilité**, pas un taux de
gain. L'UI doit le dire explicitement, sinon on retombe dans le surclaim SEO déjà
corrigé une fois (cf. `docs/snooker/PLAFFOND-PREDICTIF.md`).

### Vague 2B — ROI par marché (avec cote) — APRÈS 2A

Nécessite l'historique des cotes 1xbet sur le snooker. Risques assumés :
données lacunaires (le snooker est peu couvert), coût de scraping, faible n par
stratégie. Décision d'y aller prise, mais à documenter si le n est insuffisant
pour être significatif.

### Vague 3 — Design : conformité charte + rendu des tableaux

Constat mesuré : le fond du body rendu est `rgb(14, 18, 23)` (navy sombre) alors
que la charte impose le shell lavande `--bg-deep #F0ECF8` / `--primary #7B3FA0`.
Les squelettes sont orange vif, couleur absente de la charte. Le rendu ne respecte
pas `DESIGN_CHARTER.md`.

Périmètre : audit complet design + données + tableaux (demande de David),
incluant la voix « broadcast » des en-têtes (`.th-broadcast`, Space Grotesk) qui
n'a **jamais pu être vue** tant que la page était vide.

### Reporté — visuels IA (photos cartoon 3D, images animées)

Restent en TODO, non commencés, et **non commencables avant la vague 3** (ils
servent à habiller une page qui doit déjà afficher ses données). Détail des
arbitrages déjà tranchés dans `todo.md` (style, garde-fous, budget, droits à
l'image).