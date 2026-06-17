# 🔍 RAPPORT D'AUDIT COMPLET — TennisExplorer.com comme source de données scrapée

**Date** : 2026-06-17  
**Projet** : PariScore — Pipeline données tennis  
**Auteur** : Audit automatisé  

---

## TABLE DES MATIÈRES

1. Résumé exécutif
2. Pages auditées et endpoints
3. Structure HTML — Calendrier (ATP + WTA)
4. Structure HTML — Matchs Live
5. Structure HTML — Résultats
6. Structure HTML — Profil joueur
7. Structure HTML — Détail Match (odds H2H)
8. Implémentation actuelle dans PariScore
9. Analyse des risques
10. Recommandations
11. Spécifications techniques pour le scraping

---

## 1. RÉSUMÉ EXÉCUTIF

**TennisExplorer.com** est une source de données tennis extrêmement riche et viable pour le scraping :
- ✅ **Calendrier** complet ATP/WTA de l'année (prize money, surface, draw, vainqueur)
- ✅ **Matchs live** en temps réel (score, sets, point en cours, serveur)
- ✅ **Résultats** avec scores détaillés et cotes bookmakers (15+ bookmakers)
- ✅ **Profils joueurs** (classement, stats, historique, photo)
- ✅ **H2H** détaillé avec cotes en temps réel
- ✅ **Structure HTML stable** (tableaux avec classes CSS dédiées)
- ✅ **Pas de Cloudflare** (accessible en curl/Node natif)

**Risques identifiés** : overlay CMP (consentement cookies), rate-limiting implicite, changements HTML occasionnels.

---

## 2. PAGES AUDITÉES ET ENDPOINTS

| Page | URL | Contenu |
|------|-----|---------|
| Calendrier ATP | /calendar/atp-men/ | Tous les tournois de l'année |
| Calendrier WTA | /calendar/wta-women/ | Tous les tournois de l'année |
| Matchs Live | /live/ | Matchs en cours, scores temps réel |
| Résultats | /results/ | Matchs terminés, scores, cotes |
| Profil joueur | /player/{slug}/ | Stats, classement, historique |
| Détail match | /match-detail/?id={id} | H2H, cotes (15+ books), stats pré-match |

---

## 3. STRUCTURE HTML — CALENDRIER (ATP + WTA)

### 3.1 Tableau principal

`html
<table id="tournamentList" class="result" cellspacing="0">
  <thead>
    <tr class="head">
      <td class="shortdate">Started</td>
      <td>Tournament</td>
      <td class="surface">Surface</td>
      <td class="prize">Prize money</td>
      <td class="draw" title="number of players in tournament">Draws</td>
      <td class="winner">Winner</td>
    </tr>
  </thead>
  <tbody>...</tbody>
</table>
`

✅ **Classe id="tournamentList" utilisée par le parser actuel** — toujours valide.

### 3.2 Structure d'un tournoi (2 lignes consécutives)

Chaque tournoi = EXACTEMENT 2 <tr> (simple + double) :

`html
<!-- LIGNE 1 : simple -->
<tr id="first-actual-main" class="one actual" data-type="main">
  <td class="first shortdate" rowspan="2">15.06.<br>2026</td>
  <th class="t-name" rowspan="2">
    <a href="/halle/2026/atp-men/"><strong>Halle</strong></a>           <!-- SANS span -->
    <!-- OU avec span pour les noms longs : -->
    <a href="/asuncion-2-challenger/2026/atp-men/">
      <strong><span title="Asuncion 2 challenger">Asuncion 2 chall.</span></strong>
    </a>
  </th>
  <td class="s-color" rowspan="2">
    <span title="Grass" style="background-color:#559B43">&nbsp;</span>
  </td>
  <td class="tr" rowspan="2">2,583,330 €</td>
  <td class="draw" title="number of players in singles">32</td>
  <td> - </td>                                          <!-- OU <td class="t-name"><a href="/player/...">Nom J.</a></td> -->
</tr>

<!-- LIGNE 2 : double -->
<tr class="one actual" data-type="main">
  <td class="draw" title="number of pairs in doubles">16</td>
  <td class="winner">-</td>
</tr>
`

### 3.3 Classes CSS clés

| Classe | Usage | Note |
|--------|-------|------|
| one / 	wo | Alternance visuelle | Les 2 lignes d'un même tournoi portent la MÊME classe |
| ctual | Semaine en cours | Présente uniquement sur les tournois récents |
| data-type="main" | Tournoi ATP/WTA principal | GS, M1000, 500, 250 |
| data-type="lower" | Niveau inférieur | Challenger, ITF, UTR |
| data-type="exhibitions" | Exhibitions | Kooyong, UTS, etc. |
| id="first-actual-*" | Premier tournoi visible | Ancre de scroll |

### 3.4 Séparateurs mensuels

`html
<tr class="head month">
  <td class="tl" colspan="6">June 2026</td>
</tr>
`

### 3.5 Mapping surface → couleur

| Surface | Couleur |
|---------|---------|
| Grass | #559B43 |
| Clay | #C97D47 |
| Hard | #43749B |
| Carpet | (non trouvé récemment) |
| Indoor | #8D8D8D |
| Aucune (&nbsp;) | Davis Cup, BJK Cup |

### 3.6 Différences ATP vs WTA

- Structure HTML **IDENTIQUE**
- URLs : /atp-men/ vs /wta-women/
- WTA a davantage d'ITF (tournois à 15k/30k)
- Les ITF WTA portent le suffixe "ITF" dans le nom → détectables

---

## 4. STRUCTURE HTML — MATCHS LIVE

### 4.1 Organisation par tournoi

`
[Halle Open]                    ← en-tête de bloc
Court 1 10:00 Live             ← court + heure + statut
Shelton B. (3)                 ← joueur 1 + seed
S 1/6/7                         ← S=serve, scores sets
Bergs Z.                       ← joueur 2
P 0/1                           ← P=reçoit
`

### 4.2 Données disponibles

| Champ | Présent | Format |
|-------|---------|--------|
| Nom tournoi | ✅ | Texte brut |
| Court | ✅ | Court X ou Centre Court |
| Heure | ✅ | HH:MM |
| Statut | ✅ | Live, 2nd Set, Cancelled |
| Joueurs + seed | ✅ | Nom P. (3) ou Nom P. (wc) |
| Indicateur service | ✅ | S (sert), P (reçoit), A |
| Sets | ✅ | 1/6/7 (par set) |
| Point en cours | ✅ | 15, 30, 40, Ad |

### 4.3 ⚠️ Pas de structure CSS évidente

Le live semble être en <table> sans classes indentifiables en extraction texte. À confirmer avec le HTML brut.

---

## 5. STRUCTURE HTML — RÉSULTATS

### 5.1 Organisation

`
[Halle]                        ← en-tête de tournoi
S 1 2 3 4 5 H A               ← colonnes (Sets/Scores/Cotes)
11:40 Quinn E. 2 1 6 6        ← résultat
      Khachanov K. 1 6 4 4
`

### 5.2 Colonnes

| Position | Contenu | Description |
|----------|---------|-------------|
| 1 | HH:MM | Heure début |
| 2 | Joueur 1 | Nom + lien |
| 3-7 | 2 1 6 6 | Sets gagnés + scores |
| 8-9 | 2.91 1.41 | Cotes H/A |
| 10 | [info] | Lien vers détail |

### 5.3 ✅ Key finding : les cotes sont disponibles

Pour chaque match terminé, les cotes **Home** et **Away** sont présentes — idéal pour le backtesting et l'analyse de value.

---

## 6. STRUCTURE HTML — PROFIL JOUEUR

### 6.1 URL pattern

`
/player/{slug}/
`

Slug exemples : sinner-8b8e8, shelton-38989, lcaraz-5ab70

### 6.2 Données disponibles

| Champ | Présent | Format |
|-------|---------|--------|
| Nom complet | ✅ | Sinner Jannik |
| Classement actuel | ✅ | 5. |
| Meilleur classement | ✅ | 1. |
| Points | ✅ | 11,330 |
| Date naissance | ✅ | 16.8.2001 |
| Taille/Poids | ✅ | 188 cm / 78 kg |
| Main | ✅ | ight / left |
| Revers | ✅ | 	wo-hander / one-hander |
| Pays | ✅ | Drapeau + nom |
| Photo | ✅ | Image URL |
| W/L par surface | ✅ | Tableau |
| Titres | ✅ | Par surface |
| Historique matchs | ✅ | Par année |

---

## 7. STRUCTURE HTML — DÉTAIL MATCH (Odds + H2H)

### 7.1 URL pattern

`
/match-detail/?id={numeric_id}
`

Ex : /match-detail/?id=3238827

### 7.2 Sections

| Section | Contenu | Présent |
|---------|---------|---------|
| En-tête | Tournoi, round, surface, date, heure | ✅ |
| Tableau joueurs | Nom, ranking, taille, âge, main | ✅ |
| Liens streaming | 6+ bookmakers (bet365, Pinnacle...) | ✅ |
| W/L 2026 par surface | Tableau comparatif | ✅ |
| Head-to-Head | Matchs précédents avec scores | ✅ |
| **Cotes bookmakers** | **15+ bookmakers, 4 catégories** | ✅ |
| Derniers matchs | 10 derniers matchs par joueur | ✅ |

### 7.3 Catégories de cotes disponibles

| Catégorie | Nb de books | Exemple |
|-----------|-------------|---------|
| Home/Away (1X2) | 15 | Shelton 1.22 / Sonego 4.00 |
| Over/Under | 47 | O/U 22.5 games |
| Asian Handicap | 60 | -4.5 / +4.5 |
| Correct Score | 36 | 2-0 / 2-1 |

---

## 8. IMPLÉMENTATION ACTUELLE DANS PariScore

### 8.1 Fichiers concernés

| Fichier | Fonction | Usage |
|---------|----------|-------|
| server.js:28722 | _texFetchHtml() | Fetch HTML avec User-Agent custom + cookie timezone |
| server.js:28878 | _texParseCalendar() | Parse le calendrier ATP/WTA |
| server.js:28935 | _texTournamentCategory() | Détecte catégorie (GS, M1000...) |
| server.js:28952 | etchTexCalendar() | Orchestrateur avec cache + filtres |
| server.js:29728 | etchTexMatchDetail() | Parse la page détail match |
| server.js:29536 | etchTexPlayer() | Parse le profil joueur |
| pariscore.js:4781 | loadTexCalendar() | Rendu frontend du calendrier |

### 8.2 Points forts de l'implémentation

- ✅ Cache 24h avec invalidation
- ✅ User-Agent identifié (PariScore/2.0 +https://pariscore.render.com)
- ✅ Cookie timezone correct
- ✅ Filtre ctual (semaine courante uniquement)
- ✅ Filtre ITF/Challenger
- ✅ Filtre temporel (2 mois max)
- ✅ Catégorisation des tournois
- ✅ Tri par importance
- ✅ ✅ Regex 
ameM réparée pour les 2 formats (avec/sans <span>)

### 8.3 Points faibles / à améliorer

| Problème | Priorité | Suggestion |
|----------|----------|------------|
| Pas de scraping des matchs live TEX | 🟢 Low | Utiliser Sofascore pour le live (données JSON déjà disponibles) |
| Pas de scraping des cotes résultats | 🟡 Medium | Ajouter /results/ pour backtesting des odds |
| CSS du détail match non parseur | 🟢 Low | Seulement si besoin des odds détaillés |
| Aucun fallback si TEX est down | 🟡 Medium | Ajouter cache de secours (fichier JSON statique) |
| Rate limiting non implémenté | 🟡 Medium | Ajouter délai entre les requêtes |
| Overlay CMP (cookies) non géré | 🟢 Low | Cookie my_timezone=0 suffit pour l'instant |
| Noms de surface Indoor/Carpet manquants | 🟢 Low | Ajouter Indoor et Carpet au mapping frontend |

---

## 9. ANALYSE DES RISQUES

### 9.1 Risques techniques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Changement structure HTML tableau | 🟡 Moyenne | 🔴 Élevé | Tests de non-régression hebdomadaires |
| Blocage IP (rate limiting) | 🟢 Faible | 🟡 Moyen | Cache 24h + 1 req/jour suffit |
| Cloudflare activé | 🟢 Faible | 🔴 Élevé | User-Agent browser + headers complets |
| Overlay CMP modifié | 🟢 Faible | 🟢 Faible | Cookie déjà géré |
| Site ferme | 🟢 Très faible | 🔴 Élevé | Fallback Sofascore + GitHub tennis-data |

### 9.2 Risques données

| Problème | Impact | Note |
|----------|--------|------|
| Cotes absentes pour les petits tournois | 🟡 Moyen | Challenger/ITF rarement cotés |
| Noms de tournois en abrégé | 🟢 Faible | Le 	itle du <span> donne le nom complet |
| Surface manquante (Davis Cup) | 🟢 Faible | Cas marginaux, surface = null |
| Retard live (5-10min) | 🟢 Faible | Normal pour un site gratuit |

---

## 10. RECOMMANDATIONS

### 10.1 Architecture scraping recommandée

`
TennisExplorer.com
    │
    ├── /calendar/atp-men/        ← Calendrier ATP (1x/jour, TTL 24h)
    ├── /calendar/wta-women/      ← Calendrier WTA (1x/jour, TTL 24h)
    ├── /results/                 ← Résultats + cotes (1x/jour, batch)
    ├── /live/                    ← Matchs live (si besoin temps réel)
    ├── /match-detail/?id={id}    ← Détail match + odds (à la demande)
    └── /player/{slug}/           ← Profil joueur (à la demande)
`

### 10.2 Priorités d'implémentation

1. ✅ **Calendrier** (déjà fait, réparé)
2. 🟡 **Résultats** → backtesting des cotes, analyse des value bets
3. 🟢 **Profils joueurs** → enrichissement des données (taille, âge, main)
4. 🟢 **Détail match** → odds détaillés pour analyse des écarts de marché
5. 🟢 **Live** → si nécessaire pour le scoreboard temps réel

### 10.3 Stack technique

`javascript
// Fonction de fetch générique pour TEX
async function texFetch(path, ttl = 24 * 3600 * 1000) {
    const cacheKey = 	ex_;
    const cached = texCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < ttl) return cached.data;
    
    const html = await _texFetchHtml(path);  // déjà existant
    // parser spécifique selon le path
    const data = parseTexPage(path, html);
    
    texCache.set(cacheKey, { ts: Date.now(), data });
    return data;
}
`

### 10.4 Métriques de qualité

| Métrique | Objectif | Mesure |
|----------|----------|--------|
| Taux de succès fetch | >99% | _texFetchHtml status 200 |
| Complétude des noms | 100% | 	.name !== null |
| Complétude surfaces | >95% | 	.surface !== null (sauf Davis/BJK) |
| Fraîcheur cache | <24h | TTL configurable |
| Temps de réponse API | <500ms | Toujours en cache hit |

---

## 11. SPÉCIFICATIONS TECHNIQUES POUR LE SCRAPING

### 11.1 Headers HTTP requis

`
User-Agent: Mozilla/5.0 (PariScore/2.0 +https://pariscore.render.com)
Accept: text/html,application/xhtml+xml
Cookie: my_timezone=0
`

### 11.2 URLs complètes

| Donnée | URL | Méthode |
|--------|-----|---------|
| Calendrier ATP | https://www.tennisexplorer.com/calendar/atp-men/ | GET |
| Calendrier ATP année N | https://www.tennisexplorer.com/calendar/atp-men/2025/ | GET |
| Calendrier WTA | https://www.tennisexplorer.com/calendar/wta-women/ | GET |
| Matchs live | https://www.tennisexplorer.com/live/ | GET |
| Résultats | https://www.tennisexplorer.com/results/ | GET |
| Détail match | https://www.tennisexplorer.com/match-detail/?id={id} | GET |
| Profil joueur | https://www.tennisexplorer.com/player/{slug}/ | GET |

### 11.3 Regex de parsing (état actuel des correctifs)

`javascript
// ✅ Tableau calendrier
const tableM = html.match(/<table id="tournamentList"[^>]*>([\s\S]*)/);

// ✅ Lignes de la semaine courante
const trRe = /<tr[^>]+class="(one|two) actual"[^>]*>([\s\S]*?)(?=<tr |<\/tbody>)/g;

// ✅ Date (2 formats)
const dateM = tr.match(/<td class="first shortdate[^"]*"[^>]*>([^<]*?)<br\s*\/?\s*>?([^<]*)</);

// ✅ Nom (avec ou sans <span>) — CORRIGÉ v2
const nameM = tr.match(/<a href="(\/[^"]+)"[^>]*><strong>(?:<span[^>]*title="([^"]*)"[^>]*>([^<]*)<\/span>|([^<]+))<\/strong><\/a>/);

// ✅ Surface (avec fallback &nbsp;) — CORRIGÉ v2
const surfM = tr.match(/<td class="s-color"[^>]*>(?:<span title="(Clay|Hard|Grass|Carpet|Indoor)"|&nbsp;)/);

// ✅ Prize money
const prizeM = tr.match(/<td class="tr"[^>]*>([^<]+)</);

// ✅ Draw
const drawM = tr.match(/<td class="draw"[^>]*>(\d+)<\/td>/);
`

### 11.4 Structure de données en sortie

`json
{
  "tour": "ATP",
  "source_url": "https://www.tennisexplorer.com/calendar/atp-men/",
  "fetched_at": "2026-06-17T09:00:00.000Z",
  "count": 6,
  "tournaments": [
    {
      "start_date": "15.06.2026",
      "url": "https://www.tennisexplorer.com/halle/2026/atp-men/",
      "name": "Halle",
      "short": "Halle",
      "surface": "Grass",
      "prize": "2,583,330 €",
      "singles_draw": 32,
      "doubles_draw": 16,
      "singles_winner": null,
      "doubles_winner": null,
      "category": "atp_500"
    }
  ]
}
`

---

## ANNEXE A : Log des changements du parser

| Date | Changement | Raison |
|------|-----------|--------|
| 2026-06-16 | Version initiale | SPRINT CALENDAR_REFRACTOR |
| 2026-06-17 | Fix regex nameM (span + sans-span) | TennisExplorer a changé son HTML |
| 2026-06-17 | Fix null → 'itf' | Les noms null n'étaient pas filtrés |
| 2026-06-17 | Ajout filtre temporel 2 mois | Les vieux tournois de janvier apparaissaient |
| 2026-06-17 | Surface fallback &nbsp; | Davis Cup/BJK Cup sans surface affichée |

---

## ANNEXE B : Comparaison des sources

| Critère | TennisExplorer | Flashscore/Sofascore | GitHub tennis-data |
|---------|---------------|---------------------|-------------------|
| Calendrier complet | ✅ Oui | ✅ Oui | ⚠️ Annuel |
| Prize money | ✅ Oui | ❌ Non | ✅ Variable |
| Surface | ✅ Oui | ✅ Oui | ✅ Oui |
| Draw simple+double | ✅ Oui | ❌ Non | ✅ Variable |
| Cotes bookmakers | ✅ Oui (15+ books) | ✅ Oui | ❌ Non |
| H2H | ✅ Oui | ✅ Oui | ❌ Non |
| Profils joueurs | ✅ Oui | ✅ Oui | ❌ Non |
| Live temps réel | ⚠️ 5-10min retard | ✅ Temps réel | ❌ Non |
| Blocage | ✅ Aucun (curl OK) | ⚠️ Cloudflare | ✅ Aucun |
| Stabilité | ⚠️ HTML changeable | ⚠️ API privée | ✅ JSON stable |
| TTL recommandé | 24h | 5-15min | 24-48h |

