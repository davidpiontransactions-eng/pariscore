# Rapport d'intégration : Cotes MMA 1xBet

**Date :** 20 juin 2026
**Auteur :** Équipe ingénierie PariScore
**Contexte :** Scraping des cotes MMA/UFC depuis 1xBet.rs (VPN Serbie) pour alimenter le frontend MMA de PariScore.

---

## 1. Architecture

```
[1xBet.rs]  ← scrape (VPN Serbie obligatoire)
     ↓
[tools/scrape_1xbet_mma.py]  →  SQLite local (cache 5 min)  +  JSON
     ↓
[tools/push-odds-1xbet.ps1]  →  SCP vers VPS OVH
     ↓
[/home/ubuntu/pariscore/data/odds_1xbet_mma.json]  (stockage fichier)
     ↓
[services/mmaService.js::getOdds1xBet()]  →  cache serveur 5 min
     ↓
[server.js::GET /api/v1/mma/odds-1xbet]  →  réponse JSON
     ↓
[Frontend MMA]  →  display cotes 1xBet
```

### 1.1 Composants

| Composant | Fichier | Langage | Rôle |
|---|---|---|---|
| Scraper | `tools/scrape_1xbet_mma.py` | Python 3 | Récupère les cotes via 1xBet.rs API interne |
| Script push | `tools/push-odds-1xbet.ps1` | PowerShell | Orchestre scrape + SCP vers VPS |
| Service | `services/mmaService.js` | Node.js | Lit le JSON, cache 5 min, expose en méthode |
| Route | `server.js:21489` | Node.js | `GET /api/v1/mma/odds-1xbet` |

### 1.2 Flux de données

1. **Scrape** : Le scraper Python interroge l'API interne de 1xBet.rs (nécessite une IP serbe via VPN)
2. **Stockage local** : Les résultats sont écrits dans `pariscore.db` (table `odds_1xbet_mma`) ET dans `data/odds_1xbet_mma.json`
3. **Push** : Le script PowerShell SCP le fichier JSON vers le VPS OVH (`/home/ubuntu/pariscore/data/odds_1xbet_mma.json`)
4. **Service** : À chaque requête API, `getOdds1xBet()` lit le fichier JSON sur le VPS et le sert avec un cache de 5 minutes

---

## 2. Dépendances critiques

### 2.1 VPN Serbie (prérequis absolu)

Le scraper **ne fonctionne pas** sans une IP serbe. 1xBet.rs geobloque tout accès hors Serbie.

**IP VPN actuelle :** `146.70.111.153`  
**Fournisseur :** VPN Serbie (configuration locale sur le poste Windows)

**Vérification :**
```powershell
curl -s https://api.ipify.org
# Doit retourner une IP serbe (préfixe 146.70.xxx.xxx)
```

### 2.2 Clé SSH

La connexion au VPS utilise l'alias `pariscore` défini dans `~/.ssh/config` :

```
Host pariscore
    HostName 51.75.21.239
    User ubuntu
    IdentityFile ~/.ssh/pariscore
```

**Test SSH :**
```powershell
ssh -o BatchMode=yes pariscore "hostname"
# Doit retourner le hostname du VPS OVH
```

### 2.3 Automatisation Windows (Task Scheduler)

**Nom de la tâche :** `Push1xBetMMA`  
**Déclencheur :** Tous les samedis à 10:00  
**Commande :**
```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\david\Documents\dev PariScore\ParisScorebis\tools\push-odds-1xbet.ps1" -Force
```

**Prochaine exécution :** 27/06/2026 10:00

> **Note :** La tâche est configurée en mode interactif (`Interactive uniquement`). Elle nécessite donc une session ouverte sur le poste Windows. C'est volontaire car le VPN Serbie doit être actif, ce qui implique une session utilisateur connectée.

---

## 3. Route API

### `GET https://pariscore.fr/api/v1/mma/odds-1xbet`

**Headers :**
```json
{
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "max-age=300"
}
```

**Réponse (200) :**
```json
{
  "ok": true,
  "scraped_at": "2026-06-20T17:29:35Z",
  "sport": "UFC",
  "source": "1xBet.rs (via VPN Serbie)",
  "fights_count": 47,
  "fights": [
    {
      "game_id": 730411064,
      "event_name": "UFC Fight Night. 21.06.26",
      "league_id": 3015965,
      "fighter1": "Shane Collins",
      "fighter2": "Otari Tanzilovi",
      "odds_f1": 1.48,
      "odds_f2": 2.571,
      "start_time": 1781989200
    }
  ]
}
```

**Erreur (500) :**
```json
{
  "ok": false,
  "error": "1xBet odds fetch failed"
}
```

**Test :**
```bash
curl -s https://pariscore.fr/api/v1/mma/odds-1xbet | python3 -m json.tool | head -20
```

---

## 4. Caches

Deux niveaux de cache protègent contre les appels redondants :

| Niveau | Emplacement | Durée | Déclencheur d'invalidation |
|---|---|---|---|
| Scraper (SQLite) | `pariscore.db` | 5 min | Passage du flag `--force` |
| Serveur (mémoire) | `mmaService.js` | 5 min | Redémarrage du serveur ou attente |

**Conséquence :** Les cotes affichées sur le frontend ont au maximum 10 minutes de retard (5 min de cache scrape + 5 min de cache serveur), sans compter le scraping lui-même (~15s).

---

## 5. Runbook — Procédures d'urgence

### 5.1 Le JSON est manquant ou vide sur le VPS

```powershell
# 1. Vérifier l'état du fichier
ssh -o BatchMode=yes pariscore "ls -la /home/ubuntu/pariscore/data/odds_1xbet_mma.json"

# 2. Lancer le push manuellement (depuis le projet)
cd "C:\Users\david\Documents\dev PariScore\ParisScorebis"
.\tools\push-odds-1xbet.ps1 -Force
```

### 5.2 La route API retourne 500

```powershell
# 1. Vérifier que le fichier JSON existe et est valide
ssh -o BatchMode=yes pariscore "cat /home/ubuntu/pariscore/data/odds_1xbet_mma.json | python3 -m json.tool > /dev/null && echo VALIDE || echo INVALIDE"

# 2. Redémarrer le serveur
ssh -o BatchMode=yes pariscore "pm2 restart pariscore"

# 3. Tester
curl -s https://pariscore.fr/api/v1/mma/odds-1xbet | head -c 200
```

### 5.3 Le VPN Serbie n'est pas actif

```powershell
# 1. Vérifier l'IP publique
Invoke-RestMethod https://api.ipify.org

# 2. L'IP doit commencer par 146.70.xxx.xxx
#    Si ce n'est pas le cas, activer le VPN Serbie manuellement
```

### 5.4 La connexion SSH échoue

```powershell
# 1. Vérifier la config SSH
Get-Content "$env:USERPROFILE\.ssh\config" | Select-String -Pattern "Host pariscore" -Context 0,4

# 2. Tester la connexion
ssh -v -o BatchMode=yes pariscore "hostname" 2>&1
```

### 5.5 La tâche planifiée ne s'est pas exécutée

```powershell
# 1. Vérifier l'état
schtasks /query /tn "Push1xBetMMA" /fo LIST /v

# 2. Forcer l'exécution
schtasks /run /tn "Push1xBetMMA"

# 3. Voir le résultat
schtasks /query /tn "Push1xBetMMA" /fo LIST /v | Select-String "Dernier résultat"
```

---

## 6. Limitations et risques connus

| Risque | Impact | Mitigation |
|---|---|---|
| VPN Serbie down | Scrape impossible → cotes figées | Alerte manuelle via le check IP ; prévoir notification automatique |
| Changement API 1xBet | Scraper cassé | Log d'erreur détaillé dans le scraper ; conception modulaire du parseur |
| Surcharge API 1xBet (rate limit) | Scrape partiel ou vide | Cache 5 min côté scraper ; retry automatique (3 tentatives) |
| Disque VPS plein | Écriture JSON impossible | Monitoring disque standard OVH |
| Clé SSH expirée/rotation | Push impossible | Fichier de clé séparé dans `~/.ssh/pariscore` (pas lié au compte GitHub) |
| Poste Windows en veille le samedi | Tâche planifiée non exécutée | Paramétrer "Réveiller l'ordinateur pour exécuter cette tâche" si pertinent |

---

## 7. Améliorations suggérées

1. **Vérification IP automatique** dans le script push : si l'IP n'est pas serbe, le script échoue proprement avec un message explicite.
2. **Notification d'échec** : envoi d'un message Telegram/Discord si le push échoue.
3. **Dashboard de monitoring** : afficher `scraped_at` sur le frontend MMA pour que les utilisateurs voient la fraîcheur des données.
4. **Snapshot Git** du fichier JSON après chaque push (optionnel, traçabilité).
5. **Mode secours** : si le fichier JSON est introuvable, la route retourne une erreur 503 (plutôt que 500).

---

## 8. Déploiement

### Modification des fichiers serveur

Les fichiers impactés sont :
- `server.js` (route API, ligne 21489)
- `services/mmaService.js` (méthode `getOdds1xBet()`, ligne 907)

**Déploiement :**
```powershell
# Copier les fichiers
scp -o BatchMode=yes server.js pariscore:/home/ubuntu/pariscore/server.js
scp -o BatchMode=yes services/mmaService.js pariscore:/home/ubuntu/pariscore/services/mmaService.js

# Redémarrer
ssh -o BatchMode=yes pariscore "pm2 restart pariscore"
```

> **Note :** Le push du JSON (script PowerShell) ne nécessite PAS de redémarrage PM2 car le fichier est lu à chaque requête (avec cache 5 min).

### Retour arrière

```powershell
# Restaurer l'ancienne version depuis git
git checkout HEAD~1 -- server.js services/mmaService.js
scp -o BatchMode=yes server.js pariscore:/home/ubuntu/pariscore/server.js
scp -o BatchMode=yes services/mmaService.js pariscore:/home/ubuntu/pariscore/services/mmaService.js
ssh -o BatchMode=yes pariscore "pm2 restart pariscore"
```

---

## Annexe A : Structure du fichier JSON

Les données sont stockées dans `/home/ubuntu/pariscore/data/odds_1xbet_mma.json`.

**Format :**
```json
{
  "scraped_at": "2026-06-20T17:29:35.556416+00:00",
  "sport": "UFC",
  "source": "1xBet.rs (via VPN Serbie)",
  "fights_count": 47,
  "fights": [
    {
      "game_id": 730411064,
      "event_name": "UFC Fight Night. 21.06.26",
      "league_id": 3015965,
      "fighter1": "Nom Fighter A",
      "fighter2": "Nom Fighter B",
      "odds_f1": 1.48,
      "odds_f2": 2.571,
      "start_time": 1781989200
    }
  ]
}
```

- `odds_f1` / `odds_f2` : cotes décimales (ex: 1.48, 2.571, 11.700)
- `start_time` : timestamp UNIX de début d'event

## Annexe B : Scripts utiles

```powershell
# Lancer un push manuel (ignore le cache)
cd "C:\Users\david\Documents\dev PariScore\ParisScorebis"
.\tools\push-odds-1xbet.ps1 -Force

# Test Dry-Run (ne copie pas)
.\tools\push-odds-1xbet.ps1 -DryRun

# Voir la tâche planifiée
schtasks /query /tn "Push1xBetMMA" /fo LIST /v

# Forcer l'exécution de la tâche (même en dehors du samedi)
schtasks /run /tn "Push1xBetMMA"
```
