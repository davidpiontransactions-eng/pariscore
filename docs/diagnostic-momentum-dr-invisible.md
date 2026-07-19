# Diagnostic : MomentumDR invisible après déploiement

## Constat

Après déploiement du commit `f888b7b`, le frontend visible sur `https://pariscore.fr/` **n'affiche aucune modification** — ni le nouveau composant MomentumDR, ni la sparkline, ni les tooltips, ni les animations.

## Architecture VPS — Root Cause

### 2 serveurs, 1 seul visible

| Serveur | PM2 | Port | Technologie | Frontend |
|---------|-----|------|-------------|----------|
| **Legacy** | `pariscore` | **3000** | server.js (Node ES5) | `pariscore.html` (vanilla JS) |
| **Next.js** | `pariscore-next` | 3005 | Next.js 16 + React 19 | `src/app/page.tsx` (SetPoint) |

### Nginx : tout le trafic `/` → Legacy

Nginx `location /` proxy_pass vers **localhost:3000** (legacy). Notre nouveau composant React est dans l'app Next.js sur le **port 3005**, inaccessible depuis le domaine public.

Les API Next.js marchent (`/api/tennis/` → 3005) mais pas le frontend.

### Build stale

`pariscore-next` tourne depuis 3 jours sans rebuild. Nos `.tsx` n'ont pas été compilés.

## Fix

1. **Rebuild** Next.js (`npm run build`)
2. **Nginx** : ajouter `location /prematch/ { proxy_pass http://localhost:3005; }`
3. **Restart** pariscore-next
4. **Tester** : `curl https://pariscore.fr/prematch | grep Momentum`
