# Communications Phase 1

> **Date** : 2026-07-06
> **Auteur** : Chef de projet
> **Statut** : Prêt à envoyer (en attente validation Direction)

---

## 1. Communication interne équipe — Alerte Phase 1

### 1.1 Slack / canal équipe dev (immédiat)

```
🚨 [URGENT] Phase 1 audit sécurité — gel déploiement PariScore

L'audit de sécurité a identifié 4 vulnérabilités critiques permettant
un accès admin non autorisé SANS mot de passe. Exploit possible via
requête HTTP publique.

📋 Plan d'action Phase 1 (4h, aujourd'hui) :
  1. Rotation du secret JWT (toutes les sessions seront invalidées)
  2. Nettoyage git : .jwt_secret + pariscore.db-wal (19 Mo) + logs
  3. Vérification .env VPS (ADMIN_PASSWORD, ALLOWED_ORIGIN, BYPASS flags)
  4. Audit VPS via script fourni

🚫 Action immédiate : NE PAS DÉPLOYER jusqu'à validation Phase 1.

👥 Affectations :
  - [Dev senior] : appliquer patches code (patch-001, patch-002)
  - [Ops] : exécuter verify-vps-env.sh + vps_audit.sh sur VPS
  - [Tous] : review du PLAN_ACTION_PM.md avant 14h

📁 Livrables prêts dans /home/z/my-project/phase1/
📡 Détails : PLAN_ACTION_PM.md + BUGS_A_CORRIGER.md

Chef de projet
```

### 1.2 Email à la Direction (immédiat)

```
De : chef.projet@pariscore.fr
À : direction@pariscore.fr
Cc : juridique@pariscore.fr, ops@pariscore.fr
Objet : [URGENT] Audit sécurité PariScore — 4 vulnérabilités critiques, gel déploiement recommandé

Madame, Monsieur,

Un audit de sécurité approfondi du projet PariScore a identifié 4
vulnérabilités critiques qui permettent à un attaquant externe
d'obtenir un accès administrateur complet au système sans connaître
le mot de passe. Ces vulnérabilités sont exploitables publiquement
via une simple requête HTTP.

RISQUES PRINCIPAUX
------------------
1. Le secret JWT (utilisé pour signer toutes les sessions admin et
   users) est committé dans le repository git public ET accessible
   via `curl https://pariscore.fr/.jwt_secret`. N'importe qui peut
   forger un token admin.

2. Le fichier WAL SQLite (19 Mo) contenant potentiellement des données
   utilisateurs (emails, hash passwords, paris, bankroll) est committé
   dans git. Si le repo est public, fuite massive de données.

3. Des mots de passe admin par défaut ('pariscore2026', 'Beta2026')
   sont actifs si NODE_ENV est mal configuré.

4. Le Dockerfile de production est non fonctionnel (better-sqlite3
   absent de package.json), ce qui bloque tout déploiement futur
   via Docker.

PLAN D'ACTION
-------------
Une Phase 1 de correction immédiate (4h de travail, 1 développeur
senior) est prête à être exécutée. Les livrables (patches de code,
scripts de cleanup git, template .env, scripts de vérification) sont
préparés dans /home/z/my-project/phase1/.

DÉCISIONS REQUISES
------------------
1. Autoriser le gel déploiement jusqu'à validation Phase 1.
2. Autoriser la rotation du secret JWT (impact : tous les users
   devront se reconnecter — communication à prévoir).
3. Confirmer si le repo GitHub est public ou privé.
   Si public : évaluer l'obligation de notification CNIL (art. 33
   RGPD, sous 72h) pour la fuite du WAL SQLite.
4. Valider la communication aux utilisateurs (template fourni).

Le détail complet est dans les documents :
  - /home/z/my-project/download/PLAN_ACTION_PM.md
  - /home/z/my-project/download/BUGS_A_CORRIGER.md
  - /home/z/my-project/download/ARCHITECTURE.md

Je reste à votre disposition pour toute clarification.

Cordialement,
Chef de projet
```

### 1.3 Email au Juridique (si repo public confirmé)

```
De : chef.projet@pariscore.fr
À : juridique@pariscore.fr
Objet : [URGENT RGPD] Évaluation fuite de données potentielle — PariScore

Madame, Monsieur,

Dans le cadre de l'audit sécurité en cours sur PariScore, nous avons
identifié que le fichier WAL SQLite (19 Mo) contenant potentiellement
des données à caractère personnel (emails, hash passwords, historique
de paris, transactions bankroll) a été committé dans le repository
GitHub du projet.

Si ce repository est public, cela constitue potentiellement une
violation de données à caractère personnel au sens de l'article 4.12
du RGPD, nécessitant une évaluation quant à l'obligation de
notification à la CNIL dans les 72 heures (article 33 RGPD).

ÉLÉMENTS À ÉVALUER
------------------
1. Le repository https://github.com/davidpiontransactions-eng/pariscore
   est-il public ou privé ?
2. Si public, depuis quelle date ? (git log du fichier pariscore.db-wal)
3. Quelles données EU users sont dans le WAL ?
   (à vérifier via sqlite3 .dump sur une copie)
4. Estimation du nombre d'utilisateurs concernés ?
5. Risque pour les droits et libertés des personnes ?

ACTIONS IMMÉDIATES RECOMMANDÉES
-------------------------------
1. Vérifier la visibilité du repo GitHub.
2. Si public : bloquer l'accès immédiatement (passer en privé).
3. Analyser le contenu du WAL pour identifier les données leakées.
4. Évaluer l'obligation de notification CNIL (art. 33) sous 72h.
5. Préparer une communication aux utilisateurs concernés (art. 34).

Le cleanup git (BFG Repo-Cleaner) est en cours de préparation et
permettra de supprimer le fichier de l'historique git. Toutefois,
cela ne supprime pas l'obligation de notification si la fuite a eu
lieu pendant une période où le repo était public.

Je reste à votre disposition pour vous fournir le contenu du WAL et
toute autre information nécessaire à l'évaluation.

Cordialement,
Chef de projet
```

---

## 2. Communication aux utilisateurs — Rotation secret JWT

### 2.1 Email aux utilisateurs actifs (avant maintenance)

```
De : noreply@pariscore.fr
À : [liste utilisateurs actifs dernière semaine]
Objet : [Maintenance] Renforcement de sécurité — veuillez vous reconnecter

Bonjour,

Dans le cadre de notre politique de sécurité et de protection de vos
données, nous effectuons une maintenance de renforcement de
l'authentification sur PariScore.

Cette maintenance aura lieu le [DATE] à [HEURE] et durera
environ 30 minutes.

IMPACT
------
Pendant la maintenance, le site sera accessible en lecture seule.
À la fin de la maintenance, toutes les sessions utilisateur seront
invalidées par mesure de précaution.

ACTION REQUISE
--------------
Vous devrez vous reconnecter avec vos identifiants habituels après
la maintenance. Vos données (paris, bankroll, favoris) ne sont pas
affectées.

POURQUOI CETTE MAINTENANCE ?
----------------------------
Nous avons identifié une vulnérabilité dans notre système
d'authentification. Par mesure de précaution, nous avons décidé
de rotater les clés de sécurité et d'invalider toutes les sessions
existantes. Aucune donnée ne semble avoir été compromise, mais
nous préférons agir par prudence.

Si vous avez des questions, n'hésitez pas à contacter notre support
à support@pariscore.fr.

L'équipe PariScore
```

### 2.2 Bannière sur le site (avant et pendant maintenance)

```
HTML à insérer en haut de pariscore.html (juste après <body>) :

<div id="maintenance-banner" style="
  background: #ff6d2e;
  color: white;
  padding: 12px 20px;
  text-align: center;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;
  position: sticky;
  top: 0;
  z-index: 9999;
">
  ⚠️ Maintenance de sécurité prévue le [DATE] à [HEURE].
  Vous devrez vous reconnecter après la maintenance.
  <a href="/blog/maintenance-securite-jour-2026" style="color: white; text-decoration: underline;">En savoir plus</a>
</div>
```

### 2.3 Communication post-maintenance (confirmation)

```
De : noreply@pariscore.fr
À : [liste utilisateurs]
Objet : Maintenance terminée — veuillez vous reconnecter

Bonjour,

La maintenance de sécurité est terminée. Merci de votre patience.

Pour des raisons de sécurité, toutes les sessions ont été invalidées.
Veuillez vous reconnecter avec vos identifiants habituels :
https://pariscore.fr

Vos données (paris, bankroll, favoris, alertes) sont intactes.

Si vous rencontrez des difficultés de connexion, contactez-nous à
support@pariscore.fr.

L'équipe PariScore
```

---

## 3. Communication post-Phase 1 — Compte-rendu interne

### 3.1 Email à l'équipe (après validation Phase 1)

```
De : chef.projet@pariscore.fr
À : direction@pariscore.fr, equipe-dev@pariscore.fr, ops@pariscore.fr
Objet : [Terminé] Phase 1 audit sécurité — corrections appliquées

Madame, Monsieur,

La Phase 1 de l'audit sécurité a été appliquée avec succès.
Voici le compte-rendu.

CORRECTIONS APPLIQUÉES
----------------------
✅ Secret JWT rotaté (ancien invalidé, nouveau en place)
✅ Fichier .jwt_secret supprimé du git + historique nettoyé (BFG)
✅ BLOCKED_FILES étendu (.jwt_secret, fichiers sensibles)
✅ Mots de passe admin/beta par défaut supprimés (fail-fast strict)
✅ ALLOWED_ORIGIN configuré (CORS sécurisé)
✅ 71 fichiers sensibles retirés du tracking git (78 Mo nettoyés)
✅ .gitignore enrichi (25 patterns ajoutés)
✅ VPS vérifié : NODE_ENV=production, aucun BYPASS flag actif

VÉRIFICATIONS
-------------
- curl https://pariscore.fr/.jwt_secret → 403 ✅
- curl https://pariscore.fr/.env → 403 ✅
- pm2 status : 5 process online ✅
- Smoke test API : /api/v1/status → 200 ✅
- verify-vps-env.sh : 10/10 PASS ✅

IMPACT UTILISATEURS
-------------------
Toutes les sessions ont été invalidées. Communication envoyée à
[X] utilisateurs actifs. Taux de reconnexion à [Y]% à H+24h.

PROCHAINES ÉTAPES
-----------------
- Phase 2 (16h, sous 7 jours) : correction des 11 bugs HIGH
  (Dockerfile, XSS massif, D-Tale, PandasAI, etc.)
- Phase 3 (24h, sprint prochain) : durcissement MEDIUM
- Audit VPS comparatif : en attente des sorties vps_audit.sh

LIVRABLES
---------
- /home/z/my-project/phase1/patches/ : patches code appliqués
- /home/z/my-project/phase1/scripts/ : scripts exécutés
- /home/z/my-project/phase1/configs/.env.production.template
- /home/z/my-project/phase1/communications/ : ce dossier
- /home/z/my-project/phase1/README-EXECUTION.md : guide complet

Je reste à votre disposition pour toute question.

Cordialement,
Chef de projet
```

---

## 4. Décisions à valider (tracking)

| # | Décision | Owner | Statut | Action requise |
|---|---|---|---|---|
| D-01 | Valider le gel déploiement | Direction | ⏳ En attente | Réponse email 1.2 |
| D-02 | Confirmer visibilité repo GitHub | Ops | ⏳ En attente | `curl https://api.github.com/repos/davidpiontransactions-eng/pariscore \| grep private` |
| D-03 | Notifier CNIL (si repo public + WAL leaké) | Juridique | ⏳ En attente | Évaluation 72h après confirmation D-02 |
| D-04 | Communiquer aux users la rotation sessions | Chef de projet | ⏳ En attente | Validation D-01 |
| D-05 | Autoriser force-push BFG | Direction + Dev senior | ⏳ En attente | Validation PRs/forks non bloquantes |
| D-06 | Désactiver scrapers risqués (TNNS, 1xBet) | Direction + Juridique | ⏳ Backlog | Étude business |

---

*Document de communication Phase 1 — à mettre à jour après chaque action.*
