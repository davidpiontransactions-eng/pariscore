# PARISCORE — Module Cycling Favourites (Description + Favoris cyclingstage.com)

## 📦 Contenu

Ce package contient les fichiers pour ajouter une section "Description + Favoris"
dans l'onglet CYCLISME de PARISCORE, avec scraping automatique quotidien de cyclingstage.com.

### Fichiers modifiés (à remplacer à la racine du repo)
- `pariscore.html` — ajout section `<div id="cyc-stage-favourites">` + CSS
- `pariscore.js` — ajout fonctions `_fetchAndRenderCyclingFavourites()` + `_renderCyclingStageFavourites(j)`
- `server.js` — ajout route `GET /api/v1/cycling/favourites`
- `services/cyclingService.js` — ajout méthode `getStageFavourites(stageN)`
- `Dockerfile` — (déjà modifié par Fix 2-c) copie `services/`
- `deploy-ovh.ps1` — (déjà modifié par Fix 2-d) pousse `services/`

### Nouveaux fichiers
- `scripts/scraper-cyclingstage-favourites.py` — scraper Python (dépend de python3 standard library uniquement)
- `scripts/setup-cycling-cron.sh` — script d'installation du cron quotidien
- `data/cycling/stage-favourites.json` — données scrapées (stages 1 et 2 déjà présents)

## 🚀 Installation

### 1. Copier les fichiers dans le repo local

```powershell
# Depuis Windows, après avoir téléchargé ce dossier :
cd "C:\Users\david\Documents\dev PariScore\ParisScorebis"

# Remplacer les fichiers modifiés
copy <download_dir>\pariscore.html .
copy <download_dir>\pariscore.js .
copy <download_dir>\server.js .
copy <download_dir>\Dockerfile .
copy <download_dir>\deploy-ovh.ps1 .

# Créer les nouveaux dossiers et fichiers
mkdir services 2>nul
copy <download_dir>\services\cyclingService.js services\

mkdir scripts 2>nul
copy <download_dir>\scripts\scraper-cyclingstage-favourites.py scripts\
copy <download_dir>\scripts\setup-cycling-cron.sh scripts\

mkdir data\cycling 2>nul
copy <download_dir>\data\cycling\stage-favourites.json data\cycling\
```

### 2. Commit + push

```powershell
git add -A
git commit -m "feat(cycling): add stage description + favourites from cyclingstage.com + daily cron"
git push
```

### 3. Déployer sur le VPS

```bash
# Sur le VPS Ubuntu
cd ~/pariscore
bash deploy.sh
```

### 4. Installer le cron quotidien (18:00 Europe/Paris)

```bash
# Toujours sur le VPS
bash ~/pariscore/scripts/setup-cycling-cron.sh

# Vérifier que le cron est bien installé
bash ~/pariscore/scripts/setup-cycling-cron.sh --status

# Tester le scraper manuellement (étape du jour / prochaine étape)
bash ~/pariscore/scripts/setup-cycling-cron.sh --test
```

### 5. Restart PM2 (pour prendre en compte les modifs backend)

```bash
pm2 restart pariscore
```

## ✅ Vérification

1. **API** : `curl http://localhost:3000/api/v1/cycling/favourites | python3 -m json.tool | head -20`
   → doit retourner `{"ok": true, "stage": 1, "title": "Tour de France 2026 Favourites stage 1:...", "favourites": [...8 items]...}`

2. **Frontend** : ouvre https://pariscore.fr (ou ton URL), onglet CYCLISME
   → tu dois voir la section "Description + Favoris" entre le status et les bet cards
   → 8 favoris pour stage 1 (2x *** UAE Emirates/Visma, 2x ** Red Bull/Netcompany, 4x * Lidl-Trek/Decathlon/Alpecin/EF)

3. **Cron** : `crontab -l | grep cycling`
   → doit afficher `0 18 * * * cd /home/ubuntu/pariscore && python3 .../scraper-cyclingstage-favourites.py --current --force >> .../cycling-cron.log 2>&1`

## 🔄 Maintenance

### Voir les logs du cron
```bash
tail -f ~/pariscore/logs/cycling-cron.log
```

### Forcer un re-scrape manuel
```bash
cd ~/pariscore
python3 scripts/scraper-cyclingstage-favourites.py --stage 1 --force
python3 scripts/scraper-cyclingstage-favourites.py --all --force  # toutes les étapes
```

### Supprimer le cron (après le TdF)
```bash
bash ~/pariscore/scripts/setup-cycling-cron.sh --remove
```

## 📅 Calendrier d'exécution

- **Première exécution** : vendredi 3 juillet 2026 à 18:00 (mais stage 1 déjà scrapé manuellement)
- **Exécutions suivantes** : tous les jours à 18:00 Europe/Paris
- **Dernière exécution utile** : 27 juillet 2026 (lendemain étape finale Paris)
- Le scraper utilise `--current` (étape du jour) avec fallback `--next` (prochaine étape si jour de repos)

## ⚠️ Notes légales

Le contenu scrapingé provient de cyclingstage.com (copyright © CyclingStage.com).
Usage strictement interne à PARISCORE pour affichage sur ta plateforme.
Ne pas redistribuer le contenu scrapingé publiquement sans autorisation.
