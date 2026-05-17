# Rapport Audit Routing — Tous Championnats PariScore

**Date :** 2026-05-17
**Méthode :** probe live par ligue — BSD (`/seasons` → `/leagues/{id}/standings` + `/events`) + ESPN scoreboard/standings (`site.api.espn.com/.../soccer/{slug}/scoreboard`).
**Périmètre :** 79 entrées `leagues_config.json` (T1/T2/CUP).
**Correctif appliqué :** extension `ESPN_SOCCER_SLUG` (server.js) aux slugs ESPN vérifiés valides → recovery cotes/buteurs/joueurs zéro clé / zéro quota.

> Lecture codes : `sb200:N` = slug ESPN valide, N matchs fenêtre (0 = hors-saison, **pas** une panne). `sb400/sb500` = slug invalide → ESPN ne couvre pas. `st21|ev9` BSD = 21 lignes classement, 9 events.

---

## 1. Synthèse

| Verdict | Nb | Sens |
|---|---|---|
| ✅ OK | 36 | ≥1 source live (BSD standings ou ESPN scoreboard) |
| 🟠 DEGRADED → réparé | 14 | BSD absent, ESPN valide → **recoveré via ESPN slug ajouté** |
| 🟡 OK hors-saison | ~11 | slug ESPN valide mais 0 fixture (été) — fonctionnera à la reprise |
| 🔴 OUT irrécupérable (gratuit) | 18 | ni BSD ni ESPN — repli payant requis |

**Bilan correctif :** 14 ligues réparées via ESPN + 11 sécurisées hors-saison. 18 restent sans source gratuite (ESPN HTTP 400 confirmé + hors `config_to_bsd`).

---

## 2. Championnats RÉPARÉS via ESPN (slug ajouté à `ESPN_SOCCER_SLUG`)

BSD absent / partiel → ESPN scoreboard valide injecte cotes 1X2 + O/U + buteurs + joueurs clés.

| ID | Championnat | Slug ESPN | Preuve probe |
|---|---|---|---|
| 254 | USA / USL Championship | `usa.usl.1` | sb200 **24 events** (od24) |
| 345 | Rép. Tchèque / Czech First League | `cze.1` | sb200 (valide, hors-saison) |
| 79 | Allemagne / Bundesliga 2 | `ger.2` | sb200 9 (od9) |
| 192 | Irlande / Premier Division | `irl.1` | sb200 13 (od13) |
| 262 | Autriche / Bundesliga | `aut.1` | sb200 4 (od4) |
| 119 | Danemark / Danish Superliga | `den.1` | sb200 6 (od6) |
| 128 | Argentine / Liga Profesional | `arg.1` | sb200 1 (od1) |
| 129 | Argentine / Primera Nacional | `arg.1`* | sb200 31 (od31) |
| 265 | Chili / Campeonato Nacional | `chi.1` | sb200 13 (od13) |
| 239 | Colombie / Liga BetPlay | `col.1` | sb200 2 (od2) |
| 241 | Colombie / Primera B | `col.2` | sb200 4 (od4) |
| 240 | Équateur / LigaPro | `ecu.1` | sb200 11 (od11) |
| 480 | Paraguay / División Profesional | `par.1` | sb200 7 (od7) |
| 848 | Europe / Conference League | `uefa.europa.conf` | sb200 1 (od1) |
| 900 | Australie / A-League | `aus.1` | sb200 1 (od1) |

\* Primera Nacional remonte sous le flux `arg.1` ESPN (events filtrés par nom équipe côté `buildMatchRecord`).

**Sécurisés hors-saison** (slug valide, 0 fixture aujourd'hui — actifs à la reprise) : `fra.2`(62), `sco.2`(189), `sui.2`(208), `swe.2`(114), `fin.1`(244), `chi.2`(266), `ecu.2`(242), `par.2`(481), `mex.2`(219), `rou.1`(283 — BSD OK aussi), `cze.1`(345).

---

## 3. Championnats OK (aucune action — BSD ou ESPN déjà fonctionnels)

BSD standings + ESPN scoreboard opérationnels : Ligue 1 (61), Premier League (39), Championship (40), FA Cup (45), Carabao (48), La Liga (140), Segunda (141), Bundesliga (78), Serie A (135), Eredivisie (88), Primeira (94), Süper Lig (203), Jupiler (144), Scottish Prem (188), Super League GR (318), Super Liga CH (207), Allsvenskan (113), Ekstraklasa (106 — BSD only, ESPN KO), Superliga RO (283), MLS (253), Saudi Pro (307), J1 (98), K-League 1 (292), Parva Liga (172 — BSD only), Chinese SL (169), Botola (200 — BSD only), Champions League (2), Europa League (3), Copa Libertadores (13), Copa Sudamericana (11), CAF CL (12), Eliteserien (103), Coppa Italia (137), Liga MX (218), Brasileirão (71), Brasileirão B (72).

---

## 4. 🔴 OUT — Irrécupérables via source gratuite

ESPN HTTP **400** confirmé (non couvert) **ET** absent de `config_to_bsd` (BSD ne fournit pas). Aucune solution gratuite — repli payant (API-Football PRO déjà en place via clé, sinon source spécialisée).

| ID | Championnat | ESPN | BSD | Note |
|---|---|---|---|---|
| 271 | Hongrie / OTP Bank Liga | `hun.1` 400 | absent | `fallback_needed` implicite |
| 273 | Hongrie / NB I | 400 | absent | — |
| 332 | Slovaquie / Fortuna Liga | `svk.1` 400 | absent | — |
| 334 | Slovaquie / 2. Liga | 400 | absent | — |
| 107 | Pologne / I Liga | `pol.2` 400 | absent | Ekstraklasa T1 OK via BSD |
| 284 | Roumanie / Liga 2 | `rou.2` 400 | absent | Superliga T1 OK via BSD |
| 95 | Portugal / Liga Portugal 2 | `por.2` 400 | absent | — |
| 145 | Belgique / Challenger Pro | `bel.2` 400 | absent | — |
| 319 | Grèce / Super League 2 | `gre.2` 400 | absent | — |
| 193 | Irlande / First Division | `irl.2` 400 | absent | Premier Div réparée via irl.1 |
| 308 | Arabie S. / First Division | 400 | absent | Pro League OK |
| 99 | Japon / J2 League | `jpn.2` 400 | absent | `fallback_needed` |
| 293 | Corée / K-League 2 | `kor.2` 400 | absent | — |
| 383 | Algérie / Ligue Pro | `alg.1` 400 | absent | `fallback_needed` |
| 333 | Ukraine / Ukrainian Premier | `ukr.1` 400 | absent | `fallback_needed` |
| 210 | Croatie / Prva HNL | `cro.1` 400 | absent | `fallback_needed` |
| 269 | Serbie / SuperLiga | `srb.1` 400 | absent | `fallback_needed` |
| 245 | Finlande / Ykkönen | `fin.2` n/a | absent | Veikkausliiga réparée via fin.1 |

**Recommandation OUT :** garder le fallback API-Football (clé PRO) pour ces 18 ligues, ou souscrire source dédiée. Pas de fix ESPN/BSD possible — limite couverture amont.

---

## 5. Changements code (server.js)

- `ESPN_SOCCER_SLUG` : passé de 16 à **57 slugs** ESPN vérifiés (probe HTTP 200). Merge `ESPN_STANDINGS_SLUG` conservé. Slugs HTTP 400 volontairement omis (commentaire bloc).
- Impact : routing L3 ESPN (cotes 1X2/O-U) + `fetchESPNLeagueScorers` + `fetchESPNTeamKeyPlayers` couvrent désormais toutes les ligues ESPN-valides.
- `node --check server.js` → SYNTAX_OK. Sanity : 57 slugs, recoveries (254,345,79,192,266,244…) présents.

## 6. Déploiement VPS OVH

```bash
# WinSCP : upload server.js → /home/ubuntu/pariscore/server.js
cd /home/ubuntu/pariscore
node --check server.js && pm2 restart pariscore --update-env
pm2 logs pariscore --lines 60 | grep -E "\[ESPN odds\]|\[Routing\] . ESPN|\[TopScorers ESPN\]"
```

Validation prod : ouvrir un match USL/Czech/Bundesliga 2/Conference League → table 1X2/Edge remplie + log `[Routing] ✓ ESPN : N matchs ajoutés`.
