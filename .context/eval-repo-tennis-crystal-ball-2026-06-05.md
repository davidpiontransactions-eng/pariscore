# Éval modèle externe — `mcekovic/tennis-crystal-ball`

> Date : 2026-06-05 · Auteur : GM/CTO PariScore · Statut : **PENDING DG GO/NO-GO**
> Repo : https://github.com/mcekovic/tennis-crystal-ball
> Aussi connu : **Ultimate Tennis Statistics (UTS)** + **Tennis Crystal Ball** (moteur prédiction)

---

## 0. 🚨 DRAPEAU LÉGAL — DUAL LICENSE (bloquant commercial)

| Composant | Licence | Usage PariScore (SaaS €19/mo commercial) |
|---|---|---|
| **Code source** (Java/Spring) | Apache 2.0 | ✅ réutilisable commercialement |
| **Algorithmes** (Elo custom, NN prediction, GOAT, Tournament Forecast) | **CC BY-NC-SA 4.0** | ❌ **NON-COMMERCIAL** + ShareAlike + attribution |

**= même piège que TML-Database (bd `8uoc`).** Le cœur prédictif (formules Elo tennis, archi NN, pondérations) est **interdit en usage commercial**. PariScore est commercial → copier ces algos = violation licence + obligation ShareAlike (forcerait open-source de notre code).

---

## 1. Quel modèle ?

**Réseau de neurones "Match Prediction Algorithm"** + système Elo multi-dimension custom.

### NN (Crystal Ball)
- **~60 neurones**, features joueur : Elo Ratings, ATP Points, Head-to-Head ratios, Winning %, Recent Form
- Variés par : **surface, niveau tournoi, round, tournoi, récence, match/set ratios**
- **Entraînement surface-specific** → poids features différents par surface (clay/grass/hard)

### Elo custom (le vrai joyau)
- Elo **overall + surface-specific** (clay/grass/hard)
- Elo **contextuel** : outdoor/indoor, set-level, **service/return game Elo**, tie-break Elo
- Tables Elo hebdomadaires + Peak Elo

### Données
- **Jeff Sackmann ATP CSV** (snapshot déc 2019). Docker PostgreSQL pré-rempli jusqu'à 2019.
- ⚠️ Sackmann = source PariScore **en cours de purge** (bd `8uoc`/`dl49`, NC license).

### Stack
- **Java 51% + Spring Boot + Groovy + PostgreSQL + Thymeleaf/jQuery.** Aucune métrique accuracy/Brier/ROI publiée dans README.

---

## 2. Avantages vs PariScore ?

### Verdict : **NO-GO incorporation directe.** Inspiration conceptuelle seulement.

| Critère | Constat |
|---|---|
| **Licence** | ❌ **BLOQUANT.** Algos CC BY-NC-SA = non-commercial. Copier formules Elo/NN = illégal pour SaaS payant + ShareAlike viral. |
| **Stack** | ❌ Java/Spring/PostgreSQL/Groovy = antithèse Node zero-dep + SQLite. Réécriture totale obligatoire (pas de réutilisation code). |
| **Edge marché** | ✅ Point positif : NN **n'ingère PAS la cote** (Elo/H2H/form only) → pas circulaire, contrairement à palaia. Mais licence bloque l'usage. |
| **Calibration/UQD** | ⚠️ README ne publie ni Brier ni IC ni reliability. Pas vérifiable. Viole règle UQD si adopté tel quel. |
| **Redondance** | ⚠️ Elo overall + Klaassen-Magnus SPW/RPW déjà en prod. Recouvre une partie. |
| **Features INÉDITES** | ✅ **Vrai apport conceptuel** : Elo **surface-specific** (clay/grass/hard séparés) + Elo **service/return game** + Elo tie-break + recent-form decay. PariScore a Elo global mais PAS Elo par surface ni par contexte service/retour. C'est le gap réel. |
| **Données** | ❌ Sackmann déc-2019, déjà en purge légale. Stale + NC. Aucun intérêt. |
| **Leçon passée** | age/hand NO-GO (edge absorbé Elo). MAIS surface-Elo ≠ feature linéaire faible — c'est une **dimension Elo nouvelle**, potentiellement edge réel. |

### L'idée à voler (légalement)
**Elo surface-specific + Elo service/return.** Concept = domaine public (Elo théorie générale, Glickman). On peut **réimplémenter from scratch** un Elo par surface dans `buildMatchRecord` SANS copier leur formule CC-NC. PariScore a déjà `tennis_players_elo` + Sackmann surface data en DB → faisable nativement Node.

---

## 3. Recommandation GM

**NO-GO sur le repo** (3 raisons) :
1. **Légal** : algos CC BY-NC-SA non-commercial + ShareAlike viral → incompatible SaaS payant. Risque = TML-Database bis.
2. **Stack** : Java/Spring/PG = zéro réutilisation code dans Node zero-dep. Réécriture totale.
3. **Données** : Sackmann 2019 stale + en cours de purge légale PariScore.

**GO-partiel INSPIRATION (recommandé, séparé)** :
- Ouvrir bd ticket "**Elo surface-specific + service/return Elo**" — réimplémentation native Node from scratch, dérivée théorie Elo publique (Glickman/FiveThirtyEight), **sans lire/copier** leur code algo CC-NC.
- Source données = notre Elo interne BSD/ESPN (bd `dl49`), PAS Sackmann.
- Effort : **MED 4-6h** (split rating par surface dans pipeline existant + recompute hold prob par surface).
- Edge attendu : surface-Elo = facteur prédictif reconnu fort en tennis (clay specialists). Backtest Brier requis avant blend (règle UQD).

---

## Annexe — sources vérifiées
- Repo : https://github.com/mcekovic/tennis-crystal-ball
- README : https://github.com/mcekovic/tennis-crystal-ball/blob/master/README.md
- About UTS : https://www.ultimatetennisstatistics.com/about
- Licence code : Apache 2.0 · Licence algos : CC BY-NC-SA 4.0
- NN : ~60 neurones, features Elo/ATP pts/H2H/win%/form × surface/level/round/recency
- Elo : overall + surface + indoor-outdoor + set + service/return + tie-break
- Stack : Java/Spring Boot/Groovy/PostgreSQL · Data : Sackmann ATP CSV (déc 2019)

---

---

## 4. POST-GO — vérif codebase (2026-06-05)

User GO inspiration → audit code AVANT d'écrire. Résultat : **l'innovation citée est déjà en prod.**

| Pièce "innovation crystal-ball" | Locus PariScore | État |
|---|---|---|
| Elo surface-specific (Hard/Clay/Grass/Carpet + ALL) | `tennis_elo` `server.js:22682` · `computeTennisElo()` `:22819` | ✅ DÉJÀ SHIPPÉ |
| Surface Elo câblé prédictions | `_tennisLookupEloPair` `:24821` · `elo_surface` payload `:19736/19847` · top10 D3 `:23346` | ✅ DÉJÀ SHIPPÉ |
| K-factor exp + MoV + régression inactivité | `_eloKExp/_eloMov/_eloInactivityRegress` `:22701-22767` | ✅ DÉJÀ SHIPPÉ |

**Seul vrai gap = Elo service / Elo retour séparés.** BLOQUÉ :
1. **Training data** — serve/return Elo s'entraîne sur SPW/RPW par match historique. Source = colonnes serve Sackmann (NC, en purge bd `8uoc`/`dl49`) OU interne (différé 6 mois, accumulation ETL quotidien pas prête).
2. **Légal** — entraîner sur data CC-NC pour SaaS commercial = même risque que copier l'algo.

### Verdict final : **NO-GO net-new code maintenant.**
Surface-Elo (le cœur de l'apport) déjà en prod. Service/return Elo = seul reste, bloqué data + légal.
**Reprendre quand** : ETL interne `dl49` a ≥6 mois de serve-stats accumulés → là, Elo service/retour native = edge réel testable. Noté pour session future.

---

**Statut : NO-GO implémentation (redondance + blocage data/légal). Rapport archivé.**
