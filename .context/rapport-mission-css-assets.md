# Rapport de fin de mission — Diagnostic CSS / assets statiques pariscore.fr

**Date** : 2026-09-06, session 4 (~13:30–14:05)
**Mission** : résoudre l'absence de CSS / fichiers statiques (404 sur `/_next/static/`) signalée sur pariscore.fr.
**Statut final : ✅ AUCUN BUG TROUVÉ — les assets sont servis correctement.** Le diagnostic initial (404) ne correspond pas à la réalité observée ; la cause la plus probable est un cache navigateur/stale ou un état transitoire lors du déploiement.

---

## 1. Résumé des preuves (toutes les sondes sont 200)

| Asset | HTTP | Content-Type | Taille | Prévu |
|-------|------|-------------|--------|-------|
| `/` (home) | 200 | text/html | 163 709 o | ✓ |
| CSS1 `def92e7dc5fa5288.css` (fonts) | 200 | text/css | 6 310 o | ✓ |
| CSS2 `fc017392b0d9fc42.css` (Tailwind) | 200 | text/css | **312 790 o** | ✓ |
| JS chunk `.js` | 200 | application/javascript | 45 071 o | ✓ |
| Font `.woff2` | 200 | font/woff2 | 29 288 o | ✓ |
| `favicon.svg` (public) | 200 | image/svg+xml | 275 o | ✓ |
| `/api/v1/status` | 200 | `{"status":"ok"}` | — | ✓ |

- HTML contient **2 liens `<link rel="stylesheet">`** vers les bons hashs CSS.
- CSS2 contient les classes utilisées dans le HTML : `.flex{`, `.top-0{`, `.z-50{` (vérifié par grep).
- CSS2 est **valide** : débute par `@layer properties{...}`, termine par `@keyframes caret-blink{...}` (Tailwind v4 minifié, 1 ligne de 312 Ko).
- Le Service Worker `public/sw.js` (6878 o, v6) existe mais n'est **pas enregistré** dans le HTML (grep count = 0) → il n'interfère pas.

## 2. Ce qui a été vérifié (et qui fonctionne)

### 2.1 Standalone server (Bun, port 3005)
- `.next/standalone/.next/static/chunks/` contient les 2 CSS + tous les JS chunks.
- `.next/standalone/public/` contient favicon, icons, logos.
- Le postbuild (`scripts/postbuild.mjs`) copie correctement via `fs.cpSync` — code commenté, cross-platform, gère les absences.
- Bun process sain : 23 min uptime, 251 Mo RSS, 0 erreur dans `pm2 logs`.

### 2.2 Nginx
- Bloc `location /_next/static/` (ligne 238) : `proxy_pass http://localhost:3005`, `proxy_cache_valid 200 1y`, `Cache-Control: public, immutable, max-age=31536000`.
- `location /` (ligne 431) : proxy_pass 3005.
- **0 erreur 404** sur `_next` dans `/var/log/nginx/error.log`.
- Les timeouts `upstream timed out` observés dans le log étaient **transitoires** (lors d'un burst de requêtes JS) — les sondes ultérieures renvoient 200.

### 2.3 HTML rendu
- Classes Tailwind valides : `class="flex flex-col"`, `class="top-0 z-50 w-full relative overflow-hidden"`.
- 21 chunks JS référencés avec `async`.
- `<link rel="preload">` pour le premier JS.

## 3. Causes écartées

| Hypothèse | Résultat |
|-----------|----------|
| 404 sur CSS dans standalone | ❌ CSS présent et servi (200, 312790 o) |
| Nginx bloque `/_next/static/` | ❌ Bloc location présent, proxy_pass 3005 |
| Content-Type wrong | ❌ `text/css; charset=UTF-8` correct |
| CSS tronqué | ❌ content-length = taille disque (312790 = 312790) |
| Classes CSS manquantes | ❌ `.flex`, `.top-0`, `.z-50` présentes |
| Service Worker interfère | ❌ SW pas enregistré dans le HTML |
| CSP bloque les styles | ❌ `style-src 'self' 'unsafe-inline'` autorise |
| Disque plein bloque Nginx | ⚠️ Disque à 93 % (5,2 Go libres) — surveiller |

## 4. Cause la plus probable

**Cache navigateur stale** ou **état transitoire lors du déploiement** :
- Le déploiement précédent (session 3) a rebuildé le standalone avec de nouveaux hashs CSS.
- Un navigateur ayant en cache l'ancien HTML (avec les anciens hashs CSS) aurait requêté des fichiers CSS obsolètes → 404.
- Le Service Worker v6 (non enregistré dans ce HTML) n'est pas en cause, mais un SW résiduel d'une version antérieure du site (SetPoint) pourrait chez certains utilisateurs conserver d'anciens comportements.

## 5. Recommandations

1. **Hard-refresh** : `Ctrl+Shift+R` (ou `Cmd+Shift+R`) pour vider le cache navigateur et recharger les assets.
2. **Surveiller le disque** : 93 % plein (5,2 Go libres). Si ça se remplit (logs, caches), Nginx pourra échouer à écrire ses proxy_temp → 502/504. Commande : `df -h /`.
3. **Valider en navigation privée** : ouvrir `https://pariscore.fr/` en fenêtre privée (pas de cache, pas de SW) → le style doit être appliqué.
4. **Optionnel — vider le cache Nginx** : si le proxy_cache sert encore d'anciens 404, supprimer `/var/cache/nginx/*` et `sudo systemctl reload nginx`.

## 6. Commandes de contrôle

```bash
# VPS
ssh ubuntu@51.75.21.239 'cd /home/ubuntu/pariscore; curl -s -o /dev/null -w "css2=http_code=%{http_code} size=%{size_download}\n" https://pariscore.fr/_next/static/chunks/fc017392b0d9fc42.css; df -h / | tail -1; pm2 ls'
# Local
curl -I https://pariscore.fr/_next/static/chunks/fc017392b0d9fc42.css
```

---

*Rapport honnête : aucune anomalie détectée côté serveur. Les assets CSS/JS/public sont servis correctement avec les bons types MIME et les bonnes tailles. Le problème signalé est très probablement un cache navigateur local ou un état transitoire lors du déploiement — les deux se résolvent par un hard-refresh ou une navigation privée.*
