# 🔐 MÉMO — Accès PariScore

> ⚠️ Fichier local — contient des secrets. **NON commité** (ajouté à `.gitignore`). Ne pas partager.

## 👑 ADMINISTRATEUR (propriétaire)

| | |
|---|---|
| **Login** | `admin` |
| **Mot de passe** | `PariScorePion2026` |
| **Accès** | Total, illimité, permanent (tous sports, tous modules) |
| **Connexion** | Formulaire login → champ "Email" = `admin` (sans @) · Mot de passe |

⚠️ **Prod (Render)** : ajouter la variable d'environnement `ADMIN_PASSWORD=PariScorePion2026`
(Dashboard Render → service → Environment). Sinon le mot de passe admin en prod reste l'ancien défaut `pariscore2026`. En local : déjà OK (présent dans `.env`).

## 🧪 BÊTA-TESTEURS (weekend — compte partagé)

| | |
|---|---|
| **Login** | `betatesteur` |
| **Mot de passe** | `Beta2026` |
| **Accès** | Total (foot + tennis, tous modules) |
| **Validité** | Vendredi 15/05/2026 → **expire lundi 18/05/2026 00:00** (heure Paris) |
| **Connexion** | Formulaire login → champ "Email" = `betatesteur` (sans @) · Mot de passe |

- Après lundi 18/05 00:00 : connexion refusée (« Période beta terminée ») + sessions ouvertes coupées automatiquement.
- Compte partagé entre tous les testeurs (pas de données perso ni bankroll).
- Fonctionne en prod sans config (mdp par défaut codé en fallback ; override possible via env `BETA_TESTER_PASSWORD`).

## Règles

- Ne JAMAIS communiquer les identifiants **admin** aux testeurs — leur donner uniquement le compte **betatesteur**.
- Membres normaux : inscription obligatoire (email + mot de passe) via "S'inscrire".
- Freemium = tableau foot 5 ligues UE + 10 consultations/jour.
- **Période test gratuite 15→18/05/2026** : tout compte connecté (même freemium) a accès total + quota levé. Retour automatique aux verrous normaux après le 19/05.

---

*Généré le 2026-05-15 — PariScore v10.15.4*
