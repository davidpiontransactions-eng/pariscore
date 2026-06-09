# PariScore — Alertes Tennis Elo + DR (Discord & Telegram)

## Fichier à déployer

`server.js` → `/home/ubuntu/pariscore/server.js`

## Configuration .env

```bash
# Discord (obligatoire pour alertes Discord)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/ID/TOKEN

# Telegram (optionnel — déjà supporté)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF
TELEGRAM_CHAT_IDS=-100123456789
```

## Commandes PM2

```bash
# Redémarrer après déploiement
pm2 restart server --update-env

# Voir l'état
pm2 status

# Logs en direct (filtré tennis)
pm2 logs server | grep -iE "tennis.*alert|Elo|DR Alert"

# Logs des 50 dernières lignes
pm2 logs server --lines 50 --nostream
```

## Vérification statut API

```bash
# Statut complet
curl -s http://localhost:3000/api/v1/status | python3 -m json.tool

# Vérifier Discord actif
curl -s http://localhost:3000/api/v1/status | python3 -m json.tool | grep -E "discord|elo|telegram"
```

Sortie attendue :
```
    "telegramChats": 0,
    "discordWebhook": true,
    "tennisEloPlayers": 1564
```

## Fonctionnement

| Alerte | Fréquence | Seuil | Canal |
|---|---|---|---|
| **Prematch Elo** | Toutes les 10 min | `\|Elo P1 - Elo P2\| >= 100` | Discord + Telegram |
| **Live DR Set** | Toutes les 30s | `\|DR Set\| >= 0.20` | Discord + Telegram |
| **Live DR Match** | Toutes les 30s | `\|DR Match\| >= 0.20` | Discord + Telegram |

Cooldown : 6h (prematch), 5min (live) par match — pas de spam.

## Dépannage

```bash
# Si le port 3000 est occupé
fuser -k 3000/tcp && pm2 restart server

# Si PM2 ne recharge pas le .env
pm2 restart server --update-env

# Vérifier que le code est à jour
grep -c "sendDiscordAlert\|DISCORD_WEBHOOK_URL" /home/ubuntu/pariscore/server.js
# Doit afficher : 7
```
