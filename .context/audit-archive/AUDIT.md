# PariScore — Audit Technique 360°
**Date : 27 avril 2026 · Version : 2.0 (Architecture Serveur-Centrique)**

---

## 1. SÉCURITÉ & ROBUSTESSE

### ✅ Points forts
- **Clés API** : aucune clé dans le HTML. `ODDS_API_KEY`, `API_FOOTBALL_KEY` et `GEMINI_API_KEY` sont chargées exclusivement depuis `.env` côté serveur.
- **Proxy Gemini** : le frontend appelle `/api/v1/gemini` — la clé Google n'est jamais exposée au navigateur.
- **Frontend étanche** : audit grep confirmé — 0 occurrence de clé API, 0 `localStorage` (hors commentaire), 0 `proxyFetch`, 0 référence aux anciens patterns.

### 🔴 Risques identifiés

| # | Risque | Sévérité | Détail |
|---|--------|----------|--------|
| S1 | **`.env` accessible via HTTP** | 🔴 Critique | La route fichiers statiques fait `path.join(__dirname, pathname)`. Un GET sur `http://localhost:3000/.env` sert le fichier `.env` en clair avec toutes les clés API. |
| S2 | **`database.json` accessible** | 🟠 Élevé | GET `http://localhost:3000/database.json` sert la base complète (cotes, stats, structure interne). Pas de fuite de clés mais expose la logique métier. |
| S3 | **Path traversal** | 🟠 Élevé | `path.join(__dirname, '/../../../etc/passwd')` — `path.join` résout les `..` et pourrait servir des fichiers hors du dossier projet. Il manque une vérification `filePath.startsWith(__dirname)`. |
| S4 | **Proxy Gemini ouvert** | 🟡 Moyen | `/api/v1/gemini` transmet n'importe quel payload à l'API Google sans validation ni rate limiting. Un utilisateur malveillant pourrait envoyer des requêtes massives pour épuiser le quota Gemini. |
| S5 | **Pas de limite de taille POST** | 🟡 Moyen | Les routes POST (`/api/v1/gemini`, `/api/v1/refresh`) font `body += c` sans limite. Un payload de 100 Mo ferait crasher le serveur (OOM). |
| S6 | **CORS wildcard** | 🟡 Moyen | `Access-Control-Allow-Origin: *` sur toutes les réponses API — acceptable en local, à restreindre en production. |

---

## 2. PERFORMANCE DU BACKEND

### ✅ Points forts
- **Non-bloquant** : les cron jobs utilisent `async/await` sur des appels réseau I/O — pas de CPU-bound → l'event loop n'est pas bloquée.
- **Fusion efficace** : `buildMatchRecord()` est O(n×b) avec n=matchs et b=bookmakers par match (~4-6). Pour 50-100 matchs, le calcul prend < 10ms.
- **Persistance** : `database.json` est rechargé au boot → le serveur retrouve ses données après un redémarrage.

### 🔴 Risques identifiés

| # | Risque | Sévérité | Détail |
|---|--------|----------|--------|
| P1 | **Race condition cron** | 🟠 Élevé | Aucun mutex/verrou entre les cron jobs. Si `fetchStats()` déclenche `fetchOdds()` (ligne actuelle dans le code : `if (db.matches.length) await fetchOdds()`) pendant qu'un cron `fetchOdds()` est déjà en cours, `db.matches` sera écrasé deux fois en parallèle. Pire avec `/api/v1/refresh` qui lance les deux simultanément à un cron. |
| P2 | **`writeFileSync` bloquant** | 🟡 Moyen | `saveDB()` utilise `fs.writeFileSync` — écriture synchrone sur le thread principal. Pour une base de 500 Ko c'est ~1ms, mais si la base grossit (cache historique futur), ça bloquera les requêtes HTTP en cours. |
| P3 | **Pas de rotation des matchs passés** | 🟡 Moyen | Les matchs dont la `commence_time` est dépassée restent dans `database.json` indéfiniment. Après quelques mois, la base gonflera inutilement. |
| P4 | **`toLocaleDateString('fr-FR')` côté serveur** | 🟡 Moyen | Le filtre jour dans `/api/v1/matches` utilise `toLocaleDateString('fr-FR')` — dépend de la locale du serveur. Sur certaines images Docker ou CI, la locale `fr-FR` n'est pas installée → le filtre ne marchera pas. |

---

## 3. QUALITÉ DU CODE (FRONTEND)

### ✅ Points forts
- **Vraiment "stupide"** : audit confirmé — 0 référence aux anciennes fonctions (`proxyFetch`, `loadAllLeagues`, `initAPI`, `loadDemoData`, `afTeamStats`, `CACHE_KEY`, etc.). Migration propre.
- **Un seul point d'entrée** : `fetch('/api/v1/matches')` → tout le reste est du rendu.
- **JS réduit** : 45 Ko → 23 Ko, 393 accolades → 233 accolades. Complexité divisée par deux.

### 🟡 Points d'attention

| # | Point | Sévérité | Détail |
|---|-------|----------|--------|
| F1 | **Commentaire header obsolète** | 🟢 Mineur | `server.js` ligne 12 mentionne encore "toutes les 15 min" au lieu de "12h". |
| F2 | **Double tri inutile** | 🟢 Mineur | Dans `renderMatches()`, si `sortKey` est actif, le tableau est trié par la stat, puis re-trié par `commence_time` juste après (ligne 1103). Le tri par date écrase le tri par stat. |
| F3 | **Moy. Buts sans couleur** | 🟢 Mineur | La colonne `avgScored` est rendue avec la classe `neutral` → pas de feedback visuel, contrairement à toutes les autres colonnes. Incohérence UX avec le style OddAlerts. |
| F4 | **Sections statiques** | 🟢 Info | Les onglets Prédictions, Tendances, Alertes et Comparateur utilisent encore des données codées en dur. Ce n'est pas un bug (hors scope actuel) mais à connecter à l'API à terme. |

---

## 4. PRÉCISION DES ALGORITHMES

### ✅ Points forts
- **Edge no-vig** : la méthode est correcte. La marge est retirée via la moyenne des probabilités implicites de tous les bookmakers, puis l'edge est calculé comme `best_odds × fair_prob - 1`. C'est la méthode standard de l'industrie.
- **PPG / W-D-L** : calculés depuis `entry.home` et `entry.away` des standings API-Football — c'est la bonne source pour des stats home/away spécifiques.

### 🟡 Risques identifiés

| # | Risque | Sévérité | Détail |
|---|--------|----------|--------|
| A1 | **BTTS/Over 2.5 estimés, pas calculés** | 🟠 Élevé | Les stats BTTS, Over 2.5, Over 1.5 1MT ne viennent pas de données réelles. Elles sont calculées par des formules linéaires arbitraires (`btts = 25 + avgFor * 14 + avgAgainst * 10`). Ces formules ne sont calibrées sur aucun jeu de données. Un BTTS à 88% max (cap artificiel) peut tromper l'utilisateur qui pense que c'est une stat historique. |
| A2 | **Matching noms : faux positifs fuzzy** | 🟠 Élevé | `findFuzzy("inter")` matchera le premier résultat contenant "inter" — potentiellement "Inter Miami" au lieu de "Inter Milan". Le matching par premier mot est fragile sur les noms courts ou les clubs homonymes (Sporting Lisbon vs Sporting KC, etc.). |
| A3 | **Saison 2024 codée en dur** | 🟡 Moyen | L'URL API-Football utilise `season=2024`. À partir de juillet/août 2026, cette saison sera obsolète. Il faudrait calculer dynamiquement la saison courante. |
| A4 | **`simStats` présenté comme "SIM"** | 🟢 OK | Le badge SIM est affiché clairement quand les stats sont simulées — pas de tromperie. Mais les utilisateurs pourraient quand même baser des décisions dessus. |

---

## 5. EXPÉRIENCE UTILISATEUR (UX)

### ✅ Points forts
- **3 états visuels** : loading (spinner), empty (message), error (bannière rouge). L'utilisateur n'est jamais face à un écran vide sans explication.
- **Barre de statut** : l'utilisateur sait si les données sont live, démo, et quand la dernière MAJ a eu lieu.
- **Bouton refresh** : feedback visuel (icône qui tourne + label dynamique) → l'utilisateur sait que l'action est en cours.

### 🟡 Points d'attention

| # | Point | Sévérité | Détail |
|---|-------|----------|--------|
| U1 | **Erreur 429 non spécifique** | 🟡 Moyen | Si le quota Odds API est épuisé (429), le frontend affiche "Impossible de contacter le serveur" — pas de distinction entre serveur down et quota épuisé. L'info 429 existe dans les logs serveur mais n'est pas remontée au client via le `meta.status`. |
| U2 | **Refresh bloquant** | 🟡 Moyen | Le `POST /api/v1/refresh` attend que Stats + Odds soient terminés avant de répondre. Avec 7 ligues × 2 APIs, ça peut prendre 15-30 secondes. Le bouton tourne mais il n'y a pas de timeout ni de message "cela peut prendre 30 secondes". |
| U3 | **Pas de rafraîchissement auto** | 🟢 Mineur | Si l'utilisateur laisse l'onglet Matchs ouvert 12h, les données deviennent stale sans indication. Un `setInterval` côté client pour recharger `/api/v1/matches` toutes les 5 min serait bienvenu. |
| U4 | **Scroll horizontal sur mobile** | 🟢 Mineur | Le tableau à 22+ colonnes (1400px min) nécessite un scroll horizontal important sur mobile. Pas de bandeau visuel indiquant qu'il y a plus de colonnes à droite. |

---

## SYNTHÈSE

### ✅ Points forts globaux
1. Architecture saine — séparation nette backend/frontend
2. Zéro dépendance npm — déployable partout où Node.js est installé
3. Fallback démo automatique — l'app fonctionne toujours même sans API
4. Code frontend propre — migration v1→v2 sans résidu de code mort
5. Edge no-vig correctement implémenté

### 🔴 Correctifs prioritaires (par ordre de sévérité)

| Priorité | ID | Correctif | Effort |
|----------|----|-----------|--------|
| **P0** | S1 | Bloquer l'accès HTTP à `.env` — ajouter une liste noire dans le serveur de fichiers statiques | 5 min |
| **P0** | S3 | Ajouter une vérification `path.resolve(filePath).startsWith(__dirname)` pour empêcher le path traversal | 5 min |
| **P1** | S2 | Bloquer l'accès à `database.json` via HTTP | 2 min |
| **P1** | P1 | Ajouter un flag `isFetching` pour empêcher les cron jobs concurrents | 10 min |
| **P1** | S5 | Limiter la taille des body POST à 1 Mo (`if (body.length > 1e6) return 413`) | 5 min |
| **P1** | F2 | Supprimer le double tri dans `renderMatches()` — le tri par date doit être un fallback uniquement si `sortKey` est null | 2 min |
| **P2** | A2 | Améliorer le fuzzy matching — utiliser Levenshtein ou matching bigramme au lieu du premier mot | 30 min |
| **P2** | A1 | Ajouter un avertissement visuel que BTTS/Over 2.5 sont des estimations, pas des historiques | 10 min |
| **P2** | A3 | Calculer la saison dynamiquement (`new Date().getMonth() >= 6 ? year : year - 1`) | 5 min |
| **P2** | U1 | Remonter `db.status = 'quota_epuise'` quand une API retourne 429, et l'afficher dans le frontend | 10 min |
| **P3** | P3 | Ajouter un nettoyage des matchs expirés au boot et après chaque cron | 5 min |
| **P3** | F1 | Corriger le commentaire header server.js (15 min → 12h) | 1 min |
| **P3** | P2 | Remplacer `writeFileSync` par `writeFile` asynchrone | 5 min |
| **P3** | U3 | Auto-refresh côté client toutes les 5 min via `setInterval(loadMatches, 300000)` | 2 min |

---

*Audit réalisé le 27 avril 2026 — PariScore v2.0*
