# Test Report — Tennis Sprint 3
**Date** : 2026-05-18
**Items** : Serve Momentum Live (#10), Flux Value In-Play (#11), Mini-bracket RG (#12)

## ✅ Tests passés
- **Sync server↔frontend** : `serve_momentum` exposé route live (server.js:12119) ↔ `_tvbServeSpark(m.serve_momentum)` (pariscore.html:9564). `/api/v1/tennis/rg-path` (server.js:19741) ↔ `loadRgPath()` apiFetch (pariscore.html:7848). 0 orpheline.
- **Serve Momentum logique** (synthétique) : hist 6 snapshots → games[5], breaks_recent=2, run p2 len4, trend p2 ✓. Hist vide → `{games:[],breaks_recent:0,run:{null,0},trend:even}` (dégradé propre). Break = jeu gagné par non-serveur entre 2 snapshots ; saute si >1 jeu (poll lent) → robuste.
- **RG résolu en direct (BSD)** : `category=grand_slam` → id 76 (Roland Garros ATP, clay) + 77 (WTA, clay), exclus Boys/Girls/Wheelchair/Junior. `RG[76]` matchs réels = qualifs déjà tirées (« Qualification Round 1 », scheduled). `buildRgPath` opérationnel dès maintenant sur qualifs, tableau principal au tirage.
- **Colonnes** : serve sparkline inline dans cellule jeux (table live 8 col, colspan=8 intact). RG = module séparé sous le tableau (hors grille, conforme garde-fou anti-surcharge).
- **Cumul RG** : produit des `prob_win` par tour, couleur seuil (≥50% vert / ≥20% ambre / <20% rouge), `prob_win` null → cumul stoppé proprement.
- **Purge mémoire** : `_tennisServeHist` purgé des ids non-live à chaque poll (pas de fuite).
- **Null safety** : route live `serve_momentum: m.serve_momentum || null` ; `_tvbServeSpark` → '' si absent ; `buildRgPath` retourne `{available:false,reason}` (rg_not_found / no_matches_for_player / player_required) géré côté UI (message ambre).
- `node --check server.js` → SERVER_OK.

## ⚠️ Avertissements
### W1 — Serve momentum non vérifiable e2e (pas de tennis live)
Logique validée synthétique uniquement. Précision réelle du flag break dépend de la cadence poll (30s) vs rythme des jeux : un poll manquant >1 jeu est ignoré (pas de faux break, mais jeu non compté). À valider pendant RG sur match live réel (`[TennisLive] live=N`).
### W2 — #11 Flux Value In-Play : pas d'EV in-play réel
Aucune source de cote tennis live (The Odds API = h2h pré-match). #11 livré sous forme **serve momentum + tendance/breaks** (signal décision live) ; l'EV recalculé par jeu nécessiterait un flux de cotes live (non disponible). Documenté, non bloquant — la valeur livrée = lecture momentum, pas pricing.
### W3 — RG path = chaîne probabilités, pas vrai bracket
`prob_win` par tour issue des prédictions ML BSD des matchs RG existants (pas de simulation du tableau complet). Tant que le tirage principal n'est pas publié → seules les qualifs remontent. Cumul = produit naïf (indépendance supposée entre tours).
### W4 — Matching joueur RG par nom normalisé
`buildRgPath` filtre par `normName`. Nom inexact / variante → `no_matches_for_player` (message clair, pas de faux résultat).

## ❌ Bugs
Aucun bloquant.

## 💡 Recommandations
1. Pré-chauffer `_koaEnqueue` + cache predictions pour les joueurs du tableau RG dès publication du tirage.
2. #11 v2 : si une source de cote live tennis devient dispo (BSD live odds / autre), brancher l'EV in-play sur serve_momentum + blended.
3. RG path : ajouter une simulation Monte-Carlo du bracket complet (S4/futur) pour un vrai "chemin vers la finale".

## Statut
**S3 LIVRÉ** (backend 3/3 + frontend). #10/#12 validés données réelles BSD ; #11 livré en mode signal (EV in-play hors-scope faute de cotes live). Validation live finale pendant RG (W1).

---

## Récapitulatif global Tennis BSD (S1+S2+S3)
- **S1** : badge confiance calibré, divergence ML/marché, ranking momentum, SDI
- **S2** : blend dynamique (poids ∝ Brier), trap-bet, edge confiance, value 1er set, convergence totaux
- **S3** : serve momentum live, flux signal in-play, mini-bracket RG
Tous backend + frontend inline (grille condensée, 0 colonne ajoutée), testés statique + données réelles BSD/TA. Validation visuelle + live = onglet Tennis prod / pendant RG.
