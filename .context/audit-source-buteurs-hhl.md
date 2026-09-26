# Audit source gratuite — buteurs Herre Handbold Ligaen (bead `ParisScorebis-8z6m`)

**Date** : 2026-09-26 · **Statut tâche 1 (identifier source)** : ✅ terminée
**Tâches 2-4 (scrape + intégration + cron)** : ⏳ bloquées sur environnement FlareSolverr (voir §3).

## 1. Résultats des candidats (testés en local, ordre chronologique)

| # | Candidat | Test | Verdict |
|---|----------|------|---------|
| 1 | **Sofascore API** (`api.sofascore.com`, top-scorers par tournoi) | probe direct + UA Chrome | ❌ `403 {"reason":"challenge"}` — challenge Cloudflare Turnstile (UA seul insuffisant) |
| 2 | **FlareSolverr local** (`FLARESOLVERR_URL=http://localhost:8191`) | GET `/health` | ❌ service **non démarré** ; `docker` **absent** de la machine → pas de démarrage possible local |
| 3 | **Wikipedia da** (`Herrehåndboldligaen`) | API action=parse | ❌ page = liste des **mêtres + topscorers historiques par année** (1936→) — aucun classement de buteurs **saison courante** |
| 4 | **Feed Flashscore ninja détail** (`s_{id}_en_{1..5}`) | 5 variantes d'URL, UA + x-fsign statique | ❌ toutes réponses = `0` (1 octet) — feed détail sous **signe dynamique par URL** (secret indevinable), feed liste = scores seuls |
| 5 | **danskhandbold.dk** (fédération, 3 URLs) | fetch UA Chrome | ❌ `Unable to connect` ×3 — domaine **injoignable depuis ce poste** (DNS/réseau) |
| 6 | **handbold.dk** | fetch | ❌ timeout |
| 7 | **Flashscore feed liste** (déjà en prod) | utilisé en continu | ⚠️ scores/mi-temps/minute **uniquement** — pas de buteurs (mapping vérifié 2026-09-24, cf. `scrape-flashscore-handball.js` en-tête) |

## 2. Source retenue : Sofascore via FlareSolverr

- **Pourquoi** : seul candidat exposant un **classement de buteurs par tournoi**
  (endpoint `unique-tournament/{id}/season/{sid}` → statistiques joueurs, buts),
  100 % gratuit, sans clé, sans compteur de quota.
- **Accès** : FlareSolverr (challenge Cloudflare contourné par Chrome headless).
  **FlareSolverr VPS est déjà actif** (précédent OddAlerts : sessions réutilisées
  `oddalerts-w{0..n}`, ≈1 page/s, `FLARE_SESSIONS=2` — cf. AGENTS.md §OddAlerts).
- **Schéma visé** (`data/hhl_players.json`, miroir `hbl_players.json`/`lnh_players.json`) :
  ```json
  { "updatedAt": "ISO", "source": "sofascore",
    "players": [{ "name": "…", "team": "…", "goals": 0, "games": 0 }] }
  ```

## 3. Plan de réalisation (tâches 2-4 du bead)

1. **Valider le JSON Sofascore réel** — bloquant : 7/7 candidats inaccessibles en
   local. Options (au choix) :
   - **A (recommandée)** : lancer le probe + scraper **sur le VPS** où FlareSolverr
     tourne déjà (session Docker présente) ;
   - **B** : installer Docker Desktop + `flaresolverr` en local, puis valider ici.
2. **Scraper** `scripts/scrape-hhl-scorers.js` (zero-dép `node:https`, miroir
   `scrape-oddalerts.js`) : résolution tournoi → top-scorers → écriture
   `data/hhl_players.json`. Session FlareSolverr réutilisée, retry ×3, skip si <24 h.
3. **Intégration** : étendre `src/lib/handball-players.ts`
   (`loadHandballPlayers` + source HHL) → popup détail (remplacer le dégradé
   « Buteurs indisponibles (snapshot HBL/LNH) » quand HHL dispo).
4. **Cron hebdo** (exigé : 1×/semaine) : pm2 VPS, miroir `pariscore-cron-vitibet`
   (`pariscore-cron-hhl-scorers`, lundi 05:00 UTC) — script + doc AGENTS.md au
   déploiement.
5. **Tests** : parseur sur fixture JSON factice (bun:test) + gates.

## 4. Garde-fous

- Ne **jamais** fabriquer de buteurs : sans snapshot → dégradé existant.
- ToS/robots.txt à relire côté Sofascore avant mise en prod cron (usage
  personnel/faible volume, pattern OddAlerts déjà accepté projet).
