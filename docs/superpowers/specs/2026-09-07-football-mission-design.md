# Spec — Mission Football : Top 10, BeSoccer, Dixon-Coles, UI Behance

**Date** : 2026-09-07 · **Statut** : design approuvé par l'utilisateur (GO exécution T1→T6)

## 1. Problème & diagnostic (vérifié en runtime)

**Symptôme** : tableau « Top 10 matchs par stratégie » (onglet Football) vide en production.

**Investigation** :
- Le tableau ne lit PAS Prisma : pipeline réel = `FootballTop10Widget` → `useFootballTopN()` (SWR) → `GET /api/football/top5` → API BSD `sports.bzzoiro.com` → `computeStrategyTop5Matches()`.
- Aucun modèle `StrategyPick` dans `prisma/schema.prisma` (hypothèse mission écartée).
- Fenêtres temporelles Paris correctes (`src/lib/football-time.ts:81`, borne basse = now).
- **Probe prod** : `https://pariscore.fr/api/football/top5?limit=10` → HTTP 200, `meta.source = "fallback"`, `meta.error = "BSD_API_KEY not configured"`, payload = `{matches, meta}` **sans clé `strategies`**.
- **Probe locale** : `BSD_API_KEY` présente dans `.env` local, API BSD répond HTTP 200 (481 matchs `notstarted`).

**Root cause (2 couches)** :
1. **Env VPS** : `BSD_API_KEY` absente de `/var/www/pariscore/.env` → la route bascule en fallback.
2. **Shape cassée** : le fallback renvoie `{matches: []}` sans `strategies`, alors que le hook lit `data.strategies[key]` → `undefined` → rendu vide silencieux (HTTP 200 masque l'erreur).

## 2. Objectifs

| # | Objectif | Critère de vérification |
|---|---|---|
| T1 | Restaurer le Top 10 (fix shape + fallback + env VPS) | Probe prod : `strategies.over15.length > 0`, `source ∈ {bsd, cache-fallback}` |
| T2 | Scraper BeSoccer (analyse, avant-match, compos, infos) | JSON valides dans `data/besoccer/`, upsert Prisma OK |
| T3 | Moteur prédictif (DC + xG/DR + picks ≥60% + EV) | Tests unitaires verts (probas somment à 1, picks dans [0,1]) |
| T4 | UI : `lineup-pitch`, `top-strategies-table`, `match-conditions-widget` + refonte top10 | Gates lint+typecheck verts, COMPONENTS.md à jour |
| T5 | Deploy VPS + vérif prod | `/api/v1/status` OK, top5 non-fallback |
| T6 | `graphify update` + rapport `.context/rapport-mission-foot-debug.md` | Rapport commité |

## 3. Design technique

### T1 — Fix Top 10
- `src/app/api/football/top5/route.ts` : le fallback renvoie la forme complète `{strategies: Record<StrategyTop5Key, []>, window: 5, minPlayed: 2, matches: [], meta.error}`.
- Nouveau fallback cache-disque : à chaque succès BSD, écrire `data/cache/bsd-fixtures.json` (finished + fixtures, TTL 6h). Si BSD échoue, re-scoring depuis le cache ; sinon shape vide complète.
- Widget : si `strategies` vide et `matches` (prop prematch) non vide → scoring dégradé client (stratégies forme-only, sans cotes).
- VPS : ajouter `BSD_API_KEY` à `/var/www/pariscore/.env` + `pm2 restart pariscore-next`.
- Prisma : modèles `Lineup` (matchId, teamId, player, position, isProbable, rating, isAbsence) et `BeSoccerAnalysis` (matchId unique, h2hStats JSON, refereeName, refereeYellowAvg, refereeRedAvg, weather, stadium, predictions JSON) → `bun x prisma db push`. **SQLite** (datasource du projet).

### T2 — Scraper BeSoccer
- `scripts/scrape_besoccer.py` : Scrapling `StealthyFetcher` (Camoufox) — pattern de `scripts/test-besoccer-stealth.py`. Parsers : `/match/{id}-analyse/` (probas, H2H, radar, séries), `/match/{id}/` (enjeux, faits), `/compos/` (11 probables/officiels, schéma, notes, absents), `/infos/match/` (arbitre, cartons moyens, stade, météo). Sortie `data/besoccer/{matchId}.json`.
- `scripts/sync-besoccer-db.ts` (Bun) : upsert atomique Prisma `BeSoccerAnalysis` + `Lineup` (delete+create par matchId).
- CLI : `--limit`, `--ids=id1,id2`, `--dry-run`. Cible : fixtures Top 10 (~40 matchs/jour).

### T3 — Moteur prédictif
- `src/lib/services/football-analytics.ts` :
  - λ blendé `0.5×forme + 0.5×xG` (si couverture Understat L5/L10, sinon forme seule — comportement actuel conservé).
  - Dominance Ratio `DR = xG_for/xGA` (clamp affichage 0.3–3.0) ; modulation λ ×clamp(0.8–1.25).
  - Picks ≥60% depuis matrice DC (`buildDixonColesMatrix`) : `over15` (P(total≥2), trigger xG cumulé > 2.6), `dcOver15` (P(1X) − P(1X ∧ total≤1)), `ahPlus15` outsider (1 − P(défaite ≥2)), `over05ht` (part buts 1ère MT > 65% mesurée sur `home_score_ht/away_score_ht` du pool BSD fini).
  - EV = P × cote_dé-viggée − 1 ; classement Top 10 par EV décroissant.
- Exposition : champ `picks` dans la réponse `/api/football/top5`.
- Tests bun:test : somme matrice = 1, monotonicité over15 < over05, picks bornés [0,1], EV cohérent.

### T4 — UI
- `src/components/football/lineup-pitch.tsx` : terrain vertical glassmorphism (navy + #00e676), 4-3-3 par défaut, puces joueurs positionnées (rangées GK/D/M/A), note forme colorée, badge absence rouge.
- `src/components/football/top-strategies-table.tsx` : colonnes Match · Stratégie · Proba badge (`78% · Confiance Élevée` ≥70 / moyenne 60–70) · Cote · EV · tendance (flèche drift cotes).
- `src/components/football/match-conditions-widget.tsx` : arbitre + sévérité cartons/match (jauge), stade, météo.
- `football-top10-widget.tsx` rewiré sur `top-strategies-table` ; fallback client conservé ; dark theme.
- `COMPONENTS.md` : 3 entrées ajoutées (football passe 14→17).

### T5 — Gates & deploy
- `bun run typecheck && bun run lint && bun run build` → 0 erreur.
- Deploy via `deploy.bat` (point d'entrée unique ; ajoute .env VPS d'abord). Commits conventionnels surgiques (uniquement fichiers de la mission — PAS de `git add .` global, worktree contient du snooker non lié).

### T6 — Knowledge
- `graphify update .` après le code.
- Rapport : `.context/rapport-mission-foot-debug.md` (diagnostic, changements, preuves probes, pièges).

## 4. Risques & adaptations
- BeSoccer Cloudflare : cf_clearance lié à la fingerprint navigateur — sessions StealthyFetcher réutilisées, fallback headers statiques si challenge.
- xG couverture limitée (5 ligues Understat) → picks xG-conditionnés seulement sur ligues couvertes, sinon forme pure.
- Spec mission disait PostgreSQL → SQLite (datasource Prisma du projet).
- Fallback "PowerScore" demandé → scoring dégradé client depuis les prematch déjà en prop (pas de nouvelle table).

## 5. Hors périmètre
- Migration PostgreSQL, refonte des 13 autres widgets football, cron pm2 BeSoccer (commande fournie dans le rapport, activation manuelle).
