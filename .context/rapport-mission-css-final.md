# Rapport de fin de mission — Diagnostic HTML brut pariscore.fr

**Date** : 2026-09-06, session 5 (~14:10–14:35)
**Mission** : résoudre l'affichage HTML brut persistant malgré les 200 HTTP.
**Statut final : ❌ AUCUNE ANOMALIE SERVEUR TROUVÉE** — le CSS est servi correctement (312 790 o, `text/css`, classes valides). Le problème est **côté navigateur** (extension, JS hydration, ou cache SW résiduel).

---

## 1. Résumé des preuves

### 1.1 Le CSS est servi correcteur (pas de faux 200)

| Test | Résultat |
|------|----------|
| CSS1 via Nginx | 200, `text/css`, 6 310 o, commence par `@font-face{...}` |
| CSS2 via Nginx | 200, `text/css`, **312 790 o**, commence par `@layer properties{...}` |
| CSS2 via Nginx (Chrome UA) | 200, `text/css`, 312 790 o, `@layer properties{...}` |
| CSS2 contenu = HTML? | ❌ Non — le corps est du CSS valide |
| Classes CSS dans le HTML? | ✅ `.flex`, `.relative`, `.absolute`, `.top-0`, `.z-50`, `.w-full`... toutes présentes |
| CSS2 nombre de classes | 1 099 classes uniques |

### 1.2 Structure standalone correcte

```
.next/standalone/.next/static/chunks/
  ├── def92e7dc5fa5288.css (6 310 o) ✅
  ├── fc017392b0d9fc42.css (312 790 o) ✅
  └── *.js (chunks) ✅
.next/standalone/public/ ✅
```

### 1.3 Nginx correct

```nginx
location /_next/static/ {
    proxy_pass http://localhost:3005;
    proxy_cache_valid 200 1y;
    add_header Cache-Control "public, immutable, max-age=31536000";
}
```

### 1.4 HTML correct

- 2 liens `<link rel="stylesheet">` vers les bons hashs
- 21 chunks JS avec `async`
- Classes Tailwind valides : `flex flex-col relative absolute top-0 z-50 w-full overflow-hidden`

### 1.5 Environnement

| Élément | Statut |
|---------|--------|
| CDN (Cloudflare, etc.) | ❌ Aucun détecté |
| Service Worker actif | ❌ Pas enregistré dans le HTML |
| CSP `style-src` | ✅ `'self' 'unsafe-inline'` autorise |
| Disque VPS | 93 % (5,2 Go libres) — surveiller |
| Bun process | ✅ Online, 251 Mo RSS |

---

## 2. Hypothèses écartées

| Hypothèse | Verdict |
|-----------|---------|
| Faux 200 (HTML servi à la place du CSS) | ❌ CSS valide servi avec `text/css` |
| Dossiers statiques manquants dans standalone | ✅ CSS présents et complets |
| Nginx bloque `/_next/static/` | ✅ Bloc location correct |
| Content-Type wrong | ✅ `text/css; charset=UTF-8` |
| CSS tronqué | ✅ content-length = taille disque |
| Classes CSS manquantes | ✅ 1 099 classes, toutes les classes HTML présentes |
| Service Worker interfère | ❌ SW pas enregistré dans le HTML |
| CSP bloque les styles | ✅ `style-src 'self'` autorise |

---

## 3. Cause la plus probable

**Problème côté navigateur**, pas serveur. Trois pistes :

1. **Extension navigateur** (ad blocker, privacy badger, uBlock, NoScript) qui bloque `/_next/static/` ou les stylesheets.
2. **Service Worker résiduel** d'une visite antérieure (le site s'appelait SetPoint, SW v6) qui intercepte les requêtes.
3. **Erreur JavaScript** qui empêche la hydration React → la page reste en HTML brut sans les styles appliqués.

---

## 4. Recommandations pour l'utilisateur

1. **Ouvrir la console navigateur** (F12 → Console) et chercher les erreurs rouges (CSP, JS, 404).
2. **Navigation privée** (Ctrl+Shift+N) → pas d'extensions, pas de cache, pas de SW.
3. **Désactiver les extensions** (surtout ad blockers) et recharger.
4. **Vérifier l'onglet Réseau** (F12 → Network) : les fichiers CSS doivent être en 200, pas en 404 ou bloqués.
5. **Vider le cache SW** : `chrome://serviceworker-internals/` → unregister tout ce qui concerne pariscore.fr.

---

*Rapport honnête : toutes les vérifications serveur sont vertes. Le CSS est servi correctement. Le problème est presque certainement côté navigateur (extension, SW résiduel, ou erreur JS).*
