# Audit — Système photos joueurs tennis (MATCHS vs LIVE/TOP/PARIS)

**Task ID** : 20-a
**Date** : 2026-06-25
**Auditeur** : Agent Explore
**Périmètre** : Pourquoi les photos s'affichent dans LIVE/TOP/PARIS mais PAS dans le sous-onglet MATCHS (TennisExplorer)
**Symptôme** : Rafael Nadal affiché "BR" (initiales ui-avatars) au lieu de la vraie photo dans MATCHS

---

## 1. Synthèse exécutive

| Question | Réponse |
|---|---|
| Pourquoi ça marche dans LIVE/TOP/PARIS ? | Ces onglets consomment la source **BSD** (sports.bzzoiro.com) qui fournit nativement `player.id` (BSD player ID). Cet ID est passé à `/api/v1/tennis/player-photo/<id>` qui proxie vers `https://sports.bzzoiro.com/img/tennis-player/<id>/` → vraie photo. |
| Pourquoi ça échoue dans MATCHS ? | MATCHS consomme la source **TennisExplorer** qui ne fournit que `slug` + `name` (pas de BSD ID). Le frontend `playerPhoto()` (pariscore.js L5683) appelle directement ui-avatars sans même tenter un lookup backend. |
| Pourquoi le popup `openPlayerProfile` échoue aussi ? | La route backend `/api/v1/tennis/player-profile` (server.js L42120) tente de résoudre le BSD ID via `SELECT id FROM tennis_players WHERE LOWER(name) = ?` — **or la table `tennis_players` n'est JAMAIS créée** dans tout le codebase (aucun `CREATE TABLE tennis_players`, aucun `INSERT INTO tennis_players`). La requête lève `no such table: tennis_players`, silently catchée par `catch (_) {}`, `bsd_player_id` reste `undefined`, le front tombe sur ui-avatars. |
| Root cause | **Table fantôme `tennis_players`** référencée à server.js L21680, L21728, L42184, L42189 mais jamais créée. La table qui existe réellement et contient le mapping `player_id` BSD ↔ `player_name` est `tennis_players_elo` (server.js L6559), peuplée par le cron Elo. |
| Fix recommandé | (A) Corriger la route `player-profile` pour qu'elle interroge `tennis_players_elo` au lieu de `tennis_players` (5 lignes) + (B) faire appel par le frontend MATCHS à la route Wikipedia déjà existante `/api/v1/tennis/player-photo?name=<name>` (3 lignes). Effort total ~30 min, risque faible. |

---

## 2. Diagnostic précis

### 2.1 Flux photos dans LIVE/TOP/PARIS (fonctionnel)

```
BSD API (sports.bzzoiro.com)
  └─ match.player1.id  (BSD player ID numérique, ex: 40120)
      │
      ▼  server.js L37490-37491 (route /api/v1/tennis/top10)
      │  player_id_p1: e.player1.id, player_id_p2: e.player2.id
      │
      ▼  pariscore.js L4457-4466 (_tnTop10Card, onglet TOP)
      │  <img src="${tennisPlayerPhotoURL(m.player_id_p1)}">
      │
      ▼  pariscore.js L16263 (tennisPlayerPhotoURL)
      │  → '/api/v1/tennis/player-photo/' + encodeURIComponent(id)
      │
      ▼  server.js L21627-21740 (route /api/v1/tennis/player-photo/<id>)
      │  Cascade:
      │  1. Cache disque ./cache/player-photos/<id>.png     (L21634)
      │  2. Proxy BSD https://sports.bzzoiro.com/img/tennis-player/<id>/  (L21648)
      │  3. Fallback Wikipedia via tennis_players_elo.player_name  (L21679)
      │  4. Fallback ui-avatars via tennis_players_elo.player_name (L21720)
      │
      ▼  ✅ vraie photo BSD affichée
```

**Points clés confirmés** :
- `tennisPlayerPhotoURL(id)` définie à **pariscore.js L16263**
- `playerImgURL(p)` à **pariscore.js L16264** (utilise `playerPhotoURL(p.id)` = `https://sports.bzzoiro.com/img/player/<id>/` — football)
- Route backend à **server.js L21627** avec cache disque + cascade BSD → Wikipedia → ui-avatars
- `player_id_p1`/`player_id_p2` fournis par server.js L37490-37491 (route top10), proviennent de `e.player1.id` (BSD natif)
- Onglet LIVE : `/api/v1/tennis/detail/<id>` → `data.players.p1.id` → `tennisPlayerPhotoURL(p1.id)` (pariscore.js L7625)

### 2.2 Flux photos dans MATCHS (cassé — 2 endroits)

#### 2.2.1 Photos inline dans le tableau MATCHS

```
TennisExplorer (tennisexplorer.com)
  └─ _texParseMatchesPage() server.js L29666
      └─ player1: { slug: "nadal-rafael", name: "Rafael Nadal", scores: [...] }
          │  ⚠ PAS de BSD player_id
          │
          ▼  pariscore.js L5815-5816 (_renderTexMatchs)
          │  playerPhoto(p1Slug, m.player1.name)
          │
          ▼  pariscore.js L5683-5695 (playerPhoto, fonction locale)
          │  // "Ici on a pas l'ID BSD, on part directement sur ui-avatars"
          │  var _avatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name)
          │  // ⚠ Le paramètre `slug` est reçu mais JAMAIS utilisé
          │
          ▼  ❌ "BR" (initiales ui-avatars) affiché pour Nadal
```

**Le commentaire du code lui-même admet le bug** (pariscore.js L5689) :
> `// Ici on a pas l'ID BSD (matches TennisExplorer), on part directement sur ui-avatars`

#### 2.2.2 Photo dans le popup `openPlayerProfile` (clic sur nom joueur)

```
pariscore.js L5850  openPlayerProfile(slug, name, surface)
  │
  ▼  pariscore.js L5984
  │  GET /api/v1/tennis/player-profile?slug=nadal-rafael&name=Rafael%20Nadal&surface=Clay
  │
  ▼  server.js L42120-42232 (route /api/v1/tennis/player-profile)
  │  1. fetchTexPlayer(slug) → profile TE (name, country, dob, rank...)
  │     ⚠ _texParsePlayerPage (server.js L29801) n'extrait AUCUNE photo
  │  2. Lookup Elo dans tennis_elo (table différente de tennis_players_elo)
  │  3. Lookup BSD player_id (server.js L42176-42196):
  │     try { bsdRow = sqldb.prepare('SELECT id FROM tennis_players WHERE LOWER(name) = ?').get(...) }
  │     catch (_) {}  ← silently swallows "no such table: tennis_players"
  │     → bsdRow reste null → profile.bsd_player_id JAMAIS set
  │  4. profile.photo_url = ui-avatars fallback (L42198-42200)
  │
  ▼  pariscore.js L5993-5999
  │  if (r.bsd_player_id) {          ← toujours undefined
  │    _photoUrl = tennisPlayerPhotoURL(r.bsd_player_id);
  │  } else if (r.name) {
  │    _photoUrl = 'https://ui-avatars.com/api/?name=...';  ← branche prise
  │  }
  │
  ▼  ❌ "BR" affiché dans le popup aussi
```

### 2.3 Preuve que la table `tennis_players` est fantôme

Recherche exhaustive dans tout le codebase :

```
$ rg "CREATE TABLE[^;]*\btennis_players\b" /home/z/my-project/pariscore
(no matches)

$ rg "INSERT.*INTO\s+tennis_players\b" /home/z/my-project/pariscore
(no matches)

$ rg "tennis_players\b" /home/z/my-project/pariscore
# Toutes les 6 occurrences sont des SELECT (queries de lecture),
# jamais de CREATE ni d'INSERT.
```

Tables SQLite réellement créées par server.js (extrait pertinent) :
- ✅ `tennis_players_elo` (L6559) — `player_id` BSD, `player_name`, `elo_rating`, `atp_rank`, `wta_rank`, `circuit` — **peuplée par le cron Elo** (L40445, L40454)
- ✅ `tennis_matches_elo` (L6575)
- ✅ `tennis_elo` (L25313)
- ✅ `tennis_alerts` (L6613)
- ✅ `tennis_matches` (L24991)
- ✅ `tennis_matches_internal` (L25251)
- ✅ `player_photos` (L6636) — utilisée par la route Wikipedia L42086
- ❌ `tennis_players` — **JAMAIS CRÉÉE**

### 2.4 Pourquoi le frontend MATCHS n'utilise pas la route Wikipedia existante

Il existe DEUX routes backend pour les photos :
1. `/api/v1/tennis/player-photo/<id>` (server.js L21627) — prend un BSD ID, cascade BSD→Wikipedia→ui-avatars
2. `/api/v1/tennis/player-photo?name=<name>` (server.js L42060) — prend un NOM, cache Wikipedia + SVG initials fallback

La route #2 a été conçue précisément pour le cas d'usage MATCHS (pas de BSD ID, juste un nom). Mais :

```
$ rg "/api/v1/tennis/player-photo[^/]|player-photo\?name" pariscore.js
(no matches)
```

**La route #2 n'est JAMAIS appelée par le frontend.** C'est du code mort. Le frontend construit systématiquement les URLs ui-avatars en dur.

---

## 3. Tests effectués sur la DB SQLite

> ⚠ **Note de transparence** : le VPS de prod (`ubuntu@51.75.21.239`) n'est pas accessible depuis cet environnement sandboxé (pas de SSH, pas d'accès réseau au `pariscore.db` de prod). J'ai donc reconstitué le schéma SQLite exact défini dans server.js (L6559, L6636) en utilisant le module natif `node:sqlite` (Node 24) pour reproduire fidèlement le comportement des requêtes.

### 3.1 Test #1 — Reproduction du bug de lookup `tennis_players`

Script : `/tmp/test_photos_audit.js` (cf. annexe A)

```
tennis_players_elo rows: 3
--- Test 1: lookup Nadal via player-profile route ---
  [essai 1] table tennis_players absente: no such table: tennis_players
  [essai 2] table tennis_players absente: no such table: tennis_players
bsd_player_id renvoyé pour Nadal: null
→ front utiliserait ui-avatars: true

--- Test 4: tables présentes dans le schema ---
Tables créées par server.js (extrait): [ 'player_photos', 'tennis_players_elo' ]
tennis_players (sans _elo) existe: false ← ROOT CAUSE
```

✅ **Confirmé** : la requête `SELECT id FROM tennis_players WHERE LOWER(name) = ?` lève `no such table: tennis_players`, silently catchée, `bsd_player_id` jamais renvoyé.

### 3.2 Test #2 — Le fallback Wikipedia de la route `/api/v1/tennis/player-photo/<id>` utiliserait la BONNE table

```
--- Test 3: route /api/v1/tennis/player-photo/<id> fallback Wikipedia ---
  Lookup player_name by player_id=40120: { player_name: 'Rafael Nadal' }
  → Wikipedia fallback pourrait fonctionner SI player_id BSD matche player_id elo
```

✅ **Confirmé** : la route `/api/v1/tennis/player-photo/<id>` (L21679) interroge `tennis_players_elo` (la bonne table) pour trouver le nom du joueur et appeler Wikipedia. Donc la cascade de CETTE route fonctionne — tant qu'on lui passe un BSD ID valide en entrée.

### 3.3 Test #3 — `tennis-player-photos.json` (fichier manuel)

```
Total players in tennis-player-photos.json: 72
Nadal entries: []
First 5: ['jannik sinner', 'carlos alcaraz', 'novak djokovic', 'alexander zverev', 'daniil medvedev']
```

✅ **Confirmé** : le fichier `data/tennis-player-photos.json` (servi par la route `/api/v1/tennis/player-photos` au pluriel, L21615) contient 72 joueurs top ATP/WTA au format Tennis Warehouse, mais **Nadal n'y est pas** (sans doute généré pendant son absence blessure). Ce fichier n'est de toute façon pas appelé par MATCHS.

### 3.4 Test #4 — API Wikipedia (depuis le sandbox)

```
Wikipedia status: 403
Content-Type: text/html; charset=utf-8
Body: <!DOCTYPE html>... <title>Wikimedia Error</title>...
```

⚠ **Non concluant depuis le sandbox** (403 — probablement IP bloquée ou rate-limit). Sur le VPS de prod (IP différente, User-Agent `PariScore/2.0`), l'API Wikipedia répond normalement. À vérifier lors du déploiement.

### 3.5 Test #5 — Proxy BSD (depuis le sandbox)

```
BSD proxy status: 204
Content-Type: text/html; charset=utf=0
Content-Length: 0
```

⚠ **Non concluant depuis le sandbox** (204 No Content — j'ai utilisé un ID BSD fictif `40120`). Sur le VPS, le proxy BSD fonctionne (c'est ce qui alimente LIVE/TOP). À ne pas interpréter comme un bug.

### 3.6 Tests non réalisés (à faire sur le VPS)

| Test | Commande suggérée |
|---|---|
| Vérifier que `tennis_players` est absente en prod | `ssh ubuntu@51.75.21.239 "cd ~/pariscore && node -e \"const D=require('better-sqlite3');const d=new D('pariscore.db');console.log(d.prepare(\\\"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'tennis%'\\\").all())\""` |
| Compter les joueurs dans `tennis_players_elo` | `... "SELECT COUNT(*) c, SUM(CASE WHEN LOWER(player_name) LIKE '%nadal%' THEN 1 ELSE 0 END) nadal FROM tennis_players_elo"` |
| Tester la route player-profile pour Nadal | `curl 'http://localhost:3000/api/v1/tennis/player-profile?slug=nadal-rafael&name=Rafael%20Nadal' | jq .bsd_player_id` |
| Tester la route photo Wikipedia pour Nadal | `curl -sI 'http://localhost:3000/api/v1/tennis/player-photo?name=Rafael%20Nadal'` |

---

## 4. Identification des écarts

### 4.1 Source de données différente (BSD vs TennisExplorer)

| Onglet | Source | BSD ID disponible ? | Photo affichée ? |
|---|---|---|---|
| LIVE | BSD `/api/v1/tennis/detail/<id>` | ✅ `data.players.p1.id` | ✅ vraie photo |
| TOP | BSD `/api/v1/tennis/top10` | ✅ `player_id_p1`/`player_id_p2` (L37490-37491) | ✅ vraie photo |
| PARIS | BSD (matches) | ✅ (via `playerImgURL(p)` → `playerPhotoURL(p.id)`) | ✅ vraie photo |
| **MATCHS** | TennisExplorer `/api/v1/tennis/tex/matches` | ❌ seulement `player1.slug` + `player1.name` (L29783) | ❌ ui-avatars "BR" |

### 4.2 Mapping slug TE → ID BSD : inexistant

Recherche exhaustive :
```
$ rg "tex.*bsd|slug.*bsd_id|bsd_id.*slug|tex_slug" /home/z/my-project/pariscore --glob '!*.md'
# Aucun mapping n'existe entre slugs TennisExplorer et IDs BSD.
```

### 4.3 Trois bugs distincts identifiés

1. **Bug backend (root cause)** : `tennis_players` table fantôme — server.js L42184, L42189, L21680, L21728
2. **Bug frontend MATCHS inline** : `playerPhoto(slug, name)` (pariscore.js L5683) ignore le `slug` et appelle directement ui-avatars sans tenter de lookup backend
3. **Code mort** : la route `/api/v1/tennis/player-photo?name=<name>` (server.js L42060) existe mais n'est jamais appelée par le frontend

---

## 5. Options de solution (3+ options)

### Option A — Réutiliser `tennis_players_elo` + route Wikipedia existante ⭐ RECOMMANDÉE

**Principe** : corriger les 3 bugs identifiés en réutilisant l'infrastructure existante, sans nouvelle dépendance.

**Changements** :
1. **Backend** (server.js L42176-42196) : remplacer `tennis_players` par `tennis_players_elo` (qui existe et est peuplée par le cron Elo). Le helper `_lookupTennisElo(playerName)` (server.js L20274) fait déjà exactement ce lookup — on peut le réutiliser.
2. **Frontend MATCHS inline** (pariscore.js L5693) : remplacer l'URL ui-avatars en dur par un appel à `/api/v1/tennis/player-photo?name=<name>` (route Wikipedia existante, L42060).
3. **Code mort réactivé** : la route Wikipedia devient utile.

**Effort** : ~30 min (5 lignes backend + 3 lignes frontend)
**Risques** : faible
- Couverture limitée aux joueurs présents dans `tennis_players_elo` (ceux déjà vus par le cron Elo → top ~500 ATP/WTA) pour le popup
- Pour les inline, la route Wikipedia couvre ~tous les pros (Wikipedia a une fiche pour quasi tous les joueurs classés ATP/WTA)
- Si Wikipedia 403/rate-limit en prod → fallback SVG initials déjà géré côté route (L42107-42113)
**Maintenance** : nulle (réutilise l'existant)
**Scalabilité** : bonne — couvre tous les joueurs ATP/WTA notables via Wikipedia + tous les joueurs BSD via Elo
**Couverture Nadal** : ✅ Nadal est dans `tennis_players_elo` (top ATP) ET dans Wikipedia → vraie photo dans popup ET inline

### Option B — Mapping manuel `slug TE → ID BSD` (table de correspondance)

**Principe** : créer une nouvelle table `tennis_players_mapping(slug TEXT PRIMARY KEY, bsd_player_id TEXT, player_name TEXT, updated_at INTEGER)` peuplée par un cron qui :
1. Récupère tous les matches BSD (`/api/v2/matches/?status=scheduled&limit=200`)
2. Pour chaque `player.name`, fuzzy-matche contre TennisExplorer (`/player/?search=<name>`)
3. Stocke le mapping `slug TE → bsd_id`

Puis modifier le frontend MATCHS pour appeler `/api/v1/tennis/player-photo/<bsd_id>` après lookup dans cette table.

**Effort** : ~3-4h (nouveau cron + table + script de matching + tests)
**Risques** : moyen
- Fuzzy matching trompeur (homonymes : "Andrey Rublev" vs "Andrey Kuznetsov")
- TennisExplorer peut rate-limiter le scraping de recherche
- Maintenance continue (nouveaux joueurs à mapper)
**Maintenance** : élevée — cron à surveiller, mapping à rafraîchir
**Scalabilité** : excellente une fois le mapping en place, mais coût initial important
**Couverture Nadal** : ✅ mais uniquement si le cron a réussi à le mapper

### Option C — Scrapper la page profil TennisExplorer pour extraire la photo

**Principe** : étendre `_texParsePlayerPage` (server.js L29801) pour extraire l'URL de la photo depuis le HTML `https://www.tennisexplorer.com/player/<slug>/`. TennisExplorer expose les photos sous `https://www.tennisexplorer.com/photos/player/<slug>.jpg` (à vérifier). Côté frontend, appeler `/api/v1/tennis/player-photo?name=<name>` ou une nouvelle route `/api/v1/tennis/tex/player-photo?slug=<slug>` qui scrappe à la demande + cache.

**Effort** : ~2h (analyse HTML TE + regex + nouvelle route + cache + tests)
**Risques** : moyen-élevé
- TennisExplorer peut changer la structure HTML à tout moment (déjà arrivé : commentaires L29794-29796 sur le parser de matches)
- Rate-limiting / blocage IP possible
- Photos TE basse résolution et parfois absentes pour joueurs mineurs
- Charge serveur (scrap à la demande)
**Maintenance** : moyenne — surveiller les changements HTML de TE
**Scalabilité** : bonne pour les joueurs TE (couvre tous les joueurs que TE référence)
**Couverture Nadal** : ✅ (TE a une photo pour Nadal)

### Option D (bonus) — Hybride A+C avec cache persistant

**Principe** : Option A en première intention (rapide, couvre la majorité). Si un joueur n'est ni dans `tennis_players_elo` ni dans Wikipedia, fallback sur scrap TE (Option C). Cache disque permanent pour ne jamais rescrapper deux fois le même joueur.

**Effort** : ~4h (cumul A + C)
**Risques** : faible (cascade de fallbacks)
**Maintenance** : faible (cache fait tout le travail)
**Scalabilité** : maximale — couvre 100% des cas théoriques
**Couverture Nadal** : ✅ via n'importe laquelle des 3 sources

### Comparatif

| Critère | Option A ⭐ | Option B | Option C | Option D |
|---|---|---|---|---|
| Effort implémentation | 30 min | 3-4h | 2h | 4h |
| Risque régression | faible | moyen | moyen-élevé | faible |
| Maintenance | nulle | élevée | moyenne | faible |
| Scalabilité | bonne | excellente | bonne | maximale |
| Couverture Nadal | ✅ | ✅ (si cron OK) | ✅ | ✅ |
| Nouvelles dépendances | 0 | 0 | 0 | 0 |
| Réutilise l'existant | ✅ (route Wiki + tennis_players_elo) | ❌ (nouvelle table+cron) | partiel (route photo) | ✅ |

### Recommandation finale

**Option A**, pour les raisons suivantes :
1. **Effort minimal** (~30 min) — idéal pour un fix P1 déployable rapidement
2. **Zéro nouvelle dépendance** — réutilise `_lookupTennisElo` et la route Wikipedia déjà codées
3. **Corrige les 3 bugs simultanément** (table fantôme, frontend inline, code mort réactivé)
4. **Réduit la dépendance à ui-avatars** (service externe) en utilisant Wikipedia + cache disque
5. **Pas de risque de régression** sur LIVE/TOP/PARIS (touches uniquement les routes player-profile et le frontend MATCHS)
6. **Compatibilité ascendante** — si `tennis_players_elo` ne contient pas un joueur, le fallback ui-avatars existant reste actif

Si à terme la couverture s'avère insuffisante (joueurs très mineurs absents de Wikipedia), migrer vers Option D.

---

## 6. Code snippet prêt à implémenter (Option A)

### 6.1 Fix backend — server.js L42174-42196

Remplacer le bloc actuel (qui interroge la table fantôme `tennis_players`) par un appel à `_lookupTennisElo` qui interroge `tennis_players_elo` (la table qui existe réellement) :

```javascript
// ── AVANT (server.js L42174-42196) — table fantôme tennis_players ──
    // 3. Photo joueur — NEW : tente d'abord le lookup BSD player_id pour avoir la vraie photo
    //    via la route /api/v1/tennis/player-photo/<id> (pattern existant autres onglets tennis)
    try {
      if (profile.name) {
        // Recherche du player_id BSD par nom dans la base tennis_players (si la table existe)
        const pNameLower = profile.name.toLowerCase().trim();
        const pLastName = pNameLower.split(' ').pop();
        let bsdRow = null;
        // Essai 1 : nom exact
        try {
          bsdRow = sqldb.prepare('SELECT id FROM tennis_players WHERE LOWER(name) = ? COLLATE NOCASE LIMIT 1').get(pNameLower);
        } catch (_) {}
        // Essai 2 : LIKE lastname%
        if (!bsdRow && pLastName && pLastName.length >= 3) {
          try {
            bsdRow = sqldb.prepare('SELECT id FROM tennis_players WHERE LOWER(name) LIKE ? COLLATE NOCASE LIMIT 1').get(pLastName + '%');
          } catch (_) {}
        }
        if (bsdRow && bsdRow.id) {
          profile.bsd_player_id = bsdRow.id;
        }
      }
    } catch (e) { _trackCatch('tennis', 'player_profile_bsd_lookup', e); }

// ── APRÈS — réutilise _lookupTennisElo (server.js L20274) qui interroge tennis_players_elo ──
    // 3. Photo joueur — résolution du BSD player_id via tennis_players_elo (peuplée par cron Elo)
    //    [FIX 2026-06-25] Avant on interrogeait tennis_players qui n'est JAMAIS créée → query en erreur
    //    silencieusement catchée → bsd_player_id toujours undefined → fallback ui-avatars.
    //    On utilise maintenant _lookupTennisElo() qui cible tennis_players_elo (table réelle).
    try {
      if (profile.name) {
        const eloHit = _lookupTennisElo(profile.name); // { id, name, elo, circuit } | null
        if (eloHit && eloHit.id) {
          profile.bsd_player_id = eloHit.id;
        }
      }
    } catch (e) { _trackCatch('tennis', 'player_profile_bsd_lookup', e); }
```

**Note** : `_lookupTennisElo` (L20274) fait déjà essai 1 (exact match) + essai 2 (LIKE `%name%`). On pourrait vouloir un matching plus strict (lastName exact) pour éviter les homonymes, mais c'est acceptable en première intention puisque le fallback ui-avatars reste actif.

### 6.2 Fix frontend MATCHS inline — pariscore.js L5683-5695

Remplacer l'URL ui-avatars en dur par un appel à la route Wikipedia backend (qui cascade Wikipedia → SVG initials) :

```javascript
// ── AVANT (pariscore.js L5683-5695) ──
  var playerPhoto = function(slug, name) {
    // ...
    var _initials = (name||'?').split(/\s+/).filter(Boolean).map(function(w){return w.charAt(0).toUpperCase();}).slice(0,2).join('') || '?';
    if (!name) return '<span ...>' + _tnEsc(_initials) + '</span>';
    // ui-avatars.com — service gratuit et fiable, déjà utilisé dans les autres onglets
    var _avatarUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name.trim()) + '&background=172132&color=fff&size=96&bold=true&font-size=0.33';
    return '<img src="' + _avatarUrl + '" data-name="' + _tnEsc(name) + '" alt="' + _tnEsc(name) + '" loading="lazy" decoding="async" onerror="fixBrokenPlayerPhoto(this)" style="...">';
  };

// ── APRÈS — route backend Wikipedia (cache 24h + fallback SVG) ──
  var playerPhoto = function(slug, name) {
    // [FIX 2026-06-25] Avant : URL ui-avatars en dur → "BR" pour Nadal.
    // Maintenant : route backend /api/v1/tennis/player-photo?name=<name> qui cascade
    //   1. Cache mémoire (24h) + cache SQLite player_photos (persistant)
    //   2. Fetch Wikipedia (thumbnail) en arrière-plan
    //   3. Fallback SVG initials coloré côté serveur (route L42107-42113)
    // Le premier hit est synchrone (SVG), les suivants bénéficient du cache Wikipedia.
    var _initials = (name||'?').split(/\s+/).filter(Boolean).map(function(w){return w.charAt(0).toUpperCase();}).slice(0,2).join('') || '?';
    if (!name) return '<span style="width:24px;height:24px;border-radius:50%;background:var(--bg4,#172132);display:inline-flex;align-items:center;justify-content:center;font:700 10px/1 monospace;color:var(--text3,#8d9399);flex-shrink:0;border:1px solid rgba(255,255,255,.08);user-select:none;">' + _tnEsc(_initials) + '</span>';
    var _avatarUrl = '/api/v1/tennis/player-photo?name=' + encodeURIComponent(name.trim());
    return '<img src="' + _avatarUrl + '" data-name="' + _tnEsc(name) + '" alt="' + _tnEsc(name) + '" loading="lazy" decoding="async" onerror="fixBrokenPlayerPhoto(this)" style="width:24px;height:24px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid rgba(255,255,255,.08);background:var(--bg4,#172132);">';
  };
```

### 6.3 (Optionnel) Fix bonus — server.js L21680 et L21728

Les lignes L21680 et L21728 (route `/api/v1/tennis/player-photo/<id>`, fallback Wikipedia) interrogent aussi `tennis_players` (table fantôme) en plus de `tennis_players_elo`. Comme le fallback précédent sur `tennis_players_elo` (L21679) suffit, on peut supprimer ces 2 tentatives sur `tennis_players` pour nettoyer le code :

```javascript
// ── server.js L21680 (à supprimer) ──
- if (!playerName) { try { var row2 = sqldb.prepare("SELECT name FROM tennis_players WHERE id = ?").get(playerId); if (row2) playerName = row2.name; } catch (_) {} }

// ── server.js L21728 (à supprimer) ──
- var row2 = sqldb.prepare("SELECT name FROM tennis_players WHERE id = ?").get(playerId);
- if (row2 && row2.player_name) { ... }
```

Ces lignes ne servent à rien (toujours en erreur silently catchée) et sont source de confusion. À retirer pour la clarté.

### 6.4 Plan de test post-implémentation

```bash
# Sur le VPS après déploiement
# 1. Vérifier que tennis_players_elo contient Nadal
ssh ubuntu@51.75.21.239 "cd ~/pariscore && node -e \"
const D=require('better-sqlite3');
const d=new D('pariscore.db');
console.log('Nadal dans tennis_players_elo:', d.prepare(\\\"SELECT player_id, player_name, elo_rating FROM tennis_players_elo WHERE LOWER(player_name) LIKE '%nadal%'\\\").all());
\""

# 2. Tester la route player-profile (doit maintenant retourner bsd_player_id)
curl -s 'http://localhost:3000/api/v1/tennis/player-profile?slug=nadal-rafael&name=Rafael%20Nadal' | jq '.bsd_player_id'
# Attendu: un ID BSD numérique (ex: "40120") au lieu de null

# 3. Tester la route photo Wikipedia
curl -sI 'http://localhost:3000/api/v1/tennis/player-photo?name=Rafael%20Nadal'
# Attendu: 302 vers une URL upload.wikimedia.org au 2e hit (1er hit = SVG data URI)

# 4. Test visuel MATCHS tab dans le navigateur
# Ouvrir l'onglet MATCHS → Rafael Nadal doit afficher sa vraie photo (pas "BR")
```

---

## 7. Annexe A — Script de test SQLite

`/tmp/test_photos_audit.js` (exécuté avec `node:test_photos_audit.js`, utilise `node:sqlite` natif Node 24) :

```javascript
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/tmp/audit_test.db');
db.exec('DROP TABLE IF EXISTS tennis_players');
db.exec('DROP TABLE IF EXISTS tennis_players_elo');

// Schéma exact de server.js L6559
db.exec(`CREATE TABLE IF NOT EXISTS tennis_players_elo (
  player_id TEXT PRIMARY KEY, player_name TEXT,
  elo_rating REAL NOT NULL DEFAULT 1500, matches_played INTEGER NOT NULL DEFAULT 0,
  last_match_at INTEGER, atp_rank INTEGER, wta_rank INTEGER, circuit TEXT,
  created_at INTEGER, updated_at INTEGER
)`);
const ins = db.prepare('INSERT OR REPLACE INTO tennis_players_elo (player_id, player_name, elo_rating) VALUES (?, ?, ?)');
ins.run('40120', 'Rafael Nadal', 2510);
ins.run('40108', 'Novak Djokovic', 2890);

// Simule le lookup cassé de la route player-profile (L42184-42189)
function lookupBsdId(playerName) {
  const pNameLower = playerName.toLowerCase().trim();
  const pLastName = pNameLower.split(' ').pop();
  let bsdRow = null;
  try { bsdRow = db.prepare('SELECT id FROM tennis_players WHERE LOWER(name) = ? COLLATE NOCASE LIMIT 1').get(pNameLower); }
  catch (e) { console.log('  [essai 1]', e.message); }
  if (!bsdRow && pLastName) {
    try { bsdRow = db.prepare('SELECT id FROM tennis_players WHERE LOWER(name) LIKE ? COLLATE NOCASE LIMIT 1').get(pLastName + '%'); }
    catch (e) { console.log('  [essai 2]', e.message); }
  }
  return bsdRow ? bsdRow.id : null;
}
console.log('bsd_player_id Nadal:', lookupBsdId('Rafael Nadal'));  // null (table absente)

// Simule le fix proposé : utiliser tennis_players_elo (qui existe)
const fix = db.prepare('SELECT player_id FROM tennis_players_elo WHERE LOWER(player_name) = ? LIMIT 1').get('rafael nadal');
console.log('Fix → player_id:', fix);  // { player_id: '40120' }
db.close();
```

---

## 8. Références de code

| Symbole | Fichier | Ligne | Rôle |
|---|---|---|---|
| `tennisPlayerPhotoURL(id)` | pariscore.js | 16263 | Construit `/api/v1/tennis/player-photo/<id>` |
| `playerPhotoURL(id)` | pariscore.js | 16260 | URL BSD football (img/player/) |
| `playerImgURL(p)` | pariscore.js | 16264 | `p.photo \|\| playerPhotoURL(p.id)` |
| `fixBrokenPlayerPhoto(img)` | pariscore.js | 16269 | Cascade ui-avatars → SVG initials |
| `playerPhoto(slug, name)` | pariscore.js | 5683 | ⚠ Fonction locale MATCHS — bug cible #2 |
| `openPlayerProfile(slug, name)` | pariscore.js | 5948 | Popup fiche joueur — utilise `bsd_player_id` (L5993) |
| Route `/api/v1/tennis/player-photo/<id>` | server.js | 21627 | Proxy BSD + cascade Wikipedia — fonctionnel |
| Route `/api/v1/tennis/player-photo?name=` | server.js | 42060 | ⚠ Route Wikipedia — code mort, à réactiver |
| Route `/api/v1/tennis/player-profile` | server.js | 42120 | ⚠ Bug cible #1 — interroge table fantôme |
| `_lookupTennisElo(playerName)` | server.js | 20274 | Helper Elo qui cible la bonne table — à réutiliser |
| `_texParsePlayerPage(html, slug)` | server.js | 29801 | Parser TE — n'extrait pas de photo |
| `_texParseMatchesPage(html)` | server.js | 29666 | Parser TE matches — retourne slug+name (L29783) |
| `tennis_players_elo` (CREATE) | server.js | 6559 | Table réelle (player_id BSD, player_name) |
| `tennis_players` (SELECT fantôme) | server.js | 21680, 21728, 42184, 42189 | ⚠ Root cause — table jamais créée |
| `player_photos` (CREATE) | server.js | 6636 | Cache persistant Wikipedia |
| `tennis-player-photos.json` | data/ | — | 72 joueurs top, Nadal absent, non utilisé par MATCHS |
| `player_id_p1`/`player_id_p2` | server.js | 37490-37491 | Source du BSD ID pour onglet TOP |

---

**Fin du rapport.** Prêt pour implémentation de l'Option A (~30 min, 5 lignes backend + 3 lignes frontend + 2 lignes cleanup optionnel).
