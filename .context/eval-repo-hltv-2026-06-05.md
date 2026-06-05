# Éval Repo — gigobyte/HLTV comme SOURCE DATABASE PariScore

**Date** : 2026-06-05
**Évaluateur** : GM/CTO PariScore
**Repo cible** : https://github.com/gigobyte/HLTV
**Verdict** : 🟡 **GO-PARTIEL — DÉJÀ INTÉGRÉ** (garder comme source enrichment JSON ; NON pour feed SQLite `archive_matches` direct)

> ⚠️ Réeval suite reframe user : non plus "modèle", mais **source data DB CS2**. CS2 EST un vertical PariScore actif (`services/cs2Service.js`, `docs/cs2_hltv_deep_audit.md`, onglet CS2 prod).

---

## 1. État actuel — gigobyte/HLTV est DÉJÀ en prod

| Locus | Usage |
|---|---|
| `tools/refresh_hltv_team_mapstats.js` | `require('hltv')` → `getTeamByName()` + `getTeamStats()` → map winrates 30 teams |
| `tools/refresh_hltv_mapstats_multiwindow.js` | per-map rankings multi-fenêtre |
| `data/hltv_team_mapstats.json` + `hltv_rankings.json` | **output JSON disque** (lu 1h/24h en enrichment) |
| `services/cs2Service.js` | consomme JSON + BSD ELO + csapi.de |
| `docs/cs2_hltv_deep_audit.md` | bible intégration (Rating 3.0, OAR, filtres LAN/Top30) |

**Donc** : la question "incorporer HLTV ?" est obsolète — **c'est fait**. Vraie question = qualité comme source DB + faut-il étendre.

---

## 2. Extraction (capacités API gigobyte/HLTV)

| Champ | Valeur |
|---|---|
| **Type** | Wrapper scraper TS de HLTV.org (parsing HTML). MIT. |
| **Méthodes** | `getMatch/getMatches/getResults/getMatchStats/getMatchMapStats`, `getTeam/getTeamStats/getTeamRanking`, `getPlayer/getPlayerStats/getPlayerRanking`, `getEvent(s)/getPastEvents`, `connectToScorebot` (WS live) |
| **Données exposées** | Résultats matchs, scores, map stats, Rating joueur, rankings, events. **PAS de cotes/bookmaker** (confirmé README). |
| **Target/proba** | ❌ Aucune — données brutes, pas de prédiction. |
| **Licence** | ✅ **MIT** (réutilisable). |
| **Maintenance** | 🔴 **"No longer actively maintained"** + Cloudflare bot protection (ban IP datacenter). |

---

## 3. Analyse comme source DB

| Critère | Verdict |
|---|---|
| **Edge / circularité** | ✅ Pas de cote en sortie → **non circulaire**. Mais aussi pas de signal value direct : fournit features (map WR, Rating, form), pas de proba. OK — sert d'INPUT au moteur cs2Service, pas d'oracle. |
| **Calibration/UQD** | N/A à la source (data brute). La calibration reste à charge du moteur CS2 PariScore. |
| **Redondance** | ⚠️ Partielle : BSD CSGO fournit déjà ELO + prédictions live (30s). csapi.de fournit Rating/ADR/KAST/H2H sans CF. HLTV unique sur : **map winrates filtrables + rankings officiels + Rating 3.0/OAR**. Complémentaire, pas doublon. |
| **Feature inédite DB** | `getResults` = historique matchs CS2 → pourrait backfill une **table SQLite `cs2_matches`** (actuellement HLTV ne va QUE dans JSON disque, jamais dans `archive_matches`). C'est le seul vrai "ajout DB" possible. |
| **Compat stack** | ✅ npm `hltv` zero-config (TS compilé). Déjà installé. Mais 🔴 **CF bloque VPS** → refresh tourne en IP résidentielle locale + scp JSON vers VPS (Option A déjà en place), ou Bright Data proxy ~$3-5/mo (Option B). |
| **Risque dépendance** | 🔴 Repo **abandonné**. Si HLTV change son HTML → casse silencieuse, zéro fix upstream. Faut fork-and-own à terme. |

---

## 4. Recommandation GM — 🟡 GO-PARTIEL (statu quo + 1 extension optionnelle)

1. **GARDER l'usage actuel** (map winrates + rankings → JSON enrichment). Il marche, MIT, complémentaire de BSD/csapi.de, non circulaire. Aucune action = aucun coût. ✅
2. **NE PAS** feed SQLite `archive_matches` avec HLTV en l'état : repo non-maintenu + CF fragile = source instable pour une table persistante. Risque de polluer la DB avec des trous quand le scraper casse. ❌ pour DB durable.
3. **Extension conditionnelle** (si DG veut historique CS2 backtestable) : `getResults` → table `cs2_matches` (winner/maps/event/date), run **local IP résidentielle**, dédup, flag source. Effort ~3-4h. Mais **prérequis** : forker gigobyte/HLTV (l'abandon = bombe à retardement) OU basculer csapi.de/BSD pour les résultats. Sinon dette.

**Mitigation dépendance (recommandée quel que soit le choix)** : pin la version `hltv` dans package.json + snapshot du parser, et garder Option A (refresh local → scp) pour ne jamais exposer l'IP VPS au ban CF.

**Effort** :
- Statu quo : 0h.
- Extension `cs2_matches` DB + fork hardening : 4-6h (dont fork/pin).

---

## 5. TL;DR
HLTV = **déjà une source CS2 valable et non-circulaire, MIT, en prod via JSON**. Garde-le pour l'enrichment. Pour en faire une **vraie source DB SQLite**, le bloqueur n'est pas la valeur (elle est là) mais la **fragilité** (repo mort + CF). Donc : statu quo OUI, table DB persistante seulement après fork/hardening + décision DG sur l'historique CS2.

---

Attente : ton GO/NO-GO — option (a) statu quo seul, ou (b) statu quo + extension `cs2_matches` DB (fork hardening inclus).
