# Tennis Abstract — Extension Scraping Proposal pour Onglet Tennis PariScore

> Document : analyse homepage + extension intégration  
> Source : https://www.tennisabstract.com/  
> Date : 2026-05-15  
> Auteur : Agent (PariScore v10.9+)  
> Statut : **proposition** — étend l'intégration existante v10.8 (`/current/<EVENT>.html`).

---

## 1. Contexte

PariScore v10.8 déjà intégré : `tennisabstract.com/current/2026ATPRome.html` + `2026WTARome.html` (forecasts par tour). Cf section 3 de [proposal-tennisexplorer-scrape.md](proposal-tennisexplorer-scrape.md) et code `fetchTennisAbstractTournament(slug)` server.js.

Le site Tennis Abstract publie **30+ rapports** au-delà des pages `/current/`. Ce doc analyse leur contenu et propose extensions ciblées pour onglet Tennis.

---

## 2. robots.txt + Légal

```
User-agent: *
Disallow: /jsfrags/
Disallow: /jsmatches/
Disallow: /jsplayers/
```

- Seuls 3 paths bloqués (cache JS interne du site)
- Rapports `/reports/<name>.html` + `/current/` + `/cgi-bin/player.cgi` : **autorisés**
- Licence : non explicite côté Tennis Abstract. Data Match Charting Project = **CC BY-NC-SA 4.0** (Sackmann). Usage non-commercial OK ; SaaS payant → contact Jeff Sackmann.

---

## 3. Inventaire des rapports

### 3.1 Catalog homepage (30+ rapports)

| Category | Reports |
|----------|---------|
| **Elo Ratings** | `atp_elo_ratings.html`, `wta_elo_ratings.html` |
| **Standard Rankings** | `atpRankings.html`, `wtaRankings.html` |
| **Specialized rankings** | `leftyRankings.html`, `oneHandBackhandRankings.html`, `rankingsByAge.html` + WTA variants |
| **Country** | `countryRankings.html`, `countryRankingsWta.html` |
| **Historical** | `atp_bakery_report.html` (6-0/6-1 wins), `atp_lottery_matches.html`, `WTA_BestWhoHavent.html` |
| **Forecasts** | `atp_next_slam_report.html`, `atp_ranking_milestones.html` |
| **Match Charting Project (MCP)** | `mcp_leaders_<area>_<gender>_<career\|last52>.html` × 8 (serve/return/rally/tactics × men/women × career/52w) |
| **Daily** | `todays_birthdays.html` |
| **Tournament-specific** | `atp_surface_speed.html` |

### 3.2 Format technique commun

Tous les rapports utilisent **table avec `id="reportable"` + classe `tablesorter`** :
```html
<table id="reportable" class="tablesorter">
  <thead><tr><th>Col1</th>...<th>ColN</th></tr></thead>
  <tbody>
    <tr><td>Val1</td>...<td>ValN</td></tr>
    ...
  </tbody>
</table>
```

Parser générique possible : extraction headers `<thead>` + extraction rows `<tbody>` + lien joueur via `href="*/player.cgi?p=<id>"`.

---

## 4. Données clés pour PariScore

### 4.1 Elo Ratings (atp/wta_elo_ratings.html)

**Données** : Top ~120 joueurs ATP/WTA avec :
- **Elo** (all-surface)
- **hElo** (Hard surface)
- **cElo** (Clay surface)
- **gElo** (Grass surface)
- Peak Elo + Peak Month (historique high)
- ATP/WTA Rank officiel
- Log diff (overrated/underrated Elo vs official rank)

**Exemple ATP** (extrait au 2026-05-15) :
| Rank | Player | Age | Elo | hElo | cElo | gElo | Peak | Off Rank |
|------|--------|-----|-----|------|------|------|------|----------|
| 1 | Jannik Sinner | 24.6 | 2331 | 2268 | 2222 | 2094 | 2331 | 1 |
| 2 | Carlos Alcaraz | 22.9 | 2271 | 2198 | 2211 | 2139 | 2308 | 2 |
| 3 | Alexander Zverev | 28.9 | 2086 | 2035 | 2028 | 1898 | 2176 | 3 |

**Valeur PariScore** : cross-check avec Sackmann Elo local. TA Elo = source maintained gold-standard. Alimenter colonne "Elo surface" enrichie dans Tennis Value Bets table.

### 4.2 MCP Leaders (mcp_leaders_<area>_<gender>_<period>.html)

**Areas** : `serve`, `return`, `rally`, `tactics`  
**Period** : `career`, `last52` (52 dernières semaines)

**Données serve_last52** (exemple) : ~20 colonnes — Matches | Unret% | 1stIn% | 1stWon% | 2ndWon% | AceP% | DoubleF% | BPSavedP% | etc.

**Valeur PariScore** : afficher dans player profile modal "Top serve player last 52w?" badge ou stats avancées.

### 4.3 Lottery Matches (atp/wta_lottery_matches.html)

**Données** : Historique des matchs perdus avec DR (Dominance Ratio) < 1.05 + TPW (Total Points Won) ≈ 50% — c'est-à-dire "matchs perdus en gagnant + de points" = upsets statistiques.

**Colonnes** : Date | Tournament | Round | Winner | Loser | Score | DR | TPW | PointDiff

**Valeur PariScore** : enrichir player profile modal avec stat "lottery matches" (vulnérabilité aux retournements). Calcul : count(player as loser in lottery list) ÷ matches played.

### 4.4 Today's Birthdays (todays_birthdays.html)

**Données** : Liste des joueurs ATP/WTA fêtant leur anniversaire aujourd'hui.

**Valeur** : factoid pour landing onglet Tennis, "Birthday boost?" trivia (stat non-prédictive mais engagement UX).

### 4.5 Rankings spécialisés

- **leftyRankings** : top gauchers (effet stylistique vs droitiers)
- **oneHandBackhandRankings** : top 1-hand backhand (rare attribut)
- **rankingsByAge** : top par tranche d'âge (jeunes prospects)
- **countryRankings** : top par pays

**Valeur** : filtres avancés dans player picker / table value bets.

---

## 5. Proposition d'extension scraping

### 5.1 Module extension server.js

Étendre `tennisabstract.com` block existant (server.js post-v10.8) avec :

```js
// Catalog reports (mapping slug → URL path)
const TENNIS_ABSTRACT_REPORTS = {
  'atp-elo':            { path: '/reports/atp_elo_ratings.html',          ttl: 24 * 3600 * 1000 },
  'wta-elo':            { path: '/reports/wta_elo_ratings.html',          ttl: 24 * 3600 * 1000 },
  'atp-lottery':        { path: '/reports/atp_lottery_matches.html',      ttl: 7 * 24 * 3600 * 1000 },
  'wta-lottery':        { path: '/reports/wta_lottery_matches.html',      ttl: 7 * 24 * 3600 * 1000 },
  'mcp-serve-men-52':   { path: '/reports/mcp_leaders_serve_men_last52.html',  ttl: 7 * 24 * 3600 * 1000 },
  'mcp-serve-women-52': { path: '/reports/mcp_leaders_serve_women_last52.html', ttl: 7 * 24 * 3600 * 1000 },
  'mcp-return-men-52':  { path: '/reports/mcp_leaders_return_men_last52.html', ttl: 7 * 24 * 3600 * 1000 },
  'mcp-return-women-52':{ path: '/reports/mcp_leaders_return_women_last52.html',ttl: 7 * 24 * 3600 * 1000 },
  'birthdays':          { path: '/reports/todays_birthdays.html',         ttl: 12 * 3600 * 1000 },
};

// Generic tablesorter parser
function _taParseReportTable(html) {
  const tableM = html.match(/<table[^>]*id="reportable"[\s\S]*?<\/table>/);
  if (!tableM) return { headers: [], rows: [] };
  const block = tableM[0];
  const headM = block.match(/<thead>([\s\S]*?)<\/thead>/);
  const headers = headM ? [...headM[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)]
    .map(m => m[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()) : [];
  const bodyM = block.match(/<tbody>([\s\S]*?)(?:<\/tbody>|<\/table>)/);
  const rows = [];
  if (bodyM) {
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let trMatch;
    while ((trMatch = trRe.exec(bodyM[1])) !== null) {
      const tds = [...trMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
        .map(m => m[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
      if (tds.length) rows.push(tds);
    }
  }
  // Extract player slugs from tbody for cross-ref
  const playerLinks = [...bodyM[1].matchAll(/href="[^"]*player\.cgi\?p=([^"]+)"/g)].map(m => m[1]);
  return { headers, rows, playerLinks };
}

async function fetchTennisAbstractReport(slug) {
  const meta = TENNIS_ABSTRACT_REPORTS[slug];
  if (!meta) throw new Error(`Unknown report: ${slug}`);
  const cached = tennisAbstractReportsCache.get(slug);
  if (cached && Date.now() - cached.ts < meta.ttl) return cached.data;
  const res = await httpsGet(`https://www.tennisabstract.com${meta.path}`, {
    'Accept': 'text/html',
    'User-Agent': 'Mozilla/5.0 (PariScore)',
  });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const parsed = _taParseReportTable(res.data);
  const data = {
    slug,
    source_url: `https://www.tennisabstract.com${meta.path}`,
    fetched_at: new Date().toISOString(),
    ...parsed,
  };
  tennisAbstractReportsCache.set(slug, { ts: Date.now(), data });
  return data;
}
```

### 5.2 Route API proposée

```
GET /api/v1/tennis-abstract/report?slug=<slug>
GET /api/v1/tennis-abstract/report             → list available slugs
```

### 5.3 Use cases UI

#### UC-1 — Elo Surface Cross-Check (PRIO ALTA)

**Where** : Tennis Value Bets table — ajouter mini-tooltip au survol player name affichant `TA Elo | hElo | cElo | gElo | Δ ATP rank`.

**Why** : actuel PariScore utilise Sackmann Elo local. Cross-check TA = QA confidence.

**Effort** : 2h (hook tooltip fetch + cache map Elo by slug).

#### UC-2 — Surface specialist badge (PRIO MID)

**Where** : Tennis Value Bets row → si player.gElo_rank ≤ 10 → badge "🌱 Grass-specialist" ; clay rank ≤ 10 → "🟫 Clay-specialist".

**Why** : signal stylistique pour bet contextuel surface du tournoi.

**Effort** : 1h.

#### UC-3 — Lottery profile (PRIO BASSA)

**Where** : Player profile modal Tennis Explorer — ajouter ligne "Lottery profile: 3 losses / 27 matches in last 52w (11%)" → fragilité aux upsets.

**Why** : context utile pour évaluation underdog bet.

**Effort** : 2h (parse lottery report + count par player slug + cross-ref TE modal).

#### UC-4 — MCP Serve / Return ladder (PRIO MID)

**Where** : Section "Player insights" — petite table top 10 serve/return leaders last52w avec lien profile.

**Why** : leaderboard contextuel pour découvrir spécialistes.

**Effort** : 2h.

#### UC-5 — Today's birthdays widget (PRIO BASSA / cosmetic)

**Where** : Hot Picks / Tennis page sidebar ribbon.

**Why** : engagement UX, factoid sympa.

**Effort** : 1h.

### 5.4 Cron schedule

| Job | Fréquence | Heure Paris |
|-----|-----------|-------------|
| Refresh atp-elo + wta-elo | quotidien | 10:00 (déjà cron Tennis Abstract) |
| Refresh atp-lottery + wta-lottery | hebdo | dimanche 04:00 |
| Refresh MCP serve/return men/women last52 | hebdo | lundi 04:00 |
| Refresh birthdays | quotidien | 00:30 |

### 5.5 Estimation effort

| Phase | Effort |
|-------|--------|
| Backend parser générique `_taParseReportTable` + cache | 1h |
| Routes + 9 slugs catalog | 1h |
| Cron schedule extension | 30min |
| UC-1 Elo cross-check tooltip | 2h |
| UC-2 Surface specialist badge | 1h |
| UC-3 Lottery profile modal ext | 2h |
| UC-4 MCP ladder section | 2h |
| UC-5 Birthdays ribbon | 1h |
| Doc + tests boundary | 1h |
| **MVP recommandé (UC-1 + UC-2)** | **5.5h** |
| **Full** | **11.5h** |

---

## 6. Risques

| Risque | Mitigation |
|--------|-----------|
| HTML structure change pages reports | Parser générique → si `<table id="reportable">` absent → retourne `{ rows: [] }` + log alarmant |
| Doublon Elo (Sackmann vs TA) | TA Elo = authoritative; Sackmann conservé pour fallback offline + backtest historique (T9) |
| MCP coverage limited | MCP charts ~10-15 matchs/player/last52w → top 30 ATP/WTA covered, mid-ranked → null |
| Cloudflare anti-bot | UA identifiable + cookies session si refusé → tester en CI |
| Licence CC BY-NC-SA | Attribution Jeff Sackmann en footer onglet Tennis + non-commercial gate Pro plan |

---

## 7. Recommandation

**GO MVP UC-1 + UC-2** (Elo cross-check + Surface specialist badge) — 5.5h.  
Apport immédiat = enrichissement player context dans table value bets existante. Réutilise pipeline scraper v10.8.

**Reporter UC-3/UC-4/UC-5** post-MVP — feature ergonomie, pas critique data.

**Prochaine étape concrète** si validé :
1. Ajouter `TENNIS_ABSTRACT_REPORTS` map server.js
2. Ajouter `_taParseReportTable` + `fetchTennisAbstractReport`
3. Étendre cron `_runTennisAbstractDailyRefresh` pour inclure atp-elo + wta-elo
4. Frontend tooltip Elo sur tennis-vb-tbody player name
5. Badge surface-specialist dans row

---

*Fin du document.*
