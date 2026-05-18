# Rapport de Mission — Optimisation Premium Colonne 2 « Match » (Tennis Desktop)

> **Statut : CADRAGE / CONCEPTION — non implémenté.** Aucune modification de `pariscore.html` n'a été effectuée dans le cadre de ce rapport. Le code décrit ci-dessous est une spécification soumise à validation (GO explicite requis).
> **Date :** 2026-05-18 · **Périmètre :** Colonne 2 du tableau `#tennis-vb-table` (Version Bureau uniquement).

---

## 1. Composition de l'équipe d'experts (table ronde virtuelle)

| Agent | Rôle | Mandat |
|-------|------|--------|
| `[UX-DESIGN-PRO]` | Expert UI/UX — interfaces trading Fintech | Hiérarchie visuelle, « facteur sexy », charge cognitive, alignement pixel |
| `[BET-PRO-QUANT]` | Analyste quantitatif / parieur pro | Pureté du signal, élimination du bruit, lisibilité décisionnelle |
| `[ARCHI-DATA-ENG]` | Architecte système senior | Scraping Tennis Abstract, API BSD, stratégie de cache, anti-ban IP |

---

## 2. Verbatim des échanges techniques

### Tour 1 — Cadrage du problème

**`[BET-PRO-QUANT]`** : « État actuel : RK + 3 puces plates déjà en prod. Le signal est bon — rang Elo *surface-spécifique* + forme 90j *même surface* — c'est exactement la donnée pro. Mon exigence : ne PAS dégrader le ratio signal/bruit. Une décoration néon qui clignote ou sature détruit la lecture en scan rapide d'une grille de 40 lignes. Le glow doit être *sémantique* (vert = momentum positif), jamais ornemental. »

**`[UX-DESIGN-PRO]`** : « D'accord sur la sobriété, mais la grille actuelle est plate et inerte — elle ne se vend pas. Le levier premium n'est pas le clignotement : c'est la *profondeur*. Un liseré néon thématique sur le badge RK (1px, teinte = surface du jour) crée une cohérence chromatique gratuite entre Col1 (badge surface), Col2 (RK) et Col3 (scoreboard). Le `box-shadow` sur les puces W/L doit être un halo *statique* `0 0 6px`, pas une animation. Profond, pas tape-à-l'œil. »

**`[ARCHI-DATA-ENG]`** : « Côté données, l'infra existe déjà : `tennis_elo` (4391 lignes) + `tennis_matches` (24995 lignes) en SQLite local, alimentés par le sync Sackmann/Tennis Abstract. Le rang surface et la forme 90j se calculent en pur SQL indexé — pas de scrape à chaud, pas de risque de ban. La demande du brief d'une route `/api/v1/tennis/player-stats` + cache JSON 12h est défendable pour découpler, mais aujourd'hui la donnée est déjà injectée dans le payload `value-bets` (cache 30 min mémoire). Décision d'architecture à arbitrer ci-dessous. »

### Tour 2 — Forme du signal

**`[BET-PRO-QUANT]`** : « 3 puces est le bon nombre. 5 = surcharge sur 40 lignes ; 1 = anecdotique. 3 capture la tendance courte sans bruit. Ordre : **récent → ancien** (gauche = dernier match), c'est la convention Flashscore/Sofascore que le parieur lit déjà sans effort. Si < 3 matchs sur la surface en 90j : puces neutres `·` grises — surtout ne PAS inventer ni élargir à une autre surface (ça fausse l'analyse). »

**`[UX-DESIGN-PRO]`** : « Le nom du joueur reste l'ancre : **blanc `#e8eaed`, poids 700**. Le favori Elo garde son vert (`tvb-pfav`). Le badge RK est secondaire : `DM Mono`, 9px, `opacity .85`, liseré néon surface 1px. Les puces sont tertiaires mais doivent rester *lisibles à 14px* — c'est la taille plancher. Hiérarchie : Nom > Forme (pattern visuel) > RK (chiffre de précision). »

**`[ARCHI-DATA-ENG]`** : « Contrainte alignement : Col3 = micro-scoreboard 2 lignes (J1/J2) sur grille 5 ou 7 colonnes. Col2 DOIT être structurée en 2 sous-lignes indépendantes, hauteur de ligne identique, gap identique (3px), pour un alignement J1↔J1 / J2↔J2 au pixel. Toute hauteur variable (wrap du nom long) casse la synchro — prévoir `white-space:nowrap` + ellipsis sur le nom. »

### Tour 3 — Convergence

**`[UX-DESIGN-PRO]`** : « Consensus : profondeur statique, pas d'animation. Liseré néon surface sur RK. Halo `box-shadow` sémantique sur puces (vert/rouge), neutre sans halo. »

**`[BET-PRO-QUANT]`** : « Validé tant que le halo n'altère pas la lecture du caractère W/L. Halo derrière, opacité contenue. »

**`[ARCHI-DATA-ENG]`** : « Validé. Je recommande de conserver l'injection payload (rapide, déjà en place) et d'exposer EN PLUS `/api/v1/tennis/player-stats` en lecture seule pour debug/évolution, cache JSON disque 12h. »

---

## 3. Spécifications de l'innovation visuelle (par ligne)

### 3.1 Structure (2 sous-lignes, alignées Col3)

```
┌─ Col2 (Match) ───────────────────────┐   ┌─ Col3 (Scoreboard) ─┐
│  [Nom J1]   [● ● ●]  [RK n]           │ ⇄ │  Pts S1 S2 S3 Σ     │  ← ligne J1
│  [Nom J2]   [● ● ●]  [RK m]           │ ⇄ │  Pts S1 S2 S3 Σ     │  ← ligne J2
└──────────────────────────────────────┘   └─────────────────────┘
```

- Sous-ligne J1 = `<div>` ; sous-ligne J2 = `<div style="margin-top:3px;">` (gap = gap grille scoreboard).
- `white-space:nowrap` + `text-overflow:ellipsis` sur `.tvb-pname` pour garantir hauteur constante.

### 3.2 Nom du joueur

| Propriété | Valeur |
|-----------|--------|
| Couleur | `#e8eaed` (blanc) — `var(--text)` |
| Favori Elo | `#00e676` (classe `tvb-pfav` conservée) |
| Poids | 700 |

### 3.3 Badge RK — liseré néon thématique par surface

```css
.elo-rk {
  font-family:'DM Mono',monospace; font-size:9px; font-weight:600;
  color:var(--text2,#8d9399); background:rgba(255,255,255,.05);
  border:1px solid currentColor;            /* liseré = teinte surface */
  border-radius:5px; padding:1px 5px; opacity:.85; white-space:nowrap;
}
/* Liseré néon thématique injecté via classe surface */
.elo-rk.s-clay   { box-shadow:0 0 0 1px rgba(217,119,6,.55),  0 0 5px rgba(217,119,6,.35); }
.elo-rk.s-grass  { box-shadow:0 0 0 1px rgba(0,230,118,.55),  0 0 5px rgba(0,230,118,.30); }
.elo-rk.s-hard   { box-shadow:0 0 0 1px rgba(41,182,246,.55), 0 0 5px rgba(41,182,246,.30); }
.elo-rk.s-indoor { box-shadow:0 0 0 1px rgba(148,163,184,.55),0 0 5px rgba(148,163,184,.25); }
.elo-rk.elo-rk-na { opacity:.45; box-shadow:none; }   /* RK indisponible → neutre */
```

### 3.4 Puces de forme — halo rétro-éclairé `box-shadow`

```css
.tn-pip {
  width:16px; height:16px; border-radius:4px;
  font:800 9px/1 'DM Mono',monospace;
  display:inline-flex; align-items:center; justify-content:center;
}
.tn-pip-w  { color:#4ade80; background:rgba(74,222,128,.18);
             border:1px solid rgba(74,222,128,.45);
             box-shadow:0 0 6px rgba(74,222,128,.45); }     /* halo vert */
.tn-pip-l  { color:#ff4d4d; background:rgba(255,77,77,.16);
             border:1px solid rgba(255,77,77,.42);
             box-shadow:0 0 6px rgba(255,77,77,.40); }       /* halo rouge */
.tn-pip-na { color:var(--text3,#5a6068); background:transparent;
             border:1px solid var(--border); box-shadow:none; } /* neutre, pas de halo */
```

- Ordre des puces : **récent → ancien** (gauche = dernier match).
- Halo **statique** (aucune `@keyframes`). Respecte `prefers-reduced-motion` (rien à désactiver — pas d'animation).

---

## 4. Stratégie d'architecture réseau

### 4.1 Existant (déjà en place)

- Données 100 % locales : `tennis_elo` + `tennis_matches` (SQLite `pariscore.db`).
- Helper `getTennisSurfStats(name, tour, surface)` : rang surface (tri `elo DESC`, joueurs actifs ≤425j) + forme 3 derniers ≤90j même surface.
- Cache mémoire TTL 30 min (`_tennisSurfRankIdx`, `_tennisSurfFormCache`).
- Injection dans le payload `/api/v1/tennis/value-bets` (`player1/2.surf_rank`, `surf_rank_total`, `surf_form`).

### 4.2 Évolution proposée — route dédiée + cache disque 12h

```
GET /api/v1/tennis/player-stats?name=<...>&tour=ATP|WTA&surface=Clay|Hard|Grass|Carpet
→ { rk, total, form:["W","L","W"], cached_at, ttl_h:12 }
```

- Cache JSON disque `cache/tennis_player_stats.json`, validité **12h**, clé `name|tour|surface`.
- Lecture seule, aucun scrape déclenché par la requête (lit SQLite déjà syncé).
- Bénéfice : découplage, debug, réutilisable hors grille. Anti-ban IP garanti (zéro appel externe au runtime).
- Risque : duplication logique avec injection payload → **arbitrage requis** (cf. §6).

---

## 5. Matrice comparative AVANT / APRÈS

| Critère | AVANT (prod actuelle) | APRÈS (proposé) |
|---------|----------------------|------------------|
| Rang Elo | `RK n` badge plat gris | `RK n` + **liseré néon teinte surface** |
| Forme | 3 puces plates W/L/· | 3 puces + **halo `box-shadow` sémantique** |
| Nom joueur | Blanc 700 (inchangé) | Blanc 700 + `nowrap`/ellipsis (hauteur garantie) |
| Alignement Col3 | Approx. (hauteur variable possible) | **Au pixel** (sous-lignes hauteur fixe) |
| Source données | SQLite local, cache 30 min mémoire | Idem + route `/player-stats` cache disque 12h (option) |
| Animation | Aucune | Aucune (halo statique) — conforme cognitif |
| Charge cognitive | Plate, peu hiérarchisée | Hiérarchie Nom > Forme > RK |
| Surface→couleur | Non liée | **Cohérence Col1↔Col2↔Col3** |

---

## 6. Décisions d'arbitrage — ARRÊTÉES (DG, 2026-05-18)

| # | Point | Décision retenue | Conséquence spec |
|---|-------|------------------|------------------|
| 1 | Emplacement badge RK | **Après les puces** (statu quo) | Ordre ligne : Nom → 3 puces → `RK n` |
| 2 | Nombre de puces | **3** | `for i in 0..2` ; < 3 → puces neutres |
| 3 | Couleur Indoors | **Violet `#a78bfa`** (code actuel) — override brief | Liseré `.elo-rk.s-indoor` = `rgba(167,139,250,.55/.25)`. Charte confirmée : clay `#d97706`, grass `#00e676`, hard `#29b6f6`, indoor `#a78bfa` |
| 4 | Architecture | **Injection payload + route dédiée** | Garder injection `value-bets` (cache mém. 30 min) **ET** ajouter `GET /api/v1/tennis/player-stats` + cache JSON disque `cache/tennis_player_stats.json` TTL 12h, lecture seule |

### 6.1 Spec CSS finale verrouillée — liseré RK

```css
.elo-rk.s-clay   { box-shadow:0 0 0 1px rgba(217,119,6,.55),  0 0 5px rgba(217,119,6,.35); }
.elo-rk.s-grass  { box-shadow:0 0 0 1px rgba(0,230,118,.55),  0 0 5px rgba(0,230,118,.30); }
.elo-rk.s-hard   { box-shadow:0 0 0 1px rgba(41,182,246,.55), 0 0 5px rgba(41,182,246,.30); }
.elo-rk.s-indoor { box-shadow:0 0 0 1px rgba(167,139,250,.55),0 0 5px rgba(167,139,250,.25); }  /* violet — décision #3 */
.elo-rk.elo-rk-na{ opacity:.45; box-shadow:none; }
```

### 6.2 Spec route backend verrouillée (décision #4)

```
GET /api/v1/tennis/player-stats?name=<...>&tour=ATP|WTA&surface=Clay|Hard|Grass|Carpet
→ 200 { rk:int|null, total:int|null, form:["W","L","W"], cached_at:iso, ttl_h:12 }
```
- Persistance : `cache/tennis_player_stats.json`, clé `name|tour|surface`, TTL 12h.
- Lecture seule (lit `tennis_elo`/`tennis_matches` déjà syncés) — aucun scrape déclenché → anti-ban IP garanti.
- Coexiste avec l'injection payload `value-bets` (pas de suppression de l'existant).

---

*Arbitrages arrêtés. Specs verrouillées. **Implémentation conditionnée à un GO explicite du DG.***
