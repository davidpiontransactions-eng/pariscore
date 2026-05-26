# Test Report — YouTube Highlights Tennis Drawer
**Date** : 2026-05-26

## ✅ Tests passés

- **Unit tests `_getYouTubeEmbedUrl` (9/9)** : `watch?v=` · `youtu.be/` · `embed/` → conversion correcte ; `null` / `undefined` / `''` / URL non-YouTube / ID trop court / string aléatoire → `null`
- **Injection iframe dans drawer** : `youtube_url` présent → `<iframe class="tn-yt-iframe">` rendu avec `src=https://www.youtube.com/embed/{ID}`
- **Fallback null** : match sans `youtube_url` → section `📺 Highlights` absente du DOM (container `.tn-yt-container` inexistant) — PASS
- **No autoplay** : `iframe.src` ne contient pas `autoplay` — PASS
- **Lazy loading** : `loading="lazy"` présent sur l'iframe
- **Responsive 16:9** : `.tn-yt-container` padding-top 56.25% + `.tn-yt-iframe` absolue fill — render visuel full-width confirmé screenshot
- **Design system** : fond `var(--bg)`, `border-radius:8px`, `box-shadow 0 4px 24px rgba(0,0,0,0.45)` alignés tokens PariScore
- **Syntaxe server.js** : `node --check server.js` → OK
- **Render visuel** : thumbnail YouTube + bouton play visibles dans drawer tennis (screenshot confirmé)

## ⚠️ Avertissements (non bloquants)

### W1 — Service Worker cache pré-edit
**Localisation** : PWA SW localhost:3000  
**Problème** : Après édition de `pariscore.html`, le Service Worker servait l'ancienne version du script en mémoire. `window._getYouTubeEmbedUrl` était `undefined` dans la session browser existante.  
**Fix immédiat** : Unregister SW + clear caches + `location.reload(true)`. Après rechargement, les deux fonctions étaient disponibles globalement.  
**Recommandation** : Après chaque deploy VPS, forcer une révision du SW (`CACHE_VERSION` bump dans le service worker) pour invalider le cache client automatiquement. Ou ajouter un hash de version dans le nom du cache SW.

### W2 — Vidéo de test Coco Gauff bloquée en France
**Localisation** : URL `https://www.youtube.com/watch?v=16Z0p1RYPQU`  
**Problème** : Vidéo geo-bloquée FR — message "Vidéo non disponible". Pas un bug code ; comportement YouTube normal.  
**Recommandation** : Pour les matchs VPS (hébergé FR), choisir des URLs de highlights non-géorestreintes, ou ajouter un `?origin=` param pour les cas embed avec restriction. Pas bloquant pour le module.

## ❌ Bugs détectés

Aucun. Tous les comportements attendus validés.

## 💡 Recommandations d'amélioration

1. **Bump CACHE_VERSION SW post-deploy** : Ajouter une variable `const CACHE_VERSION = 'v12.67'` dans le service worker et la modifier à chaque deploy pour invalider le cache client sans friction.
2. **Enrichissement backend `youtube_url`** : Ajouter le champ `youtube_url` dans `buildTennisMatchRecord()` côté `server.js` (source : enrichissement manuel via bd issue, ou scraping YouTube Data API). Le frontend consomme automatiquement dès que le champ est présent.
3. **Graceful `onerror` iframe** : Optionnel — ajouter `onerror` JS sur l'iframe pour masquer le container si YouTube retourne une erreur d'embed (geo-block, vidéo supprimée). Low priority.
