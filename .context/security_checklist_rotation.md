# SECURITY — Checklist Rotation 8 Clés API
> Créé post-incident 20/05/2026 — bd `ParisScorebis-c8m`
> Confidentialité : INTERNE — ne pas committer sur repo public

---

## CONTEXTE

Suite à l'exfiltration de `server.js` le 20/05/2026, 8 clés/secrets ont été considérés compromis.
Ce document liste leur emplacement dans le code, leur service associé, et la procédure exacte de rotation.

**1 clé déjà rotée** : `JWT_SECRET` (openssl rand -hex 64, déployé VPS, pm2 restart).

**MAJ 21/05/2026 audit `.env` complet** : 4 clés additionnelles compromises non listées initialement (GROQ, RAPIDAPI, FOOTBALL_DATA, APIFY). Total = 12 secrets à roter.

---

## CLÉS À ROTATION — STATUT AU 21/05/2026

| Clé | Statut | Service | Priorité |
|---|---|---|---|
| `JWT_SECRET` | ROTEE | Auth interne | CRITIQUE |
| `ADMIN_PASSWORD` | EN ATTENTE | admin.html | CRITIQUE |
| `GA_POSTBACK_TOKEN` | EN ATTENTE | Gambling-Affiliation S2S | HAUTE |
| `TELEGRAM_BOT_TOKEN` | EN ATTENTE | Bot Telegram alertes | HAUTE |
| `ODDS_API_KEY` | EN ATTENTE | the-odds-api.com | HAUTE |
| `GEMINI_API_KEY` | EN ATTENTE | Google Gemini AI | HAUTE |
| `GROQ_API_KEY` | **EN ATTENTE (nouveau)** | Groq LLM | HAUTE |
| `RAPIDAPI_KEY` | **EN ATTENTE (nouveau, 5 endpoints)** | RapidAPI (Tennis + Football + Odds) | HAUTE |
| `API_FOOTBALL_KEY` | EN ATTENTE (kill-switch actif) | api-football.com Pro | MOYENNE |
| `BSD_API_KEY` | EN ATTENTE | Bzzoiro Sports Addon | MOYENNE |
| `FOOTBALL_DATA_API_KEY` | **EN ATTENTE (nouveau)** | football-data.org | MOYENNE |
| `APIFY_TOKEN` | **EN ATTENTE (nouveau)** | Apify Transfermarkt actor | MOYENNE |

---

## PROCÉDURES DE ROTATION

### 1. JWT_SECRET — FAIT
- **Emplacement code** : `server.js` ligne ~13217 — `const JWT_SECRET = process.env.JWT_SECRET || ...`
- **Risque si compromis** : forge de tokens admin valides, impersonnation de tous les utilisateurs
- **Procédure** :
  ```bash
  # Générer un nouveau secret
  openssl rand -hex 64
  # Sur VPS :
  nano /home/ubuntu/pariscore/.env
  # Modifier : JWT_SECRET=<nouveau_secret>
  pm2 restart pariscore
  ```
- **Effet** : Invalide TOUTES les sessions actives (les users devront se reconnecter)
- **Post-rotation** : Ajouter bannière UI "Reconnexion requise" dans `pariscore.html`

---

### 2. ADMIN_PASSWORD — A FAIRE EN PRIORITÉ
- **Emplacement code** : `server.js` ligne ~13407 — `process.env.ADMIN_PASSWORD || 'pariscore2026'`
- **DANGER** : Le mot de passe par défaut `pariscore2026` est visible dans le `server.js` exfiltré
- **Risque si compromis** : accès direct au dashboard admin (`/admin.html`), accès aux KPIs, tokens Telegram, données users
- **Procédure** :
  ```bash
  # Sur VPS :
  nano /home/ubuntu/pariscore/.env
  # Ajouter/modifier : ADMIN_PASSWORD=<nouveau_mot_de_passe_fort_16+chars>
  pm2 restart pariscore
  ```
- **Vérification** : Se connecter à `https://pariscore.fr/admin.html` avec le nouveau mot de passe
- **Note** : Sans `ADMIN_PASSWORD` dans `.env`, le serveur loggue une erreur SECURITY au démarrage (ajouté dans server.js)

---

### 3. GA_POSTBACK_TOKEN — A FAIRE
- **Emplacement code** : `server.js` ligne ~21486 — `process.env.GA_POSTBACK_TOKEN`
- **Route concernée** : `POST /cb/` (Gambling-Affiliation S2S postback)
- **Risque si compromis** : fraude de conversions d'affiliation (argent), attribution de commissions fictives
- **Procédure** :
  1. Se connecter au dashboard Gambling-Affiliation
  2. Générer un nouveau token S2S
  3. Sur VPS : `nano /home/ubuntu/pariscore/.env` → modifier `GA_POSTBACK_TOKEN=<nouveau_token>`
  4. Mettre à jour l'URL de postback dans le dashboard Gambling-Affiliation avec le nouveau token
  5. `pm2 restart pariscore`
- **Vérification** : Tester un postback de test depuis le dashboard affilié

---

### 4. TELEGRAM_BOT_TOKEN — A FAIRE
- **Emplacement code** : `server.js` ligne ~13418 — `process.env.TELEGRAM_BOT_TOKEN || ''`
- **Risque si compromis** : contrôle total du bot (@PariScoreBot), envoi de spam/phishing aux abonnés, lecture des messages
- **Procédure** :
  1. Ouvrir Telegram → contacter `@BotFather`
  2. Envoyer `/mybots` → sélectionner le bot PariScore
  3. Envoyer `/revoke` pour révoquer l'ancien token
  4. Copier le nouveau token généré
  5. Sur VPS : `nano /home/ubuntu/pariscore/.env` → modifier `TELEGRAM_BOT_TOKEN=<nouveau_token>`
  6. `pm2 restart pariscore`
- **Vérification** : Déclencher une alerte test depuis admin.html

---

### 5. ODDS_API_KEY — A FAIRE
- **Emplacement code** : `server.js` ligne ~59 — `const ODDS_API_KEY = process.env.ODDS_API_KEY`
- **Risque si compromis** : épuisement du quota mensuel (500 req/mois plan gratuit), coût si plan payant
- **Procédure** :
  1. Se connecter à `https://the-odds-api.com/account/`
  2. Dashboard → API Keys → Revoke / Generate New Key
  3. Sur VPS : `nano /home/ubuntu/pariscore/.env` → modifier `ODDS_API_KEY=<nouvelle_clé>`
  4. `pm2 restart pariscore`
- **Vérification** : GET `https://pariscore.fr/api/v1/status` → vérifier que `oddsApiRemaining` est > 0 et non-zéro

---

### 6. GEMINI_API_KEY — A FAIRE
- **Emplacement code** : `server.js` ligne ~72 — `const GEMINI_API_KEY = process.env.GEMINI_API_KEY`
- **Risque si compromis** : génération de contenu sur crédit Google (facturation à l'usage, potentiellement élevée)
- **Procédure** :
  1. Se connecter à `https://aistudio.google.com/`
  2. Menu → API Keys → Delete (ou revoke) l'ancienne clé
  3. Créer une nouvelle clé → Copier
  4. Sur VPS : `nano /home/ubuntu/pariscore/.env` → modifier `GEMINI_API_KEY=<nouvelle_clé>`
  5. `pm2 restart pariscore`
- **Vérification** : Cliquer "Analyse IA" sur un match dans l'interface → doit répondre sans erreur 503

---

### 7. API_FOOTBALL_KEY — A FAIRE (kill-switch actif, priorité basse)
- **Emplacement code** : `server.js` ligne ~68 — `const AF_REMOVED = true; const API_FOOTBALL_KEY = AF_REMOVED ? '' : process.env.API_FOOTBALL_KEY`
- **Note** : Kill-switch activé en v10.77 — la clé est forcée vide, aucun appel n'est émis. La rotation reste nécessaire pour quand le kill-switch sera désactivé.
- **Risque si compromis** : quota Pro $19/mois exposé (7 500 req/jour), coût si quota dépassé
- **Procédure** :
  1. Se connecter à `https://dashboard.api-sports.io/`
  2. Account → API Keys → Regenerate
  3. Sur VPS : `nano /home/ubuntu/pariscore/.env` → modifier `API_FOOTBALL_KEY=<nouvelle_clé>`
  4. (Ne pas redémarrer avant de désactiver le kill-switch `AF_REMOVED = true`)
- **Vérification** : Une fois kill-switch désactivé, GET `/api/v1/status` → vérifier appels AF

---

### 8. BSD_API_KEY — A FAIRE (en attente email vendeur)
- **Emplacement code** : `server.js` — `process.env.BSD_API_KEY` (via variable BSD_API_KEY)
- **Risque si compromis** : quota $5/mois épuisé, données sportives live indisponibles
- **Procédure** :
  1. Envoyer email à `bzzoiro@proton.me` avec sujet "API Key Rotation — Security Incident"
  2. Demander révocation de l'ancienne clé + génération d'une nouvelle
  3. Sur VPS : `nano /home/ubuntu/pariscore/.env` → modifier `BSD_API_KEY=<nouvelle_clé>`
  4. `pm2 restart pariscore`
- **Vérification** : Les matchs BSD apparaissent dans `/api/v1/matches` avec source `bsd`

---

### 9. GROQ_API_KEY — A FAIRE (nouveau, ajouté 21/05/2026)
- **Emplacement code** : `server.js` — `process.env.GROQ_API_KEY` (LLM rapide pour Power Score fallback)
- **Risque si compromis** : consommation de crédits Groq (tier gratuit limité, payant si dépassement)
- **Procédure** :
  1. Se connecter à `https://console.groq.com/keys`
  2. Revoke ancienne clé → Create New API Key
  3. Sur VPS : `nano /home/ubuntu/pariscore/.env` → modifier `GROQ_API_KEY=<nouvelle_clé>`
  4. `pm2 restart pariscore`
- **Vérification** : Power Score Groq fallback opérationnel (test analyse IA)

---

### 10. RAPIDAPI_KEY — A FAIRE (nouveau, critique — 5 endpoints)
- **Emplacement code** : `server.js` — `process.env.RAPIDAPI_KEY` + alias `MATCHSTAT_API_KEY`, `TENNISAPI1_API_KEY`, `FREE_FOOTBALL_RAPIDAPI_KEY`, `ODDSPAPI_KEY`
- **Une seule clé partagée pour 5 souscriptions RapidAPI**
- **Risque si compromis** : épuisement quota tennis-api-atp-wta-itf + tennisapi1 + odds-api1 + free-football, coût $$ si plans payants
- **Procédure** :
  1. Se connecter à `https://rapidapi.com/developer/dashboard`
  2. Settings → Security → Reset API Key
  3. Sur VPS : `nano /home/ubuntu/pariscore/.env` → modifier les 5 variables: `RAPIDAPI_KEY`, `MATCHSTAT_API_KEY`, `TENNISAPI1_API_KEY`, `FREE_FOOTBALL_RAPIDAPI_KEY`, `ODDSPAPI_KEY` (toutes identiques)
  4. `pm2 restart pariscore`
- **Vérification** : GET `/api/v1/tennis/board` → matchs ESPN+BSD apparaissent ; tester `oddsapi` source dans logs

---

### 11. FOOTBALL_DATA_API_KEY — A FAIRE (nouveau)
- **Emplacement code** : `server.js` — `process.env.FOOTBALL_DATA_API_KEY` (football-data.org standings + fixtures fallback)
- **Risque si compromis** : quota tier gratuit (10 req/min) épuisé
- **Procédure** :
  1. Se connecter à `https://www.football-data.org/client/home`
  2. Account → API Token → Regenerate
  3. Sur VPS : `nano /home/ubuntu/pariscore/.env` → modifier `FOOTBALL_DATA_API_KEY=<nouvelle_clé>`
  4. `pm2 restart pariscore`
- **Vérification** : Logs sans erreur 403 football-data.org

---

### 12. APIFY_TOKEN — A FAIRE (nouveau)
- **Emplacement code** : `server.js` — `process.env.APIFY_TOKEN` (Transfermarkt actor curious_coder)
- **Risque si compromis** : consommation crédits Apify ($15/mo actor), exécution actors non autorisés
- **Procédure** :
  1. Se connecter à `https://console.apify.com/account/integrations`
  2. Revoke ancien token → Create new token
  3. Sur VPS : `nano /home/ubuntu/pariscore/.env` → modifier `APIFY_TOKEN=<nouveau_token>`
  4. `pm2 restart pariscore`
- **Vérification** : Si Transfermarkt actor utilisé, vérifier exec sans 401

---

## PROCÉDURE GÉNÉRALE POST-ROTATION

Après chaque rotation :

```bash
# 1. Éditer .env sur VPS
ssh ubuntu@pariscore.fr
nano /home/ubuntu/pariscore/.env

# 2. Redémarrer pm2
pm2 restart pariscore

# 3. Vérifier les logs de démarrage
pm2 logs pariscore --lines 50

# 4. Tester l'endpoint de statut
curl https://pariscore.fr/api/v1/status

# 5. Vérifier qu'aucune clé n'apparaît dans les logs
pm2 logs pariscore --lines 200 | grep -i "key\|token\|secret\|password"
```

---

## HARDENING COMPLÉMENTAIRE (Actions DG/Ops)

### Firewall VPS (urgent)
```bash
sudo ufw deny from 37.65.65.25 to any   # Attaquant principal
sudo ufw deny from 78.153.140.0/24 to any  # Scanner secondaire
sudo ufw reload
sudo ufw status numbered
```

### nginx ACL (double protection)
Ajouter dans la config nginx (`/etc/nginx/sites-available/pariscore`):
```nginx
# Bloquer accès direct aux fichiers sensibles (double protection avec Node.js)
location ~* \.(env|js|json|db|wal|shm|md|yaml|yml|lock)$ {
    deny all;
    return 403;
}
location ~ /\.(git|beads|context|claude|planning) {
    deny all;
    return 403;
}
```

### Déplacer .env hors web root (long terme)
```bash
# Déplacer .env vers /etc/pariscore/
sudo mkdir -p /etc/pariscore
sudo mv /home/ubuntu/pariscore/.env /etc/pariscore/secrets.env
sudo chmod 600 /etc/pariscore/secrets.env
# Modifier server.js : loadEnv() → utiliser le chemin absolu /etc/pariscore/secrets.env
```

---

## SUIVI ROTATION

| Date | Clé | Qui | Confirmé |
|---|---|---|---|
| ~21/05/2026 | JWT_SECRET | DG | Oui (pm2 restart confirmé) |
| 21/05/2026 20:10 UTC | ADMIN_PASSWORD | DG | Oui (.env + pm2 restart, prod HTTP 200) |
| 21/05/2026 20:10 UTC | GA_POSTBACK_TOKEN | DG | Oui |
| 21/05/2026 20:10 UTC | TELEGRAM_BOT_TOKEN | DG | Oui |
| 21/05/2026 20:10 UTC | ODDS_API_KEY | DG | Oui |
| 21/05/2026 20:10 UTC | GEMINI_API_KEY | DG | Oui |
| 21/05/2026 20:10 UTC | GROQ_API_KEY | DG | Oui |
| 21/05/2026 20:10 UTC | RAPIDAPI_KEY (×5 alias) | DG | Oui |
| 21/05/2026 20:10 UTC | API_FOOTBALL_KEY | DG | Oui (kill-switch toujours actif) |
| 21/05/2026 20:10 UTC | BSD_API_KEY | DG + bzzoiro | Oui (bsd_connected=true vérifié) |
| 21/05/2026 20:10 UTC | FOOTBALL_DATA_API_KEY | DG | Oui |
| 21/05/2026 20:10 UTC | APIFY_TOKEN | DG | Oui |

**TOUTES CLÉS ROTÉES 21/05/2026 20:10 UTC** — vérification prod : `/api/v1/status` HTTP 200, `/server.js` HTTP 403, uptime pm2 ~14min (restart confirmé), `bsd_connected:true`.

---

*Document créé le 21/05/2026 — bd `ParisScorebis-c8m`*
*Conservation : 7 ans minimum (preuves légales — incident 20/05/2026)*
*Mettre à jour le tableau "Suivi Rotation" au fil des rotations.*
