# Rapport — Tennis Abstract `/wp-includes/interactivity-api/` (2026-05-21)

> **Investigation** : URL `https://www.tennisabstract.com/blog/wp-includes/interactivity-api/`
> **Demandeur** : DG · **Auteur** : Research Agent · **Statut** : CLOS

---

## TL;DR — VERDICT

**SKIP.** L'URL n'expose **PAS** de données tennis. Il s'agit du **listing Apache d'un répertoire WordPress core standard** (`wp-includes/interactivity-api/`, module WP depuis 6.5). Les 3 fichiers visibles sont des classes PHP du framework de réactivité frontend WordPress, sans aucune valeur data pour PariScore. Aucune incorporation possible/utile.

---

## 1. Ce que sert réellement l'URL

**HTTP 200** — Apache/2.4.58 (Ubuntu) — Directory indexing **activé** (misconfig OPS côté Tennis Abstract, pas notre problème).

### Fichiers exposés (3 fichiers PHP WordPress core)

| Fichier | Taille | Date | Nature |
|---|---|---|---|
| `class-wp-interactivity-api-directives-processor.php` | 7.6K | 2025-12-03 | Classe WP core — parseur de directives HTML |
| `class-wp-interactivity-api.php` | 49K | 2026-05-21 | Classe WP core — runtime API Interactivity |
| `interactivity-api.php` | 4.9K | 2024-11-13 | Bootstrap WP core du module |

**Ce sont des fichiers PHP framework standard WordPress 6.5+** (introduits pour piloter les blocs Gutenberg réactifs côté front). Aucun contenu tennis, aucun JSON, aucun endpoint REST métier.

### Contexte parent (`/wp-includes/`)

Le répertoire parent expose toute l'arborescence WP standard (`blocks/`, `rest-api/`, `class-wpdb.php`, `pluggable.php`, etc.) + 2-3 ajouts custom (`ai-client/`, `collaboration/`) qui ressemblent à des plugins maison Jeff Sackmann mais ne sont pas pertinents pour notre stack.

---

## 2. Nature : API data ou misconfig sécurité ?

**Réponse : misconfig sécurité côté Tennis Abstract** (`Options +Indexes` non désactivé dans Apache). Ce n'est **PAS** une API de données.

- L'API d'Interactivité WordPress est un **framework JS/PHP côté serveur** (équivalent ~Alpine.js intégré à Gutenberg) pour rendre les blocs WP réactifs sans React/Vue côté thème.
- Aucun endpoint JSON tennis exposé via ce chemin. Les vraies données tennis de Sackmann sont sur :
  - GitHub `JeffSackmann/tennis_atp` + `tennis_wta` (CSV) — **déjà ingéré dans `server.js:15445`**
  - tennisabstract.com pages HTML statiques (ATP/WTA player pages, head-to-head)
  - Blog WP : articles narratifs sans data structurée

---

## 3. Licence & ToS

**Identique au problème déjà identifié dans `rapport-tennis-data-sourcing-2026.md`.**

- Tennis Abstract = projet Jeff Sackmann
- Toutes les données Sackmann (GitHub + site) sont sous **CC BY-NC-SA 4.0** (Non-Commercial Share-Alike)
- PariScore = SaaS €19/mois Pro → **commercial** → **incompatible NC**
- Même si l'URL exposait des données (ce n'est pas le cas), même blocage légal

**Conclusion ToS** : aucune voie d'incorporation légale, indépendamment du contenu technique.

---

## 4. Valeur pour PariScore

**ZÉRO.** Détail :

| Hypothèse | Réalité | Valeur PariScore |
|---|---|---|
| Endpoint data tennis caché | Non — c'est du WP core PHP | 0 |
| API REST custom Sackmann | Non — pas de routes `/wp-json/` métier visibles ici | 0 |
| Plugin tennis exposé | Non — fichiers framework Gutenberg génériques | 0 |
| Curiosité technique sur stack TA | Oui : WordPress + Apache + ajouts AI/collaboration custom | 0 (pas notre stack Node.js) |

Les fichiers PHP listés sont du **code source WordPress identique à n'importe quel site WP 6.5+** dans le monde. On peut les lire dans le repo officiel `WordPress/wordpress-develop` sur GitHub.

---

## 5. Risques

| Risque | Niveau | Note |
|---|---|---|
| Scraping & violation NC | **HAUT** (mais N/A ici, pas de data) | Si on tentait d'exfiltrer des data via WP REST `/wp-json/`, même blocage CC BY-NC-SA |
| Perte de temps R&D | Modéré | Spike close-fast recommandé (ce rapport) |
| Confusion stratégique | Faible | Bien distinguer : `wp-includes/` = framework WP, pas des datasets tennis |
| Sécurité Tennis Abstract | N/A | Misconfig de leur côté (directory listing) — pas notre problème, ne pas exploiter |

---

## 6. Recommandation

**SKIP cette piste.** Aucune action côté code, aucune incorporation, aucun spike supplémentaire nécessaire.

### Pour la stratégie tennis data, rester sur le plan déjà validé :

1. **Court terme** : poursuivre l'ETL Sackmann CSV existant (bd `rxh` en cours) en **acceptant la non-conformité NC à titre temporaire** (déjà acté risk register).
2. **Moyen terme** : exécuter la migration vers **Datahub.io tennis CC-BY-4.0** recommandée dans `rapport-tennis-data-sourcing-2026.md` pour résoudre la compliance commerciale.
3. **Ne PAS** :
   - Scraper tennisabstract.com (NC + risque ban IP)
   - Explorer `/wp-json/` de TA en espérant data tennis (très improbable + même blocage légal)
   - Documenter la misconfig Apache de TA (hors scope, éthique)

---

## VERDICT

**[SKIP]** — URL = listing Apache de fichiers PHP framework WordPress core (pas de data tennis), et de toute façon licence Sackmann CC BY-NC-SA bloque tout usage commercial PariScore. Zéro valeur, zéro action.

---

*Rapport produit le 2026-05-21 — Recherche close en 2 fetchs WebFetch. Cross-réf : `.context/strategy/rapport-tennis-data-sourcing-2026.md`, `bd rxh`, `server.js:15445`.*
