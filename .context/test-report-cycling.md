# Test Report — Cycling
**Date** : 2026-06-27

## ✅ Tests passés
- **Server syntaxe** : `node --check server.js` OK, zéro erreur
- **Navigation desktop** : lien `<a onclick="showPage('cycling',this)">` dans `.nav-links` (pariscore.html:12410)
- **Bottom nav** : lien `<a onclick="bnGo('cycling',this)">` dans `.bnav-list` (pariscore.html:12493)
- **Drawer Plus** : lien cyclisme dans le tiroir Plus (pariscore.html:12519)
- **showPage générique** : `function showPage(pageId, linkEl)` (pariscore.js:844) fait `getElementById('page-' + pageId)` → trouve `#page-cycling` automatiquement. Aucun code spécifique requis.
- **bnGo alias** : `window.bnGo` (pariscore.js:973) délègue à `showPage` → fonctionnement identique
- **`#page-cycling` HTML** (pariscore.html:22637-22666) : conteneur avec `data-page="cycling"`, style display none, tokens CSS
- **Badge "Sprint 1"** : présent sur le titre (pariscore.html:22658)
- **SVG vélo** : icône personnalisée (pariscore.html:22654-22656) — roue/pignon/cadre
- **Couleurs** : `--cyc-bg:#0a1628` (fond sombre), `--cyc-accent:#ff6b35` (orange cyclisme)
- **Placeholder texte** : "⏳ Contenu cyclisme à venir — calendrier, classements UCI, pronostics." (pariscore.html:22662-22664)
- **Footer caché** : `body[data-page="cycling"] .footer-newsletter, footer { display:none }` (pariscore.html:22642-22643)
- **7 fichiers locale** : clés `bnav.cycling`, `nav.cycling`, `nav.cycling_aria` traduites dans fr/en/de/es/it/nl/pt
- **Routes API cyclisme** : aucune route `/api/v1/cycling` dans server.js → correct pour un placeholder Sprint 1
- **Aucune config STRATEGIES/STRATEGIES_UI pour cyclisme** : correct, le module n'a pas encore de stratégies de paris

## ⚠️ Avertissements (non bloquants)
### W1 — Titre de page non défini pour cycling ✅ FIXED
- **Commit** : `38ebee2`
- **Fichier** : `pariscore.js:987` — clé `'cycling': 'Cyclisme — Courses & Résultats'` ajoutée
- **Statut** : ✅ Résolu

## ✅ Bugs détectés
*Aucun bug bloquant.*

## 💡 Recommandations d'amélioration
1. **Ajouter le setPageTitle** pour cycling : `'cycling': 'Cyclisme — Courses & Résultats' | PariScore`
2. **Architecture API** : prévoir un service cyclisme (ex: `services/cyclingService.js`) exploitant UCI API ou ProCyclingStats pour le Sprint 2
3. **STRATEGIES cyclisme** : si des pronostics sont prévus (vainqueur d'étape, classement général), prévoir l'ajout dans `STRATEGIES_UI` côté frontend
