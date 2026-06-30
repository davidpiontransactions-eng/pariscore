# 🛡️ AUDIT DE PRÉ-PRODUCTION PARISCORE (ONGLET TENNIS)
**Statut Global :** ❌ **NO-GO : CORRECTIONS REQUISES** (1 bug critique bloquant, 5 majeurs)

**Date** : 2026-06-30 · **Cible** : `https://pariscore.fr` (VPS, commit `8e1d2a7`) · **Méthode** : 6 experts (3 agents parallèles + 3 inline), tests live sur prod.

---

## 1. 🐛 BUGS CRITIQUES (Bloquants)

### 🔴 C1 — `p1WinProb` blended → NaN cascade (Data Scientist)
**Sévérité** : CRITIQUE · **Fichier** : `pariscore.html:24904`
```
Code actuel : Number(m.predictions.blended)
Backend     : predictions.blended = objet {p1,p2}  (server.js:37671)
Résultat    : Number({p1:0.6}) = NaN
Cascade     : ev(NaN,odds)=NaN → kelly=NaN → tiers=avoid → gauge=NaN → 1-p1=NaN
```
**Déclencheur** : `predictions.elo` null ET `predictions.blended` présent → tout l'affichage pourri. Atténué en pratique (elo testé avant), mais crash latent.
**Fix** : `m.predictions.blended.p1` (pas `Number(blended)`).

### 🟠 C2 — Compression gzip/brotli ABSENTE (Réseau)
**Sévérité** : MAJEURE · **Preuve** : `curl -I pariscore.fr/pariscore.js` → pas de `Content-Encoding`.
- `pariscore.js` = 1.77 MB servi **non compressé** → ~400 KB avec gzip (−77%).
- `/tennis/live` = 283 KB non compressé (2.26s latence).
**Fix** : `gzip on; gzip_types application/javascript application/json;` dans nginx.

### 🟠 C3 — Live polling trop lent vs WS dispo (Betting Expert)
**Sévérité** : MAJEURE · **Fichiers** : `pariscore.js:5697, 8875`
- WS BSD pousse <5s (dispo) MAIS listes tennis = polling 5min / détail modal 30s.
- Momentum tennis bascule en 1 game (~30s) → pro perd le break avant re-render.
**Fix** : SSE push sur liste live tennis (pas juste foot), détail modal 30s→10s.

### 🟠 C4 — XSS potentiel : 57 onclick template literals (Dev)
**Sévérité** : MAJEURE · **Preuve** : `pariscore.js` contient 57 `onclick="${...}"`.
- Pattern historique connu cassant (audit précédent : escaping `&#39;` décodé par HTML parser).
- Vérifier si escaping actuel robuste (sinon `data-match-id` + event delegation).
**Fix** : migration `data-*` + `addEventListener` (déférable, pas bloquant immédiat).

### 🟠 C5 — Aucun teaser Value Bets freemium (Betting Expert)
**Sévérité** : MAJEURE (conversion) · `/api/v1/tennis/value-bets` = 403 pour non-Pro.
- Freemium voit onglet Value Bets **vide** (0 cotes via fallback top10) = zéro accroche.
- KPI "Paris Dispos" = `—` muet (après fix P2-2).
**Fix** : 2-3 cartes value bets floues + CTA "Passez Pro".

### 🟡 C6 — `liveCard` momentum fill CSS invalide (Data Scientist)
**Sévérité** : MODÉRÉE · **Fichier** : `pariscore.html:25221`
```
Math.min(50, p1Pct-50)  → si p1Pct<50 (score<0), retourne NÉGATIF
→ CSS left:-12% invalide → fill momentum mal positionné
```
**Fix** : `Math.max(0, Math.min(50, ...))`.

---

## 2. 🎨 ANOMALIES UI / UX & DESIGN

### P1 — 49 couleurs hardcodées hors charte
**Preuve live** : `#fbbf24`×29, `#0077ff`×19, `#FFD700`×1 dans HTML servi.
- Charte = Premium Dark `#00e676` accent. Ces couleurs = legacy tn2-* / inline styles.
- Bridge `--tn2-accent: var(--accent)` présent (atténue) mais inline styles bypass.

### P2 — Inline styles massifs dans renderers JS
Renderers TennisScope (`prematchCard`, `marketsList`, `addMatchSelector`) = styles inline `cssText` partout. Court-circuite design system, risque incohérence.

### P2 — Glicko-2 affiché comme rating brut (confusion conceptuelle)
`glicko2.p1_serve` (rating ~150-2500) affiché tel quel dans `metricRow` labelé "Glicko service" — suggère %. Commentaire code reconnait (l.25198) mais utilisateur confus. Pas un bug code.

### P3 — `projectedScore` arbitraire (pas de modèle)
`projectedScore(p1p, bestOf)` = bucketing hardcoded, pas Markov/Poisson. Proba match 0.65 → "2-0" faux mathématiquement. Pure cosmétique, risque confusion utilisateur.

### P4 — Clamp Elo asymétrique
L.24903: clamp `.02-.98` (elo direct) vs l.24909: clamp `.05-.95` (derivation). Même formule, bornes différentes. Mineur.

---

## 3. 📈 AMÉLIORATIONS TRADING & DATA

| # | Reco | Expert | Impact |
|---|------|--------|--------|
| T1 | **SSE push liste live tennis** (pas polling 5min) | Betting | Momentum temps réel, vital |
| T2 | **Badge âge cote** (rouge si >2min en live) | Betting | Confiance trader, killer feature |
| T3 | **Teaser value bets freemium** (2-3 cartes floues + CTA) | Betting | Conversion Pro |
| T4 | **Curseur fraction Kelly réglable** (0.05-0.25 def, Pro débloque 1.0) | Betting | Sizing trader-grade |
| T5 | **Tri default EV desc + watchlist persistante** | Betting | Fin scroll sur 387 matchs |
| D1 | **Fix blended bug** (`blended.p1` pas `Number(blended)`) | Data | Évite NaN cascade |
| D2 | **Calibration `projectedScore`** (Markov set-by-set) | Data | Scores projetés justes |
| D3 | **Harmoniser clamp Elo** (`.02-.98` partout) | Data | Cohérence |
| N1 | **Activer gzip nginx** | Réseau | −77% poids JS, latence /2 |
| N2 | **Strip champs inutiles payload top10** (99 fields pour 10 cards) | Réseau | Payload léger |

---

## 4. 💡 INNOVATIONS POST-PROD (V2)

1. **Compteur "X données masquées (Pro)"** sur chaque card freemium → montre valeur Pro au lieu de masquer.
2. **Empty state actif** : "Prochain live Wimbledon dans 12 min [activer alerte]" au lieu de "Aucun match".
3. **Tooltips courts** sur jargon (DR, King of Aces, Comeback ≥1 set) → recrue pas effrayée.
4. **Watchlist Edge persistante** (localStorage) → trader retrouve ses matchs.
5. **Alertes momentum push notification** quand break point / set changement.
6. **Cache HTTP long (1an) sur pariscore.js avec hash** (`?v=hash`) → re-download only on change.

---

## 5. 🛠️ PLAN D'ACTION IMMÉDIAT (To-Do)

### Fix 1 — C1 blended bug (BLOQUANT) — `pariscore.html:24904`
```js
// AVANT (bug) :
if(m.predictions.blended!=null) return clamp(Number(m.predictions.blended),0.02,0.98);
// APRÈS :
if(m.predictions.blended!=null){
  var bl=m.predictions.blended;
  var blv=(bl&&typeof bl==='object'&&bl.p1!=null)?Number(bl.p1):Number(bl);
  if(isFinite(blv)) return clamp(blv,0.02,0.98);
}
```

### Fix 2 — C6 momentum fill CSS — `pariscore.html:25221`
```js
// AVANT (bug) : Math.min(50,p1Pct-50)
// APRÈS : Math.max(0,Math.min(50,p1Pct-50))
```

### Fix 3 — C2 gzip nginx — config VPS `/etc/nginx/sites-available/pariscore`
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/javascript application/json image/svg+xml;
```
Puis `sudo nginx -t && sudo systemctl reload nginx`.

### Fix 4 — C5 teaser value bets freemium — `pariscore.html:25604` (renderActiveTab valuebets branch)
```js
// Non-Pro + 0 cotes → afficher teaser au lieu de vide
if(tab==='valuebets' && !withOdds && !userIsPro){
  pEl.innerHTML = '<div class="sc-vb-teaser">'+
    '<h3>🔒 Value Bets réservés Pro</h3>'+
    '<div class="sc-vb-blur">'+sampleCardsBlurred+'</div>'+
    '<button onclick="openPlanModal()">Débloquer +14 books, +EV edge</button>'+
    '</div>';
  return;
}
```

### Fix 5 — D3 clamp Elo harmonisé — `pariscore.html:24909, 24913`
```js
// AVANT : return clamp(1/(1+Math.pow(10,(b-a)/400)),0.05,0.95);
// APRÈS : return clamp(1/(1+Math.pow(10,(b-a)/400)),0.02,0.98);
```

---

## 📊 MATRICE DE COUVERTURE AUDIT

| Expert | Domaine | Verdict |
|---|---|---|
| 🎨 Design Director | UI/UX charte | 49 couleurs hors charte, inline styles, responsive OK |
| 🛠️ Lead Dev | Frontend/blindage | Shim OK, navbar-fix OK, guards OK, blended BUG, XSS 57 sites |
| 📐 Data Scientist | Math formules | blended BUG critique, momentum fill bug, projectedScore arbitraire |
| 🎯 Betting Expert | Trading UX | Polling lent, paywall muet, Kelly bridé, pas d'âge cote |
| 🌐 Lead Network | Perf/latence | gzip ABSENT, /live 283KB, cache 5min |
| 🏗️ CTO | Architecture | NO-GO (1 critique), fixable en ~2h |

## 🏗️ VERDICT CTO

**NO-GO conditionnel.** 1 bug critique (C1 blended NaN) bloquant + gzip absent (C2) = 2 fixes obligatoires avant prod. Reste = améliorations. Une fois C1+C2+C6 fixés (≈30min code + nginx), **GO PROD**. C3/C4/C5 = roadmap V2 court terme.

**Timeline GO-PROD réaliste** : 2h (fix blended + gzip + momentum fill + test).

---
*Rapport généré par comité d'experts (6 rôles) — skill caveman + web-performance, 2026-06-30.*
