# Test Report — Tennis Sprint 1 (signaux BSD tableau)
**Date** : 2026-05-18
**Module** : `_buildTennisValueBetsCore` (backend) + `renderTennisValueBets` (frontend)
**Périmètre** : Badge Confiance calibré, Divergence ML/Marché, Ranking Momentum, Serve Dominance Index

## ✅ Tests passés
- **Sync server↔frontend** : backend expose `confidence_badge`, `ml_market_div`, `rank_momentum.{p1,p2}`, `serve_dominance` (server.js:19388-19391) ; frontend lit exactement `m.confidence_badge/ml_market_div/rank_momentum/serve_dominance` (pariscore.html:10065-10071). Zéro clé orpheline.
- **Colonnes** : injection 100% inline dans cellules existantes (noms, Elo, proba). Aucune colonne ajoutée → `colspan="13"` (×3 états vides/filtre) reste valide. Contrainte "condenser d'abord" respectée.
- **Null safety** (validé en isolation) :
  - calib `null` (BSD off / fetch KO) → `_calibBadge` → `null` → `_tvbConfBadge('')` → chaîne vide, aucune casse.
  - `rankIdx` vide → `_rankMomentum(undefined)` → `null` → flèche absente.
  - `predMap` vide → `bsdProb=null` → blend `elo_only` (pas de régression), `_tvbMlDiv` rien.
  - `serve_dominance=null` (cache KoA froid) → `_tvbSDI` chaîne vide.
  - Helpers testés : vert/amber/red/null/flat/noflag → tous dégradent proprement.
- **Données réelles** : calibration 151 réglées, acc 62.9%, buckets monotones (50→43%, 80→91%) ; rankings Sinner #1 ; SDI Sinner 77.8 > Alcaraz 70.8 > Svitolina 67.5, split clay correct.
- **Unités** : `ml_market_div = bsdProb.p1*100 − fair.p1` (les deux en %, cohérent). `confidence` 0-100 → bucket `floor(c/10)` clampé 5-9. OK.
- **Perf** : predictions/calibration/rankings = 1 fetch bulk chacun, cachés (30min / 6h / 6h), paginations bornées (6-8 pages). SDI = rows KoA déjà cachées, **zéro fetch ajouté**. Pas de N+1.
- `node --check server.js` → SERVER_OK.
- Déploiement prod : pm2 restart OK (build 36, online).

## ⚠️ Avertissements (non bloquants)
### W1 — SDI dépend du cache KoA chaud
`serve_dominance` calculé seulement si `getKoaMatchmxCached` chaud pour les 2 joueurs. Cache rempli en lazy (`_koaEnqueue`, concurrence 2). Aux 1ers chargements / nouveaux joueurs → SDI absent (rendu vide propre) puis apparaît après warm-up. Comportement attendu, à monitorer pendant RG (volume joueurs).

### W2 — Calibration `upcoming=false` non bornée dans le temps
`buildBSDTennisCalibration` prend les 200×8 dernières prédictions réglées (pas de fenêtre date). Échantillon biaisé vers le récent. Acceptable (cache 6h, n≥30 par bucket requis pour badge vert). Surface `clay` vide tant que RG pas joué → badge retombe sur accuracy globale (logique prévue).

### W3 — Pas de vérif E2E navigateur
Onglet Tennis auth-gated (Pro Tennis) + RG non commencé → rendu visuel exact non confirmé. Logique + données validées hors-ligne. À confirmer en prod : ouvrir onglet Tennis, vérifier pastille/SDI/flèche/MLΔ + logs `[TennisCalib BSD]` `[TennisRank BSD]` `[TennisPred BSD]`.

### W4 — Matching ranking par nom normalisé
`rankIdx` clé = `normName(player.name)`. Matchs ESPN-fallback (noms displayName différents) → momentum absent (dégradé propre, pas de faux positif). BSD primaire = noms cohérents → OK.

## ❌ Bugs détectés
Aucun bug bloquant.

## 💡 Recommandations
1. Pré-chauffer le cache KoA des joueurs RG avant le tournoi (boucle `_koaEnqueue` sur le tableau RG) → SDI dispo dès J1.
2. S2 : exploiter la calibration mesurée pour le **blend dynamique** (poids ∝ 1/Brier par segment) au lieu du 60/40 fixe — la donnée est déjà calculée (`meta.bsd_calibration`, `by_confidence`, `by_surface`).
3. Ajouter un filtre tableau "Badge vert seulement" (réutilise `confidence_badge.level`).

## Statut
**S1 LIVRÉ** (backend 4/4 + frontend inline), testé statique + données réelles BSD/TA, déployé prod. Validation visuelle finale = ouverture onglet Tennis en prod (W3).
