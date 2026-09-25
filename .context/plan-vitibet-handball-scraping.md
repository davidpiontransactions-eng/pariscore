# Plan — Vitibet Handball Quicktips → Pariscore (scraping complet)

Date : 2026-09-25 · Source : `https://www.vitibet.com/index.php?clanek=quicktips&sekce=hazena&lang=en`
Objectif : prendre le meilleur de Vitibet pour l'onglet Handball et garantir un scraping **complet** avec les meilleurs agents du stack.

---

## 1. Audit de la source

### Champs par match (carte)
| Champ | Format / exemple |
|---|---|
| Horaire | `18:30` |
| Équipes + logos | `/images/logos/handball/team_{teamId}.png` (ID stable : 176, 4858…) |
| Tip (vainqueur) | `1` / `X` / `2` (+ doubles chances 1X/X2 en analyse) |
| INDEX | float signé : `+8.96`, `-21.82` (rapport de force mathématique) |
| Probabilités | `1 65% / X 5% / 2 30%` |
| Score prédit | `36 31` |
| Lien détail | `?clanek=hazena-match-detail&fixture_id={id}&league_id={id}` |

### Fonctionnalités UI exploitables
- Onglets dates **J → J+3** (fenêtre glissante 4 jours)
- Filtres statut : `All / LIVE / Finished / Scheduled`
- Tri : **By League** / **By INDEX value** (classement des favoris)
- Liens `Table ›` par ligue, page détail match, live score + FT (tip conservé à côté du résultat → backtest gratuit)
- 53 ligues handball dont **France Starligue (34), Proligue (36), D1F (29)**, Bundesliga (39), Champions League (131/132)

### Méthodologie (à connaître pour interpréter)
- Algo mathématique pur (aucune cote bookmaker) : efficacité offensive, stabilité défensive, cycles de score, tendances saison
- **INDEX** = indicateur d'équilibre ; très positif = avantage domicile, très négatif = avantage extérieur
- Prédictions absentes = ligue avec trop peu de matchs modélisés

### Patterns d'URL (scraping)
```
/index.php?clanek=quicktips&sekce={sport}&lang={lang}          # listing (sekce: hazena|fotbal|hokej|basket|baseball)
/index.php?clanek=hazena-match-detail&fixture_id={f}&league_id={l}  # détail match
/handball/tips/{slug}/{country}/{league_id}/                     # page ligue (classement)
```

---

## 2. Le meilleur à prendre pour Pariscore

| Pri | Donnée / feature | Usage Pariscore |
|-----|------------------|-----------------|
| P0 | INDEX + probas 1/X/2 | Badge "rapport de force" sur les fiches matchs handball |
| P0 | Tip + score prédit | Section prédictive onglet Handball, croisée avec nos modèles Gemini |
| P0 | Couverture 53 ligues | Complète les ligues FR déjà en place (Starligue/Proligue/D1F) |
| P1 | Tri By INDEX value | **Top 10 matchs du jour par stratégie** (favoris les plus lourds) |
| P1 | Fenêtre J→J+3 | Calendrier prédictif "pronostics des prochains jours" |
| P1 | Divergence Vitibet vs modèle maison | Signal **value** : quand nos probas contredisent l'INDEX |
| P2 | FT + tip conservé | Backtest automatique : taux de réussite Vitibet affiché et tracké |
| P2 | Sections fotbal/hokej/basket | Réutilisation du même scraper (mêmes patterns `sekce`) |

**Hors scope** : design switcher, ads/accumulators, multi-langues (sauf cross-check qualité).

---

## 3. Architecture scraping — complétude garantie

### Couche 1 — Script Node zéro-dép (quotidien)
`scripts/scrape-vitibet.js` — calqué sur `scripts/scrape-oddalerts.js` :
- module **`https` natif** (pas d'undici/fetch), parser tolérant guillemets simples/doubles
- passe listing `hazena` sur J→J+3 → pages ligues → pages détail (`fixture_id`)
- flags : `--sport=hazena --only=ligue/ID --limit=N --dry-run --force` (skip-cache < 20h)
- écrit dans **`pariscore.db`** (convention `DATABASE_PATH || cwd/pariscore.db`), table `vitibet_tips`
- rate limit ~1 req/s, retry 3×, UA identifié Pariscore

### Couche 2 — Fallback adaptatif
- **scrapling MCP** (3 modes : static/adaptive/stealth) si le HTML change ou blocage partiel
- **FlareSolverr** (Docker VPS :8191) UNIQUEMENT si WAF Cloudflare apparaît — aujourd'hui aucun WAF détecté (fetch direct 200)
- **crawl4ai MCP** pour extraction markdown des pages d'analyse

### Couche 3 — Masse / historique / debug
- **scrapy MCP** : backfill historique matchs (saisons passées, entraînement/calibration)
- **playwright-mcp** + `browser-skill` : QA visuelle, debug sélecteurs après refontes Vitibet

### Orchestration
- Cron VPS pm2 : `pariscore-cron-vitibet` — 2 runs/jour (`05:30` et `12:00` UTC), pattern identique à `pariscore-cron-oddalerts`
- Manifeste **AX** : ajouter la Task `vitibet-handball` dans `ax/hockey-scrapers.yaml` (+ allowlist hôte `vitibet.com`, `vitisport.*`) — source de vérité unique CI/.bat/futur K8s
- Maintenance par agents : sous-agents `explore`/`test-engineer` pour audits, `deepcode-runner` pour les correctifs de parsing

---

## 4. Schéma de données

```sql
CREATE TABLE IF NOT EXISTS vitibet_tips (
  fixture_id     INTEGER NOT NULL,
  league_id      INTEGER NOT NULL,
  sport          TEXT DEFAULT 'hazena',
  date_match     TEXT,            -- AAAA-MM-JJ
  heure          TEXT,
  equipe_dom     TEXT,
  equipe_ext     TEXT,
  tip            TEXT,            -- '1' | 'X' | '2'
  index_value    REAL,
  prob_home      INTEGER,
  prob_draw      INTEGER,
  prob_away      INTEGER,
  score_predit_d INTEGER,
  score_predit_e INTEGER,
  statut         TEXT,            -- scheduled | live | finished
  score_reel_d   INTEGER,
  score_reel_e   INTEGER,
  scraped_at     TEXT,
  PRIMARY KEY (fixture_id, league_id, date_match)
);
```

---

## 5. Intégration produit (onglet Handball)

1. Carte match : badge INDEX coloré (vert favori domicile / rouge extérieur) + probas 1/X/2
2. Sous-section **"Top 10 par INDEX"** (équivalent du tri By INDEX value) → nourrit le top 10 par stratégie
3. Bandeau J→J+3 dans le calendrier handball
4. Bloc **"Vs. nos modèles"** : proba Gemini vs proba Vitibet, écarts > 15 pts surlignés (candidats value)
5. Historique : taux de réussite des tips Vitibet (backtest FT) — preuve sociale + calibration

---

## 6. Conformité & robustesse

- Étape 1 du preset Scraping Pipeline : **robots.txt + ToS vérifiés** avant prod (à rejouer à chaque changement majeur du site)
- Pas de données sous licence revendues : usage interne d'analyse, attribution "source: vitibet.com", disclaimer 18+ / jeu responsable
- Anti-régression parsing : compteurs QA (`53` ligues référencées, `8+` champs non-null par match prédit) → alerte si chute > 20 %

---

## 7. Boucle de vérification

```
1. [Recherche] robots.txt + structure HTML confirmée      → verify: 200 + parsers testés sur 3 pages
2. [Script] scripts/scrape-vitibet.js --dry-run           → verify: 0 erreur, JSON de sortie complet
3. [Store] run réel → pariscore.db                        → verify: SELECT count(*) vitibet_tips > 0
4. [Cron] pm2 + manifest AX                               → verify: run planifié OK sur VPS
5. [UI] enrichissement onglet Handball                    → verify: lint + typecheck 0 erreur + QA visuelle
6. [Backtest] rapprochement FT vs tips J-7                → verify: taux de réussite calculé et affiché
```

## 8. Risques

| Risque | Mitigation |
|---|---|
| Refonte HTML Vitibet | parser tolérant + QA compteurs + fallback scrapling |
| Apparition WAF Cloudflare | FlareSolverr déjà en place sur le VPS |
| Trop peu de matchs prédits (ex: 8/32) | afficher les "–" comme non prédit, jamais inventer |
| ToS / robots | vérif initiale + re-check trimestriel |

---

## T4 — Runbook VPS (orchestration)

> **Exécution VPS = étape manuelle via `scripts\deploy-runner.ps1` ou SSH — pas faite par l'agent.**
> Fichiers préparés localement : `ecosystem.config.js` (2 entrées pm2) + `ax/hockey-scrapers.yaml` (Task `vitibet-handball`).

### Enregistrement pm2 (sur le VPS, ubuntu@51.75.21.239)

```bash
cd /home/ubuntu/pariscore
# 2 runs/jour : 05:30 UTC (matin) + 12:00 UTC (midi) — minutes différentes = 2 entrées
pm2 startOrRestart ecosystem.config.js --only pariscore-cron-vitibet --update-env
pm2 startOrRestart ecosystem.config.js --only pariscore-cron-vitibet-pm --update-env
pm2 save
```

### Vérification des logs

```bash
pm2 ls | grep vitibet                      # les 2 entrées doivent être 'online'
pm2 logs pariscore-cron-vitibet --lines 50 --nostream
pm2 logs pariscore-cron-vitibet-pm --lines 50 --nostream
# fichiers : logs/cron-vitibet.{out,err}.log et logs/cron-vitibet-pm.{out,err}.log
# ligne de fin attendue : "[vitibet] terminé : écrits=N skip-cache=M ..." + "table vitibet_tips : X lignes"
```

### Test manuel (identique en local et sur le VPS)

```bash
node scripts/scrape-vitibet.js --dry-run   # parse J→J+3 sans écrire — 0 erreur attendue
node scripts/scrape-vitibet.js --limit=5   # smoke test avec écriture DB
```
