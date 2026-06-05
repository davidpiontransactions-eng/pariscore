# Éval modèle externe — `grooveworks/tennis-db`

> Date : 2026-06-05 · Auteur : GM/CTO PariScore · Statut : **PENDING DG GO/NO-GO**
> Repo : https://github.com/grooveworks/tennis-db · Licence : **non spécifiée** ⚠️

---

## 1. Quel modèle ? → AUCUN

**Ce n'est PAS un repo de modèle prédictif.** = plateforme data/frontend tennis en développement (WIP).

- 308 commits · **HTML 60.8% / JS 37.5% / PowerShell 1.7%**
- Backend = **Firebase (Firestore)** · build PowerShell
- Docs présentes : `ARCHITECTURE_v4.md`, `DESIGN_SYSTEM_v4.md`, `TENNIS_RULES.md` · versions v3/v4 · prototypes HTML
- **Absent** : aucun modèle ML, aucun algo prédictif, aucune métrique, aucune source data attribuée, aucun README public, **aucune licence**.

→ Search GitHub ne le référence même pas (obscur/perso). Apparente plateforme front Firebase, pas un moteur de prédiction.

---

## 2. Avantages vs PariScore ?

### Verdict : **NO-GO — hors-sujet.** Rien à incorporer.

| Critère | Constat |
|---|---|
| **Type** | ❌ Pas un modèle. Plateforme front/data WIP. |
| **Modèle/algo** | ❌ Aucun. Rien à évaluer côté Edge math. |
| **Licence** | ❌ Non spécifiée = all rights reserved. Bloquant. |
| **Stack** | ❌ HTML/JS/**Firebase** — antithèse Node zero-dep + SQLite. Architecture concurrente, pas réutilisable. |
| **Data** | ❌ Aucune source/licence disclosed. |
| **Features inédites** | ❌ Sans objet (pas de modèle). |
| **Redondance** | ❌ Sans objet. PariScore = backend prédictif ; ce repo = front Firebase. |

---

## 3. Recommandation GM

**NO-GO ferme** (3 raisons) :
1. **Hors périmètre** — pas un modèle prédictif, pas d'algo, pas de math engine. Rien à incorporer dans notre pipeline.
2. **Stack incompatible** — Firebase/HTML/JS front vs Node zero-dep + SQLite. C'est une plateforme concurrente WIP, pas une brique.
3. **Légal opaque** — aucune licence, aucune source data documentée.

**Aucun GO-partiel.** Repo sans contenu exploitable pour l'Edge PariScore.

---

## Annexe — sources vérifiées
- Repo : https://github.com/grooveworks/tennis-db
- 308 commits · HTML 60.8% / JS 37.5% / Firebase Firestore
- Docs : ARCHITECTURE_v4 / DESIGN_SYSTEM_v4 / TENNIS_RULES · v3/v4 prototypes
- Pas de modèle · pas de métrique · pas de licence · pas de source data

---

**Attente : ton GO/NO-GO.** (reco = NO-GO ferme — pas un modèle, hors-sujet)
