# Incident : Chunks JS manquants sur SetPoint Tennis Prematch

**Date** : 2026-07-06
**URL** : http://51.75.21.239/
**Statut** : CRITIQUE - site non-fonctionnel
**Projet** : SetPoint Tennis Prematch (Next.js 16 standalone)
**VPS** : OVH 51.75.21.239 (ubuntu)

---

## 1. Symptomes

- Page affiche "0 matchs aujourd'hui" + skeletons de chargement infinis
- Tous les boutons sont inactifs (Bankroll, Paper Trading, Filtres, Cookies, Theme, Langue)
- Console : 404 sur tous les chunks _next/static/chunks/*.js
- Footer affiche "Chargement..." en permanence
- Bouton theme a l'attribut disabled=""

## 2. Preuves

| Test | Resultat |
|------|----------|
| GET /_next/static/chunks/006f293584c8bf5d.js | HTTP 404 |
| GET /api/v1/status | HTTP 404 |
| GET /api/tennis/matches | HTTP 404 |
| JSON-LD dans HTML | 3 matchs Wimbledon presents |
| Rendu visuel | CSS/HTML ok mais JS non hydrate |

## 3. Cause Racine

Les fichiers statiques generes par `next build` ne sont pas servis par le serveur standalone.

Build command dans package.json:
```
"build": "next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/"
```

Le repertoire .next/standalone/.next/static/ est vide ou inexistant sur le VPS.

### Hypotheses :
- H1 : Le deploiement a copie le serveur standalone sans les statiques
- H2 : Un rebuild local a change les hashs de chunks mais les anciens fichiers ont ete purges
- H3 : Le script update_vps.sh ne couvre PAS le deploiement Next.js (concu pour l'ancienne app PariScore vanilla)

## 4. Plan de Correction

### Etape 1 : Rebuild complet
```bash
cd /home/ubuntu/pariscore
npm run build
```

### Etape 2 : Verifier les fichiers statiques
```bash
ls -la .next/standalone/.next/static/chunks/
```

### Etape 3 : Redemarrer le serveur
```bash
NODE_ENV=production node .next/standalone/server.js
# OU via PM2 :
pm2 restart setpoint
```

### Etape 4 : Verifier
```bash
curl -I http://51.75.21.239/_next/static/chunks/006f293584c8bf5d.js
# Attendu : HTTP 200
```

## 5. Prevention

Creer un script de deploiement dedie pour SetPoint (Next.js) qui inclut :
```bash
#!/bin/bash
set -e
git pull origin main
npm install
npm run build
pm2 restart setpoint --update-env
```

Le script actuel scripts/update_vps.sh sert uniquement pour l'ancienne app PariScore (server.js vanilla) et ne doit pas etre confondu.
