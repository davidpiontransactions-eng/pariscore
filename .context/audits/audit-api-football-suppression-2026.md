# Audit — Suppression du routing API-Football

> Date : 2026-05-19 · Auteur : GM PariScore · Fichier analysé : `server.js` (~25 488 lignes)
> Objet : cartographier ce qu'API-Football alimente, déterminer le double-routing (fallback) par champ, et l'impact d'une suppression.

---

## 0. Verdict express

**API-Football N'EST PAS supprimable en l'état sans perdre 5 features.**

- ~23 points d'appel API-Football (`v3.football.api-sports.io` + CDN `media.api-sports.io`).
- Beaucoup de champs ont un **double-routing** (BSD → ESPN → Sofascore → local) : suppression sans impact.
- **5 blocs orphelins** (zéro fallback) : stats avancées équipe, ratings joueurs par poste, enrichissement bio joueur, prédictions, transferts.
- CDN photos/logos = clé-zéro public → **non concerné** par la suppression de la clé (continue de marcher).

---

## 1. Points d'appel API-Football

| Ligne | Endpoint | Fonction |
|---|---|---|
| 456 | `/teams` | `fetchAPIFootballTeamId()` |
| 677 | `/players` | `fetchAPIFootballPlayer()` |
| 5810 / 5888 | `/fixtures?status=FT` | `archivePastMatches()` (scores finaux) |
| 6441 | `/teams/statistics` | `fetchTeamAdvancedStats()` |
| 6572 | `/predictions` | `fetchAFPredictions()` |
| 6613 | `/transfers` | `fetchAFTransfers()` |
| 7246 | `/players/topscorers` | `fetchTopScorersLeague()` (phase 3) |
| 7278 | `/players` | `fetchBackupPlayers()` (fallback) |
| 7422 / 7470 | `/players` | `fetchTeamPositionRatings()` |
| 7597 | `/players` | `splitTeamPlayers()` |
| 8296 | `/fixtures/headtohead` | `fetchH2H()` |
| 8429 | `/fixtures?team&last` | `fetchTeamLastFixtures()` |
| 8855 / 8856 | `/players/topscorers` + `/topassists` | `fetchApifTopPlayersByLeague()` |
| 9948 / 9966 | `/standings` | `fetchStats()` phase 2 fallback |
| 10136 | `/fixtures?date` | `fetchFixturesFromAPIFootballByDateRange()` |
| 22640 / 22643 | `/odds?bet=1` / `bet=5` | route cotes custom |
| CDN 434 / 7292 + html 15001/16684/18106 | `media.api-sports.io` photos/logos | clé-zéro (non concerné) |

---

## 2. Champs alimentés → double-routing

### ✅ Champs AVEC double-routing (suppression = OK, dégradation faible)

| Champ / feature | Primaire | Fallback(s) | Niveau si AF off |
|---|---|---|---|
| **Standings** `db.teamStats` (rank, form, played/wins/draws/losses, splits home/away, ppg) | BSD `/standing` | API-Football → **ESPN** `/scoreboard` → **Sofascore** `/team` → `simStats()` | Faible (AF n'était que phase 2) |
| **Top scorers** `db.topScorers` (buts) | BSD `/player-stats` | ESPN scoreboard → AF `/players/topscorers` | Faible |
| **Scores finaux** (archivage / backtest `history.realScore`) | BSD `/events?finished` | AF `/fixtures?status=FT` | Faible (BSD primaire) |
| **H2H** confrontations | AF `/fixtures/headtohead` | **`fetchLocalH2H()`** (archive_matches + db.matches local) | Faible (local couvre l'essentiel) |
| **Key players (noms)** | ESPN `fetchESPNTeamKeyPlayers` | BSD `/player-stats?team` → AF `/players` | Faible |
| **Logos équipe** (CDN) | `media.api-sports.io` clé-zéro | Sofascore CDN → backend `/api/v1/team-logo` | Aucun (CDN public) |
| **Photos joueur** (CDN) | `media.api-sports.io` clé-zéro | TheSportsDB → backend | Aucun (CDN public) |

> Le CDN `media.api-sports.io` ne nécessite **aucune clé** : il survit à la suppression de `API_FOOTBALL_KEY`. SEUL bémol : l'URL photo joueur a besoin de l'`api_football_id` (voir orphelin #3).

### 🔴 Champs ORPHELINS (zéro fallback — suppression = perte feature)

| # | Bloc / champs | Source unique | Impact suppression |
|---|---|---|---|
| 1 | **Stats avancées équipe** `db.advancedTeamStats` : `goals_scored/conceded_home/away_avg`, `form`, `played/wins/draws/losses_home/away`, `shots_on/total`, `cards_yellow/red`, `clean_sheet_*`, `main_formation` | API-Football `/teams/statistics` | Table Stats Avancées + insights équipe vides. FBref ne couvre que tirs/gardien (partiel). ⚠️ certains `*_avg` nourrissent le Poisson sur ligues sans BSD |
| 2 | **Ratings joueurs par poste** (Attaquants/Milieux/Défenseurs : rating, buts, passes moy.) | AF `/players` (`fetchTeamPositionRatings`/`splitTeamPlayers`) | Section Player Cards top 3 par poste vide |
| 3 | **Enrichissement bio joueur** : `api_football_id`, âge, naissance, nationalité, taille, poids, blessé, stats saison | AF `/players` (`fetchAPIFootballPlayer`) | Fiche joueur vide ; **URL photo CDN cassée** (besoin de l'id) |
| 4 | **Prédictions par match** : winner_id, win_or_draw, under_over, goals_home/away, advice, percent_home/draw/away | AF `/predictions` | Section « Prédiction Expert » du modal Insights vide. BSD `/predictions` existe mais qualité/format différents (non câblé en fallback) |
| 5 | **Transferts joueur** (in/out, date, type, club) + **classement passes décisives** (`/topassists`) | AF `/transfers`, `/players/topassists` | Historique transferts + ranking passes vides |

---

## 3. Fonctions mortes si AF supprimé

100 % AF (deviennent dead code) :
`fetchAPIFootballTeamId` (449) · `fetchAPIFootballPlayer` (651) · `fetchTeamAdvancedStats` (6426) · `fetchAFPredictions` (6563) · `fetchAFTransfers` (6604) · `fetchTeamPositionRatings` (7462) · `splitTeamPlayers` (7594) · `fetchTeamLastFixtures` (8423) · `fetchApifTopPlayersByLeague` (8843) · phase 2 standings (9932-9966).

Dégradées (gardent un autre chemin) :
`fetchStats` (phase 2 optionnelle) · `archivePastMatches` (BSD phase 1) · `fetchH2H` (→ `fetchLocalH2H`) · `fetchTopScorersLeague` (AF = phase 3) · `fetchBackupPlayers` (AF = dernier fallback).

Routes dégradées :
`GET /api/v1/team/:id/stats/advanced` → 503 · `GET /api/v1/team/:id/players/key` → vide · `GET /api/v1/player/:name/detail` → partiel (pas d'id/photo) · `GET /api/v1/standings` → BSD/ESPN/Sofa only.

---

## 4. Recommandation GM

API-Football est **déjà en position de fallback** sur la data critique (standings, scores, scorers) — BSD/ESPN sont primaires. C'est sain. Le vrai coût d'AF = les **5 blocs orphelins** (features secondaires : stats avancées, ratings poste, bio, prédictions, transferts).

3 scénarios :

| Scénario | Action | Conséquence | Coût |
|---|---|---|---|
| **A — Garder AF** (reco court terme) | ne rien supprimer ; corriger doc CLAUDE.md (AF = FREE pas PRO) ; AF reste fallback | zéro régression | 0 € (free) ou 18 €/mois si PRO voulu pour saison courante |
| **B — Suppression partielle** | retirer SEULEMENT les chemins double-routés + sunset assumé des 5 orphelins (features off, UI masquée proprement) | perd 5 features secondaires ; data cœur (matchs/Poisson/value bets) intacte via BSD/ESPN | 0 € |
| **C — Suppression totale brute** | delete tout routing AF maintenant | casse 5 features + risque Poisson sur ligues sans BSD (orphelin #1) + photos joueur cassées (orphelin #3) | 0 € mais régression UX |

**Reco : Scénario B** si l'objectif est de tuer la dépendance/quota AF — mais il faut d'abord :
1. Confirmer qu'on assume la perte des 5 features (ou les remplacer : BSD `/predictions` câblé en fallback #4, TheSportsDB+cache pour bio #3).
2. Vérifier orphelin #1 : lister les ligues qui dépendent d'AF pour `*_avg` Poisson (sans BSD ni ESPN) → sinon Poisson dégradé sur ces ligues.
3. Masquer proprement les sections UI orphelines (pas de blocs vides/erreurs).

**Suppression non effectuée** : action destructive multi-fichiers + 5 orphelins confirmés → attente GO + choix scénario.
